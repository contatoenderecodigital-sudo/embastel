"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FornecedorLicitacao,
  TresEstados,
  UsarEmLicitacao,
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
  semTravaDePreco: number;
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
  telefone: string;
  contato: string;
  categorias: string[];
  usarEmLicitacao: UsarEmLicitacao;
  seguraPrecoDias: string;
  prazoEntregaDias: string;
  pedidoMinimo: string;
  condicaoPagamento: string;
  mandaFichaTecnica: TresEstados;
  capacidade: string;
  ufsQueAtende: string[];
  observacao: string;
};

const VAZIO: Form = {
  id: null,
  nome: "",
  telefone: "",
  contato: "",
  categorias: [],
  usarEmLicitacao: "nao_sei",
  seguraPrecoDias: "",
  prazoEntregaDias: "",
  pedidoMinimo: "",
  condicaoPagamento: "",
  mandaFichaTecnica: "nao_sei",
  capacidade: "",
  ufsQueAtende: [],
  observacao: "",
};

const USAR: Array<{ valor: UsarEmLicitacao; rotulo: string; ajuda: string }> = [
  { valor: "sim", rotulo: "Pode contar", ajuda: "já provou que segura" },
  { valor: "nao", rotulo: "Não usar", ajuda: "some do Quem cota" },
  { valor: "nao_sei", rotulo: "Ainda não sei", ajuda: "falta testar" },
];

const FICHA: Array<{ valor: TresEstados; rotulo: string }> = [
  { valor: "sim", rotulo: "Manda" },
  { valor: "nao", rotulo: "Não manda" },
  { valor: "nao_sei", rotulo: "Não sei" },
];

