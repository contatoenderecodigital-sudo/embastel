import { NextRequest, NextResponse } from "next/server";
import { buscarPrecos } from "@/lib/precosBusca";
import { lerItens, lerStatusVarredura } from "@/lib/itensDb";
import { lerIndice } from "@/lib/licitacoesIndexDb";
import { lerStatusBackfill } from "@/lib/precosBackfill";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const termo = p.get("termo") ?? "";

  const [status, guardado, indice, historico] = await Promise.all([
    lerStatusVarredura(),
    lerItens(),
    lerIndice(),
    lerStatusBackfill(),
  ]);

  const varridas = Object.keys(guardado.varridas).length;

  const resultado = termo.trim()
    ? await buscarPrecos({
        termo,
        uf: p.get("uf") || undefined,
        mesesMax: p.get("meses") ? Number(p.get("meses")) : undefined,
      })
    : null;

  return NextResponse.json({
    resultado,
    historico: {
      ...historico,
      // 12 meses é o alvo (ver MESES_PARA_TRAS em precosBackfill.ts).
      mesesLidos: historico.cursor ? historico.cursor.mesesAtras - 1 : 0,
      mesesAlvo: 12,
      comPrecoArrematado: guardado.itens.filter((i) => i.resultados.length > 0).length,
    },
    varredura: {
      ...status,
      licitacoesVarridas: varridas,
      totalNoIndice: indice.items.length,
      itensGuardados: guardado.itens.length,
      aguardandoResultado: guardado.aguardandoResultado.length,
      percentual:
        indice.items.length > 0
          ? Math.min(1, varridas / indice.items.length)
          : 0,
    },
  });
}
