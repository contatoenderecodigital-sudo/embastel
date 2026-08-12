import { NextRequest, NextResponse } from "next/server";
import { deleteProduto, updateProduto } from "@/lib/estoqueDb";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const produto = await updateProduto(id, {
    nome: body.nome?.trim(),
    fornecedor: body.fornecedor?.trim(),
    situacao: body.situacao,
    quantidadeSugerida:
      body.quantidadeSugerida != null && body.quantidadeSugerida !== ""
        ? Number(body.quantidadeSugerida)
        : body.quantidadeSugerida === "" ? null : undefined,
    observacao: body.observacao !== undefined ? body.observacao?.trim() || null : undefined,
  });
  if (!produto) {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  }
  return NextResponse.json(produto);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteProduto(id);
  return NextResponse.json({ ok: true });
}
