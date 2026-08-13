import { NextResponse } from "next/server";
import { excluirArte, marcarUso } from "@/lib/papelArrozDb";

export const dynamic = "force-dynamic";

// Registra que a arte foi reaproveitada — ela volta pro topo da galeria.
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await marcarUso(id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await excluirArte(id);
  return NextResponse.json({ ok: true });
}
