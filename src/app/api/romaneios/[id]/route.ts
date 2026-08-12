import { NextRequest, NextResponse } from "next/server";
import { deleteRomaneio, getRomaneio, updateRomaneio } from "@/lib/romaneiosDb";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const romaneio = await getRomaneio(id);
  if (!romaneio) {
    return NextResponse.json({ error: "Romaneio não encontrado." }, { status: 404 });
  }
  return NextResponse.json(romaneio);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const romaneio = await updateRomaneio(id, {
    data: body.data,
    observacao: body.observacao !== undefined ? body.observacao?.trim() || null : undefined,
  });
  if (!romaneio) {
    return NextResponse.json({ error: "Romaneio não encontrado." }, { status: 404 });
  }
  return NextResponse.json(romaneio);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteRomaneio(id);
  return NextResponse.json({ ok: true });
}
