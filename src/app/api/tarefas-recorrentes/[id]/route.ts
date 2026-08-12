import { NextRequest, NextResponse } from "next/server";
import { deleteRecorrente, updateRecorrente } from "@/lib/recorrentesDb";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const recorrente = await updateRecorrente(id, {
    titulo: body.titulo,
    diaSemana: body.diaSemana != null ? Number(body.diaSemana) : undefined,
    responsavel: body.responsavel !== undefined ? body.responsavel || null : undefined,
    ativo: body.ativo,
  });
  if (!recorrente) {
    return NextResponse.json({ error: "Não encontrada." }, { status: 404 });
  }
  return NextResponse.json(recorrente);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteRecorrente(id);
  return NextResponse.json({ ok: true });
}
