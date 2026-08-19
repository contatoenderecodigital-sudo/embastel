"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AtendeLicitacao,
  FornecedorLicitacao,
} from "@/lib/fornecedoresLicitacaoDb";
import { PATH_WHATSAPP } from "@/components/icones";

type Resumo = {
  total: number;
  prontos: number;
  confirmados: number;
  aPerguntar: number;
  semTelefone: number;
  semCategoria: number;
  semPrazo: number;
};

type Dados = {
  fornecedores: FornecedorLicitacao[];
  categorias: string[];
  categoriasSugeridas: string[];
  ufsSugeridas: string[];
  resumo: Resumo;
};

type Form = {
  id: string | null;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  email: string;
  contato: string;
  departamento: string;
  categorias: string[];
  atendeLicitacao: AtendeLicitacao;
  prazoEntregaDias: string;
  pedidoMinimo: string;
  condicaoPagamento: string;
  ufsQueAtende: string[];
  observacao: string;
};

const VAZIO: Form = {
  id: null,
  nome: "",
  razaoSocial: "",
  cnpj: "",
  telefone: "",
  email: "",
  contato: "",
  departamento: "",
  categorias: [],
  atendeLicitacao: "nao_sei",
  prazoEntregaDias: "",
  pedidoMinimo: "",
  condicaoPagamento: "",
  ufsQueAtende: [],
  observacao: "",
};

const ATENDE: Array<{ valor: AtendeLicitacao; rotulo: string; ajuda: string }> = [
  { valor: "sim", rotulo: "Sim", ajuda: "já faturou pra órgão público" },
  { valor: "nao", rotulo: "Não", ajuda: "não use em proposta" },
  { valor: "nao_sei", rotulo: "Não sei", ajuda: "falta perguntar" },
];

