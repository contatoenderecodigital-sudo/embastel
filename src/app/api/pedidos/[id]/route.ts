import { NextRequest, NextResponse } from "next/server";
import { deletePedido, getPedido, updatePedido } from "@/lib/pedidosDb";
import type { PedidoItem } from "@/lib/pedidosDb";

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pedido = await getPedido(id);
  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  return NextResponse.json(pedido);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const pedido = await updatePedido(id, {
    itens: body.itens !== undefined ? sanitizeItens(body.itens) : undefined,
    formaPagamento: body.formaPagamento,
    status: body.status,
    pago: body.pago,
    observacao: body.observacao !== undefined ? body.observacao?.trim() || null : undefined,
    dataEntrega: body.dataEntrega,
  });
  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  return NextResponse.json(pedido);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deletePedido(id);
  return NextResponse.json({ ok: true });
}
