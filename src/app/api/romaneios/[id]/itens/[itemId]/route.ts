import { NextRequest, NextResponse } from "next/server";
import { deleteItemRomaneio, updateItemRomaneio } from "@/lib/romaneiosDb";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const body = await request.json();
  const romaneio = await updateItemRomaneio(id, itemId, {
    // Nome e cidade também se editam: o que foi digitado à mão se corrige
    // digitando de novo, sem apagar a linha e lançar tudo outra vez.
    clienteNome:
      body.clienteNome !== undefined
        ? String(body.clienteNome).trim() || "Sem nome"
        : undefined,
    cidade: body.cidade !== undefined ? String(body.cidade).trim() : undefined,
    valor: body.valor !== undefined ? Number(body.valor) : undefined,
    formaPagamento: body.formaPagamento,
    observacao: body.observacao !== undefined ? body.observacao?.trim() || null : undefined,
    entregue: body.entregue,
    pago: body.pago,
  });
  if (!romaneio) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }
  return NextResponse.json(romaneio);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const romaneio = await deleteItemRomaneio(id, itemId);
  if (!romaneio) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }
  return NextResponse.json(romaneio);
}
