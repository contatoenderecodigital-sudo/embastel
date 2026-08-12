import { NextRequest, NextResponse } from "next/server";
import { listRecorrentes, addRecorrente } from "@/lib/recorrentesDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const recorrentes = await listRecorrentes();
  return NextResponse.json({ recorrentes });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.titulo?.trim() || body.diaSemana == null) {
    return NextResponse.json(
      { error: "Título e dia da semana são obrigatórios" },
      { status: 400 }
    );
  }
  const diaSemana = Number(body.diaSemana);
  if (Number.isNaN(diaSemana) || diaSemana < 0 || diaSemana > 6) {
    return NextResponse.json({ error: "Dia da semana inválido" }, { status: 400 });
  }
  const recorrente = await addRecorrente({
    titulo: body.titulo.trim(),
    diaSemana,
    responsavel: body.responsavel?.trim() || null,
  });
  return NextResponse.json(recorrente, { status: 201 });
}
