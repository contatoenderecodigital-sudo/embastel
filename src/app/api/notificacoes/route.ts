import { NextRequest, NextResponse } from "next/server";
import {
  limparLidas,
  listNotificacoes,
  marcarLida,
  marcarTodasLidas,
} from "@/lib/notificacoesDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const notificacoes = await listNotificacoes();
  return NextResponse.json({
    notificacoes,
    naoLidas: notificacoes.filter((n) => !n.lida).length,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    acao?: "marcar_lida" | "marcar_todas" | "limpar_lidas";
    id?: string;
  };

  switch (body.acao) {
    case "marcar_lida":
      if (!body.id) {
        return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
      }
      await marcarLida(body.id);
      break;
    case "marcar_todas":
      await marcarTodasLidas();
      break;
    case "limpar_lidas":
      await limparLidas();
      break;
    default:
      return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
  }

  const notificacoes = await listNotificacoes();
  return NextResponse.json({
    notificacoes,
    naoLidas: notificacoes.filter((n) => !n.lida).length,
  });
}
