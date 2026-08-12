"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cliente, FormaPagamento } from "@/lib/clientesDb";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMais, setShowMais] = useState(false);

  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [telefone, setTelefone] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [formaPagamentoPadrao, setFormaPagamentoPadrao] = useState<FormaPagamento | "">("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/clientes");
      const data = await res.json();
      setClientes(data.clientes ?? []);
    } catch {
      setError("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const cidadesConhecidas = useMemo(
    () => Array.from(new Set(clientes.map((c) => c.cidade))).sort(),
    [clientes]
  );

  async function handleAdd() {
    if (!nome.trim() || !cidade.trim()) {
      setError("Preenche o nome e a cidade do cliente.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          cidade,
          telefone: telefone || null,
          razaoSocial: razaoSocial || null,
          cnpj: cnpj || null,
          endereco: endereco || null,
          formaPagamentoPadrao: formaPagamentoPadrao || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao adicionar");
      setNome("");
      setTelefone("");
      setRazaoSocial("");
      setCnpj("");
      setEndereco("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar cliente");
    } finally {
      setSaving(false);
    }
  }

  async function handlePatch(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/clientes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/clientes/${id}`, { method: "DELETE" });
    await load();
  }

  const porCidade = useMemo(() => {
    const grupos = new Map<string, Cliente[]>();
    for (const c of clientes) {
      const lista = grupos.get(c.cidade) ?? [];
      lista.push(c);
      grupos.set(c.cidade, lista);
    }
    return Array.from(grupos.entries())
      .map(([cidadeNome, itens]) => ({
        cidade: cidadeNome,
        itens: itens.sort((a, b) => a.nome.localeCompare(b.nome)),
      }))
      .sort((a, b) => a.cidade.localeCompare(b.cidade));
  }, [clientes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">Clientes</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Cadastro por cidade — usado pra montar o romaneio de entrega.{" "}
          <b className="font-semibold text-neutral-900">{clientes.length}</b> cadastrado(s).
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do cliente"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Cidade</label>
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex: Xaxim"
              list="cidades-conhecidas"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <datalist id="cidades-conhecidas">
              {cidadesConhecidas.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Telefone (opcional)
            </label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(49) 9...."
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowMais((v) => !v)}
          className="text-xs font-medium text-brand hover:underline"
        >
          {showMais ? "− Menos campos" : "+ Razão social, CNPJ, endereço (opcional)"}
        </button>

        {showMais && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Razão social
              </label>
              <input
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                CNPJ/CPF
              </label>
              <input
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Endereço
              </label>
              <input
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Forma de pagamento padrão (opcional)
          </label>
          <select
            value={formaPagamentoPadrao}
            onChange={(e) => setFormaPagamentoPadrao(e.target.value as FormaPagamento | "")}
            className="w-full max-w-xs rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="">Decidir na hora</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">Pix</option>
            <option value="cheque">Cheque</option>
            <option value="boleto">Boleto</option>
          </select>
        </div>

        <button
          onClick={handleAdd}
          disabled={saving}
          className="brand-gradient rounded-md px-5 py-2 text-sm font-medium text-white shadow-md shadow-brand/20 transition-transform hover:-translate-y-px disabled:opacity-50"
        >
          {saving ? "Adicionando..." : "Adicionar cliente"}
        </button>
      </div>

      {loading && <p className="text-sm text-neutral-500">Carregando...</p>}
      {!loading && porCidade.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhum cliente cadastrado ainda.</p>
      )}

      <div className="space-y-5">
        {porCidade.map(({ cidade: cidadeNome, itens }) => (
          <div
            key={cidadeNome}
            className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm"
          >
            <p className="mb-3 font-semibold text-neutral-900">
              {cidadeNome} <span className="text-xs font-normal text-neutral-400">({itens.length})</span>
            </p>
            <div className="divide-y divide-neutral-100">
              {itens.map((cliente) => (
                <div key={cliente.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                  <div className="min-w-[160px] flex-1">
                    <p className="font-medium text-neutral-800">{cliente.nome}</p>
                    {(cliente.endereco || cliente.cnpj) && (
                      <p className="text-[11px] text-neutral-400">
                        {cliente.endereco}
                        {cliente.endereco && cliente.cnpj && " · "}
                        {cliente.cnpj}
                      </p>
                    )}
                  </div>
                  {cliente.telefone && (
                    <span className="text-xs text-neutral-500">{cliente.telefone}</span>
                  )}
                  <select
                    value={cliente.formaPagamentoPadrao ?? ""}
                    onChange={(e) =>
                      handlePatch(cliente.id, { formaPagamentoPadrao: e.target.value || null })
                    }
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs outline-none focus:border-brand"
                  >
                    <option value="">Decidir na hora</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">Pix</option>
                    <option value="cheque">Cheque</option>
                    <option value="boleto">Boleto</option>
                  </select>
                  <button
                    onClick={() => handleDelete(cliente.id)}
                    className="text-xs text-neutral-400 hover:text-red-600"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
