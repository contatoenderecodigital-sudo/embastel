import { NextRequest, NextResponse } from "next/server";
import { listTracked, trackLicitacao } from "@/lib/licitacoesTrackingDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listTracked();
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    numeroControlePNCP,
    objeto,
    orgao,
    municipio,
    uf,
    modalidade,
    valorEstimado,
    dataEncerramentoProposta,
    link,
  } = body ?? {};

  if (!numeroControlePNCP || !objeto) {
    return NextResponse.json(
      { error: "Dados da licitação incompletos." },
      { status: 400 }
    );
  }

  const item = await trackLicitacao({
    numeroControlePNCP,
    objeto,
    orgao: orgao ?? "",
    municipio: municipio ?? "",
    uf: uf ?? "",
    modalidade: modalidade ?? "",
    valorEstimado: valorEstimado ?? null,
    dataEncerramentoProposta: dataEncerramentoProposta ?? null,
    link: link ?? "",
  });

  return NextResponse.json({ item });
}
