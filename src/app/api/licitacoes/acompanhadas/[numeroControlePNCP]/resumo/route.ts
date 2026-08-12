import { NextRequest, NextResponse } from "next/server";
import { listTracked, updateTracked } from "@/lib/licitacoesTrackingDb";
import { summarizeLicitacao } from "@/lib/licitacaoSummary";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ numeroControlePNCP: string }> }
) {
  const { numeroControlePNCP } = await params;
  const id = decodeURIComponent(numeroControlePNCP);

  const items = await listTracked();
  const item = items.find((i) => i.numeroControlePNCP === id);
  if (!item) {
    return NextResponse.json(
      { error: "Licitação não encontrada no acompanhamento." },
      { status: 404 }
    );
  }

  try {
    const summary = await summarizeLicitacao(item);
    const updated = await updateTracked(id, { aiSummary: summary });
    return NextResponse.json({ item: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao gerar resumo." },
      { status: 500 }
    );
  }
}
