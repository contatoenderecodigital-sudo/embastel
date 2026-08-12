import { NextRequest, NextResponse } from "next/server";
import { listPedidos, addPedido } from "@/lib/pedidosDb";
import type { PedidoItem } from "@/lib/pedidosDb";
import { listClientes, FORMAS_PAGAMENTO } from "@/lib/clientesDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const pedidos = await listPedidos();
  return NextResponse.json({ pedidos });
}

function sanitizeItens(raw: unknown): PedidoItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      descricao: String(item?.descricao ?? "").trim(),
      quantidade: Number(item?.quantidade) || 0,
      valorUnitario: Number(item?.valorUnitario) || 0,
    }))
    .filter((item) => item.descricao && item.quantidade > 0);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.clienteId) {
    return NextResponse.json({ error: "Escolhe o cliente" }, { status: 400 });
  }
  const itens = sanitizeItens(body.itens);
  if (itens.length === 0) {
    return NextResponse.json(
      { error: "Anota pelo menos um item do pedido (com descrição e quantidade)." },
      { status: 400 }
    );
  }
  const clientes = await listClientes();
  const cliente = clientes.find((c) => c.id === body.clienteId);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
  const pedido = await addPedido({
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    cidade: cliente.cidade,
    itens,
    formaPagamento: FORMAS_PAGAMENTO.includes(body.formaPagamento)
      ? body.formaPagamento
      : "dinheiro",
    observacao: body.observacao?.trim() || null,
  });
  return NextResponse.json(pedido, { status: 201 });
}
