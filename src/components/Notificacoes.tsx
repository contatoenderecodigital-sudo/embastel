"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Notificacao = {
  id: string;
  tipo: "licitacao_nova" | "licitacao_prazo" | "whatsapp" | "estoque" | "sistema";
  titulo: string;
  texto: string;
  href: string;
  criadoEm: number;
  lida: boolean;
};

const ICONE: Record<Notificacao["tipo"], string> = {
  licitacao_nova: "★",
  licitacao_prazo: "⏱",
  whatsapp: "●",
  estoque: "!",
  sistema: "i",
};

const COR: Record<Notificacao["tipo"], string> = {
  licitacao_nova: "bg-emerald-100 text-emerald-700",
  licitacao_prazo: "bg-amber-100 text-amber-700",
  whatsapp: "bg-red-100 text-red-600",
  estoque: "bg-rose-100 text-rose-600",
  sistema: "bg-neutral-100 text-neutral-600",
};

const TITULO_BASE = "Embastel · Painel";

function tempoRelativo(ts: number): string {
  const minutos = Math.floor((Date.now() - ts) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h`;
  return `${Math.floor(horas / 24)}d`;
}

/**
 * Toca um bipe curto usando a Web Audio API. De propósito não usa arquivo de
 * som: evita adicionar binário ao projeto e funciona offline.
 */
function tocarBipe() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const agora = ctx.currentTime;

    // Duas notas curtas — som de "aviso", não de erro.
    for (const [i, freq] of [880, 1174].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const inicio = agora + i * 0.14;
      gain.gain.setValueAtTime(0.0001, inicio);
      gain.gain.exponentialRampToValueAtTime(0.18, inicio + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.13);
      osc.connect(gain).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.15);
    }
    setTimeout(() => void ctx.close(), 700);
  } catch {
    // Navegador bloqueou áudio sem interação — o aviso visual continua valendo.
  }
}

export default function Notificacoes() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [permissao, setPermissao] = useState<NotificationPermission | "indisponivel">(
    "indisponivel"
  );

  // Ids já vistos por esta aba. Serve pra tocar o som só quando chega algo
  // novo de verdade, e não a cada atualização de 15 em 15 segundos.
  const jaVistos = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermissao(Notification.permission);
  }, []);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/notificacoes");
      if (!res.ok) return;
      const data = (await res.json()) as { notificacoes: Notificacao[] };
      const lista = data.notificacoes ?? [];
      setNotificacoes(lista);

      const naoLidas = lista.filter((n) => !n.lida);

      if (jaVistos.current === null) {
        // Primeira carga da aba: só registra o que já existe, sem alarde —
        // ninguém quer ser recebido por cinco bipes ao abrir o painel.
        jaVistos.current = new Set(lista.map((n) => n.id));
        return;
      }

      const novas = naoLidas.filter((n) => !jaVistos.current!.has(n.id));
      for (const n of lista) jaVistos.current.add(n.id);
      if (!novas.length) return;

      tocarBipe();
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const n of novas.slice(0, 3)) {
          const notificacao = new Notification(n.titulo, {
            body: n.texto,
            tag: n.id,
            icon: "/logo-embastel.png",
          });
          notificacao.onclick = () => {
            window.focus();
            window.location.href = n.href;
          };
        }
      }
    } catch {
      // silencioso: a próxima rodada tenta de novo
    }
  }, []);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 15000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  const naoLidas = notificacoes.filter((n) => !n.lida);

  // Contador no título da aba — é o que faz o aviso aparecer mesmo com o
  // painel numa aba de fundo.
  useEffect(() => {
    document.title = naoLidas.length ? `(${naoLidas.length}) ${TITULO_BASE}` : TITULO_BASE;
  }, [naoLidas.length]);

  async function acao(acao: "marcar_lida" | "marcar_todas" | "limpar_lidas", id?: string) {
    const res = await fetch("/api/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao, id }),
    });
    if (res.ok) {
      const data = (await res.json()) as { notificacoes: Notificacao[] };
      setNotificacoes(data.notificacoes ?? []);
    }
  }

  async function pedirPermissao() {
    if (typeof Notification === "undefined") return;
    const resultado = await Notification.requestPermission();
    setPermissao(resultado);
    if (resultado === "granted") {
      tocarBipe();
      new Notification("Avisos ligados", {
        body: "A partir de agora o painel avisa aqui, mesmo em outra aba.",
        icon: "/logo-embastel.png",
      });
    }
  }

  return (
    <div className="fixed right-6 top-5 z-50">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label={`Notificações${naoLidas.length ? ` (${naoLidas.length} não lidas)` : ""}`}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200/80 bg-white shadow-md shadow-neutral-300/40 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      >
        <svg
          className="h-[19px] w-[19px] text-neutral-700"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M10 2.5a5 5 0 0 0-5 5v3l-1.5 3h13L15 10.5v-3a5 5 0 0 0-5-5zM8 16.5a2 2 0 0 0 4 0" />
        </svg>
        {naoLidas.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10.5px] font-extrabold text-white shadow-sm shadow-red-900/40">
            {naoLidas.length > 99 ? "99+" : naoLidas.length}
          </span>
        )}
        {naoLidas.length > 0 && (
          <span className="absolute inline-flex h-11 w-11 animate-ping rounded-full bg-red-400/20" />
        )}
      </button>

      {aberto && (
        <>
          {/* clique fora fecha */}
          <button
            className="fixed inset-0 -z-10 cursor-default"
            aria-label="Fechar notificações"
            onClick={() => setAberto(false)}
          />
          <div className="absolute right-0 top-13 mt-2 w-[360px] overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-2xl shadow-neutral-400/25">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <span className="text-[13px] font-bold text-neutral-900">
                Avisos {naoLidas.length > 0 && `(${naoLidas.length})`}
              </span>
              <div className="flex gap-3 text-[11.5px] font-medium">
                {naoLidas.length > 0 && (
                  <button
                    onClick={() => acao("marcar_todas")}
                    className="text-brand hover:underline"
                  >
                    Marcar tudo como lido
                  </button>
                )}
                {notificacoes.length > naoLidas.length && (
                  <button
                    onClick={() => acao("limpar_lidas")}
                    className="text-neutral-400 hover:text-neutral-700"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {permissao === "default" && (
              <button
                onClick={pedirPermissao}
                className="flex w-full items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-left text-[11.5px] text-amber-800 hover:bg-amber-100"
              >
                <span className="text-sm">🔔</span>
                <span>
                  <b className="font-semibold">Ativar avisos no computador</b> — pra ser
                  avisado mesmo com o painel em outra aba.
                </span>
              </button>
            )}

            <div className="max-h-[420px] overflow-y-auto">
              {notificacoes.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12.5px] text-neutral-400">
                  Nenhum aviso por enquanto.
                </p>
              ) : (
                notificacoes.map((n) => (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => {
                      void acao("marcar_lida", n.id);
                      setAberto(false);
                    }}
                    className={`flex gap-3 border-b border-neutral-50 px-4 py-3 transition-colors hover:bg-neutral-50 ${
                      n.lida ? "opacity-55" : ""
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${COR[n.tipo]}`}
                    >
                      {ICONE[n.tipo]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[12.5px] font-semibold leading-snug text-neutral-900">
                          {n.titulo}
                        </span>
                        <span className="shrink-0 text-[10.5px] text-neutral-400">
                          {tempoRelativo(n.criadoEm)}
                        </span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-relaxed text-neutral-500">
                        {n.texto}
                      </span>
                    </span>
                    {!n.lida && (
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
