"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ItemDaLista, Proposta } from "@/lib/casarProdutos";
import type { DisputaCalculada, LoteCalculado } from "@/lib/disputaDb";
import type { Sugestao } from "@/lib/cotacoesDb";

type LicitacaoDaLista = {
  numeroControlePNCP: string;
  objeto: string;
  orgao: string;
  municipio: string;
  uf: string;
  status: string;
  valorEstimado: number | null;
  dataEncerramentoProposta: string | null;
  link: string;
  lotes: number;
  cotados: number;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/**
 * Lê número digitado do jeito brasileiro.
 *
 * Se tem vírgula, ela é o decimal e o ponto é separador de milhar
 * ("1.234,56"). Se não tem, o ponto é o decimal ("13.33") — quem digita rápido
 * usa o ponto do teclado numérico, e apagar esse ponto transformaria 13.33 em
 * 1333, um erro de cem vezes bem no meio de um lance.
 */
function paraNumero(texto: string): number {
  const t = (texto ?? "").trim();
  if (!t) return 0;
  const limpo = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : t.replace(/,/g, "");
  const n = Number(limpo.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

type Ordem = { campo: string; desc: boolean } | null;

/**
 * Cabeçalho clicável que ordena a tabela.
 *
 * Fica fora do componente da página de propósito: definido lá dentro, ele era
 * recriado a cada render e o React remontava a coluna inteira em vez de só
 * atualizar — o eslint acusa isso (react-hooks/static-components), e o efeito
 * prático é o input da linha perder o foco enquanto se digita.
 */
function Cabecalho({
  campo,
  ordem,
  aoOrdenar,
  children,
  className = "",
}: {
  campo: string;
  ordem: Ordem;
  aoOrdenar: (campo: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ativa = ordem?.campo === campo;
  return (
    <th className={className}>
      <button
        onClick={() => aoOrdenar(campo)}
        className={`flex w-full items-center gap-0.5 whitespace-nowrap hover:text-brand ${
          className.includes("text-right") ? "justify-end" : ""
        } ${ativa ? "text-brand" : ""}`}
      >
        {children}
        <span className={ativa ? "" : "opacity-25"}>
          {ativa && !ordem.desc ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

export default function DisputaPage() {
  const [licitacoes, setLicitacoes] = useState<LicitacaoDaLista[] | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [disputa, setDisputa] = useState<DisputaCalculada | null>(null);
  // Quem já cotou cada produto antes, por lote sem custo. Vem do histórico de
  // cotações, então a cotação feita num edital serve no próximo.
  const [sugestoes, setSugestoes] = useState<Record<string, Sugestao[]>>({});
  const [carregandoDisputa, setCarregandoDisputa] = useState(false);
  const [modoPregao, setModoPregao] = useState(false);
  const [busca, setBusca] = useState("");
  const [soCotados, setSoCotados] = useState(false);
  // Ordenação por coluna. Clicar no cabeçalho alterna crescente/decrescente;
  // clicar numa coluna nova começa pela ordem que interessa nela (piso e folga
  // do maior pro menor, porque é onde está o dinheiro).
  const [ordem, setOrdem] = useState<Ordem>(null);
  // Frete, imposto, margem e empate ficam escondidos por padrão. São quatro
  // colunas que quase nunca mudam por lote (imposto e margem vêm do padrão do
  // edital), e empurravam Piso, Fatura e Lucro pra fora da tela — a tabela
  // rolava pro lado e a pessoa perdia de vista qual produto era cada linha.
  const [mostrarCalculo, setMostrarCalculo] = useState(false);
  // Qual lote está com a conta aberta. Clicar no piso abre uma linha embaixo
  // com a aritmética inteira. Ficava só no title do mouse, e "como ele fez o
  // cálculo?" foi a primeira pergunta de quem usa — passar o mouse é gesto que
  // ninguém descobre sozinho, e no celular nem existe.
  const [contaAberta, setContaAberta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  // Colar a lista do fornecedor. As propostas ficam aqui até alguém confirmar:
  // preço errado num lote é dinheiro perdido no pregão, então nada é gravado
  // sem passar por um olho humano.
  const [colando, setColando] = useState(false);
  const [textoLista, setTextoLista] = useState("");
  const [fornecedorLista, setFornecedorLista] = useState("");
  const [propostas, setPropostas] = useState<Proposta[] | null>(null);
  const [semPar, setSemPar] = useState<ItemDaLista[]>([]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/disputa")
      .then((r) => r.json())
      .then((d) => setLicitacoes(d.licitacoes ?? []))
      .catch(() => setErro("Não deu pra carregar as licitações do funil."));
  }, []);

  const carregarDisputa = useCallback(async (numero: string) => {
    setCarregandoDisputa(true);
    try {
      const res = await fetch(`/api/disputa/${encodeURIComponent(numero)}`);
      const d = await res.json();
      setDisputa(d.disputa);
      setSugestoes(d.sugestoes ?? {});
    } catch {
      setErro("Não deu pra carregar a planilha.");
    } finally {
      setCarregandoDisputa(false);
    }
  }, []);

  function abrir(numero: string) {
    setEscolhida(numero);
    setDisputa(null);
    setErro(null);
    setAviso(null);
    setBusca("");
    carregarDisputa(numero);
  }

  async function chamar(metodo: string, corpo?: unknown, query = "") {
    if (!escolhida) return;
    const res = await fetch(
      `/api/disputa/${encodeURIComponent(escolhida)}${query}`,
      {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      }
    );
    const d = await res.json();
    if (!res.ok) {
      setErro(d.error ?? "Não deu pra salvar.");
      return null;
    }
    if (d.disputa) {
      setDisputa(d.disputa);
      // O histórico muda a cada custo preenchido; recarrega pra sugestão do
      // lote de baixo já refletir o que acabou de ser gravado.
      fetch(`/api/disputa/${encodeURIComponent(escolhida)}`)
        .then((r) => r.json())
        .then((x) => setSugestoes(x.sugestoes ?? {}))
        .catch(() => {});
    }
    return d;
  }

  async function importar() {
    setImportando(true);
    setErro(null);
    setAviso(null);
    const d = await chamar("POST", { acao: "importar-do-pncp" });
    setImportando(false);
    if (!d) return;
    setAviso(
      d.importados
        ? `${d.importados} lote(s) vieram do edital.${
            d.jaExistiam ? ` ${d.jaExistiam} já estavam aqui.` : ""
          } Agora é só preencher o custo que o fornecedor cotou.`
        : "O PNCP não devolveu nenhum lote novo pra este edital."
    );
  }

  const salvarLote = (loteId: string, campo: string, valor: unknown) =>
    chamar("PATCH", { loteId, [campo]: valor });

  async function procurarNaLista() {
    setErro(null);
    setAviso(null);
    const d = await chamar("POST", { acao: "casar-lista", texto: textoLista });
    if (!d) return;
    setPropostas(d.propostas);
    setSemPar(d.semPar);
    // Vem tudo marcado: o normal é a lista estar certa, e desmarcar o que
    // destoa dá menos trabalho que marcar um por um.
    setMarcadas(new Set(d.propostas.map((p: Proposta) => p.loteId)));
    if (d.propostas.length === 0) {
      setAviso(
        `Li ${d.lidos} item(ns) da lista, mas nenhum bateu com os lotes deste edital.`
      );
    }
  }

  async function aplicarLista() {
    if (!propostas) return;
    const aplicar = propostas
      .filter((p) => marcadas.has(p.loteId))
      .map((p) => ({ loteId: p.loteId, preco: p.item.preco }));
    if (aplicar.length === 0) return;
    const d = await chamar("POST", {
      acao: "aplicar-lista",
      fornecedor: fornecedorLista,
      aplicar,
    });
    if (!d) return;
    setAviso(`${d.aplicados} lote(s) com o custo preenchido.`);
    setPropostas(null);
    setSemPar([]);
    setColando(false);
    setTextoLista("");
  }

  const lotesVisiveis = useMemo(() => {
    if (!disputa) return [];
    const termo = busca.trim().toLowerCase();
    const filtrados = disputa.lotes.filter((l) => {
      if (l.descartado) return false;
      if (soCotados && l.custoUnitario <= 0) return false;
      if (!termo) return true;
      return (
        l.numero.toLowerCase().includes(termo) ||
        l.descricao.toLowerCase().includes(termo) ||
        l.fornecedor.toLowerCase().includes(termo) ||
        l.marca.toLowerCase().includes(termo)
      );
    });

    if (!ordem) {
      // Sem ordenação escolhida vale a ordem do edital, que é como a sala de
      // disputa chama os lotes.
      return filtrados.sort(
        (a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0)
      );
    }

    const valor = (l: LoteCalculado): number | string => {
      switch (ordem.campo) {
        case "numero": return Number(l.numero) || 0;
        case "descricao": return l.descricao;
        case "quantidade": return l.quantidade;
        case "fornecedor": return l.fornecedor;
        case "marca": return l.marca;
        case "custo": return l.custoUnitario;
        case "frete": return l.freteTotal;
        case "imposto": return l.percentualImpostos;
        case "margem": return l.margemAlvo;
        case "referencia": return l.referenciaUnitaria ?? -1;
        // Lote sem custo não tem piso de verdade: manda pro fim nas duas
        // direções em vez de fingir que o piso é zero e liderar a lista.
        case "piso": return l.custoUnitario > 0 ? l.pisoUnitario : (ordem.desc ? -1 : Infinity);
        case "empate": return l.custoUnitario > 0 ? l.empateUnitario : (ordem.desc ? -1 : Infinity);
        case "folga": return l.folgaPercentual ?? (ordem.desc ? -Infinity : Infinity);
        case "lance": return l.meuLance ?? -1;
        case "faturamento": return l.vale ? l.faturamentoPrevisto : -1;
        case "lucro": return l.vale ? l.lucroPrevisto : -1;
        default: return 0;
      }
    };

    return filtrados.sort((a, b) => {
      const va = valor(a), vb = valor(b);
      const cmp =
        typeof va === "string" || typeof vb === "string"
          ? String(va).localeCompare(String(vb), "pt-BR")
          : va - vb;
      return ordem.desc ? -cmp : cmp;
    });
  }, [disputa, busca, soCotados, ordem]);

  // Piso, folga, quantidade e referência começam do maior — é o que se procura
  // quando se clica neles. Texto começa de A a Z.
  const COMECA_DECRESCENTE = new Set([
    "quantidade", "referencia", "piso", "empate", "folga", "custo", "lance",
    "faturamento", "lucro",
  ]);

  function ordenarPor(campo: string) {
    setOrdem((atual) =>
      atual?.campo === campo
        ? { campo, desc: !atual.desc }
        : { campo, desc: COMECA_DECRESCENTE.has(campo) }
    );
  }


  const numInput =
    "w-full rounded border border-neutral-300 px-1.5 py-1 text-right text-[12px] tabular-nums outline-none focus:border-brand";

  // ------------------------------------------------- escolher a licitação --
  if (!escolhida) {
    return (
      <div className="space-y-5 p-6 md:p-8">
        <header>
          <h1 className="text-2xl font-bold text-neutral-900">Disputa</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Até quanto dá pra baixar em cada lote. Os lotes vêm do próprio
            edital — você só preenche o custo que o fornecedor cotou pra aquela
            quantidade, e o painel calcula o piso pra você olhar durante o
            pregão.
          </p>
        </header>

        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {!licitacoes ? (
          <div className="text-sm text-neutral-500">Carregando…</div>
        ) : licitacoes.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-neutral-700">
              Nenhuma licitação no seu funil ainda.
            </p>
            <p className="mt-1 text-[12.5px] text-neutral-500">
              Vá em <b>Licitações</b>, clique em <b>+ Acompanhar</b> na que te
              interessa, e ela aparece aqui pra montar a planilha.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {licitacoes.map((l) => (
              <button
                key={l.numeroControlePNCP}
                onClick={() => abrir(l.numeroControlePNCP)}
                className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-4 text-left shadow-sm transition-colors hover:border-brand/50 hover:bg-neutral-50/60"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[220px] flex-1">
                    <div className="text-[13.5px] font-semibold text-neutral-900">
                      {l.orgao}
                    </div>
                    <div className="text-[11.5px] text-neutral-500">
                      {l.municipio}/{l.uf}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] text-neutral-600">
                      {l.objeto}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {l.lotes > 0 ? (
                      <>
                        <div className="text-[13px] font-bold text-neutral-900">
                          {l.cotados}/{l.lotes}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          lotes cotados
                        </div>
                      </>
                    ) : (
                      <div className="rounded-lg bg-neutral-100 px-2.5 py-1 text-[11.5px] font-medium text-neutral-600">
                        montar planilha
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------- a planilha ----
  const t = disputa?.totais;

  return (
    <div className="space-y-4 p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            setEscolhida(null);
            setDisputa(null);
            setModoPregao(false);
          }}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-50"
        >
          ← Outras licitações
        </button>
        <h1 className="text-lg font-bold text-neutral-900">
          {licitacoes?.find((l) => l.numeroControlePNCP === escolhida)?.orgao ??
            "Disputa"}
        </h1>
        <button
          onClick={() => setModoPregao(!modoPregao)}
          className={`ml-auto rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ${
            modoPregao
              ? "brand-gradient text-white"
              : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          {modoPregao ? "Sair do modo pregão" : "Modo pregão"}
        </button>
      </div>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}
      {aviso && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {aviso}
        </div>
      )}

      {carregandoDisputa && !disputa ? (
        <div className="text-sm text-neutral-500">Carregando planilha…</div>
      ) : !disputa ? null : disputa.lotes.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-neutral-700">
            A planilha está vazia.
          </p>
          <p className="mx-auto mt-1 max-w-lg text-[12.5px] text-neutral-500">
            Traga os lotes do edital: número, descrição, quantidade e preço de
            referência vêm prontos do PNCP. Você só preenche o custo.
          </p>
          <button
            onClick={importar}
            disabled={importando}
            className="brand-gradient mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          >
            {importando ? "Buscando no PNCP…" : "Trazer os lotes do edital"}
          </button>
          <button
            onClick={() => chamar("POST", { numero: "", descricao: "" })}
            className="ml-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Adicionar lote na mão
          </button>
        </div>
      ) : (
        <>
          {/* ------------------------------------------------------ resumo -- */}
          {t && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  r: "Cotados",
                  v: `${t.cotados}/${t.lotes}`,
                  a: `${t.semCusto} lote(s) sem custo ainda`,
                },
                {
                  r: "Fecham",
                  v: String(t.valem),
                  a: t.naoFecham
                    ? `${t.naoFecham} cotado(s) dão prejuízo`
                    : "nenhum dá prejuízo",
                },
                {
                  r: "Faturamento",
                  v: brl(t.faturamentoPrevisto),
                  a: "só os lotes que fecham",
                },
                {
                  r: "Lucro",
                  v: brl(t.lucroPrevisto),
                  a: `no piso sobra ${brl(t.lucroNoPiso)}`,
                  forte: true,
                },
              ].map((c) => (
                <div
                  key={c.r}
                  className={`rounded-2xl border px-4 py-3 shadow-sm ${
                    c.forte
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-neutral-200/70 bg-white"
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    {c.r}
                  </div>
                  <div className="text-xl font-bold tabular-nums text-neutral-900">
                    {c.v}
                  </div>
                  <div className="text-[11px] text-neutral-500">{c.a}</div>
                </div>
              ))}
            </div>
          )}

          {t && t.abaixoDoPiso > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {t.abaixoDoPiso} lote(s) com lance abaixo do piso — nesses o
              contrato dá prejuízo.
            </div>
          )}

          {/* ------------------------------------------------ barra de ação -- */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Achar lote pelo número ou descrição"
              className="min-w-[220px] flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              onClick={() => setSoCotados(!soCotados)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium ${
                soCotados
                  ? "brand-gradient text-white shadow-sm"
                  : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              Só os que já tenho custo
            </button>

            {!modoPregao && (
              <>
                <button
                  onClick={() => setMostrarCalculo(!mostrarCalculo)}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium ${
                    mostrarCalculo
                      ? "brand-gradient text-white shadow-sm"
                      : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  Imposto e margem
                </button>
                <label className="flex items-center gap-1.5 text-[12px] text-neutral-600">
                  Imposto padrão
                  <input
                    defaultValue={String(disputa.impostoPadrao)}
                    onBlur={(e) =>
                      chamar("PATCH", { impostoPadrao: paraNumero(e.target.value) })
                    }
                    className="w-16 rounded border border-neutral-300 px-1.5 py-1 text-right text-[12px] tabular-nums outline-none focus:border-brand"
                  />
                  %
                </label>
                <label className="flex items-center gap-1.5 text-[12px] text-neutral-600">
                  Margem padrão
                  <input
                    defaultValue={String(disputa.margemPadrao)}
                    onBlur={(e) =>
                      chamar("PATCH", { margemPadrao: paraNumero(e.target.value) })
                    }
                    className="w-16 rounded border border-neutral-300 px-1.5 py-1 text-right text-[12px] tabular-nums outline-none focus:border-brand"
                  />
                  %
                </label>
                <button
                  onClick={() => chamar("POST", { acao: "reaplicar-padroes" })}
                  title="Aplica o imposto e a margem acima em todos os lotes"
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Aplicar em todos
                </button>
                <button
                  onClick={importar}
                  disabled={importando}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                >
                  {importando ? "Buscando…" : "Buscar lotes de novo"}
                </button>
                <button
                  onClick={() => {
                    setColando(!colando);
                    setPropostas(null);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${
                    colando
                      ? "brand-gradient text-white shadow-sm"
                      : "border border-brand/40 bg-brand/5 text-brand hover:bg-brand/10"
                  }`}
                >
                  Colar lista do fornecedor
                </button>
              </>
            )}
          </div>

          {/* ------------------------------------ colar a lista do fornecedor */}
          {colando && !modoPregao && (
            <div className="space-y-3 rounded-2xl border-2 border-brand/40 bg-white p-5 shadow-md">
              <div className="text-sm font-semibold text-neutral-900">
                Cole a lista que o fornecedor mandou
              </div>
              <p className="text-[12px] text-neutral-500">
                Um item por linha, com o preço no fim — como vem do WhatsApp ou
                colado do Excel. O painel acha sozinho com que lote cada um se
                parece; nada é gravado sem você confirmar.
              </p>

              <div className="flex flex-wrap gap-2">
                <input
                  value={fornecedorLista}
                  onChange={(e) => setFornecedorLista(e.target.value)}
                  placeholder="Nome do fornecedor (vai junto nos lotes)"
                  className="min-w-[220px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>

              <textarea
                value={textoLista}
                onChange={(e) => setTextoLista(e.target.value)}
                rows={7}
                placeholder={
                  "7922 - Acendedor Lume (200)   6,99\n8913 - Bacia 12lts c/ alça   7,49\nÁlcool 70 1 litro   5,00"
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-[12px] outline-none focus:border-brand"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={procurarNaLista}
                  disabled={!textoLista.trim()}
                  className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                >
                  Procurar nos lotes
                </button>
                <button
                  onClick={() => {
                    setColando(false);
                    setPropostas(null);
                  }}
                  className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Fechar
                </button>
              </div>

              {propostas && propostas.length > 0 && (
                <div className="space-y-2 border-t border-neutral-200 pt-3">
                  <div className="text-[12.5px] font-semibold text-neutral-800">
                    {propostas.length} item(ns) parecem bater. Confira antes de
                    aplicar:
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-neutral-200">
                    <table className="w-full min-w-[640px] text-[12px]">
                      <thead className="bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
                        <tr>
                          <th className="px-2 py-2" />
                          <th className="px-3 py-2 text-left">Da lista dele</th>
                          <th className="px-3 py-2 text-right">Preço</th>
                          <th className="px-3 py-2 text-left">Vai pro lote</th>
                          <th className="px-3 py-2 text-right">Ref. órgão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {propostas.map((p) => (
                          <tr
                            key={p.loteId}
                            className="border-t border-neutral-100 align-top"
                          >
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={marcadas.has(p.loteId)}
                                onChange={() => {
                                  const nova = new Set(marcadas);
                                  if (nova.has(p.loteId)) nova.delete(p.loteId);
                                  else nova.add(p.loteId);
                                  setMarcadas(nova);
                                }}
                              />
                            </td>
                            <td className="max-w-[220px] px-3 py-2 text-neutral-700">
                              {p.item.descricao}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {brl(p.item.preco)}
                            </td>
                            <td className="sticky left-12 z-10 max-w-[240px] bg-inherit px-3 py-2 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                              <div className="font-semibold text-neutral-800">
                                Lote {p.numeroLote}
                                <span className="ml-1.5 font-normal text-neutral-400">
                                  {p.quantidade.toLocaleString("pt-BR")} {p.unidade}
                                </span>
                              </div>
                              <div className="line-clamp-2 text-neutral-500">
                                {p.descricaoLote}
                              </div>
                              <div className="mt-0.5 text-[10.5px] text-neutral-400">
                                bateu em: {p.palavras.join(", ")}
                              </div>
                              {p.jaTinhaCusto && (
                                <div className="text-[10.5px] font-semibold text-amber-700">
                                  esse lote já tinha custo — vai ser trocado
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                              {p.referenciaUnitaria != null
                                ? brl(p.referenciaUnitaria)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {semPar.length > 0 && (
                    <p className="text-[11.5px] text-neutral-500">
                      {semPar.length} item(ns) da lista não bateram com lote
                      nenhum: {semPar.slice(0, 4).map((i) => i.descricao).join("; ")}
                      {semPar.length > 4 && "…"}
                    </p>
                  )}

                  <button
                    onClick={aplicarLista}
                    disabled={marcadas.size === 0}
                    className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                  >
                    Preencher o custo de {marcadas.size} lote(s)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* A fórmula fica escrita na tela, não só no clique.
              "Como ele fez o cálculo?" foi a primeira pergunta de quem usa, e
              a resposta não pode depender de descobrir que a célula é
              clicável. Os percentuais vêm do próprio edital, então a linha
              muda junto quando alguém ajusta o imposto. */}
          {!modoPregao && disputa && (
            <p className="-mt-1 text-[12px] text-neutral-500">
              <b className="font-semibold text-neutral-700">Piso</b> = (custo do
              fornecedor + frete ÷ quantidade) ÷{" "}
              <b className="font-semibold text-neutral-700">
                {100 - disputa.impostoPadrao - disputa.margemPadrao}%
              </b>
              {" — "}porque o imposto ({disputa.impostoPadrao}%) e a margem (
              {disputa.margemPadrao}%) saem do preço de venda, não do custo.{" "}
              <span className="text-neutral-400">
                Clique em qualquer piso pra ver a conta daquele lote.
              </span>
            </p>
          )}

          {/* ----------------------------------------------------- a tabela -- */}
          <div className="max-h-[70vh] overflow-auto rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-[12px]">
              <thead className="sticky top-0 z-20 border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
                <tr>
                  <Cabecalho campo="numero" ordem={ordem} aoOrdenar={ordenarPor} className="sticky left-0 z-10 w-12 bg-neutral-50 px-2 py-2 text-left">Lote</Cabecalho>
                  <Cabecalho campo="descricao" ordem={ordem} aoOrdenar={ordenarPor} className="sticky left-12 z-10 bg-neutral-50 px-3 py-2 text-left shadow-[2px_0_4px_rgba(0,0,0,0.05)]">Descrição</Cabecalho>
                  <Cabecalho campo="quantidade" ordem={ordem} aoOrdenar={ordenarPor} className="px-3 py-2 text-right">Qtd</Cabecalho>
                  {!modoPregao && (
                    <>
                      <Cabecalho campo="fornecedor" ordem={ordem} aoOrdenar={ordenarPor} className="px-3 py-2 text-left">Fornecedor</Cabecalho>
                      <Cabecalho campo="marca" ordem={ordem} aoOrdenar={ordenarPor} className="px-3 py-2 text-left">Marca</Cabecalho>
                      <Cabecalho campo="custo" ordem={ordem} aoOrdenar={ordenarPor} className="px-3 py-2 text-right">Custo un.</Cabecalho>
                      <Cabecalho campo="frete" ordem={ordem} aoOrdenar={ordenarPor} className="px-3 py-2 text-right">Frete do lote</Cabecalho>
                      {mostrarCalculo && (
                        <>
                          <Cabecalho campo="imposto" ordem={ordem} aoOrdenar={ordenarPor} className="px-3 py-2 text-right">Imp%</Cabecalho>
                          <Cabecalho campo="margem" ordem={ordem} aoOrdenar={ordenarPor} className="px-3 py-2 text-right">Marg%</Cabecalho>
                        </>
                      )}
                    </>
                  )}
                  <Cabecalho campo="referencia" ordem={ordem} aoOrdenar={ordenarPor} className="px-3 py-2 text-right">Ref. órgão</Cabecalho>
                  <Cabecalho campo="piso" ordem={ordem} aoOrdenar={ordenarPor} className="bg-brand/5 px-3 py-2 text-right font-bold text-brand">Piso</Cabecalho>
                  {mostrarCalculo && (
                    <Cabecalho campo="empate" ordem={ordem} aoOrdenar={ordenarPor} className="px-3 py-2 text-right">Empate</Cabecalho>
                  )}
                  <Cabecalho campo="lance" ordem={ordem} aoOrdenar={ordenarPor} className="px-3 py-2 text-right">Meu lance</Cabecalho>
                  <Cabecalho campo="faturamento" ordem={ordem} aoOrdenar={ordenarPor} className="px-3 py-2 text-right">Fatura</Cabecalho>
                  <Cabecalho campo="lucro" ordem={ordem} aoOrdenar={ordenarPor} className="bg-emerald-50 px-3 py-2 text-right font-bold text-emerald-700">Lucro</Cabecalho>
                  {!modoPregao && <th className="px-2 py-2" />}
                </tr>
              </thead>
              <tbody>
                {lotesVisiveis.map((l: LoteCalculado) => {
                  const semCusto = l.custoUnitario <= 0;
                  return (
                    <React.Fragment key={l.id}>
                    <tr
                      // O fundo fica no <tr> porque as duas primeiras células
                      // são sticky e precisam de fundo opaco pra tapar o que
                      // passa por baixo — elas herdam este.
                      className={`border-b border-neutral-100 last:border-0 ${
                        l.abaixoDoPiso
                          ? "bg-red-100"
                          : semCusto
                            ? "bg-white"
                            : l.vale
                              ? "bg-emerald-50"
                              : "bg-red-50"
                      }`}
                    >
                      <td className="sticky left-0 z-10 w-12 bg-inherit px-2 py-2 font-semibold tabular-nums text-neutral-800">
                        {l.numero || "—"}
                      </td>
                      {/* A descrição do edital passa de 300 caracteres (um MOP
                          giratório vem com balde, cabo e refil descritos). Solta,
                          ela empurra o piso e o campo de lance pra fora da tela
                          justamente no modo pregão. Fica em duas linhas, com o
                          texto inteiro no title. */}
                      <td className="max-w-[260px] px-3 py-2">
                        <div className="line-clamp-2" title={l.descricao}>
                          {l.descricao || "sem descrição"}
                        </div>
                        {l.marca && (
                          <div className="text-[10.5px] font-semibold text-neutral-500">
                            marca: {l.marca}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                        {l.quantidade.toLocaleString("pt-BR")} {l.unidade}
                      </td>

                      {!modoPregao && (
                        <>
                          <td className="px-3 py-2">
                            <input
                              defaultValue={l.fornecedor}
                              onBlur={(e) =>
                                salvarLote(l.id, "fornecedor", e.target.value)
                              }
                              placeholder="quem cotou"
                              className="w-28 rounded border border-neutral-300 px-1.5 py-1 text-[12px] outline-none focus:border-brand"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              defaultValue={l.marca}
                              onBlur={(e) => salvarLote(l.id, "marca", e.target.value)}
                              placeholder="marca ofertada"
                              title="O pregão exige declarar a marca item por item"
                              className="w-28 rounded border border-neutral-300 px-1.5 py-1 text-[12px] outline-none focus:border-brand"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              defaultValue={l.custoUnitario || ""}
                              inputMode="decimal"
                              placeholder="0,00"
                              onBlur={(e) =>
                                salvarLote(
                                  l.id,
                                  "custoUnitario",
                                  paraNumero(e.target.value)
                                )
                              }
                              className={`${numInput} w-20 ${
                                semCusto ? "border-amber-400 bg-amber-50" : ""
                              }`}
                            />
                            {/* Quem já cotou este produto antes. Clicar copia
                                preço, fornecedor e marca de uma vez — é o que
                                faz a cotação de um edital servir no próximo. */}
                            {semCusto &&
                              (sugestoes[l.id] ?? []).map((sug) => (
                                <button
                                  key={sug.id}
                                  onClick={() =>
                                    chamar("PATCH", {
                                      loteId: l.id,
                                      custoUnitario: sug.precoUnitario,
                                      fornecedor: sug.fornecedor,
                                      marca: sug.marca,
                                    })
                                  }
                                  title={
                                    `${sug.fornecedor} cotou ${brl(sug.precoUnitario)} quando o pedido era de ` +
                                    `${sug.quantidadeCotada.toLocaleString("pt-BR")} ${sug.unidade}. ` +
                                    `Aqui o edital pede ${l.quantidade.toLocaleString("pt-BR")}. Clique pra usar esse preço.`
                                  }
                                  className="mt-0.5 block max-w-[110px] truncate rounded border border-emerald-300 bg-emerald-50 px-1 text-left text-[10px] leading-snug text-emerald-800 hover:bg-emerald-100"
                                >
                                  <b className="font-bold">{brl(sug.precoUnitario)}</b>{" "}
                                  {sug.fornecedor}
                                  {/* O preço foi dado pra um pedido bem maior que
                                      este lote. Comprar menos costuma sair mais
                                      caro, então serve de teto e não de certeza. */}
                                  {sug.quantidadeDiferente && (
                                    <span className="block text-amber-700">
                                      era p/ {sug.quantidadeCotada.toLocaleString("pt-BR")}, aqui{" "}
                                      {l.quantidade.toLocaleString("pt-BR")}
                                    </span>
                                  )}
                                </button>
                              ))}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              defaultValue={l.freteTotal || ""}
                              inputMode="decimal"
                              placeholder="0,00"
                              title="Frete do lote inteiro (nao por unidade) — e rateado pela quantidade na hora da conta"
                              onBlur={(e) =>
                                salvarLote(l.id, "freteTotal", paraNumero(e.target.value))
                              }
                              className={`${numInput} w-20 ${
                                l.freteEmBranco ? "border-amber-400 bg-amber-50" : ""
                              }`}
                            />
                          </td>
                          {mostrarCalculo && (
                          <>
                          <td className="px-3 py-2">
                            <input
                              defaultValue={l.percentualImpostos}
                              inputMode="decimal"
                              onBlur={(e) =>
                                salvarLote(
                                  l.id,
                                  "percentualImpostos",
                                  paraNumero(e.target.value)
                                )
                              }
                              className={`${numInput} w-14`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              defaultValue={l.margemAlvo}
                              inputMode="decimal"
                              onBlur={(e) =>
                                salvarLote(l.id, "margemAlvo", paraNumero(e.target.value))
                              }
                              className={`${numInput} w-14`}
                            />
                          </td>
                          </>
                          )}
                        </>
                      )}

                      <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                        {l.referenciaUnitaria != null ? brl(l.referenciaUnitaria) : "—"}
                      </td>

                      <td
                        // A conta inteira no title: "de onde saiu esse preco?"
                        // foi a primeira pergunta de quem olhou a tabela, e o
                        // numero que decide o lance nao pode ser magica.
                        title={l.explicacao}
                        onClick={() =>
                          setContaAberta(contaAberta === l.id ? null : l.id)
                        }
                        className={`cursor-pointer bg-brand/5 px-3 py-2 text-right font-bold tabular-nums hover:bg-brand/10 ${
                          modoPregao ? "text-[17px]" : "text-[13px]"
                        } ${semCusto ? "text-neutral-400" : "text-brand"}`}
                      >
                        {semCusto ? "sem custo" : brl(l.pisoUnitario)}
                        {!semCusto && l.folgaPercentual != null && (
                          <div className="text-[10px] font-medium text-neutral-500">
                            folga {pct(l.folgaPercentual)}
                          </div>
                        )}
                      </td>

                      {mostrarCalculo && (
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                          {semCusto ? "—" : brl(l.empateUnitario)}
                        </td>
                      )}

                      <td className="px-3 py-2">
                        <input
                          defaultValue={l.meuLance ?? ""}
                          inputMode="decimal"
                          placeholder="0,00"
                          onBlur={(e) =>
                            salvarLote(l.id, "meuLance", paraNumero(e.target.value))
                          }
                          className={`${numInput} ${modoPregao ? "w-24 text-[14px]" : "w-20"} ${
                            l.abaixoDoPiso ? "border-red-400 bg-red-50 font-bold" : ""
                          }`}
                        />
                        {l.margemDoLance != null && !semCusto && (
                          <div
                            className={`text-right text-[10px] font-semibold ${
                              l.abaixoDoPiso ? "text-red-600" : "text-emerald-700"
                            }`}
                          >
                            {pct(l.margemDoLance)}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                        {l.vale ? brl(l.faturamentoPrevisto) : "—"}
                      </td>
                      <td
                        className={`bg-emerald-50 px-3 py-2 text-right font-bold tabular-nums ${
                          modoPregao ? "text-[15px]" : "text-[13px]"
                        } ${l.lucroPrevisto > 0 ? "text-emerald-700" : "text-neutral-400"}`}
                      >
                        {l.vale ? (
                          <>
                            {brl(l.lucroPrevisto)}
                            <div className="text-[10px] font-medium text-neutral-500">
                              no piso {brl(l.lucroNoPiso)}
                            </div>
                          </>
                        ) : semCusto ? (
                          "—"
                        ) : (
                          <span className="text-red-600">não fecha</span>
                        )}
                      </td>

                      {!modoPregao && (
                        <td className="px-2 py-2 text-right">
                          <button
                            onClick={() => salvarLote(l.id, "descartado", true)}
                            title="Tirar da disputa"
                            className="rounded px-1.5 py-1 text-[14px] leading-none text-neutral-400 hover:bg-red-50 hover:text-red-600"
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>

                    {contaAberta === l.id && (
                      <tr className="bg-brand/5">
                        <td colSpan={20} className="px-5 py-3">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-brand">
                            Como este piso foi calculado
                          </div>
                          <pre className="mt-1 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-neutral-700">
                            {l.explicacao}
                          </pre>
                          {l.referenciaUnitaria != null && l.custoUnitario > 0 && (
                            <div className="mt-2 border-t border-brand/20 pt-2 text-[12px] text-neutral-600">
                              O órgão paga até <b>{brl(l.referenciaUnitaria)}</b>, e o seu
                              piso é <b>{brl(l.pisoUnitario)}</b> —{" "}
                              {l.vale ? (
                                <span className="font-semibold text-emerald-700">
                                  sobra {pct(l.folgaPercentual ?? 0)} pra brigar no lance.
                                </span>
                              ) : (
                                <span className="font-semibold text-red-700">
                                  não fecha: o custo teria que cair pra{" "}
                                  {brl(
                                    l.referenciaUnitaria *
                                      (1 -
                                        (l.percentualImpostos + l.margemAlvo) / 100)
                                  )}
                                  .
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              {/* Soma o que está na tela agora: com um filtro ligado, é o
                  total daquele recorte, e não do edital inteiro. */}
              <tfoot className="border-t-2 border-neutral-200 bg-neutral-50 font-semibold">
                <tr>
                  <td
                    className="sticky left-0 bg-neutral-50 px-3 py-2"
                    colSpan={modoPregao ? 3 : mostrarCalculo ? 9 : 6}
                  >
                    {lotesVisiveis.filter((l) => l.vale).length} lote(s) fecham
                    {lotesVisiveis.length !== (disputa?.totais.lotes ?? 0) &&
                      " (do filtro atual)"}
                  </td>
                  <td className="px-3 py-2" colSpan={mostrarCalculo ? 3 : 2} />
                  <td className="px-3 py-2 text-right tabular-nums">
                    {brl(
                      lotesVisiveis
                        .filter((l) => l.vale)
                        .reduce((s, l) => s + l.faturamentoPrevisto, 0)
                    )}
                  </td>
                  <td className="bg-emerald-50 px-3 py-2 text-right tabular-nums text-emerald-700">
                    {brl(
                      lotesVisiveis
                        .filter((l) => l.vale)
                        .reduce((s, l) => s + l.lucroPrevisto, 0)
                    )}
                  </td>
                  {!modoPregao && <td />}
                </tr>
              </tfoot>
            </table>
          </div>

          {lotesVisiveis.length === 0 && (
            <p className="text-center text-sm text-neutral-500">
              Nenhum lote bate com esse filtro.
            </p>
          )}

          {!modoPregao && (
            <button
              onClick={() => chamar("POST", { numero: "", descricao: "" })}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              + Adicionar lote na mão
            </button>
          )}
        </>
      )}
    </div>
  );
}
