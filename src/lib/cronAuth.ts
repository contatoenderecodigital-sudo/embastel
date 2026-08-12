import { NextRequest, NextResponse } from "next/server";

/**
 * As rotas de cron ficam numa URL pública, então precisam de segredo próprio —
 * senão qualquer um dispara uma varredura inteira do PNCP no seu projeto.
 *
 * O Vercel manda `Authorization: Bearer $CRON_SECRET` nas chamadas agendadas.
 * Devolve uma resposta de erro quando a chamada não é legítima, ou null quando
 * está tudo certo.
 */
export function autorizarCron(request: NextRequest): NextResponse | null {
  const segredo = process.env.CRON_SECRET;

  // Sem segredo configurado só permite fora da Vercel (seu computador), onde a
  // rota não está exposta pra internet. Em produção, recusa — é melhor o cron
  // falhar visivelmente do que ficar aberto sem ninguém perceber.
  if (!segredo) {
    if (process.env.VERCEL) {
      return NextResponse.json(
        { error: "CRON_SECRET não configurado." },
        { status: 500 }
      );
    }
    return null;
  }

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  return null;
}
