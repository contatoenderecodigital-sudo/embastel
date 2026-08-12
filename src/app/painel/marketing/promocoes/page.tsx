"use client";

import { useCallback, useEffect, useState } from "react";
import type { Promocao } from "@/lib/promocoesDb";
import { buildPromocaoPrompt } from "@/lib/promptTemplates";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function PromocoesPage() {
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [produto, setProduto] = useState("");
  const [precoAntigo, setPrecoAntigo] = useState("");
  const [precoNovo, setPrecoNovo] = useState("");
  const [destaque, setDestaque] = useState("");
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/promocoes");
      const data = await res.json();
      setPromocoes(data.promocoes ?? []);
    } catch {
      setError("Erro ao carregar promoções");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function handleGerarPrompt() {
    if (!produto.trim() || !precoAntigo || !precoNovo) {
      setError("Preenche produto, preço antigo e preço novo.");
      return;
    }
    setError(null);
    setPrompt(
      buildPromocaoPrompt({
        produto,
        precoAntigo: Number(precoAntigo),
        precoNovo: Number(precoNovo),
        destaque,
      })
    );
  }

  async function handleCopiarPrompt(texto: string, id: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Não deu pra copiar automaticamente — seleciona e copia manualmente.");
    }
  }

  async function handleSalvar() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/promocoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produto,
          precoAntigo,
          precoNovo,
          destaque,
          promptGerado: prompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar");
      setProduto("");
      setPrecoAntigo("");
      setPrecoNovo("");
      setDestaque("");
      setPrompt("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar promoção");
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluir(id: string) {
    await fetch(`/api/promocoes/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">Promoções</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Post de promoção pra um produto específico. O sistema não gera a imagem final
          sozinho — monta um prompt caprichado pra você colar no Gemini ou no Flow.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Produto</label>
          <input
            value={produto}
            onChange={(e) => setProduto(e.target.value)}
            placeholder="Ex: Sacola de organza 20x30cm"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Preço antigo
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={precoAntigo}
              onChange={(e) => setPrecoAntigo(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Preço novo (promocional)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={precoNovo}
              onChange={(e) => setPrecoNovo(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Destaque adicional (opcional)
          </label>
          <input
            value={destaque}
            onChange={(e) => setDestaque(e.target.value)}
            placeholder="Ex: só até domingo, enquanto durar o estoque..."
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>

        <button
          onClick={handleGerarPrompt}
          className="brand-gradient rounded-md px-5 py-2 text-sm font-medium text-white shadow-md shadow-brand/20"
        >
          Gerar prompt
        </button>

        {prompt && (
          <div className="space-y-2 rounded-xl bg-neutral-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Prompt pra colar no Gemini/Flow
              </p>
              <button
                onClick={() => handleCopiarPrompt(prompt, "novo")}
                className="text-xs font-medium text-brand hover:underline"
              >
                {copiedId === "novo" ? "✓ Copiado!" : "Copiar"}
              </button>
            </div>
            <textarea
              readOnly
              value={prompt}
              rows={10}
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 outline-none"
            />
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-white disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Guardar essa promoção na lista"}
            </button>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-neutral-500">Carregando...</p>}

      {!loading && promocoes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[14px] font-semibold text-neutral-900">
            Promoções guardadas ({promocoes.length})
          </h2>
          {promocoes
            .slice()
            .reverse()
            .map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{p.produto}</p>
                    <p className="text-xs text-neutral-500">
                      <span className="line-through">{currency.format(p.precoAntigo)}</span>{" "}
                      → <span className="font-semibold text-brand">{currency.format(p.precoNovo)}</span>
                      {p.destaque && ` · ${p.destaque}`}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleCopiarPrompt(p.promptGerado, p.id)}
                      className="text-xs font-medium text-brand hover:underline"
                    >
                      {copiedId === p.id ? "✓ Copiado!" : "Copiar prompt"}
                    </button>
                    <button
                      onClick={() => handleExcluir(p.id)}
                      className="text-xs text-neutral-400 hover:text-red-600"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
