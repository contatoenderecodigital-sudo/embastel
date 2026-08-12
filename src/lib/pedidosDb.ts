import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";
import type { FormaPagamento } from "./clientesDb";

export type StatusPedido = "pendente" | "entregue" | "cancelado";

export type PedidoItem = {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

export type Pedido = {
  id: string;
  clienteId: string;
  // Nome e cidade copiados do cliente no momento do pedido — o romaneio de
  // uma semana passada não deve mudar se o cadastro do cliente mudar depois.
  clienteNome: string;
  cidade: string;
  itens: PedidoItem[];
  // Sempre recalculado no servidor a partir de itens (quantidade × valor
  // unitário, somado) — nunca confia no total que o cliente HTTP mandou.
  valorTotal: number;
  formaPagamento: FormaPagamento;
  status: StatusPedido;
  pago: boolean;
  observacao: string | null;
  dataPedido: string;
  dataEntrega: string | null;
};

type PedidosData = {
  pedidos: Pedido[];
};

const store = jsonStore<PedidosData>("pedidos.json", { pedidos: [] });

function calcularTotal(itens: PedidoItem[]): number {
  return Math.round(
    itens.reduce((soma, item) => soma + item.quantidade * item.valorUnitario, 0) * 100
  ) / 100;
}

export async function listPedidos(): Promise<Pedido[]> {
  const data = await store.read();
  return data.pedidos;
}

export async function getPedido(id: string): Promise<Pedido | null> {
  const data = await store.read();
  return data.pedidos.find((p) => p.id === id) ?? null;
}

export async function addPedido(input: {
  clienteId: string;
  clienteNome: string;
  cidade: string;
  itens: PedidoItem[];
  formaPagamento: FormaPagamento;
  observacao?: string | null;
}): Promise<Pedido> {
  return store.update((data) => {
    const pedido: Pedido = {
      id: randomUUID(),
      clienteId: input.clienteId,
      clienteNome: input.clienteNome,
      cidade: input.cidade,
      itens: input.itens,
      valorTotal: calcularTotal(input.itens),
      formaPagamento: input.formaPagamento,
      status: "pendente",
      pago: false,
      observacao: input.observacao ?? null,
      dataPedido: new Date().toISOString(),
      dataEntrega: null,
    };
    data.pedidos.push(pedido);
    return pedido;
  });
}

export async function updatePedido(
  id: string,
  patch: Partial<
    Pick<
      Pedido,
      "itens" | "formaPagamento" | "status" | "pago" | "observacao" | "dataEntrega"
    >
  >
): Promise<Pedido | null> {
  return store.update((data) => {
    const pedido = data.pedidos.find((p) => p.id === id);
    if (!pedido) return null;
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        (pedido as Record<string, unknown>)[key] = value;
      }
    }
    // itens mudou (ou não) — sempre recalcula o total a partir do que está
    // salvo agora, nunca aceita um valorTotal vindo de fora.
    pedido.valorTotal = calcularTotal(pedido.itens);
    return pedido;
  });
}

export async function deletePedido(id: string): Promise<void> {
  await store.update((data) => {
    data.pedidos = data.pedidos.filter((p) => p.id !== id);
  });
}
