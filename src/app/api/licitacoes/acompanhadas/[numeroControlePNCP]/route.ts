import { NextRequest, NextResponse } from "next/server";
import { untrackLicitacao, updateTracked } from "@/lib/licitacoesTrackingDb";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ numeroControlePNCP: string }> }
) {
  const { numeroControlePNCP } = await params;
  const updates = (await request.json()) as {
    status?: "de_olho" | "preparando" | "enviada" | "ganhou" | "perdeu";
    notes?: string;
    aiSummary?: string;
  };

  const item = await updateTracked(decodeURIComponent(numeroControlePNCP), updates);
  if (!item) {
    return NextResponse.json(
      { error: "Licitação não encontrada no acompanhamento." },
      { status: 404 }
    );
  }
  return NextResponse.json({ item });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ numeroControlePNCP: string }> }
) {
  const { numeroControlePNCP } = await params;
  await untrackLicitacao(decodeURIComponent(numeroControlePNCP));
  return NextResponse.json({ ok: true });
}
