import { NextRequest, NextResponse } from "next/server";
import { atualizarProduto, excluirProduto } from "@/lib/catalogoDb";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const produto = await atualizarProduto(id, await request.json());
  if (!produto) {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ produto });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await excluirProduto(id);
  return NextResponse.json({ ok: true });
}
