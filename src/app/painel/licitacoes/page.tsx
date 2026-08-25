"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_KEYWORDS, MODALIDADES } from "@/lib/pncpTypes";
import type { LicitacaoResultado } from "@/lib/pncpTypes";
import type { LicitacaoStatus, TrackedLicitacao } from "@/lib/licitacoesTrackingDb";
import { linkDoEdital } from "@/lib/linkEdital";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Formato curto pro total de cada coluna do quadro, onde não cabe o valor
// inteiro (R$ 1,2 mi em vez de R$ 1.234.567,00).
const compacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

// A ordem das colunas é a ordem em que as etapas acontecem de verdade num
// pregão eletrônico — ver o comentário em licitacoesTrackingDb.ts.
const STATUS_ORDER: LicitacaoStatus[] = [
  "de_olho",
  "preparando",
  "enviada",
  "em_disputa",
  "habilitacao",
  "ganhou",
  "entregando",
  "perdeu",
];

const STATUS_LABEL: Record<LicitacaoStatus, string> = {
  de_olho: "De olho",
  preparando: "Preparando",
  enviada: "Enviada",
  em_disputa: "Em disputa",
  habilitacao: "Habilitação",
  ganhou: "Ganhou",
  entregando: "Entregando",
  perdeu: "Perdeu",
};

// O que fazer em cada etapa, pra quem abrir o quadro não precisar lembrar.
const STATUS_AJUDA: Record<LicitacaoStatus, string> = {
  de_olho: "Achou e está avaliando se compensa",
  preparando: "Montando preço e juntando documento",
  enviada: "Proposta no portal, esperando a sessão",
  em_disputa: "Sessão de lances acontecendo",
  habilitacao: "Venceu no preço, conferindo documentos",
  ganhou: "Homologada, ata ou contrato assinado",
  entregando: "Fornecendo — registro de preços dura meses",
  perdeu: "Não deu dessa vez",
};

const STATUS_ACCENT: Record<LicitacaoStatus, string> = {
  de_olho: "bg-neutral-400",
  preparando: "bg-amber-400",
  enviada: "bg-blue-400",
  em_disputa: "bg-violet-500",
  habilitacao: "bg-cyan-500",
  ganhou: "bg-emerald-500",
  entregando: "bg-teal-500",
  perdeu: "bg-red-400",
};

// Uma licitação que entrou no índice nas últimas 24h ganha selo de novidade.
const JANELA_NOVIDADE_MS = 24 * 60 * 60 * 1000;

type ColetaStatus = {
  rodando: boolean;
  etapa: "ociosa" | "lendo_pncp" | "localizando_cidades" | "concluida";
  ufAtual: string | null;
  paginasLidas: number;
  paginasTotais: number;
  registrosLidos: number;
  itensNoIndice: number;
  novasNaUltimaColeta: number;
  cidadesPendentes: number;
  erro: string | null;
  aviso: string | null;
};

// Devolve dias inteiros restantes, ou -1 para qualquer prazo já vencido.
// O -1 explícito existe porque Math.ceil de uma fração negativa devolve -0
// (um prazo que venceu de manhã dava "0 dias", ou seja, "fecha hoje").
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const restante = new Date(dateStr).getTime() - Date.now();
  if (Number.isNaN(restante)) return null;
  if (restante < 0) return -1;
  return Math.ceil(restante / 86400000);
}

function deadlineBadge(dateStr: string | null) {
  const d = daysUntil(dateStr);
  if (d === null) return null;
  if (d < 0) return { text: "Prazo encerrado", cls: "bg-neutral-100 text-neutral-500" };
  if (d === 0) return { text: "Fecha hoje", cls: "bg-red-100 text-red-700 font-semibold" };
  if (d <= 2) return { text: `Fecha em ${d}d`, cls: "bg-red-50 text-red-700" };
  if (d <= 7) return { text: `Fecha em ${d}d`, cls: "bg-amber-50 text-amber-700" };
  return { text: `Fecha em ${d}d`, cls: "bg-neutral-100 text-neutral-500" };
}

