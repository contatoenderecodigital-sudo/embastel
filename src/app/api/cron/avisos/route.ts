import { NextRequest, NextResponse } from "next/server";
import { verificarAvisos } from "@/lib/avisosAutomaticos";
import { contarNaoLidas } from "@/lib/notificacoesDb";
import { autorizarCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const negado = autorizarCron(request);
  if (negado) return negado;

  await verificarAvisos();
  return NextResponse.json({ ok: true, naoLidas: await contarNaoLidas() });
}
