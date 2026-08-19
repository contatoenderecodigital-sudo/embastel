import { NextRequest, NextResponse } from "next/server";
import {
  deleteFornecedorLicitacao,
  registrarCotacao,
  updateFornecedorLicitacao,
} from "@/lib/fornecedoresLicitacaoDb";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // {cotacao:"pedida"|"respondida"} mexe só nos contadores de histórico.
  const fornecedor =
    body?.cotacao === "pedida" || body?.cotacao === "respondida"
      ? await registrarCotacao(id, body.cotacao)
      : await updateFornecedorLicitacao(id, body);

  if (!fornecedor) {
    return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ fornecedor });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteFornecedorLicitacao(id);
  return NextResponse.json({ ok: true });
}
