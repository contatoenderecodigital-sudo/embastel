import { NextRequest, NextResponse } from "next/server";
import { listArtes, salvarArte } from "@/lib/papelArrozDb";

export const dynamic = "force-dynamic";
// Arte de impressão é arquivo grande; o padrão de tempo não dá conta de
// receber e gravar alguns MB em conexão ruim.
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ artes: await listArtes() });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Parameters<typeof salvarArte>[0];

    if (!body?.imagemDataUrl) {
      return NextResponse.json({ error: "Faltou a imagem." }, { status: 400 });
    }

    const arte = await salvarArte({
      ...body,
      titulo: body.titulo?.trim() || "Arte sem nome",
    });

    return NextResponse.json({ arte }, { status: 201 });
  } catch (erro) {
    return NextResponse.json(
      { error: erro instanceof Error ? erro.message : "Não deu pra salvar a arte." },
      { status: 400 }
    );
  }
}
