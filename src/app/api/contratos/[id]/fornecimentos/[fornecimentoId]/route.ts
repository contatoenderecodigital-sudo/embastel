import { NextRequest, NextResponse } from "next/server";
import { atualizarFornecimento, excluirFornecimento } from "@/lib/contratosDb";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fornecimentoId: string }> }
) {
  const { id, fornecimentoId } = await params;
  const contrato = await atualizarFornecimento(
    id,
    fornecimentoId,
    await request.json()
  );
  if (!contrato) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ contrato });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fornecimentoId: string }> }
) {
  const { id, fornecimentoId } = await params;
  await excluirFornecimento(id, fornecimentoId);
  return NextResponse.json({ ok: true });
}
