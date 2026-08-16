"use client";

import { useCallback, useEffect, useState } from "react";
import type { BuscaPrecos, ItemEncontrado } from "@/lib/precosBusca";

type Varredura = {
  rodando: boolean;
  licitacoesVarridas: number;
  totalNoIndice: number;
  itensGuardados: number;
  aguardandoResultado: number;
  percentual: number;
  ultimaRodadaEm: number | null;
  erro: string | null;
};

type Historico = {
  rodando: boolean;
  mesesLidos: number;
  mesesAlvo: number;
  licitacoesEncontradas: number;
  comPrecoArrematado: number;
  paginasLidas: number;
  paginasComFalha: number;
  concluido: boolean;
  erro: string | null;
};

const UFS = ["", "SC", "PR", "RS", "SP", "MG", "GO", "MS", "MT"];

function dinheiro(valor: number | null): string {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function PrecosPage() {
  const [termo, setTermo] = useState("");
  const [uf, setUf] = useState("");
  const [meses, setMeses] = useState("");
  const [resultado, setResultado] = useState<BuscaPrecos | null>(null);
  const [varredura, setVarredura] = useState<Varredura | null>(null);
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [empurrando, setEmpurrando] = useState(false);

  const carregarStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/precos");
      if (!res.ok) throw new Error();
      const dados = await res.json();
      setVarredura(dados.varredura);
      setHistorico(dados.historico);
    } catch {
      // silencioso — a próxima atualização tenta de novo
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarStatus();
    const t = setInterval(carregarStatus, 20_000);
    return () => clearInterval(t);
  }, [carregarStatus]);

  async function buscar() {
    if (!termo.trim()) return;
    setBuscando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ termo });
      if (uf) params.set("uf", uf);
      if (meses) params.set("meses", meses);
      const res = await fetch(`/api/precos?${params}`);
      if (!res.ok) throw new Error();
      const dados = await res.json();
      setResultado(dados.resultado);
      setVarredura(dados.varredura);
      setHistorico(dados.historico);
    } catch {
      setErro("Não deu pra buscar.");
    } finally {
      setBuscando(false);
    }
  }

  async function empurrarVarredura() {
    setEmpurrando(true);
    try {
      await fetch("/api/precos/varredura", { method: "POST" });
      await carregarStatus();
    } finally {
      setEmpurrando(false);
    }
  }

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-bold text-neutral-900">
          Preços de referência e busca nos lotes
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Por quanto o item foi arrematado em licitações passadas — e quais
          licitações abertas têm ele em algum lote, mesmo que o título não diga.
        </p>
      </header>

      {/* -------------------------------------------------------- varredura -- */}
      {varredura && (
        <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
                Leitura dos lotes
              </div>
              <div className="mt-1 text-[13px] text-neutral-700">
                {varredura.licitacoesVarridas.toLocaleString("pt-BR")} de{" "}
                {varredura.totalNoIndice.toLocaleString("pt-BR")} licitações lidas ·{" "}
                <b className="font-semibold text-neutral-900">
                  {varredura.itensGuardados.toLocaleString("pt-BR")}
                </b>{" "}
                itens do ramo guardados
                {varredura.aguardandoResultado > 0 &&
                  ` · ${varredura.aguardandoResultado} esperando o órgão publicar o resultado`}
              </div>
            </div>
            <button
              onClick={empurrarVarredura}
              disabled={empurrando || varredura.rodando}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
            >
              {varredura.rodando
                ? "Lendo agora…"
                : empurrando
                  ? "Lendo…"
                  : "Ler mais agora"}
            </button>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="brand-gradient h-full rounded-full"
              style={{ width: `${Math.round(varredura.percentual * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[11.5px] text-neutral-500">
            A leitura anda devagar de propósito — o PNCP é um serviço público
            gratuito e cada licitação custa pelo menos uma consulta. Ela avança
            sozinha em segundo plano e continua de onde parou.
          </p>
          {varredura.erro && (
            <p className="mt-2 text-[12px] text-red-600">{varredura.erro}</p>
          )}
        </div>
      )}

      {/* -------------------------------------------------------- histórico -- */}
      {historico && (
        <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-4 shadow-sm">
          <div className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
            Histórico de preço arrematado
          </div>
          <div className="mt-1 text-[13px] text-neutral-700">
            {historico.concluido
              ? "12 meses varridos — histórico completo."
              : `${historico.mesesLidos} de ${historico.mesesAlvo} meses varridos`}
            {" · "}
            <b className="font-semibold text-neutral-900">
              {historico.comPrecoArrematado.toLocaleString("pt-BR")}
            </b>{" "}
            itens com preço homologado
            {historico.paginasComFalha > 0 &&
              ` · ${historico.paginasComFalha} página(s) o PNCP não entregou`}
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{
                width: `${Math.min(100, (historico.mesesLidos / historico.mesesAlvo) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-[11.5px] text-neutral-500">
            O órgão só publica o resultado semanas depois da sessão, então quase
            nada dentro dos 30 dias da busca normal tem preço. Esta parte vai
            buscar até 12 meses atrás, uma vez só, e depois para sozinha.
          </p>
          {historico.erro && (
            <p className="mt-2 text-[12px] text-red-600">{historico.erro}</p>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ busca -- */}
      <div className="flex flex-wrap gap-2">
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          placeholder="ex: saco lixo 100, copo descartável 200, papel toalha"
          className="min-w-[260px] flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <select
          value={uf}
          onChange={(e) => setUf(e.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          {UFS.map((u) => (
            <option key={u} value={u}>
              {u || "Todo o Brasil"}
            </option>
          ))}
        </select>
        <select
          value={meses}
          onChange={(e) => setMeses(e.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          <option value="">Qualquer data</option>
          <option value="3">Últimos 3 meses</option>
          <option value="6">Últimos 6 meses</option>
          <option value="12">Último ano</option>
        </select>
        <button
          onClick={buscar}
          disabled={buscando || !termo.trim()}
          className="brand-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {buscando ? "Buscando…" : "Buscar"}
        </button>
      </div>
      <p className="-mt-3 text-[11.5px] text-neutral-500">
        Todas as palavras que você digitar precisam aparecer na descrição do
        item. Menos palavras trazem mais resultados.
      </p>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* ------------------------------------------------------ estatística -- */}
      {resultado?.estatistica && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Menor arrematado", dinheiro(resultado.estatistica.menor)],
              ["Mediana", dinheiro(resultado.estatistica.mediana)],
              ["Maior arrematado", dinheiro(resultado.estatistica.maior)],
              [
                "Amostras",
                `${resultado.estatistica.amostras}${
                  resultado.estatistica.unidadeMaisComum
                    ? ` · ${resultado.estatistica.unidadeMaisComum}`
                    : ""
                }`,
              ],
            ] as Array<[string, string]>
          ).map(([rotulo, valor]) => (
            <div
              key={rotulo}
              className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-4 shadow-sm"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                {rotulo}
              </div>
              <div className="mt-1 text-lg font-bold text-neutral-900">{valor}</div>
            </div>
          ))}
          <p className="text-[11.5px] text-neutral-500 sm:col-span-2 lg:col-span-4">
            A mediana costuma valer mais que a média aqui: quando um órgão
            cadastra o preço por caixa e outro por unidade, a média vai pro
            espaço e a mediana aguenta. Confira a unidade antes de usar o número.
          </p>
        </div>
      )}

      {/* ------------------------------------------------ licitações abertas -- */}
      {resultado && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-neutral-900">
            Licitações abertas com esse item ({resultado.abertas.length})
          </h2>
          {resultado.abertas.length === 0 ? (
            <p className="text-[12.5px] text-neutral-500">
              Nenhuma licitação aberta com esse item entre as já lidas.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
              {resultado.abertas.map((item) => (
                <LinhaItem key={`${item.numeroControlePNCP}-${item.numeroItem}`} item={item} aberta />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------- arrematados -- */}
      {resultado && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-neutral-900">
            Preços já arrematados ({resultado.arrematados.length})
          </h2>
          {resultado.arrematados.length === 0 ? (
            <p className="text-[12.5px] text-neutral-500">
              Nenhum resultado publicado ainda para esse item. O órgão costuma
              levar alguns dias depois da sessão — a leitura volta nessas
              licitações sozinha depois de uma semana.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
              {resultado.arrematados.map((item) => (
                <LinhaItem
                  key={`${item.numeroControlePNCP}-${item.numeroItem}`}
                  item={item}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function LinhaItem({ item, aberta }: { item: ItemEncontrado; aberta?: boolean }) {
  return (
    <div className="border-b border-neutral-100 px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[240px] flex-1">
          <div className="text-[13px] font-medium text-neutral-900">
            {item.descricao}
          </div>
          <div className="mt-0.5 text-[11.5px] text-neutral-500">
            {item.orgao} · {item.municipio}/{item.uf} · {item.modalidade} · lote{" "}
            {item.numeroItem}
          </div>
          <div className="mt-0.5 text-[11.5px] text-neutral-500">
            {item.quantidade.toLocaleString("pt-BR")} {item.unidade}
            {aberta
              ? ` · fecha ${formatarData(item.dataEncerramentoProposta)}`
              : item.resultados[0]?.dataResultado
                ? ` · resultado ${formatarData(item.resultados[0].dataResultado)}`
                : ""}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {item.valorUnitarioEstimado != null && (
            <div className="text-[11.5px] text-neutral-500">
              estimado {dinheiro(item.valorUnitarioEstimado)}
            </div>
          )}
          {item.menorPreco != null ? (
            <>
              <div className="text-[15px] font-bold text-emerald-700">
                {dinheiro(item.menorPreco)}
              </div>
              {item.descontoSobreEstimado != null && (
                <div className="text-[11px] text-neutral-500">
                  {item.descontoSobreEstimado >= 0 ? "−" : "+"}
                  {Math.abs(Math.round(item.descontoSobreEstimado * 100))}% do
                  estimado
                </div>
              )}
              {item.vencedor && (
                <div className="max-w-[220px] truncate text-[11px] text-neutral-500">
                  {item.vencedor}
                </div>
              )}
            </>
          ) : (
            <div className="text-[12px] text-neutral-400">sem resultado</div>
          )}
        </div>

        <a
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 self-center rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Abrir
        </a>
      </div>
    </div>
  );
}
