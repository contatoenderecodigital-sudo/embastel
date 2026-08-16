import { NextRequest, NextResponse } from "next/server";
import { adicionarFornecimento } from "@/lib/contratosDb";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const contrato = await adicionarFornecimento(id, await request.json());
  if (!contrato) {
    return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ contrato }, { status: 201 });
}
