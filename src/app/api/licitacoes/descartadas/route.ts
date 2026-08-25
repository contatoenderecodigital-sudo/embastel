import { NextRequest, NextResponse } from "next/server";
import {
  descartar,
  listarDescartadas,
  restaurar,
} from "@/lib/licitacoesDescartadasDb";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ descartadas: await listarDescartadas() });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const numeroControlePNCP = String(body?.numeroControlePNCP ?? "").trim();
  if (!numeroControlePNCP) {
    return NextResponse.json(
      { error: "Falta o número da licitação." },
      { status: 400 }
    );
  }
  return NextResponse.json({
    descartadas: await descartar({
      numeroControlePNCP,
      objeto: body?.objeto,
      municipio: body?.municipio,
      uf: body?.uf,
      motivo: body?.motivo,
    }),
  });
}

export async function DELETE(request: NextRequest) {
  const numero = request.nextUrl.searchParams.get("numeroControlePNCP");
  if (!numero) {
    return NextResponse.json(
      { error: "Falta o número da licitação." },
      { status: 400 }
    );
  }
  return NextResponse.json({ descartadas: await restaurar(numero) });
}
