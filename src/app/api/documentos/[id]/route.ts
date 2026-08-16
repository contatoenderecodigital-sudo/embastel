import { NextRequest, NextResponse } from "next/server";
import { atualizarDocumento, excluirDocumento } from "@/lib/documentosDb";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const doc = await atualizarDocumento(id, body);
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ documento: doc });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await excluirDocumento(id);
  return NextResponse.json({ ok: true });
}
