import { NextRequest, NextResponse } from "next/server";
import { listFichas, addFicha } from "@/lib/fichasDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const fichas = await listFichas();
  return NextResponse.json({ fichas });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.titulo?.trim()) {
    return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
  }
  const variantes = Array.isArray(body.variantes)
    ? body.variantes.map((v: unknown) => String(v).trim()).filter(Boolean)
    : [];
  const ficha = await addFicha({
    titulo: body.titulo.trim(),
    categoria: body.categoria?.trim() || null,
    variantes,
    imagemDataUrl: body.imagemDataUrl || null,
    observacao: body.observacao?.trim() || null,
  });
  return NextResponse.json(ficha, { status: 201 });
}
