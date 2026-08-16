"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContratoCalculado, TipoContrato } from "@/lib/contratosDb";

type Ganha = {
  numeroControlePNCP: string;
  objeto: string;
  orgao: string;
  municipio: string;
  uf: string;
  valorEstimado: number | null;
};

type Dados = {
  contratos: ContratoCalculado[];
  ganhasSemContrato: Ganha[];
  resumo: {
    ativos: number;
    valorTotal: number;
    saldoAFornecer: number;
    aReceber: number;
    emAtraso: number;
    vencendo: number;
  };
};

type LinhaItem = {
  id?: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  precoUnitario: string;
};

type FormContrato = {
  id: string | null;
  tipo: TipoContrato;
  numero: string;
  orgao: string;
  municipio: string;
  uf: string;
  numeroControlePNCP: string | null;
  vigenciaInicio: string;
  vigenciaFim: string;
  observacao: string;
  itens: LinhaItem[];
};

const LINHA_VAZIA: LinhaItem = {
  descricao: "",
  unidade: "un",
  quantidade: "",
  precoUnitario: "",
};

const FORM_VAZIO: FormContrato = {
  id: null,
  tipo: "ata",
  numero: "",
  orgao: "",
  municipio: "",
  uf: "SC",
  numeroControlePNCP: null,
  vigenciaInicio: "",
  vigenciaFim: "",
  observacao: "",
  itens: [{ ...LINHA_VAZIA }],
};

