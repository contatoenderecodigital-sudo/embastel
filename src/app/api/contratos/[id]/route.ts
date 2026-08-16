import { NextRequest, NextResponse } from "next/server";
import { atualizarContrato, excluirContrato } from "@/lib/contratosDb";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const contrato = await atualizarContrato(id, await request.json());
  if (!contrato) {
    return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ contrato });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await excluirContrato(id);
  return NextResponse.json({ ok: true });
}
