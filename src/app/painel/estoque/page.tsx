"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProdutoEstoque, SituacaoEstoque } from "@/lib/estoqueDb";
import type { Fornecedor } from "@/lib/fornecedoresDb";

const SITUACAO_LABEL: Record<SituacaoEstoque, string> = {
  ok: "Em estoque",
  baixo: "Estoque baixo",
  falta: "Em falta",
};

const SITUACAO_STYLE: Record<SituacaoEstoque, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  baixo: "bg-amber-50 text-amber-700",
  falta: "bg-red-50 text-red-700",
};

// Ordem de prioridade dentro de cada grupo de fornecedor: o que falta pedir
// primeiro, o que já está ok por último.
const SITUACAO_ORDER: Record<SituacaoEstoque, number> = { falta: 0, baixo: 1, ok: 2 };

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyPending, setShowOnlyPending] = useState(true);
  const [filtroFornecedor, setFiltroFornecedor] = useState("");
  const [copiedFornecedor, setCopiedFornecedor] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [situacao, setSituacao] = useState<SituacaoEstoque>("falta");
  const [quantidadeSugerida, setQuantidadeSugerida] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const [puxando, setPuxando] = useState(false);
  const [avisoConferencia, setAvisoConferencia] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [estoqueRes, fornecedoresRes] = await Promise.all([
        fetch("/api/estoque"),
        fetch("/api/fornecedores"),
      ]);
      const estoqueData = await estoqueRes.json();
      const fornecedoresData = await fornecedoresRes.json();
      setProdutos(estoqueData.produtos ?? []);
      setFornecedores(fornecedoresData.fornecedores ?? []);
    } catch {
      setError("Erro ao carregar estoque");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  /**
   * Traz da conferência o que está abaixo do ideal.
   *
   * A reposição automática só age quando uma contagem é salva. Item contado
   * baixo semanas atrás, ou que só ganhou fornecedor depois da contagem, nunca
   * chegava aqui — e sumia do pedido sem ninguém perceber. Este botão olha o
   * estado de hoje em vez de esperar o próximo evento.
   */
  async function puxarDaConferencia() {
    setPuxando(true);
    setAvisoConferencia(null);
    try {
      const res = await fetch("/api/estoque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "puxar_da_conferencia" }),
      });
      if (!res.ok) throw new Error();
      const d = (await res.json()) as {
        criados: number;
        atualizados: number;
        analisados: number;
      };
      setProdutos(((await (await fetch("/api/estoque")).json()).produtos ?? []));
      setAvisoConferencia(
        d.analisados === 0
          ? "A conferência não tem nada abaixo do ideal. Lembre que o item só entra aqui se tiver fornecedor E quantidade ideal preenchidos, e se já tiver sido contado ao menos uma vez."
          : `${d.criados} produto(s) novo(s) e ${d.atualizados} atualizado(s), de ${d.analisados} abaixo do ideal na conferência.`
      );
    } catch {
      setAvisoConferencia("Não deu pra puxar da conferência agora.");
    } finally {
      setPuxando(false);
    }
  }

  async function handleAdd() {
    if (!nome.trim() || !fornecedor.trim()) {
      setError("Preenche o nome do produto e o fornecedor.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/estoque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          fornecedor,
          situacao,
          quantidadeSugerida: quantidadeSugerida || null,
          observacao: observacao || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao adicionar");
      setNome("");
      setQuantidadeSugerida("");
      setObservacao("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar produto");
    } finally {
      setSaving(false);
    }
  }

  async function handleSituacaoChange(id: string, novaSituacao: SituacaoEstoque) {
    await fetch(`/api/estoque/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ situacao: novaSituacao }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/estoque/${id}`, { method: "DELETE" });
    await load();
  }

  async function handleCopyList(fornecedorNome: string, itens: ProdutoEstoque[]) {
    const pendentes = itens.filter((p) => p.situacao !== "ok");
    const linhas = pendentes.map((p) => {
      const qtd = p.quantidadeSugerida ? ` (qtd: ${p.quantidadeSugerida})` : "";
      const obs = p.observacao ? ` — ${p.observacao}` : "";
      return `- ${p.nome}${qtd} [${SITUACAO_LABEL[p.situacao]}]${obs}`;
    });
    const texto = `Pedido — ${fornecedorNome}\n${linhas.join("\n")}`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiedFornecedor(fornecedorNome);
      setTimeout(() => setCopiedFornecedor(null), 2000);
    } catch {
      setError("Não deu pra copiar automaticamente — seleciona e copia manualmente.");
    }
  }

  const grupos = useMemo(() => {
    let visiveis = showOnlyPending ? produtos.filter((p) => p.situacao !== "ok") : produtos;
    if (filtroFornecedor) {
      visiveis = visiveis.filter((p) => p.fornecedor === filtroFornecedor);
    }
    const porFornecedor = new Map<string, ProdutoEstoque[]>();
    for (const produto of visiveis) {
      const lista = porFornecedor.get(produto.fornecedor) ?? [];
      lista.push(produto);
      porFornecedor.set(produto.fornecedor, lista);
    }
    return Array.from(porFornecedor.entries())
      .map(([fornecedorNome, itens]) => ({
        fornecedor: fornecedorNome,
        itens: itens.sort(
          (a, b) => SITUACAO_ORDER[a.situacao] - SITUACAO_ORDER[b.situacao] || a.nome.localeCompare(b.nome)
        ),
      }))
      .sort((a, b) => a.fornecedor.localeCompare(b.fornecedor));
  }, [produtos, showOnlyPending, filtroFornecedor]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">Estoque</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Marca o que está em falta ou com estoque baixo, por fornecedor — na hora de fazer o
            pedido, já sai a lista pronta.
          </p>
        </div>
        <button
          onClick={puxarDaConferencia}
          disabled={puxando}
          title="Traz o que a última contagem deixou abaixo do ideal, com o fornecedor de cada item"
          className="rounded-xl border border-neutral-300 px-3.5 py-2 text-[13px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-60"
        >
          {puxando ? "Puxando…" : "Puxar da conferência"}
        </button>
      </div>

      {avisoConferencia && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {avisoConferencia}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Produto</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Sacola plástica 40x50"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Fornecedor</label>
            <select
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="">Selecione...</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.nome}>
                  {f.nome}
                </option>
              ))}
            </select>
            {fornecedores.length === 0 && !loading && (
              <p className="mt-1 text-xs text-amber-600">
                Nenhum fornecedor cadastrado — cadastra em &quot;Fornecedores&quot; primeiro.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Situação</label>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value as SituacaoEstoque)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="falta">Em falta</option>
              <option value="baixo">Estoque baixo</option>
              <option value="ok">Em estoque</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Quantidade a pedir (opcional)
            </label>
            <input
              type="number"
              min={0}
              value={quantidadeSugerida}
              onChange={(e) => setQuantidadeSugerida(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Observação (opcional)
            </label>
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: cor branca, caixa fechada"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={saving}
          className="brand-gradient rounded-md px-5 py-2 text-sm font-medium text-white shadow-md shadow-brand/20 transition-transform hover:-translate-y-px disabled:opacity-50"
        >
          {saving ? "Adicionando..." : "Adicionar produto"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex w-fit items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={showOnlyPending}
            onChange={(e) => setShowOnlyPending(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300"
          />
          Mostrar só o que precisa pedir (esconde os que estão &quot;Em estoque&quot;)
        </label>
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-600">Filtrar por fornecedor:</label>
          <select
            value={filtroFornecedor}
            onChange={(e) => setFiltroFornecedor(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-brand"
          >
            <option value="">Todos</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.nome}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="text-sm text-neutral-500">Carregando...</p>}

      {!loading && grupos.length === 0 && (
        <p className="text-sm text-neutral-500">
          {showOnlyPending
            ? "Nada em falta ou com estoque baixo no momento. 🎉"
            : "Nenhum produto cadastrado ainda."}
        </p>
      )}

      <div className="space-y-5">
        {grupos.map(({ fornecedor: fornecedorNome, itens }) => {
          const pendentesCount = itens.filter((p) => p.situacao !== "ok").length;
          return (
            <div
              key={fornecedorNome}
              className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-neutral-900">{fornecedorNome}</p>
                  <p className="text-xs text-neutral-500">
                    {pendentesCount} item(ns) pra pedir · {itens.length} no total
                  </p>
                </div>
                <button
                  onClick={() => handleCopyList(fornecedorNome, itens)}
                  disabled={pendentesCount === 0}
                  className="brand-gradient rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-brand/20 disabled:opacity-40"
                >
                  {copiedFornecedor === fornecedorNome ? "✓ Copiado!" : "Copiar lista de pedido"}
                </button>
              </div>

              <div className="mt-3 divide-y divide-neutral-100">
                {itens.map((produto) => (
                  <div
                    key={produto.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{produto.nome}</p>
                      <p className="text-xs text-neutral-500">
                        {produto.quantidadeSugerida != null && `Qtd: ${produto.quantidadeSugerida} · `}
                        {produto.observacao}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${SITUACAO_STYLE[produto.situacao]}`}
                      >
                        {SITUACAO_LABEL[produto.situacao]}
                      </span>
                      <select
                        value={produto.situacao}
                        onChange={(e) =>
                          handleSituacaoChange(produto.id, e.target.value as SituacaoEstoque)
                        }
                        className="rounded-md border border-neutral-300 px-1.5 py-1 text-[11px] outline-none focus:border-brand"
                      >
                        <option value="falta">Em falta</option>
                        <option value="baixo">Estoque baixo</option>
                        <option value="ok">Em estoque</option>
                      </select>
                      <button
                        onClick={() => handleDelete(produto.id)}
                        className="text-[11px] text-neutral-400 hover:text-red-600"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
