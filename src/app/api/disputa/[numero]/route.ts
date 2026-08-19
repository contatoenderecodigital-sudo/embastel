import { NextRequest, NextResponse } from "next/server";
import {
  adicionarLote,
  atualizarLote,
  importarDoPncp,
  lerDisputa,
  reaplicarPadroes,
  removerLote,
  salvarPadroes,
} from "@/lib/disputaDb";
import { listTracked } from "@/lib/licitacoesTrackingDb";

export const dynamic = "force-dynamic";

// O número de controle do PNCP tem barra ("...-000038/2026"), então chega
// codificado na URL e precisa ser decodificado antes de bater com o guardado.
async function numeroDe(params: Promise<{ numero: string }>): Promise<string> {
  const { numero } = await params;
  return decodeURIComponent(numero);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const numero = await numeroDe(params);
  const [disputa, tracked] = await Promise.all([lerDisputa(numero), listTracked()]);
  return NextResponse.json({
    disputa,
    licitacao: tracked.find((t) => t.numeroControlePNCP === numero) ?? null,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const numero = await numeroDe(params);
  const body = await request.json();

  if (body?.acao === "importar-do-pncp") {
    try {
      return NextResponse.json(await importarDoPncp(numero));
    } catch {
      // O PNCP recusa e cai fora com alguma frequência. Erro de rede aqui não
      // é bug do painel, e a mensagem precisa dizer isso pra ninguém achar que
      // a planilha quebrou no meio do pregão.
      return NextResponse.json(
        {
          error:
            "O PNCP não respondeu a lista de itens agora. Tente de novo em um minuto, ou adicione os lotes na mão.",
        },
        { status: 502 }
      );
    }
  }

  if (body?.acao === "reaplicar-padroes") {
    const disputa = await reaplicarPadroes(numero);
    return NextResponse.json({ disputa });
  }

  return NextResponse.json({ disputa: await adicionarLote(numero, body) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const numero = await numeroDe(params);
  const { loteId, ...campos } = await request.json();

  const disputa = loteId
    ? await atualizarLote(numero, loteId, campos)
    : await salvarPadroes(numero, campos);

  if (!disputa) {
    return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ disputa });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const numero = await numeroDe(params);
  const loteId = request.nextUrl.searchParams.get("loteId");
  if (!loteId) {
    return NextResponse.json({ error: "Falta o loteId." }, { status: 400 });
  }
  const disputa = await removerLote(numero, loteId);
  if (!disputa) {
    return NextResponse.json({ error: "Disputa não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ disputa });
}