function dinheiro(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

function numero(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function ContratosPage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [form, setForm] = useState<FormContrato | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  // Novo fornecimento sendo montado, por contrato.
  const [entrega, setEntrega] = useState<{
    contratoId: string;
    numeroEmpenho: string;
    data: string;
    notaFiscal: string;
    notaEmitidaEm: string;
    prazoPagamentoDias: string;
    quantidades: Record<string, string>;
  } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/contratos");
      if (!res.ok) throw new Error();
      setDados(await res.json());
    } catch {
      setErro("Não deu pra carregar os contratos.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  function abrirNovo(daLicitacao?: Ganha) {
    setErro(null);
    setSucesso(null);
    setForm({
      ...FORM_VAZIO,
      itens: [{ ...LINHA_VAZIA }],
      orgao: daLicitacao?.orgao ?? "",
      municipio: daLicitacao?.municipio ?? "",
      uf: daLicitacao?.uf ?? "SC",
      numeroControlePNCP: daLicitacao?.numeroControlePNCP ?? null,
      observacao: daLicitacao?.objeto ?? "",
    });
  }

  function abrirEdicao(c: ContratoCalculado) {
    setErro(null);
    setSucesso(null);
    setForm({
      id: c.id,
      tipo: c.tipo,
      numero: c.numero,
      orgao: c.orgao,
      municipio: c.municipio,
      uf: c.uf,
      numeroControlePNCP: c.numeroControlePNCP,
      vigenciaInicio: c.vigenciaInicio ?? "",
      vigenciaFim: c.vigenciaFim ?? "",
      observacao: c.observacao ?? "",
      itens: c.itens.map((i) => ({
        id: i.id,
        descricao: i.descricao,
        unidade: i.unidade,
        quantidade: String(i.quantidade),
        precoUnitario: String(i.precoUnitario),
      })),
    });
  }

  async function salvarContrato() {
    if (!form) return;
    setSalvando(true);
    setErro(null);
    try {
      const corpo = {
        tipo: form.tipo,
        numero: form.numero,
        orgao: form.orgao,
        municipio: form.municipio,
        uf: form.uf,
        numeroControlePNCP: form.numeroControlePNCP,
        vigenciaInicio: form.vigenciaInicio || null,
        vigenciaFim: form.vigenciaFim || null,
        observacao: form.observacao,
        itens: form.itens
          .filter((i) => i.descricao.trim())
          .map((i) => ({
            id: i.id,
            descricao: i.descricao,
            unidade: i.unidade,
            quantidade: Number(i.quantidade.replace(",", ".")) || 0,
            precoUnitario: Number(i.precoUnitario.replace(",", ".")) || 0,
          })),
      };
      const res = await fetch(
        form.id ? `/api/contratos/${form.id}` : "/api/contratos",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        }
      );
      if (!res.ok) throw new Error();
      setForm(null);
      await carregar();
      setSucesso(form.id ? "Contrato atualizado." : "Contrato cadastrado.");
    } catch {
      setErro("Não deu pra salvar o contrato.");
    } finally {
      setSalvando(false);
    }
  }

  function abrirEntrega(c: ContratoCalculado) {
    setEntrega({
      contratoId: c.id,
      numeroEmpenho: "",
      data: hojeISO(),
      notaFiscal: "",
      notaEmitidaEm: "",
      prazoPagamentoDias: "30",
      quantidades: {},
    });
    setAberto(c.id);
  }

  async function salvarEntrega() {
    if (!entrega) return;
    const itens = Object.entries(entrega.quantidades)
      .map(([itemId, q]) => ({
        itemId,
        quantidade: Number(q.replace(",", ".")) || 0,
      }))
      .filter((i) => i.quantidade > 0);
    if (!itens.length) {
      setErro("Informe a quantidade de pelo menos um item.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/contratos/${entrega.contratoId}/fornecimentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroEmpenho: entrega.numeroEmpenho,
          data: entrega.data,
          notaFiscal: entrega.notaFiscal,
          notaEmitidaEm: entrega.notaEmitidaEm || null,
          prazoPagamentoDias: Number(entrega.prazoPagamentoDias) || 30,
          itens,
        }),
      });
      if (!res.ok) throw new Error();
      setEntrega(null);
      await carregar();
      setSucesso("Fornecimento registrado. O saldo já foi baixado.");
    } catch {
      setErro("Não deu pra registrar o fornecimento.");
    } finally {
      setSalvando(false);
    }
  }

  async function marcarPago(contratoId: string, fornecimentoId: string) {
    await fetch(`/api/contratos/${contratoId}/fornecimentos/${fornecimentoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pagoEm: hojeISO() }),
    });
    await carregar();
    setSucesso("Pagamento registrado.");
  }

  async function desfazerPago(contratoId: string, fornecimentoId: string) {
    await fetch(`/api/contratos/${contratoId}/fornecimentos/${fornecimentoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pagoEm: null }),
    });
    await carregar();
  }

  async function alternarEncerrado(c: ContratoCalculado) {
    await fetch(`/api/contratos/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encerrado: !c.encerrado }),
    });
    await carregar();
  }

  async function excluir(c: ContratoCalculado) {
    if (
      !confirm(
        `Apagar ${c.tipo === "ata" ? "a ata" : "o contrato"} ${c.numero}? Os fornecimentos e o histórico de pagamento vão junto.`
      )
    ) {
      return;
    }
    await fetch(`/api/contratos/${c.id}`, { method: "DELETE" });
    await carregar();
    setSucesso("Apagado.");
  }

  if (!dados) {
    return <div className="p-8 text-sm text-neutral-500">Carregando contratos…</div>;
  }

  const { resumo } = dados;

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-bold text-neutral-900">
          Contratos e atas de registro de preços
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          O que acontece depois de ganhar: quanto ainda dá pra fornecer, até
          quando a ata vale, e quanto a prefeitura está devendo.
        </p>
      </header>

      {/* ---------------------------------------------------------- resumo -- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Saldo a fornecer", dinheiro(resumo.saldoAFornecer), "text-neutral-900"],
            ["A receber", dinheiro(resumo.aReceber), "text-sky-700"],
            [
              "Atrasado",
              dinheiro(resumo.emAtraso),
              resumo.emAtraso > 0 ? "text-red-600" : "text-neutral-300",
            ],
            [
              "Vencendo em 60 dias",
              String(resumo.vencendo),
              resumo.vencendo > 0 ? "text-orange-600" : "text-neutral-300",
            ],
          ] as Array<[string, string, string]>
        ).map(([rotulo, valor, cor]) => (
          <div
            key={rotulo}
            className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-4 shadow-sm"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {rotulo}
            </div>
            <div className={`mt-1 text-xl font-bold ${cor}`}>{valor}</div>
          </div>
        ))}
      </div>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sucesso}
        </div>
      )}

      {/* ------------------------------------------- ganhou e não cadastrou -- */}
      {dados.ganhasSemContrato.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="text-sm font-semibold text-emerald-900">
            Licitações ganhas que ainda não viraram contrato
          </div>
          <div className="mt-3 space-y-2">
            {dados.ganhasSemContrato.map((g) => (
              <div
                key={g.numeroControlePNCP}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-2"
              >
                <div className="min-w-[200px] flex-1">
                  <div className="text-[13px] font-medium text-neutral-900">
                    {g.orgao}
                  </div>
                  <div className="text-[11.5px] text-neutral-500">
                    {g.municipio}/{g.uf} · {g.objeto.slice(0, 90)}
                  </div>
                </div>
                <button
                  onClick={() => abrirNovo(g)}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  Cadastrar contrato
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <button
          onClick={() => (form ? setForm(null) : abrirNovo())}
          className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          {form ? "Fechar formulário" : "Cadastrar contrato ou ata"}
        </button>
      </div>

      {/* ------------------------------------------------------ formulário -- */}
      {form && (
        <div className="space-y-4 rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-neutral-900">
            {form.id ? "Editar" : "Novo contrato / ata"}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">Tipo</span>
              <select
                value={form.tipo}
                onChange={(e) =>
                  setForm({ ...form, tipo: e.target.value as TipoContrato })
                }
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                <option value="ata">Ata de registro de preços</option>
                <option value="contrato">Contrato</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">Número</span>
              <input
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                placeholder="ex: 75/2025"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[12px] font-medium text-neutral-600">Órgão</span>
              <input
                value={form.orgao}
                onChange={(e) => setForm({ ...form, orgao: e.target.value })}
                placeholder="ex: Prefeitura Municipal de Faxinal dos Guedes"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[12px] font-medium text-neutral-600">Município</span>
              <input
                value={form.municipio}
                onChange={(e) => setForm({ ...form, municipio: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">UF</span>
              <input
                value={form.uf}
                maxLength={2}
                onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm uppercase outline-none focus:border-brand"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Vigência — início
              </span>
              <input
                type="date"
                value={form.vigenciaInicio}
                onChange={(e) => setForm({ ...form, vigenciaInicio: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Vigência — fim
              </span>
              <input
                type="date"
                value={form.vigenciaFim}
                onChange={(e) => setForm({ ...form, vigenciaFim: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            <label className="flex flex-col gap-1 md:col-span-4">
              <span className="text-[12px] font-medium text-neutral-600">
                Objeto / observação
              </span>
              <textarea
                value={form.observacao}
                rows={2}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
          </div>

          {/* ------------------------------------------------------- itens -- */}
          <div className="space-y-2">
            <div className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
              Itens registrados
            </div>
            {form.itens.map((linha, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-12">
                <input
                  value={linha.descricao}
                  onChange={(e) => {
                    const itens = [...form.itens];
                    itens[idx] = { ...linha, descricao: e.target.value };
                    setForm({ ...form, itens });
                  }}
                  placeholder="Descrição do item"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand md:col-span-5"
                />
                <input
                  value={linha.unidade}
                  onChange={(e) => {
                    const itens = [...form.itens];
                    itens[idx] = { ...linha, unidade: e.target.value };
                    setForm({ ...form, itens });
                  }}
                  placeholder="un"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand md:col-span-2"
                />
                <input
                  value={linha.quantidade}
                  inputMode="decimal"
                  onChange={(e) => {
                    const itens = [...form.itens];
                    itens[idx] = { ...linha, quantidade: e.target.value };
                    setForm({ ...form, itens });
                  }}
                  placeholder="Qtd"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand md:col-span-2"
                />
                <input
                  value={linha.precoUnitario}
                  inputMode="decimal"
                  onChange={(e) => {
                    const itens = [...form.itens];
                    itens[idx] = { ...linha, precoUnitario: e.target.value };
                    setForm({ ...form, itens });
                  }}
                  placeholder="Preço un."
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand md:col-span-2"
                />
                <button
                  onClick={() =>
                    setForm({
                      ...form,
                      itens: form.itens.filter((_, i) => i !== idx),
                    })
                  }
                  className="rounded-lg border border-neutral-300 px-2 py-2 text-[12px] text-neutral-600 hover:bg-neutral-50 md:col-span-1"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setForm({ ...form, itens: [...form.itens, { ...LINHA_VAZIA }] })
              }
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-50"
            >
              + Adicionar item
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={salvarContrato}
              disabled={salvando}
              className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <button
              onClick={() => setForm(null)}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- lista -- */}
      {dados.contratos.length === 0 && !form && (
        <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-neutral-700">
            Nenhum contrato cadastrado.
          </p>
          <p className="mt-1.5 text-[12.5px] text-neutral-500">
            Quando uma licitação for pra &quot;ganhou&quot; no kanban, ela aparece
            aqui em cima pra virar contrato com um clique.
          </p>
        </div>
      )}

      {dados.contratos.map((c) => {
        const expandido = aberto === c.id;
        const vencendo =
          c.diasAteFimVigencia != null && c.diasAteFimVigencia <= 60 && !c.encerrado;
        return (
          <div
            key={c.id}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
              c.encerrado
                ? "border-neutral-200/70 opacity-60"
                : c.vigenciaVencida
                  ? "border-red-300"
                  : vencendo
                    ? "border-orange-300"
                    : "border-neutral-200/70"
            }`}
          >
            <div className="flex flex-wrap items-start gap-3 px-5 py-4">
              <div className="min-w-[240px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-neutral-600">
                    {c.tipo === "ata" ? "Ata de registro" : "Contrato"}
                  </span>
                  <span className="text-[14px] font-bold text-neutral-900">
                    {c.numero}
                  </span>
                  {c.encerrado && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10.5px] font-semibold text-neutral-500">
                      encerrado
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[13px] text-neutral-700">{c.orgao}</div>
                <div className="text-[11.5px] text-neutral-500">
                  {c.municipio}
                  {c.uf && `/${c.uf}`} · vigência {formatarData(c.vigenciaInicio)} a{" "}
                  {formatarData(c.vigenciaFim)}
                  {c.diasAteFimVigencia != null &&
                    !c.encerrado &&
                    (c.vigenciaVencida
                      ? ` · VENCIDA há ${Math.abs(c.diasAteFimVigencia)} dia(s)`
                      : ` · faltam ${c.diasAteFimVigencia} dias`)}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-1.5">
                <button
                  onClick={() => (expandido ? setAberto(null) : setAberto(c.id))}
                  className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  {expandido ? "Fechar" : "Abrir"}
                </button>
                <button
                  onClick={() => abrirEntrega(c)}
                  className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Registrar fornecimento
                </button>
                <button
                  onClick={() => abrirEdicao(c)}
                  className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => alternarEncerrado(c)}
                  className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  {c.encerrado ? "Reabrir" : "Encerrar"}
                </button>
                <button
                  onClick={() => excluir(c)}
                  className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50"
                >
                  Apagar
                </button>
              </div>
            </div>

            {/* ------------------------------------------------ barra saldo -- */}
            <div className="px-5 pb-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full ${
                    c.percentualUsado >= 0.9 ? "bg-orange-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, c.percentualUsado * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
                <span className="text-neutral-500">
                  Total{" "}
                  <b className="font-semibold text-neutral-800">
                    {dinheiro(c.valorTotal)}
                  </b>
                </span>
                <span className="text-neutral-500">
                  Fornecido{" "}
                  <b className="font-semibold text-neutral-800">
                    {dinheiro(c.valorFornecido)}
                  </b>{" "}
                  ({Math.round(c.percentualUsado * 100)}%)
                </span>
                <span className="text-neutral-500">
                  Saldo{" "}
                  <b className="font-semibold text-emerald-700">
                    {dinheiro(c.saldoValor)}
                  </b>
                </span>
                {c.aReceber > 0 && (
                  <span className="text-neutral-500">
                    A receber{" "}
                    <b className="font-semibold text-sky-700">{dinheiro(c.aReceber)}</b>
                  </span>
                )}
                {c.emAtraso > 0 && (
                  <span className="text-neutral-500">
                    Atrasado{" "}
                    <b className="font-semibold text-red-600">{dinheiro(c.emAtraso)}</b>
                  </span>
                )}
              </div>
            </div>

            {/* --------------------------------------------- novo fornecimento */}
            {entrega?.contratoId === c.id && (
              <div className="border-t border-neutral-100 bg-sky-50/50 px-5 py-4">
                <div className="mb-3 text-[12px] font-bold uppercase tracking-wider text-neutral-600">
                  Novo fornecimento (empenho / ordem)
                </div>
                <div className="grid gap-2 md:grid-cols-4">
                  <input
                    value={entrega.numeroEmpenho}
                    onChange={(e) =>
                      setEntrega({ ...entrega, numeroEmpenho: e.target.value })
                    }
                    placeholder="Nº do empenho"
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <input
                    type="date"
                    value={entrega.data}
                    onChange={(e) => setEntrega({ ...entrega, data: e.target.value })}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <input
                    value={entrega.notaFiscal}
                    onChange={(e) =>
                      setEntrega({ ...entrega, notaFiscal: e.target.value })
                    }
                    placeholder="Nº da nota fiscal"
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={entrega.notaEmitidaEm}
                      onChange={(e) =>
                        setEntrega({ ...entrega, notaEmitidaEm: e.target.value })
                      }
                      title="Data de emissão da nota"
                      className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-brand"
                    />
                    <input
                      value={entrega.prazoPagamentoDias}
                      inputMode="numeric"
                      onChange={(e) =>
                        setEntrega({ ...entrega, prazoPagamentoDias: e.target.value })
                      }
                      title="Prazo de pagamento em dias"
                      className="w-16 shrink-0 rounded-lg border border-neutral-300 px-2 py-2 text-center text-sm outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                  <table className="w-full text-left">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="w-28 px-3 py-2 text-right">Saldo</th>
                        <th className="w-32 px-3 py-2 text-center">Fornecer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.itensComSaldo.map((item) => {
                        const digitado = entrega.quantidades[item.id] ?? "";
                        const acima =
                          Number(digitado.replace(",", ".")) > item.saldoQuantidade;
                        return (
                          <tr
                            key={item.id}
                            className="border-b border-neutral-100 last:border-0"
                          >
                            <td className="px-3 py-2 text-[13px] text-neutral-800">
                              {item.descricao}
                              <span className="ml-1 text-[11px] text-neutral-400">
                                {dinheiro(item.precoUnitario)}/{item.unidade}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-[12.5px] text-neutral-600">
                              {numero(item.saldoQuantidade)} {item.unidade}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={digitado}
                                inputMode="decimal"
                                onChange={(e) =>
                                  setEntrega({
                                    ...entrega,
                                    quantidades: {
                                      ...entrega.quantidades,
                                      [item.id]: e.target.value,
                                    },
                                  })
                                }
                                className={`w-full rounded-lg border px-2 py-1.5 text-center text-sm outline-none ${
                                  acima
                                    ? "border-red-400 bg-red-50 text-red-700"
                                    : "border-neutral-300 focus:border-brand"
                                }`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={salvarEntrega}
                    disabled={salvando}
                    className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                  >
                    {salvando ? "Salvando…" : "Registrar"}
                  </button>
                  <button
                    onClick={() => setEntrega(null)}
                    className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* -------------------------------------------------- expandido -- */}
            {expandido && (
              <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4">
                {c.observacao && (
                  <p className="mb-3 text-[12.5px] text-neutral-600">{c.observacao}</p>
                )}

                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Itens e saldo
                </div>
                <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                  <table className="w-full min-w-[560px] text-left">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2 text-right">Registrado</th>
                        <th className="px-3 py-2 text-right">Fornecido</th>
                        <th className="px-3 py-2 text-right">Saldo</th>
                        <th className="px-3 py-2 text-right">Valor do saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.itensComSaldo.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-neutral-100 last:border-0"
                        >
                          <td className="px-3 py-2 text-[13px] text-neutral-800">
                            {item.descricao}
                          </td>
                          <td className="px-3 py-2 text-right text-[12.5px] text-neutral-600">
                            {numero(item.quantidade)} {item.unidade}
                          </td>
                          <td className="px-3 py-2 text-right text-[12.5px] text-neutral-600">
                            {numero(item.quantidadeFornecida)}
                          </td>
                          <td
                            className={`px-3 py-2 text-right text-[12.5px] font-semibold ${
                              item.saldoQuantidade === 0
                                ? "text-neutral-400"
                                : "text-emerald-700"
                            }`}
                          >
                            {numero(item.saldoQuantidade)}
                          </td>
                          <td className="px-3 py-2 text-right text-[12.5px] text-neutral-600">
                            {dinheiro(item.saldoQuantidade * item.precoUnitario)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Fornecimentos e pagamento
                </div>
                {c.fornecimentosCalculados.length === 0 ? (
                  <p className="text-[12.5px] text-neutral-500">
                    Nada fornecido ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {c.fornecimentosCalculados.map((f) => (
                      <div
                        key={f.id}
                        className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white px-3 py-2.5 ${
                          f.diasDeAtraso > 0 ? "border-red-300" : "border-neutral-200"
                        }`}
                      >
                        <div className="min-w-[200px] flex-1">
                          <div className="text-[13px] font-medium text-neutral-900">
                            {dinheiro(f.valor)}
                            {f.numeroEmpenho && (
                              <span className="ml-2 text-[11.5px] font-normal text-neutral-500">
                                empenho {f.numeroEmpenho}
                              </span>
                            )}
                          </div>
                          <div className="text-[11.5px] text-neutral-500">
                            {formatarData(f.data)}
                            {f.notaFiscal && ` · NF ${f.notaFiscal}`}
                            {f.notaEmitidaEm &&
                              ` · emitida ${formatarData(f.notaEmitidaEm)}`}
                            {f.vencePagamentoEm &&
                              ` · vence ${formatarData(f.vencePagamentoEm)}`}
                          </div>
                        </div>

                        {f.pago ? (
                          <>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              Pago em {formatarData(f.pagoEm)}
                            </span>
                            <button
                              onClick={() => desfazerPago(c.id, f.id)}
                              className="text-[11.5px] text-neutral-500 underline"
                            >
                              desfazer
                            </button>
                          </>
                        ) : (
                          <>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                f.diasDeAtraso > 0
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : f.notaEmitidaEm
                                    ? "border-sky-200 bg-sky-50 text-sky-700"
                                    : "border-neutral-200 bg-neutral-50 text-neutral-600"
                              }`}
                            >
                              {f.diasDeAtraso > 0
                                ? `Atrasado ${f.diasDeAtraso} dia(s)`
                                : f.notaEmitidaEm
                                  ? "A receber"
                                  : "Sem nota emitida"}
                            </span>
                            <button
                              onClick={() => marcarPago(c.id, f.id)}
                              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-800 hover:bg-emerald-100"
                            >
                              Recebi
                            </button>
                          </>
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
  );
}