function formatarTelefone(digitos: string): string {
  const d = digitos.startsWith("55") ? digitos.slice(2) : digitos;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
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

/** Tem alguma coisa preenchida além do básico? Decide se abre os detalhes. */
function temDetalhe(f: Form): boolean {
  return Boolean(
    f.usarEmLicitacao !== "nao_sei" ||
      f.seguraPrecoDias ||
      f.prazoEntregaDias ||
      f.pedidoMinimo ||
      f.condicaoPagamento ||
      f.mandaFichaTecnica !== "nao_sei" ||
      f.capacidade ||
      f.ufsQueAtende.length ||
      f.observacao
  );
}

export default function CotacaoPage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [soProntos, setSoProntos] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  // Os campos de proposta ficam recolhidos. O cadastro do dia a dia é empresa,
  // vendedor, telefone e o que ela cota — o resto só se descobre depois de
  // pedir a primeira cotação, e formulário comprido não é preenchido.
  const [verDetalhes, setVerDetalhes] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
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
      if (soProntos && !(f.telefone && f.categorias.length && f.usarEmLicitacao !== "nao"))
        return false;
      if (!termo) return true;
      return [f.nome, f.contato, f.telefone, f.condicaoPagamento, ...f.categorias, ...f.ufsQueAtende]
        .filter(Boolean)
        .some((campo) => campo.toLowerCase().includes(termo));
    });
  }, [dados, busca, filtroCategoria, soProntos]);

  function abrirEdicao(f: FornecedorLicitacao) {
    setErro(null);
    const novo: Form = {
      id: f.id,
      nome: f.nome,
      telefone: f.telefone,
      contato: f.contato,
      categorias: [...f.categorias],
      usarEmLicitacao: f.usarEmLicitacao,
      seguraPrecoDias: f.seguraPrecoDias == null ? "" : String(f.seguraPrecoDias),
      prazoEntregaDias: f.prazoEntregaDias == null ? "" : String(f.prazoEntregaDias),
      pedidoMinimo: f.pedidoMinimo,
      condicaoPagamento: f.condicaoPagamento,
      mandaFichaTecnica: f.mandaFichaTecnica,
      capacidade: f.capacidade,
      ufsQueAtende: [...f.ufsQueAtende],
      observacao: f.observacao,
    };
    setForm(novo);
    // Quem já tem detalhe preenchido abre com eles à vista; senão o formulário
    // fica curto, que é o normal.
    setVerDetalhes(temDetalhe(novo));
  }

  function abrirNovo() {
    setErro(null);
    setForm({ ...VAZIO });
    setVerDetalhes(false);
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
      setErro("O nome da empresa é obrigatório.");
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
            seguraPrecoDias: form.seguraPrecoDias.trim()
              ? Number(form.seguraPrecoDias)
              : null,
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

  const campo =
    "rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand";
  const rotulo = "text-[12px] font-medium text-neutral-600";
  const chip = (marcada: boolean) =>
    `rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
      marcada
        ? "brand-gradient text-white shadow-sm"
        : "border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
    }`;

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

        {/* ------------------------------------------------------- o básico -- */}
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className={rotulo}>Empresa</span>
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="ex: Copozan"
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={rotulo}>Vendedor</span>
            <input
              value={form.contato}
              onChange={(e) => setForm({ ...form, contato: e.target.value })}
              placeholder="ex: Josué"
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={rotulo}>Telefone / WhatsApp</span>
            <input
              value={form.telefone}
              inputMode="tel"
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="49 99999-9999"
              className={campo}
            />
          </label>
        </div>

        {/* ----------------------------------------------------- categorias -- */}
        <div>
          <div className="mb-2 text-[12px] font-medium text-neutral-600">
            O que a empresa cota{" "}
            <span className="text-neutral-400">
              — é isto que faz ela aparecer no &quot;Quem cota&quot; do edital
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categoriasDoForm.map((c) => (
              <button
                key={c}
                onClick={() => alternar("categorias", c)}
                className={chip(form.categorias.includes(c))}
              >
                {form.categorias.includes(c) ? "✓ " : "+ "}
                {c}
              </button>
            ))}
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
            className={`mt-2 w-64 ${campo}`}
          />
        </div>

        {/* --------------------------------------------- detalhes recolhidos */}
        <button
          onClick={() => setVerDetalhes(!verDetalhes)}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-neutral-500 hover:text-brand"
        >
          <span className={`transition-transform ${verDetalhes ? "rotate-90" : ""}`}>
            ›
          </span>
          Detalhes pra proposta — prazo, preço travado, pagamento
          <span className="text-neutral-400">(opcional)</span>
        </button>

        {verDetalhes && (
          <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
            <p className="text-[11.5px] text-neutral-500">
              Preencha quando souber, depois da primeira cotação. Ele fatura pra
              vocês como sempre — quem entrega pro município é a Embastel. O que
              muda é o compromisso: a ata trava o preço por meses.
            </p>

            <div>
              <div className="mb-1.5 text-[12px] font-medium text-neutral-600">
                Dá pra contar com ele numa licitação?
              </div>
              <div className="flex flex-wrap gap-1.5">
                {USAR.map((op) => (
                  <button
                    key={op.valor}
                    onClick={() => setForm({ ...form, usarEmLicitacao: op.valor })}
                    className={chip(form.usarEmLicitacao === op.valor)}
                  >
                    {op.rotulo}
                    <span className="ml-1 font-normal opacity-70">— {op.ajuda}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className={rotulo}>Segura o preço por quantos dias</span>
                <input
                  value={form.seguraPrecoDias}
                  inputMode="numeric"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      seguraPrecoDias: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  placeholder="ex: 90"
                  className={campo}
                />
                <span className="text-[11px] text-neutral-400">
                  a ata dura até 12 meses; o que ele reajustar depois sai do seu
                  bolso
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className={rotulo}>Entrega em quantos dias</span>
                <input
                  value={form.prazoEntregaDias}
                  inputMode="numeric"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      prazoEntregaDias: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  placeholder="ex: 10"
                  className={campo}
                />
                <span className="text-[11px] text-neutral-400">
                  o edital manda o prazo; quem não entrega paga multa
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className={rotulo}>Condição de pagamento</span>
                <input
                  value={form.condicaoPagamento}
                  onChange={(e) =>
                    setForm({ ...form, condicaoPagamento: e.target.value })
                  }
                  placeholder="ex: 30 dias, à vista"
                  className={campo}
                />
                <span className="text-[11px] text-neutral-400">
                  a prefeitura paga depois do empenho e do aceite
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className={rotulo}>Pedido mínimo</span>
                <input
                  value={form.pedidoMinimo}
                  onChange={(e) => setForm({ ...form, pedidoMinimo: e.target.value })}
                  placeholder="ex: 20 caixas"
                  className={campo}
                />
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className={rotulo}>Quanto dá conta de um pedido grande</span>
                <input
                  value={form.capacidade}
                  onChange={(e) => setForm({ ...form, capacidade: e.target.value })}
                  placeholder="ex: 500 caixas por semana"
                  className={campo}
                />
              </label>
            </div>

            <div>
              <div className="mb-1.5 text-[12px] font-medium text-neutral-600">
                Manda ficha técnica, laudo e amostra quando o edital pede?{" "}
                <span className="font-normal text-neutral-400">
                  — sem isso a proposta cai, mesmo com o melhor preço
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FICHA.map((op) => (
                  <button
                    key={op.valor}
                    onClick={() => setForm({ ...form, mandaFichaTecnica: op.valor })}
                    className={chip(form.mandaFichaTecnica === op.valor)}
                  >
                    {op.rotulo}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[12px] font-medium text-neutral-600">
                Entrega para
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ufsDoForm.map((uf) => (
                  <button
                    key={uf}
                    onClick={() => alternar("ufsQueAtende", uf)}
                    className={chip(form.ufsQueAtende.includes(uf))}
                  >
                    {form.ufsQueAtende.includes(uf) ? "✓ " : "+ "}
                    {uf}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1">
              <span className={rotulo}>Informações relevantes</span>
              <input
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder="ex: só cota com planilha em Excel"
                className={campo}
              />
            </label>
          </div>
        )}

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
      <header>
        <h1 className="text-2xl font-bold text-neutral-900">
          Fornecedores de licitação
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Que empresa cota o quê, com o telefone do vendedor. Lista própria, sem
          relação com a da loja. É esta lista que o botão &quot;Quem cota&quot;
          do edital consulta.
        </p>
      </header>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
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
            rotulo: "Dá pra contar",
            valor: resumo.confirmados,
            ajuda: "já provaram que seguram",
          },
          {
            rotulo: "Sem categoria",
            valor: resumo.semCategoria,
            ajuda: "não aparecem no Quem cota",
          },
          {
            rotulo: "Sem trava de preço",
            valor: resumo.semTravaDePreco,
            ajuda: "não sabemos por quanto tempo seguram",
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
          onClick={() => (form?.id === null ? setForm(null) : abrirNovo())}
          className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          {form?.id === null ? "Fechar formulário" : "Cadastrar fornecedor"}
        </button>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por empresa, vendedor, telefone, categoria ou UF"
          className="min-w-[240px] flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setSoProntos(!soProntos)}
          className={chip(soProntos)}
        >
          Só quem dá pra cotar hoje ({resumo.prontos})
        </button>
        {dados.categorias.length > 0 && (
          <>
            <span className="mx-1 text-neutral-300">|</span>
            <button
              onClick={() => setFiltroCategoria("")}
              className={chip(filtroCategoria === "")}
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
                  className={chip(filtroCategoria === c)}
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
            Cadastre a empresa, o vendedor, o telefone e o que ela cota. O resto
            é opcional.
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
                      {f.usarEmLicitacao === "sim" && (
                        <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                          pode contar
                        </span>
                      )}
                      {f.usarEmLicitacao === "nao" && (
                        <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-red-700">
                          não usar
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-neutral-500">
                      {f.contato && `${f.contato} · `}
                      {f.telefone ? formatarTelefone(f.telefone) : "sem telefone"}
                    </div>
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
                        f.categorias.length
                          ? "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                          : "brand-gradient text-white shadow-sm"
                      }`}
                    >
                      {f.categorias.length ? "Editar" : "Marcar o que cota"}
                    </button>
                    <button
                      onClick={() => excluir(f)}
                      className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50"
                    >
                      Apagar
                    </button>
                  </div>
                </div>

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

                {/* Só mostra as condições que alguém já preencheu — quem não
                    cotou ainda não tem nada disso, e a linha some. */}
                {(f.seguraPrecoDias != null ||
                  f.prazoEntregaDias != null ||
                  f.condicaoPagamento ||
                  f.pedidoMinimo ||
                  f.capacidade ||
                  f.mandaFichaTecnica !== "nao_sei" ||
                  f.ufsQueAtende.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-neutral-600">
                    {f.seguraPrecoDias != null && (
                      <span>
                        Segura o preço{" "}
                        <b className="font-semibold">{f.seguraPrecoDias} dias</b>
                      </span>
                    )}
                    {f.prazoEntregaDias != null && (
                      <span>
                        Entrega em{" "}
                        <b className="font-semibold">{f.prazoEntregaDias} dias</b>
                      </span>
                    )}
                    {f.condicaoPagamento && <span>Paga em {f.condicaoPagamento}</span>}
                    {f.pedidoMinimo && <span>Mín. {f.pedidoMinimo}</span>}
                    {f.capacidade && <span>Dá conta de {f.capacidade}</span>}
                    {f.mandaFichaTecnica === "sim" && <span>manda ficha técnica</span>}
                    {f.mandaFichaTecnica === "nao" && (
                      <span className="text-red-600">não manda ficha técnica</span>
                    )}
                    {f.ufsQueAtende.length > 0 && (
                      <span>Entrega {f.ufsQueAtende.join(", ")}</span>
                    )}
                  </div>
                )}

                {f.observacao && (
                  <div className="mt-1 text-[11.5px] text-neutral-500">
                    {f.observacao}
                  </div>
                )}

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
                        {f.ultimaCotacaoEm &&
                          ` · última em ${dataCurta(f.ultimaCotacaoEm)}`}
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
