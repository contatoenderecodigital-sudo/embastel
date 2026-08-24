"use client";

import { useCallback, useEffect, useState } from "react";
import type { EstadoDeploy } from "@/lib/deployDb";

// O aviso de "tem código pronto que não está no ar", com o botão de publicar.
//
// Fica no topo do painel e SOME quando não há nada pendente — aviso que aparece
// sempre vira parte do cenário e ninguém lê. Ele existe porque um trabalho já
// ficou quatro dias no GitHub sem ir pro ar: estava pronto, testado, e ninguém
// sabia (ver deployDb.ts).

function tempoDesde(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

export default function AvisoPublicar() {
  const [estado, setEstado] = useState<EstadoDeploy | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [verLog, setVerLog] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/deploy");
      if (!res.ok) return;
      setEstado(await res.json());
    } catch {
      // Silencioso: é um aviso auxiliar, não pode atrapalhar o resto da tela.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  // Enquanto publica, pergunta de perto pra acompanhar; parado, de longe.
  // Durante o deploy o servidor reinicia e algumas respostas falham — o
  // intervalo curto é o que faz a tela se recuperar sozinha quando ele volta.
  useEffect(() => {
    const intervalo = setInterval(carregar, estado?.rodando ? 4000 : 60000);
    return () => clearInterval(intervalo);
  }, [carregar, estado?.rodando]);

  async function publicar() {
    if (!confirm("Publicar agora? O painel que a loja usa vai ser atualizado.")) return;

    setErro(null);
    try {
      const res = await fetch("/api/deploy", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setErro(d.error ?? "Não deu pra publicar.");
        return;
      }
      setEstado(d.estado);
      setVerLog(true);
    } catch {
      setErro("Não deu pra publicar.");
    }
  }

  if (!estado) return null;

  const pendentes = estado.pendentes.length;

  // A barra fica SEMPRE visível, mesmo sem nada pendente.
  //
  // A primeira versão sumia quando estava tudo publicado — e a primeira coisa
  // que perguntaram foi "e onde fica o botão?". Botão que só existe no momento
  // em que é necessário é botão que ninguém sabe que existe, e a pessoa não
  // aprende o caminho. Sem pendência ela fica discreta, cinza, dizendo o que
  // está no ar; com pendência ela fica amarela e chama.
  //
  // Publicar sem nada pendente continua valendo: recompila o mesmo commit, que
  // é o que se quer quando o painel fica estranho.
  const terminouAgora =
    !estado.rodando && estado.ultimoOk !== null && estado.resultadoRecente;

  const emDia = pendentes === 0 && !estado.rodando && !terminouAgora;

  return (
    <div
      className={`rounded-2xl border shadow-sm ${
        emDia ? "px-5 py-3" : "px-5 py-4"
      } ${
        emDia
          ? "border-neutral-200 bg-white"
          : estado.rodando
            ? "border-amber-300 bg-amber-50"
            : terminouAgora && !estado.ultimoOk
              ? "border-red-300 bg-red-50"
              : terminouAgora
                ? "border-emerald-300 bg-emerald-50"
                : "border-amber-300 bg-amber-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[240px] flex-1">
          {estado.rodando ? (
            <div className="text-sm font-semibold text-amber-900">
              Publicando… o painel reinicia em alguns segundos.
            </div>
          ) : terminouAgora ? (
            <div
              className={`text-sm font-semibold ${
                estado.ultimoOk ? "text-emerald-800" : "text-red-800"
              }`}
            >
              {estado.ultimoOk
                ? "Publicado. O que estava pendente já está no ar."
                : "A publicação falhou — o painel continua na versão anterior."}
            </div>
          ) : emDia ? (
            <div className="text-[13px] font-semibold text-neutral-700">
              Tudo publicado — o que está no GitHub já está no ar
            </div>
          ) : (
            <div className="text-sm font-semibold text-amber-900">
              {pendentes === 1
                ? "1 alteração pronta que ainda não está no ar"
                : `${pendentes} alterações prontas que ainda não estão no ar`}
            </div>
          )}

          {pendentes > 0 && !estado.rodando && (
            <ul className="mt-1.5 space-y-0.5">
              {estado.pendentes.slice(0, 5).map((c) => (
                <li key={c.hash} className="text-[12px] text-amber-900/80">
                  <b className="font-semibold">{c.autor}</b> · {c.assunto}{" "}
                  <span className="text-amber-900/60">{tempoDesde(c.quando)}</span>
                </li>
              ))}
              {pendentes > 5 && (
                <li className="text-[12px] text-amber-900/60">
                  e mais {pendentes - 5}…
                </li>
              )}
            </ul>
          )}

          {estado.noAr && (
            <div className={`text-[11.5px] text-neutral-500 ${emDia ? "mt-0.5" : "mt-1.5"}`}>
              No ar agora: {estado.noAr.assunto} ({estado.noAr.hash})
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {(estado.rodando || terminouAgora) && estado.log && (
            <button
              onClick={() => setVerLog(!verLog)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {verLog ? "Esconder detalhes" : "Ver detalhes"}
            </button>
          )}
          {!estado.rodando && estado.podePublicar && (
            <button
              onClick={publicar}
              className={
                pendentes > 0
                  ? "brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm"
                  : "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-50"
              }
            >
              {pendentes > 0 ? "Publicar agora" : "Publicar de novo"}
            </button>
          )}
        </div>
      </div>

      {!estado.podePublicar && pendentes > 0 && (
        <p className="mt-2 text-[11.5px] text-neutral-500">{estado.motivo}</p>
      )}

      {erro && <p className="mt-2 text-[12px] font-medium text-red-700">{erro}</p>}

      {verLog && estado.log && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-neutral-900 px-3 py-2 text-[11px] leading-relaxed text-neutral-200">
          {estado.log}
        </pre>
      )}
    </div>
  );
}
