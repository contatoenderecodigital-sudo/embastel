"use client";

import { useCallback, useEffect, useState } from "react";
import type { Fornecedor } from "@/lib/fornecedoresDb";

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fornecedores");
      const data = await res.json();
      setFornecedores(data.fornecedores ?? []);
    } catch {
      setError("Erro ao carregar fornecedores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleAdd() {
    if (!nome.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/fornecedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao adicionar");
      setNome("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar fornecedor");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/fornecedores/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">Fornecedores</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Cadastro usado pra marcar de qual fornecedor é cada produto no Estoque — assim dá pra
          filtrar o que falta pedir por fornecedor.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="Nome do fornecedor..."
          className="min-w-[200px] flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !nome.trim()}
          className="brand-gradient rounded-md px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand/20 disabled:opacity-50"
        >
          Adicionar
        </button>
      </div>

      {loading && <p className="text-sm text-neutral-500">Carregando...</p>}

      {!loading && (
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">
            {fornecedores.length} cadastrado(s)
          </p>
          <div className="flex flex-wrap gap-2">
            {fornecedores.map((f) => (
              <span
                key={f.id}
                className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-700"
              >
                {f.nome}
                <button
                  onClick={() => handleDelete(f.id)}
                  className="text-neutral-400 hover:text-red-600"
                  title="Remover"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
