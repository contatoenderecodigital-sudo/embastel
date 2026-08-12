import { NextRequest, NextResponse } from "next/server";
import { avancarColeta } from "@/lib/pncpCollector";
import { autorizarCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
// Teto do plano Hobby do Vercel. A coleta é retomável (ver pncpCollector.ts):
// cada chamada empurra o cursor um pouco e a próxima continua dali.
export const maxDuration = 60;

// Fatia de trabalho por chamada, com folga pra resposta caber no limite acima.
const ORCAMENTO_MS = 45_000;

export async function GET(request: NextRequest) {
  const negado = autorizarCron(request);
  if (negado) return negado;

  const status = await avancarColeta(ORCAMENTO_MS);

  return NextResponse.json({
    etapa: status.etapa,
    rodando: status.rodando,
    paginasLidas: status.paginasLidas,
    registrosLidos: status.registrosLidos,
    itensNoIndice: status.itensNoIndice,
    cidadesPendentes: status.cidadesPendentes,
    erro: status.erro,
  });
}