function formatarTelefone(digitos: string): string {
  const d = digitos.startsWith("55") ? digitos.slice(2) : digitos;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

function formatarCnpj(d: string): string {
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function linkWhatsapp(digitos: string): string {
  const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${numero}`;
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function CotacaoPage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [soProntos, setSoProntos] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [novaCategoria, setNovaCategoria] = useState("");

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/fornecedores-licitacao");
      if (!res.ok) throw new Error();
      setDados(await res.json());
    } catch {
      setErro("Não deu pra carregar os fornecedores de licitação.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    return dados.fornecedores.filter((f) => {
      if (filtroCategoria && !f.categorias.includes(filtroCategoria)) return false;
      if (soProntos && !(f.telefone && f.categorias.length && f.atendeLicitacao !== "nao"))
        return false;
      if (!termo) return true;
      return [
        f.nome,
        f.razaoSocial,
        f.contato,
        f.departamento,
        f.cnpj,
        f.telefone,
        f.condicaoPagamento,
        ...f.categorias,
        ...f.ufsQueAtende,
      ]
        .filter(Boolean)
        .some((campo) => campo.toLowerCase().includes(termo));
    });
  }, [dados, busca, filtroCategoria, soProntos]);

  function abrirEdicao(f: FornecedorLicitacao) {
    setErro(null);
    setForm({
      id: f.id,
      nome: f.nome,
      razaoSocial: f.razaoSocial,
      cnpj: f.cnpj,
      telefone: f.telefone,
      email: f.email,
      contato: f.contato,
      departamento: f.departamento,
      categorias: [...f.categorias],
      atendeLicitacao: f.atendeLicitacao,
      prazoEntregaDias: f.prazoEntregaDias == null ? "" : String(f.prazoEntregaDias),
      pedidoMinimo: f.pedidoMinimo,
      condicaoPagamento: f.condicaoPagamento,
      ufsQueAtende: [...f.ufsQueAtende],
      observacao: f.observacao,
    });
  }

  function alternar(campo: "categorias" | "ufsQueAtende", valor: string) {
    setForm((f) => {
      if (!f) return f;
      const atual = f[campo];
      return {
        ...f,
        [campo]: atual.includes(valor)
          ? atual.filter((c) => c !== valor)
          : [...atual, valor],
      };
    });
  }

  async function salvar() {
    if (!form) return;
    if (!form.nome.trim()) {
      setErro("O nome é obrigatório.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(
        form.id ? `/api/fornecedores-licitacao/${form.id}` : "/api/fornecedores-licitacao",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            prazoEntregaDias: form.prazoEntregaDias.trim()
              ? Number(form.prazoEntregaDias)
              : null,
          }),
        }
      );
      if (!res.ok) throw new Error();
      setForm(null);
      setNovaCategoria("");
      await carregar();
    } catch {
      setErro("Não deu pra salvar o fornecedor.");
    } finally {
      setSalvando(false);
    }
  }

  async function marcarCotacao(f: FornecedorLicitacao, evento: "pedida" | "respondida") {
    await fetch(`/api/fornecedores-licitacao/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cotacao: evento }),
    });
    await carregar();
  }

  async function excluir(f: FornecedorLicitacao) {
    if (!confirm(`Apagar "${f.nome}" da agenda de licitação?`)) return;
    await fetch(`/api/fornecedores-licitacao/${f.id}`, { method: "DELETE" });
    await carregar();
  }

  async function importar() {
    if (
      !confirm(
        "Trazer os fornecedores da lista da loja pra cá?\n\n" +
          "Copia só nome, telefone e categorias. Se ele fatura pra prefeitura, " +
          "prazo e pagamento entram como “não sei” — isso você confirma com cada um."
      )
    )
      return;
    setAviso(null);
    const res = await fetch("/api/fornecedores-licitacao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "importar-da-loja" }),
    });
    const { importados } = await res.json();
    setAviso(
      importados
        ? `${importados} fornecedor(es) trazido(s) da loja. Agora confirme com cada um se fatura pra órgão público.`
        : "Nenhum novo — todos os da loja já estão aqui."
    );
    await carregar();
  }

  if (!dados) {
    return <div className="p-8 text-sm text-neutral-500">Carregando fornecedores…</div>;
  }

  const categoriasDoForm = [
    ...new Set([
      ...dados.categoriasSugeridas,
      ...dados.categorias,
      ...(form?.categorias ?? []),
    ]),
  ];
  const ufsDoForm = [...new Set([...dados.ufsSugeridas, ...(form?.ufsQueAtende ?? [])])];

  // O formulário aparece em dois lugares: no topo quando é cadastro novo, e no
  // lugar do card quando é edição — com a lista longa, formulário que abre no
  // topo passa despercebido.
  function renderFormulario() {
    if (!form) return null;
    return (
      <div className="space-y-4 rounded-2xl border-2 border-brand/40 bg-white p-5 shadow-md">
        <div className="text-sm font-semibold text-neutral-900">
          {form.id ? `Editar ${form.nome}` : "Novo fornecedor de licitação"}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-neutral-600">
              Nome (como vocês chamam)
            </span>
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-[12px] font-medium text-neutral-600">
              Razão social{" "}
              <span className="text-neutral-400">— é a que vai no processo</span>
            </span>
            <input
              value={form.razaoSocial}
              onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-neutral-600">
              Telefone / WhatsApp
            </span>
            <input
              value={form.telefone}
              inputMode="tel"
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="49 99999-9999"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-neutral-600">Quem atende</span>
            <input
              value={form.contato}
              onChange={(e) => setForm({ ...form, contato: e.target.value })}
              placeholder="nome do vendedor"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-neutral-600">Departamento</span>
            <input
              value={form.departamento}
              onChange={(e) => setForm({ ...form, departamento: e.target.value })}
              placeholder="televendas, representante…"
              list="departamentos-licitacao"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-neutral-600">CNPJ</span>
            <input
              value={form.cnpj}
              inputMode="numeric"
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              placeholder="só números"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-[12px] font-medium text-neutral-600">
              E-mail <span className="text-neutral-400">— pra mandar a planilha de itens</span>
            </span>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>

        {/* -------------------------------------------- o que decide o uso -- */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
          <div className="mb-3 text-[12px] font-semibold text-neutral-700">
            O que decide se dá pra usar ele numa proposta
          </div>

          <div className="mb-3">
            <div className="mb-1.5 text-[12px] font-medium text-neutral-600">
              Fatura pra órgão público (aceita empenho, emite a nota)?
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ATENDE.map((op) => (
                <button
                  key={op.valor}
                  onClick={() => setForm({ ...form, atendeLicitacao: op.valor })}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                    form.atendeLicitacao === op.valor
                      ? "brand-gradient text-white shadow-sm"
                      : "border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {op.rotulo}
                  <span className="ml-1 font-normal opacity-70">— {op.ajuda}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Entrega em quantos dias
              </span>
              <input
                value={form.prazoEntregaDias}
                inputMode="numeric"
                onChange={(e) =>
                  setForm({ ...form, prazoEntregaDias: e.target.value.replace(/\D/g, "") })
                }
                placeholder="ex: 10"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Pedido mínimo
              </span>
              <input
                value={form.pedidoMinimo}
                onChange={(e) => setForm({ ...form, pedidoMinimo: e.target.value })}
                placeholder="ex: 20 caixas, R$ 1.500"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Condição de pagamento
              </span>
              <input
                value={form.condicaoPagamento}
                onChange={(e) => setForm({ ...form, condicaoPagamento: e.target.value })}
                placeholder="ex: 30 dias, à vista"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
          </div>

          <div className="mt-3">
            <div className="mb-1.5 text-[12px] font-medium text-neutral-600">
              Entrega para
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ufsDoForm.map((uf) => {
                const marcada = form.ufsQueAtende.includes(uf);
                return (
                  <button
                    key={uf}
                    onClick={() => alternar("ufsQueAtende", uf)}
                    className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                      marcada
                        ? "brand-gradient text-white shadow-sm"
                        : "border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {marcada ? "✓ " : "+ "}
                    {uf}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------ categorias */}
        <div>
          <div className="mb-2 text-[12px] font-medium text-neutral-600">
            O que ele cota{" "}
            <span className="text-neutral-400">
              — é isto que faz ele aparecer no &quot;Quem cota&quot; do edital
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categoriasDoForm.map((c) => {
              const marcada = form.categorias.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => alternar("categorias", c)}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                    marcada
                      ? "brand-gradient text-white shadow-sm"
                      : "border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {marcada ? "✓ " : "+ "}
                  {c}
                </button>
              );
            })}
          </div>
          <input
            value={novaCategoria}
            onChange={(e) => setNovaCategoria(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !novaCategoria.trim()) return;
              e.preventDefault();
              alternar("categorias", novaCategoria.trim());
              setNovaCategoria("");
            }}
            placeholder="Outra categoria (Enter pra adicionar)"
            className="mt-2 w-64 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-neutral-600">
            Informações relevantes
          </span>
          <input
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            placeholder="ex: só cota com planilha em Excel, frete por conta dele acima de R$ 3 mil"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>

        <div className="flex gap-2">
          <button
            onClick={salvar}
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
    );
  }

  const { resumo } = dados;

  return (
    <div className="space-y-5 p-6 md:p-8">
      <datalist id="departamentos-licitacao">
        {[...new Set(dados.fornecedores.map((f) => f.departamento).filter(Boolean))].map(
          (d) => (
            <option key={d} value={d} />
          )
        )}
      </datalist>

      <header>
        <h1 className="text-2xl font-bold text-neutral-900">
          Fornecedores de licitação
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Quem dá pra colocar numa proposta. Não é a lista da loja: aqui interessa
          se ele fatura pra prefeitura, em quantos dias entrega, como cobra e se
          responde cotação. É esta lista que o botão &quot;Quem cota&quot; do
          edital consulta.
        </p>
      </header>

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

      {/* --------------------------------------------------------- resumo -- */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            rotulo: "Prontos pra cotar",
            valor: resumo.prontos,
            ajuda: "com telefone e categoria",
            forte: true,
          },
          {
            rotulo: "Faturam pra prefeitura",
            valor: resumo.confirmados,
            ajuda: "confirmado com eles",
          },
          {
            rotulo: "Falta perguntar",
            valor: resumo.aPerguntar,
            ajuda: "não sabemos se faturam",
          },
          {
            rotulo: "Sem prazo de entrega",
            valor: resumo.semPrazo,
            ajuda: "não dá pra saber se cabe no edital",
          },
        ].map((c) => (
          <div
            key={c.rotulo}
            className={`rounded-2xl border px-4 py-3 shadow-sm ${
              c.forte
                ? "border-emerald-200 bg-emerald-50"
                : "border-neutral-200/70 bg-white"
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {c.rotulo}
            </div>
            <div className="text-2xl font-bold text-neutral-900">{c.valor}</div>
            <div className="text-[11px] text-neutral-500">{c.ajuda}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            form?.id === null ? setForm(null) : (setErro(null), setForm({ ...VAZIO }))
          }
          className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          {form?.id === null ? "Fechar formulário" : "Cadastrar fornecedor"}
        </button>
        <button
          onClick={importar}
          title="Copia os fornecedores da agenda da loja pra cá"
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Trazer da lista da loja
        </button>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, contato, CNPJ, telefone, categoria ou UF"
          className="min-w-[240px] flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setSoProntos(!soProntos)}
          className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
            soProntos
              ? "brand-gradient text-white shadow-sm"
              : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          Só quem dá pra cotar hoje ({resumo.prontos})
        </button>
        {dados.categorias.length > 0 && (
          <>
            <span className="mx-1 text-neutral-300">|</span>
            <button
              onClick={() => setFiltroCategoria("")}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                filtroCategoria === ""
                  ? "brand-gradient text-white shadow-sm"
                  : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              Toda categoria
            </button>
            {dados.categorias.map((c) => {
              const quantos = dados.fornecedores.filter((f) =>
                f.categorias.includes(c)
              ).length;
              return (
                <button
                  key={c}
                  onClick={() => setFiltroCategoria(filtroCategoria === c ? "" : c)}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                    filtroCategoria === c
                      ? "brand-gradient text-white shadow-sm"
                      : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {c} ({quantos})
                </button>
              );
            })}
          </>
        )}
      </div>

      {form?.id === null && renderFormulario()}

      {/* ---------------------------------------------------------- lista -- */}
      {dados.fornecedores.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-neutral-700">
            Nenhum fornecedor de licitação ainda.
          </p>
          <p className="mx-auto mt-1 max-w-lg text-[12.5px] text-neutral-500">
            Comece trazendo os da lista da loja — depois é só ligar pra cada um e
            confirmar se fatura pra prefeitura, em quantos dias entrega e como
            cobra.
          </p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-neutral-700">
            Nenhum fornecedor bate com esse filtro.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filtrados.map((f) =>
            form?.id === f.id ? (
              <div key={f.id} className="md:col-span-2">
                {renderFormulario()}
              </div>
            ) : (
              <div
                key={f.id}
                className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[160px] flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[14px] font-semibold text-neutral-900">
                        {f.nome}
                      </span>
                      {f.atendeLicitacao === "sim" && (
                        <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                          fatura pra prefeitura
                        </span>
                      )}
                      {f.atendeLicitacao === "nao" && (
                        <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-red-700">
                          não usar em proposta
                        </span>
                      )}
                      {f.atendeLicitacao === "nao_sei" && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-800">
                          falta perguntar
                        </span>
                      )}
                      {f.departamento && (
                        <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10.5px] font-medium text-neutral-600">
                          {f.departamento}
                        </span>
                      )}
                    </div>
                    {f.razaoSocial && (
                      <div className="text-[11.5px] text-neutral-500">
                        {f.razaoSocial}
                      </div>
                    )}
                    <div className="mt-0.5 text-[11.5px] text-neutral-500">
                      {f.contato && `${f.contato} · `}
                      {f.telefone ? formatarTelefone(f.telefone) : "sem telefone"}
                      {f.cnpj && ` · ${formatarCnpj(f.cnpj)}`}
                    </div>
                    {f.email && (
                      <div className="text-[11.5px] text-neutral-500">{f.email}</div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {f.telefone && (
                      <a
                        href={linkWhatsapp(f.telefone)}
                        target="_blank"
                        rel="noreferrer"
                        title="Pedir cotação no WhatsApp"
                        className="flex items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-2.5 py-1.5 text-[12px] font-semibold text-[#128C7E] hover:bg-[#25D366]/20"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-3.5 w-3.5"
                        >
                          {PATH_WHATSAPP}
                        </svg>
                        Cotar
                      </a>
                    )}
                    <button
                      onClick={() => abrirEdicao(f)}
                      className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium ${
                        f.telefone && f.categorias.length && f.atendeLicitacao !== "nao_sei"
                          ? "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                          : "brand-gradient text-white shadow-sm"
                      }`}
                    >
                      {f.telefone && f.categorias.length && f.atendeLicitacao !== "nao_sei"
                        ? "Editar"
                        : "Completar"}
                    </button>
                    <button
                      onClick={() => excluir(f)}
                      className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50"
                    >
                      Apagar
                    </button>
                  </div>
                </div>

                {/* ------------------------------------------- as condições */}
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-neutral-600">
                  <span>
                    {f.prazoEntregaDias != null ? (
                      <>
                        Entrega em{" "}
                        <b className="font-semibold">{f.prazoEntregaDias} dias</b>
                      </>
                    ) : (
                      <span className="text-amber-700">prazo de entrega não sei</span>
                    )}
                  </span>
                  {f.pedidoMinimo && <span>Mín. {f.pedidoMinimo}</span>}
                  {f.condicaoPagamento && <span>Paga em {f.condicaoPagamento}</span>}
                  {f.ufsQueAtende.length > 0 && (
                    <span>Entrega {f.ufsQueAtende.join(", ")}</span>
                  )}
                </div>

                {f.observacao && (
                  <div className="mt-1 text-[11.5px] text-neutral-500">
                    {f.observacao}
                  </div>
                )}

                {f.categorias.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {f.categorias.map((c) => (
                      <span
                        key={c}
                        className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-[11.5px] text-amber-700">
                    Sem categoria — não vai aparecer no &quot;Quem cota&quot;.
                  </div>
                )}

                {/* ------------------------------------- histórico de resposta */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-2.5">
                  <span className="text-[11.5px] text-neutral-500">
                    {f.cotacoesPedidas === 0 ? (
                      "Nunca foi cotado"
                    ) : (
                      <>
                        Respondeu{" "}
                        <b className="font-semibold text-neutral-700">
                          {f.cotacoesRespondidas} de {f.cotacoesPedidas}
                        </b>{" "}
                        cotações
                        {f.ultimaCotacaoEm && ` · última em ${dataCurta(f.ultimaCotacaoEm)}`}
                      </>
                    )}
                  </span>
                  <button
                    onClick={() => marcarCotacao(f, "pedida")}
                    className="ml-auto rounded-lg border border-neutral-300 px-2 py-1 text-[11.5px] font-medium text-neutral-600 hover:bg-neutral-50"
                  >
                    Pedi cotação
                  </button>
                  <button
                    onClick={() => marcarCotacao(f, "respondida")}
                    className="rounded-lg border border-emerald-300 px-2 py-1 text-[11.5px] font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    Respondeu
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
