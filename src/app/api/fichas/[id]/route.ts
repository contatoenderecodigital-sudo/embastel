import { NextRequest, NextResponse } from "next/server";
import { deleteFicha, updateFicha } from "@/lib/fichasDb";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const ficha = await updateFicha(id, {
    titulo: body.titulo?.trim(),
    categoria: body.categoria !== undefined ? body.categoria?.trim() || null : undefined,
    variantes: Array.isArray(body.variantes)
      ? body.variantes.map((v: unknown) => String(v).trim()).filter(Boolean)
      : undefined,
    imagemDataUrl: body.imagemDataUrl !== undefined ? body.imagemDataUrl || null : undefined,
    observacao: body.observacao !== undefined ? body.observacao?.trim() || null : undefined,
  });
  if (!ficha) {
    return NextResponse.json({ error: "Ficha não encontrada." }, { status: 404 });
  }
  return NextResponse.json(ficha);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteFicha(id);
  return NextResponse.json({ ok: true });
}
