"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cliente, FormaPagamento } from "@/lib/clientesDb";
import type { Pedido } from "@/lib/pedidosDb";
import { ItensEditor, itemFormVazio, totalItens, type ItemForm } from "@/components/PedidoItensEditor";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function PedidosPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editItens, setEditItens] = useState<ItemForm[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("dinheiro");
  const [itensForm, setItensForm] = useState<ItemForm[]>([itemFormVazio()]);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [clientesRes, pedidosRes] = await Promise.all([
        fetch("/api/clientes"),
        fetch("/api/pedidos"),
      ]);
      const clientesData = await clientesRes.json();
      const pedidosData = await pedidosRes.json();
      setClientes(clientesData.clientes ?? []);
      setPedidos(pedidosData.pedidos ?? []);
    } catch {
      setError("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function handleClienteChange(id: string) {
    setClienteId(id);
    const cliente = clientes.find((c) => c.id === id);
    if (cliente?.formaPagamentoPadrao) setFormaPagamento(cliente.formaPagamentoPadrao);
  }

  const totalPedidoAtual = useMemo(() => totalItens(itensForm), [itensForm]);

  async function handleAdd() {
    const itensValidos = itensForm.filter((i) => i.descricao.trim() && Number(i.quantidade) > 0);
    if (!clienteId || itensValidos.length === 0) {
      setError("Escolhe o cliente e anota pelo menos um item com quantidade.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          formaPagamento,
          observacao,
          itens: itensValidos.map((i) => ({
            descricao: i.descricao,
            quantidade: Number(i.quantidade),
            valorUnitario: Number(i.valorUnitario) || 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao adicionar pedido");
      setItensForm([itemFormVazio()]);
      setObservacao("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar pedido");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/pedidos/${id}`, { method: "DELETE" });
    await load();
  }

  function abrirEdicao(pedido: Pedido) {
    setEditandoId(pedido.id);
    setEditItens(
      pedido.itens.length
        ? pedido.itens.map((i) => ({
            descricao: i.descricao,
            quantidade: String(i.quantidade),
            valorUnitario: String(i.valorUnitario),
          }))
        : [itemFormVazio()]
    );
  }

  async function salvarEdicao(id: string) {
    const itensValidos = editItens.filter((i) => i.descricao.trim() && Number(i.quantidade) > 0);
    setSavingEdit(true);
    try {
      await fetch(`/api/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens: itensValidos.map((i) => ({
            descricao: i.descricao,
            quantidade: Number(i.quantidade),
            valorUnitario: Number(i.valorUnitario) || 0,
          })),
        }),
      });
      setEditandoId(null);
      await load();
    } finally {
      setSavingEdit(false);
    }
  }

  const emAberto = useMemo(
    () =>
      pedidos
        .filter((p) => p.status === "pendente")
        .sort((a, b) => (b.dataPedido ?? "").localeCompare(a.dataPedido ?? "")),
    [pedidos]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">Pedidos</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Escreve aqui o pedido do cliente — item, quantidade e valor, com o total somando
          sozinho. Depois de anotado, ele aparece organizado por dia em &quot;Romaneio&quot;.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Cliente</label>
          <select
            value={clienteId}
            onChange={(e) => handleClienteChange(e.target.value)}
            className="w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="">Selecione...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — {c.cidade}
              </option>
            ))}
          </select>
          {clientes.length === 0 && !loading && (
            <p className="mt-1 text-xs text-amber-600">
              Nenhum cliente cadastrado ainda — cadastra em &quot;Clientes&quot; primeiro.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Itens do pedido
          </label>
          <ItensEditor itens={itensForm} setItens={setItensForm} />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-brand-soft px-4 py-3">
          <span className="text-sm font-medium text-neutral-700">Total do pedido</span>
          <span className="brand-gradient-text text-xl font-extrabold">
            {currency.format(totalPedidoAtual)}
          </span>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Forma de pagamento
          </label>
          <select
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
            className="w-full max-w-xs rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">Pix</option>
            <option value="cheque">Cheque</option>
            <option value="boleto">Boleto</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Observações (opcional)
          </label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder="Ex: entregar até meio-dia, ligar antes de ir..."
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>

        <button
          onClick={handleAdd}
          disabled={saving}
          className="brand-gradient rounded-md px-5 py-2 text-sm font-medium text-white shadow-md shadow-brand/20 transition-transform hover:-translate-y-px disabled:opacity-50"
        >
          {saving ? "Adicionando..." : "Adicionar pedido"}
        </button>
      </div>

      {loading && <p className="text-sm text-neutral-500">Carregando...</p>}

      <div className="space-y-3">
        <h2 className="text-[14px] font-semibold text-neutral-900">
          Pedidos em aberto {emAberto.length > 0 && `(${emAberto.length})`}
        </h2>
        {!loading && emAberto.length === 0 && (
          <p className="text-sm text-neutral-500">
            Nenhum pedido em aberto — os que forem marcados como entregues no Romaneio somem
            dessa lista.
          </p>
        )}
        {emAberto.map((pedido) => (
          <div
            key={pedido.id}
            className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{pedido.clienteNome}</p>
                <p className="text-xs text-neutral-500">{pedido.cidade}</p>
              </div>
              <span className="brand-gradient-text text-base font-extrabold">
                {currency.format(pedido.valorTotal)}
              </span>
            </div>

            {editandoId === pedido.id ? (
              <div className="mt-2 space-y-2 rounded-lg bg-neutral-50 p-3">
                <ItensEditor itens={editItens} setItens={setEditItens} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-600">
                    Total: {currency.format(totalItens(editItens))}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditandoId(null)}
                      className="text-[11px] text-neutral-400 hover:text-neutral-600"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => salvarEdicao(pedido.id)}
                      disabled={savingEdit}
                      className="text-[11px] font-medium text-brand hover:underline disabled:opacity-50"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              pedido.itens.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[12.5px] text-neutral-600">
                  {pedido.itens.map((item, i) => (
                    <li key={i}>
                      {item.quantidade}x {item.descricao}
                      {item.valorUnitario > 0 &&
                        ` — ${currency.format(item.quantidade * item.valorUnitario)}`}
                    </li>
                  ))}
                </ul>
              )
            )}

            {pedido.observacao && (
              <p className="mt-2 text-[12px] italic text-neutral-500">{pedido.observacao}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => abrirEdicao(pedido)}
                className="text-[11px] text-neutral-500 hover:text-brand"
              >
                Editar itens
              </button>
              <Link
                href={`/romaneio/pedido/${pedido.id}/imprimir`}
                target="_blank"
                className="text-[11px] text-neutral-500 hover:text-brand"
              >
                Imprimir pedido
              </Link>
              <button
                onClick={() => handleDelete(pedido.id)}
                className="ml-auto text-[11px] text-neutral-400 hover:text-red-600"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
