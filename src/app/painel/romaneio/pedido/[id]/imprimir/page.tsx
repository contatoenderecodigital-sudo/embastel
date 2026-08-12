"use client";

import { use, useEffect, useState } from "react";
import type { Cliente, FormaPagamento } from "@/lib/clientesDb";
import type { Pedido } from "@/lib/pedidosDb";

const FORMA_LABEL: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cheque: "Cheque",
  boleto: "Boleto",
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function ImprimirPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [pedidoRes, clientesRes] = await Promise.all([
          fetch(`/api/pedidos/${id}`),
          fetch("/api/clientes"),
        ]);
        const pedidoData = await pedidoRes.json();
        if (!pedidoRes.ok) throw new Error(pedidoData.error ?? "Pedido não encontrado");
        const clientesData = await clientesRes.json();
        setPedido(pedidoData);
        setCliente(
          (clientesData.clientes ?? []).find((c: Cliente) => c.id === pedidoData.clienteId) ??
            null
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar pedido");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <p className="p-8 text-sm text-neutral-500">Carregando...</p>;
  if (error || !pedido) return <p className="p-8 text-sm text-red-600">{error}</p>;

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-10 text-neutral-900 print:p-0">
      <div className="mb-6 flex gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="brand-gradient rounded-md px-4 py-2 text-sm font-medium text-white shadow-md"
        >
          Imprimir
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-600"
        >
          Fechar
        </button>
      </div>

      <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-4">
        <div>
          <h1 className="text-xl font-extrabold">EMBASTEL EMBALAGENS</h1>
          <p className="text-xs text-neutral-600">Av. Brasil, 1372, Xanxerê/SC</p>
          <p className="text-xs text-neutral-600">(49) 3433-5247</p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold">PEDIDO</h2>
          <p className="text-xs text-neutral-600">
            {new Date(pedido.dataPedido).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Cliente
          </p>
          <p className="font-medium">{pedido.clienteNome}</p>
          {cliente?.razaoSocial && <p className="text-xs text-neutral-600">{cliente.razaoSocial}</p>}
          {cliente?.cnpj && <p className="text-xs text-neutral-600">CNPJ/CPF: {cliente.cnpj}</p>}
          <p className="text-xs text-neutral-600">
            {cliente?.endereco ? `${cliente.endereco}, ` : ""}
            {pedido.cidade}
          </p>
          {cliente?.telefone && <p className="text-xs text-neutral-600">{cliente.telefone}</p>}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Pagamento
          </p>
          <p>{FORMA_LABEL[pedido.formaPagamento]}</p>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-neutral-900 text-left">
            <th className="py-2">Item</th>
            <th className="py-2 text-right">Qtd</th>
            <th className="py-2 text-right">Valor unit.</th>
            <th className="py-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {pedido.itens.map((item, i) => (
            <tr key={i} className="border-b border-neutral-200">
              <td className="py-2">{item.descricao}</td>
              <td className="py-2 text-right">{item.quantidade}</td>
              <td className="py-2 text-right">{currency.format(item.valorUnitario)}</td>
              <td className="py-2 text-right">
                {currency.format(item.quantidade * item.valorUnitario)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex justify-end">
        <div className="w-56 border-t-2 border-neutral-900 pt-2 text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Total
          </p>
          <p className="text-xl font-extrabold">{currency.format(pedido.valorTotal)}</p>
        </div>
      </div>

      {pedido.observacao && (
        <div className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Observações
          </p>
          <p className="text-sm">{pedido.observacao}</p>
        </div>
      )}

      <div className="mt-16 grid grid-cols-2 gap-8 text-center text-xs text-neutral-500">
        <div className="border-t border-neutral-400 pt-1">Assinatura do cliente</div>
        <div className="border-t border-neutral-400 pt-1">Entregador</div>
      </div>
    </div>
  );
}