function tempoDesde(ts: number | null): string {
  if (!ts) return "nunca";
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)} dia(s)`;
}

export default function LicitacoesPage() {
  const [tab, setTab] = useState<"buscar" | "acompanhamento">("buscar");

  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS.join(", "));
  const [exclusoes, setExclusoes] = useState("");
  const [minDeadlineDays, setMinDeadlineDays] = useState(0);
  const [raioKm, setRaioKm] = useState(250);
  const [municipio, setMunicipio] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [modalidades, setModalidades] = useState<number[]>([6, 8]);
  const [somenteNovas, setSomenteNovas] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<LicitacaoResultado[] | null>(null);

  const [storeAddress, setStoreAddress] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);

  const [coleta, setColeta] = useState<ColetaStatus | null>(null);
  const [indiceAtualizadoEm, setIndiceAtualizadoEm] = useState<number | null>(null);
  const [totalNoIndice, setTotalNoIndice] = useState(0);

  // Relógio da tela. Chamar Date.now() direto no corpo do componente é uma
  // função impura no meio do render (o React 19 reclama, com razão: dois
  // renders do mesmo estado podem dar resultados diferentes). Guardar num
  // state atualizado de minuto em minuto mantém o cálculo estável e vivo.
  const [agora, setAgora] = useState(0);
  useEffect(() => {
    const atualizar = () => setAgora(Date.now());
    const primeiro = setTimeout(atualizar, 0);
    const intervalo = setInterval(atualizar, 60000);
    return () => {
      clearTimeout(primeiro);
      clearInterval(intervalo);
    };
  }, []);

  const [tracked, setTracked] = useState<TrackedLicitacao[]>([]);
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [mostrarEncerradas, setMostrarEncerradas] = useState(false);
  const [editandoNota, setEditandoNota] = useState<string | null>(null);
  const [notaRascunho, setNotaRascunho] = useState("");

  // Arrastar e soltar do quadro. `arrastado` é a licitação na mão,
  // `colunaAlvo` é a coluna embaixo do cursor (só pra dar o destaque visual).
  const [arrastado, setArrastado] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<LicitacaoStatus | null>(null);

  // "Quem cota isso": fornecedores DE LICITAÇÃO cujas categorias batem com o
  // objeto do edital. Um card por vez — a lista abre embaixo do card clicado.
  //
  // Consulta a agenda de licitação, não a da loja: quem está marcado como "não
  // usar" não pode aparecer aqui, e a trava de preço e o prazo de entrega
  // precisam estar à vista pra comparar com o do edital antes de ligar.
  const [cotacao, setCotacao] = useState<{
    numero: string;
    carregando: boolean;
    lista: Array<{
      fornecedor: {
        id: string;
        nome: string;
        telefone: string;
        usarEmLicitacao: "sim" | "nao" | "nao_sei";
        seguraPrecoDias: number | null;
        prazoEntregaDias: number | null;
        condicaoPagamento: string;
      };
      categoriasQueBatem: string[];
    }>;
  } | null>(null);

  async function quemCota(item: TrackedLicitacao) {
    if (cotacao?.numero === item.numeroControlePNCP) {
      setCotacao(null);
      return;
    }
    setCotacao({ numero: item.numeroControlePNCP, carregando: true, lista: [] });
    try {
      const res = await fetch(
        `/api/fornecedores-licitacao?para=${encodeURIComponent(item.objeto)}`
      );
      const dados = await res.json();
      setCotacao({
        numero: item.numeroControlePNCP,
        carregando: false,
        lista: dados.atendem ?? [],
      });
    } catch {
      setCotacao({ numero: item.numeroControlePNCP, carregando: false, lista: [] });
    }
  }

  async function soltarNaColuna(destino: LicitacaoStatus) {
    const numero = arrastado;
    setArrastado(null);
    setColunaAlvo(null);
    if (!numero) return;

    const item = tracked.find((t) => t.numeroControlePNCP === numero);
    if (!item || item.status === destino) return;

    // Move o card na hora e só depois grava: esperar a resposta do servidor
    // pra ver o card mudar de coluna faz o arrastar parecer que não pegou.
    setTracked((atual) =>
      atual.map((t) =>
        t.numeroControlePNCP === numero ? { ...t, status: destino } : t
      )
    );

    try {
      const res = await fetch(
        `/api/licitacoes/acompanhadas/${encodeURIComponent(numero)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: destino }),
        }
      );
      if (!res.ok) throw new Error();
    } catch {
      // Não gravou: desfaz na tela, senão a pessoa fecha o painel achando
      // que salvou e na próxima abertura o card está no lugar antigo.
      setTracked((atual) =>
        atual.map((t) =>
          t.numeroControlePNCP === numero ? { ...t, status: item.status } : t
        )
      );
      setError("Não deu pra mover a licitação. Tente de novo.");
    }
  }

  // ---------------------------------------------------------------- carregar

  const loadTracked = useCallback(async () => {
    try {
      const res = await fetch("/api/licitacoes/acompanhadas");
      if (!res.ok) return;
      const data = await res.json();
      setTracked(data.items ?? []);
    } catch {
      // silencioso
    }
  }, []);

  /**
   * A configuração salva só preenche os campos na PRIMEIRA carga.
   *
   * Sem isso o raio não parava em pé: `loadColeta` roda de 2 em 2 segundos
   * enquanto a coleta anda (e de novo depois de salvar e de atualizar), e a
   * cada volta reescrevia o campo com o valor do servidor. Quem digitasse
   * "80" via voltar pra 250 sozinho dois segundos depois, no meio da
   * digitação. Depois da primeira carga quem manda é quem está na tela.
   */
  const configCarregada = useRef(false);

  const loadColeta = useCallback(async () => {
    try {
      const res = await fetch("/api/licitacoes/coleta");
      if (!res.ok) return;
      const data = await res.json();
      setColeta(data.status);
      setIndiceAtualizadoEm(data.atualizadoEm);
      setTotalNoIndice(data.totalNoIndice);
      if (data.config && !configCarregada.current) {
        configCarregada.current = true;
        setRaioKm(data.config.raioKm);
        setModalidades(data.config.modalidades);
        if (data.config.keywords?.length) {
          setKeywords(data.config.keywords.join(", "));
        }
        setExclusoes((data.config.exclusoes ?? []).join(", "));
      }
    } catch {
      // silencioso
    }
  }, []);

  const buscar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ keywords });
      if (minDeadlineDays) params.set("minDeadlineDays", String(minDeadlineDays));
      if (raioKm) params.set("raioKm", String(raioKm));
      if (municipio.trim()) params.set("municipio", municipio.trim());
      if (valorMin.trim()) params.set("valorMin", valorMin.replace(",", "."));
      if (valorMax.trim()) params.set("valorMax", valorMax.replace(",", "."));
      if (modalidades.length) params.set("modalidades", modalidades.join(","));

      const res = await fetch(`/api/licitacoes/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na busca");
      setResults(data.items);
      setIndiceAtualizadoEm(data.atualizadoEm);
      setTotalNoIndice(data.totalNoIndice);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar licitações");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [keywords, minDeadlineDays, raioKm, municipio, valorMin, valorMax, modalidades]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTracked();
    loadColeta();
  }, [loadTracked, loadColeta]);

  useEffect(() => {
    async function loadStoreAddress() {
      try {
        const res = await fetch("/api/licitacoes/loja");
        const data = await res.json();
        if (data.address) {
          setStoreAddress(data.address);
          setAddressInput(data.address);
        }
      } catch {
        // silencioso
      }
    }
    loadStoreAddress();
  }, []);

  // A busca agora é local e instantânea — dá pra rodar sozinha sempre que um
  // filtro muda, sem botão "Buscar" e sem esperar minuto nenhum. Depende
  // também de coletaRodando pra refazer a busca assim que a coleta termina.
  const coletaRodando = coleta?.rodando ?? false;
  useEffect(() => {
    const t = setTimeout(() => void buscar(), 250);
    return () => clearTimeout(t);
  }, [buscar, coletaRodando]);

  // Enquanto a coleta roda, acompanha o progresso de perto.
  useEffect(() => {
    if (!coleta?.rodando) return;
    const intervalo = setInterval(() => {
      void loadColeta();
    }, 2000);
    return () => clearInterval(intervalo);
  }, [coleta?.rodando, loadColeta]);


  // ------------------------------------------------------------------ ações

  async function handleSaveAddress() {
    setSavingAddress(true);
    setError(null);
    try {
      const res = await fetch("/api/licitacoes/loja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addressInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar endereço");
      setStoreAddress(data.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar endereço");
    } finally {
      setSavingAddress(false);
    }
  }

  async function atualizarAgora() {
    setError(null);
    const res = await fetch("/api/licitacoes/coleta", { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Não foi possível iniciar a coleta.");
      return;
    }
    await loadColeta();
  }

  async function salvarConfigColeta() {
    await fetch("/api/licitacoes/coleta", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raioKm,
        modalidades,
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        exclusoes: exclusoes.split(",").map((e) => e.trim()).filter(Boolean),
      }),
    });
    await loadColeta();
    await buscar();
  }

  function toggleModalidade(code: number) {
    setModalidades((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  /**
   * Tira a licitação da busca pra sempre.
   *
   * Some da tela na hora, sem esperar o servidor: quem está limpando uma lista
   * de duzentas linhas clica em sequência, e uma lista que só reordena depois
   * da resposta faz a pessoa clicar na linha errada.
   */
  async function handleDescartar(item: LicitacaoResultado) {
    const motivo = window.prompt(
      `Descartar "${item.objeto.slice(0, 70)}"?

Por que não serve? (opcional, mas ajuda a lembrar depois)`,
      ""
    );
    // Cancelar no prompt devolve null; string vazia é "descarta sem motivo".
    if (motivo === null) return;

    setResults((atuais) =>
      atuais
        ? atuais.filter((r) => r.numeroControlePNCP !== item.numeroControlePNCP)
        : atuais
    );
    try {
      await fetch("/api/licitacoes/descartadas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroControlePNCP: item.numeroControlePNCP,
          objeto: item.objeto,
          municipio: item.municipio,
          uf: item.uf,
          motivo,
        }),
      });
    } catch {
      setError("Não deu pra descartar. A licitação volta na próxima busca.");
    }
  }

  async function handleTrack(item: LicitacaoResultado) {
    await fetch("/api/licitacoes/acompanhadas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    await loadTracked();
  }

  async function handleUntrack(numeroControlePNCP: string) {
    await fetch(`/api/licitacoes/acompanhadas/${encodeURIComponent(numeroControlePNCP)}`, {
      method: "DELETE",
    });
    await loadTracked();
  }

  async function patchTracked(
    numeroControlePNCP: string,
    body: Record<string, unknown>
  ) {
    await fetch(`/api/licitacoes/acompanhadas/${encodeURIComponent(numeroControlePNCP)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await loadTracked();
  }

  async function handleSummarize(numeroControlePNCP: string) {
    setSummarizing(numeroControlePNCP);
    try {
      const res = await fetch(
        `/api/licitacoes/acompanhadas/${encodeURIComponent(numeroControlePNCP)}/resumo`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao resumir");
      await loadTracked();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar resumo");
    } finally {
      setSummarizing(null);
    }
  }

  // ---------------------------------------------------------------- derivados

  const trackedIds = useMemo(
    () => new Set(tracked.map((t) => t.numeroControlePNCP)),
    [tracked]
  );

  const resultadosVisiveis = useMemo(() => {
    if (!results) return null;
    if (!somenteNovas) return results;
    const corte = agora - JANELA_NOVIDADE_MS;
    return results.filter((r) => (r.vistaEm ?? 0) >= corte);
  }, [results, somenteNovas, agora]);

  const qtdNovas = useMemo(() => {
    if (!results || !agora) return 0;
    const corte = agora - JANELA_NOVIDADE_MS;
    return results.filter((r) => (r.vistaEm ?? 0) >= corte).length;
  }, [results, agora]);

  const valorNoFunil = tracked
    .filter((t) => t.status !== "perdeu")
    .reduce((soma, t) => soma + (t.valorEstimado ?? 0), 0);

  // "Encerrada" aqui é a que ficou pelo caminho: o prazo passou e ela nunca
  // saiu das três primeiras etapas. Da disputa em diante o prazo ter passado
  // é o normal, não um problema.
  const encerradasNoFunil = tracked.filter(
    (t) =>
      (t.status === "de_olho" || t.status === "preparando" || t.status === "enviada") &&
      (daysUntil(t.dataEncerramentoProposta) ?? 1) < 0
  ).length;

  const progresso =
    coleta && coleta.paginasTotais > 0
      ? Math.min(100, Math.round((coleta.paginasLidas / coleta.paginasTotais) * 100))
      : 0;

  // -------------------------------------------------------------------- tela

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">
            Licitações
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            O painel varre o PNCP inteiro sozinho e avisa quando aparece algo do seu
            perfil.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-neutral-200 bg-white p-1 text-sm font-medium shadow-sm">
          <button
            onClick={() => setTab("buscar")}
            className={`rounded-lg px-4 py-1.5 transition-colors ${
              tab === "buscar"
                ? "brand-gradient text-white shadow-sm"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Oportunidades
          </button>
          <button
            onClick={() => setTab("acompanhamento")}
            className={`rounded-lg px-4 py-1.5 transition-colors ${
              tab === "acompanhamento"
                ? "brand-gradient text-white shadow-sm"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Meu funil{tracked.length > 0 ? ` (${tracked.length})` : ""}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------ estado da coleta */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                coleta?.rodando
                  ? "animate-pulse bg-amber-500 shadow-[0_0_6px_2px] shadow-amber-400/40"
                  : coleta?.erro
                    ? "bg-red-500"
                    : "bg-emerald-500 shadow-[0_0_6px_2px] shadow-emerald-400/40"
              }`}
            />
            <div className="text-[13px]">
              {coleta?.rodando ? (
                <span className="text-neutral-700">
                  <b className="font-semibold">Varrendo o PNCP</b>
                  {coleta.etapa === "localizando_cidades" ? (
                    <> — localizando cidades ({coleta.cidadesPendentes} restantes)</>
                  ) : (
                    <>
                      {" "}
                      — {coleta.ufAtual ?? ""} · página {coleta.paginasLidas} de{" "}
                      {coleta.paginasTotais || "?"} ·{" "}
                      {coleta.registrosLidos.toLocaleString("pt-BR")} lidas
                    </>
                  )}
                </span>
              ) : (
                <span className="text-neutral-700">
                  <b className="font-semibold">
                    {totalNoIndice.toLocaleString("pt-BR")} licitações
                  </b>{" "}
                  no índice · atualizado {tempoDesde(indiceAtualizadoEm)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-[12px]">
            <button
              onClick={() => setMostrarConfig((v) => !v)}
              className="font-medium text-neutral-500 hover:text-neutral-800"
            >
              {mostrarConfig ? "Fechar ajustes" : "Ajustes da coleta"}
            </button>
            <button
              onClick={atualizarAgora}
              disabled={coleta?.rodando}
              className="rounded-lg bg-neutral-900 px-3.5 py-1.5 font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
            >
              {coleta?.rodando ? "Coletando..." : "Atualizar agora"}
            </button>
          </div>
        </div>

        {coleta?.rodando && (
          <div className="h-1 w-full bg-neutral-100">
            <div
              className="brand-gradient h-full transition-all duration-500"
              style={{ width: `${Math.max(progresso, 3)}%` }}
            />
          </div>
        )}

        {coleta?.erro && !coleta.rodando && (
          <p className="border-t border-red-100 bg-red-50 px-5 py-2.5 text-[12px] text-red-700">
            Última coleta falhou: {coleta.erro}
          </p>
        )}

        {/* Coleta que deu certo mas deixou página pra trás. Cinza, não
            vermelho: não há nada pra fazer, a próxima rodada já tenta de
            novo. */}
        {coleta?.aviso && !coleta.erro && !coleta.rodando && (
          <p className="border-t border-neutral-100 bg-neutral-50 px-5 py-2.5 text-[12px] text-neutral-500">
            {coleta.aviso}
          </p>
        )}

        {!indiceAtualizadoEm && !coleta?.rodando && (
          <p className="border-t border-amber-100 bg-amber-50 px-5 py-2.5 text-[12px] text-amber-800">
            O índice ainda está vazio. Clique em <b>Atualizar agora</b> — a primeira
            coleta demora alguns minutos porque lê o PNCP inteiro e localiza cada
            cidade. Depois disso ela se atualiza sozinha a cada 6 horas.
          </p>
        )}

        {mostrarConfig && (
          <div className="space-y-4 border-t border-neutral-100 bg-neutral-50/60 px-5 py-4">
            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Endereço da loja (centro do raio)
              </label>
              <div className="flex gap-2">
                <input
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="Ex: Av. Brasil, 1372, Xanxerê, SC"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <button
                  onClick={handleSaveAddress}
                  disabled={savingAddress || !addressInput.trim()}
                  className="shrink-0 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-50"
                >
                  {savingAddress ? "Salvando..." : "Salvar"}
                </button>
              </div>
              {storeAddress && (
                <p className="mt-1 text-[11.5px] text-emerald-600">
                  ✓ {storeAddress}
                </p>
              )}
            </div>

            <div>
              <span className="mb-1.5 block text-[12.5px] font-medium text-neutral-700">
                Modalidades que a coleta lê
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(MODALIDADES).map(([code, label]) => {
                  const active = modalidades.includes(Number(code));
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleModalidade(Number(code))}
                      className={`rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors ${
                        active
                          ? "border-brand bg-brand text-white"
                          : "border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-50"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-neutral-400">
                Quanto mais modalidades, mais demorada fica cada coleta. Pregão
                Eletrônico e Dispensa cobrem quase toda compra de material.
              </p>
            </div>

            <button
              onClick={salvarConfigColeta}
              className="rounded-lg bg-brand px-4 py-2 text-[12.5px] font-medium text-white hover:bg-brand-dark"
            >
              Salvar ajustes da coleta
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* --------------------------------------------------------- oportunidades */}
      {tab === "buscar" && (
        <div className="space-y-4">
          <div className="grid gap-4 rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm sm:grid-cols-[2fr_1fr_1fr]">
            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                O que a Embastel fornece (separado por vírgula)
              </label>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Raio (km)
              </label>
              <input
                type="number"
                min={5}
                max={2000}
                value={raioKm}
                onChange={(e) => setRaioKm(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Prazo mínimo (dias)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={minDeadlineDays}
                onChange={(e) => setMinDeadlineDays(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>

            {/* Filtros que nenhum portal oferece: abaixo do estado e por
                tamanho da compra. Frete decide venda de embalagem, e um pregão
                de R$ 3 mil não paga o trabalho de montar a proposta. */}
            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Município (parte do nome)
              </label>
              <input
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                placeholder="ex: xanxerê, chapecó"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Valor mínimo (R$)
              </label>
              <input
                value={valorMin}
                inputMode="decimal"
                onChange={(e) => setValorMin(e.target.value)}
                placeholder="sem mínimo"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Valor máximo (R$)
              </label>
              <input
                value={valorMax}
                inputMode="decimal"
                onChange={(e) => setValorMax(e.target.value)}
                placeholder="sem máximo"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Descartar quando aparecer (o que a loja{" "}
                <b className="font-semibold">não</b> vende)
              </label>
              <input
                value={exclusoes}
                onChange={(e) => setExclusoes(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                A prefeitura escreve tudo num texto só. &quot;Ureia agrícola
                acondicionada em <b>embalagens</b> de 50 kg&quot; é adubo, e
                &quot;bolos de pote — empresa de <b>confeitaria</b>&quot; é bolo pronto.
                Estas palavras derrubam a licitação mesmo que ela case com as de cima.{" "}
                <button
                  onClick={salvarConfigColeta}
                  className="font-semibold text-brand hover:underline"
                >
                  Salvar as duas listas
                </button>{" "}
                pra valer também nos avisos automáticos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-500">
              {loading ? (
                "Filtrando..."
              ) : (
                <>
                  <b className="font-semibold text-neutral-900">
                    {resultadosVisiveis?.length ?? 0}
                  </b>{" "}
                  licitação(ões) aberta(s) no seu perfil
                </>
              )}
            </p>
            {qtdNovas > 0 && (
              <button
                onClick={() => setSomenteNovas((v) => !v)}
                className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors ${
                  somenteNovas
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                ★ {qtdNovas} nova(s) nas últimas 24h
              </button>
            )}
          </div>

          {resultadosVisiveis?.length === 0 && !loading && (
            <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
              <p className="text-sm font-medium text-neutral-700">
                Nada aberto batendo com essas palavras agora.
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-neutral-500">
                Tente palavras mais genéricas (&quot;copo&quot;, &quot;saco&quot;,
                &quot;higiene&quot;, &quot;alimentício&quot;) ou aumente o raio — o
                índice tem {totalNoIndice.toLocaleString("pt-BR")} licitações
                guardadas.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {resultadosVisiveis?.map((item) => {
              const isTracked = trackedIds.has(item.numeroControlePNCP);
              const badge = deadlineBadge(item.dataEncerramentoProposta);
              const nova =
                agora > 0 && (item.vistaEm ?? 0) >= agora - JANELA_NOVIDADE_MS;
              return (
                <div
                  key={item.numeroControlePNCP}
                  className={`rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
                    nova ? "border-emerald-200 ring-1 ring-emerald-100" : "border-neutral-200"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium text-neutral-900">
                        {nova && (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            novo
                          </span>
                        )}
                        {item.orgao}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {item.municipio}/{item.uf} · {item.modalidade} · {item.situacao}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.distanceKm != null && (
                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                          {item.distanceKm} km
                        </span>
                      )}
                      {item.valorEstimado != null && item.valorEstimado > 0 && (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          {currency.format(item.valorEstimado)}
                        </span>
                      )}
                      {badge && (
                        <span className={`rounded-full px-3 py-1 text-xs ${badge.cls}`}>
                          {badge.text}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-neutral-700">
                    {item.objeto}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    {item.palavraCombinada && (
                      <span className="text-neutral-400">
                        apareceu por{" "}
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-600">
                          {item.palavraCombinada}
                        </span>
                      </span>
                    )}
                    {item.triagem && (
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          item.triagem.serve
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                        title={item.triagem.motivo}
                      >
                        IA: {item.triagem.motivo}
                      </span>
                    )}
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <a
                      href={linkDoEdital(item.numeroControlePNCP, item.link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand hover:underline"
                    >
                      Ver edital no portal de origem →
                    </a>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDescartar(item)}
                        title="Não interessa — some da busca e não volta"
                        className="rounded-full px-3 py-1.5 font-medium text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        Não interessa
                      </button>
                      <button
                        onClick={() => handleTrack(item)}
                        disabled={isTracked}
                        className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
                          isTracked
                            ? "bg-neutral-100 text-neutral-400"
                            : "bg-brand text-white hover:bg-brand-dark"
                        }`}
                      >
                        {isTracked ? "✓ No funil" : "+ Acompanhar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- funil */}
      {tab === "acompanhamento" && (
        <div className="space-y-4">
          {tracked.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
              <p className="text-sm font-medium text-neutral-700">
                Funil vazio.
              </p>
              <p className="mt-1.5 text-[12.5px] text-neutral-500">
                Em &quot;Oportunidades&quot;, clique em <b>+ Acompanhar</b> no que
                interessar.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200/70 bg-white px-5 py-3.5 shadow-sm">
                <p className="text-[13px] text-neutral-600">
                  <b className="font-semibold text-neutral-900">
                    {currency.format(valorNoFunil)}
                  </b>{" "}
                  em jogo · {tracked.length} licitação(ões) no funil
                </p>
                {encerradasNoFunil > 0 && (
                  <button
                    onClick={() => setMostrarEncerradas((v) => !v)}
                    className="text-[12px] font-medium text-neutral-500 hover:text-neutral-800"
                  >
                    {mostrarEncerradas ? "Esconder" : "Mostrar"} {encerradasNoFunil}{" "}
                    encerrada(s)
                  </button>
                )}
              </div>

              <div className="flex gap-3 overflow-x-auto pb-3">
                {STATUS_ORDER.map((status) => {
                  const items = tracked
                    .filter((t) => t.status === status)
                    .filter((t) => {
                      if (mostrarEncerradas) return true;
                      // Prazo vencido só significa "perdeu o bonde" nas três
                      // primeiras etapas. Da disputa em diante o prazo de
                      // proposta JÁ passou por definição — esconder por isso
                      // faria a licitação sumir do quadro justamente quando
                      // ela está andando.
                      const antesDaSessao =
                        status === "de_olho" ||
                        status === "preparando" ||
                        status === "enviada";
                      if (!antesDaSessao) return true;
                      return (daysUntil(t.dataEncerramentoProposta) ?? 1) >= 0;
                    });
                  const totalColuna = items.reduce(
                    (s, i) => s + (i.valorEstimado ?? 0),
                    0
                  );
                  const alvo = colunaAlvo === status;
                  return (
                    <div
                      key={status}
                      // Soltar em qualquer lugar da coluna funciona, inclusive
                      // no vazio embaixo dos cards — mirar num alvo pequeno com
                      // o mouse é o que torna kanban chato de usar.
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (colunaAlvo !== status) setColunaAlvo(status);
                      }}
                      onDragLeave={() => setColunaAlvo(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        soltarNaColuna(status);
                      }}
                      className={`flex w-[240px] shrink-0 flex-col gap-2 rounded-xl p-2 transition-colors ${
                        alvo ? "bg-brand-soft ring-2 ring-brand/30" : "bg-neutral-100/50"
                      }`}
                    >
                      <div className="px-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${STATUS_ACCENT[status]}`}
                          />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                            {STATUS_LABEL[status]}
                          </span>
                          <span className="ml-auto text-[11px] font-semibold text-neutral-400">
                            {items.length}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] leading-tight text-neutral-400">
                          {STATUS_AJUDA[status]}
                        </p>
                        {totalColuna > 0 && (
                          <p className="mt-1 text-[10.5px] font-semibold text-emerald-700">
                            {compacto.format(totalColuna)}
                          </p>
                        )}
                      </div>

                      <div className="flex min-h-[60px] flex-col gap-2">
                        {items.map((item) => {
                          const badge = deadlineBadge(item.dataEncerramentoProposta);
                          const encerrada =
                            (daysUntil(item.dataEncerramentoProposta) ?? 1) < 0;
                          const arrastando =
                            arrastado === item.numeroControlePNCP;
                          return (
                            <div
                              key={item.numeroControlePNCP}
                              draggable
                              onDragStart={() => setArrastado(item.numeroControlePNCP)}
                              onDragEnd={() => {
                                setArrastado(null);
                                setColunaAlvo(null);
                              }}
                              className={`cursor-grab rounded-xl border bg-white p-3 shadow-sm transition-all active:cursor-grabbing ${
                                arrastando
                                  ? "rotate-1 opacity-40 shadow-lg"
                                  : "hover:shadow-md"
                              } ${
                                encerrada
                                  ? "border-neutral-200 opacity-60"
                                  : "border-neutral-200"
                              }`}
                            >
                              <p className="text-[12.5px] font-semibold leading-snug text-neutral-900">
                                {item.orgao}
                              </p>
                              <p className="mt-0.5 text-[11px] text-neutral-500">
                                {item.municipio}/{item.uf}
                              </p>
                              <p className="mt-2 line-clamp-3 text-[11.5px] leading-relaxed text-neutral-600">
                                {item.objeto}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {item.valorEstimado != null && item.valorEstimado > 0 && (
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-medium text-emerald-700">
                                    {currency.format(item.valorEstimado)}
                                  </span>
                                )}
                                {badge && (
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10.5px] ${badge.cls}`}
                                  >
                                    {badge.text}
                                  </span>
                                )}
                              </div>

                              {item.aiSummary && (
                                <p className="mt-2 rounded-lg bg-brand-soft p-2 text-[11px] leading-relaxed text-neutral-700">
                                  {item.aiSummary}
                                </p>
                              )}

                              {editandoNota === item.numeroControlePNCP ? (
                                <div className="mt-2">
                                  <textarea
                                    value={notaRascunho}
                                    onChange={(e) => setNotaRascunho(e.target.value)}
                                    rows={3}
                                    autoFocus
                                    placeholder="Ex: pedir preço na Copozan, exige certidão X..."
                                    className="w-full rounded-lg border border-neutral-300 p-2 text-[11px] outline-none focus:border-brand"
                                  />
                                  <div className="mt-1 flex gap-2">
                                    <button
                                      onClick={async () => {
                                        await patchTracked(item.numeroControlePNCP, {
                                          notes: notaRascunho,
                                        });
                                        setEditandoNota(null);
                                      }}
                                      className="rounded-md bg-brand px-2.5 py-1 text-[10.5px] font-medium text-white"
                                    >
                                      Salvar
                                    </button>
                                    <button
                                      onClick={() => setEditandoNota(null)}
                                      className="text-[10.5px] text-neutral-400 hover:text-neutral-700"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditandoNota(item.numeroControlePNCP);
                                    setNotaRascunho(item.notes ?? "");
                                  }}
                                  className={`mt-2 block w-full rounded-lg border border-dashed p-1.5 text-left text-[11px] leading-relaxed transition-colors ${
                                    item.notes
                                      ? "border-neutral-200 text-neutral-600 hover:border-brand/40"
                                      : "border-neutral-200 text-neutral-400 hover:border-brand/40 hover:text-neutral-600"
                                  }`}
                                >
                                  {item.notes || "+ anotação"}
                                </button>
                              )}

                              <select
                                value={item.status}
                                onChange={(e) =>
                                  patchTracked(item.numeroControlePNCP, {
                                    status: e.target.value as LicitacaoStatus,
                                  })
                                }
                                className="mt-2 w-full rounded-md border border-neutral-300 px-1.5 py-1 text-[11px] outline-none focus:border-brand"
                              >
                                {STATUS_ORDER.map((s) => (
                                  <option key={s} value={s}>
                                    {STATUS_LABEL[s]}
                                  </option>
                                ))}
                              </select>

                              <div className="mt-2 flex items-center gap-2 text-[10.5px]">
                                <a
                                  href={linkDoEdital(item.numeroControlePNCP, item.link)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-brand hover:underline"
                                >
                                  Edital
                                </a>
                                <button
                                  onClick={() => handleSummarize(item.numeroControlePNCP)}
                                  disabled={summarizing === item.numeroControlePNCP}
                                  className="text-neutral-500 hover:text-brand disabled:opacity-50"
                                >
                                  {summarizing === item.numeroControlePNCP
                                    ? "Resumindo..."
                                    : item.aiSummary
                                      ? "Resumir de novo"
                                      : "Resumir c/ IA"}
                                </button>
                                <button
                                  onClick={() => quemCota(item)}
                                  className="text-neutral-500 hover:text-brand"
                                >
                                  Quem cota
                                </button>
                                <button
                                  onClick={() => handleUntrack(item.numeroControlePNCP)}
                                  className="ml-auto text-neutral-400 hover:text-red-600"
                                >
                                  Remover
                                </button>
                              </div>

                              {/* Fornecedores que atendem o objeto deste
                                  edital, pra pedir cotação sem sair da tela. */}
                              {cotacao?.numero === item.numeroControlePNCP && (
                                <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                                  {cotacao.carregando ? (
                                    <p className="text-[10.5px] text-neutral-500">
                                      Procurando…
                                    </p>
                                  ) : cotacao.lista.length === 0 ? (
                                    <p className="text-[10.5px] text-neutral-500">
                                      Nenhum fornecedor de licitação atende isso.
                                      Cadastre em Licitação → Fornecedores.
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {cotacao.lista.map((a) => (
                                        <div
                                          key={a.fornecedor.id}
                                          className="flex items-center gap-2"
                                        >
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1">
                                              <span className="truncate text-[11px] font-semibold text-neutral-800">
                                                {a.fornecedor.nome}
                                              </span>
                                              {a.fornecedor.usarEmLicitacao === "sim" ? (
                                                <span className="shrink-0 rounded bg-emerald-100 px-1 text-[9px] font-semibold text-emerald-700">
                                                  pode contar
                                                </span>
                                              ) : (
                                                <span className="shrink-0 rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-800">
                                                  falta testar
                                                </span>
                                              )}
                                            </div>
                                            <div className="truncate text-[10px] text-neutral-500">
                                              {a.categoriasQueBatem.join(", ")}
                                              {a.fornecedor.seguraPrecoDias != null &&
                                                ` · segura ${a.fornecedor.seguraPrecoDias}d`}
                                              {a.fornecedor.prazoEntregaDias != null &&
                                                ` · entrega ${a.fornecedor.prazoEntregaDias}d`}
                                              {a.fornecedor.condicaoPagamento &&
                                                ` · paga ${a.fornecedor.condicaoPagamento}`}
                                            </div>
                                          </div>
                                          {a.fornecedor.telefone ? (
                                            <a
                                              href={`https://wa.me/${
                                                a.fornecedor.telefone.startsWith("55")
                                                  ? a.fornecedor.telefone
                                                  : `55${a.fornecedor.telefone}`
                                              }`}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="shrink-0 rounded border border-[#25D366]/40 bg-[#25D366]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#128C7E]"
                                            >
                                              Cotar
                                            </a>
                                          ) : (
                                            <span className="shrink-0 text-[10px] text-neutral-400">
                                              sem telefone
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
