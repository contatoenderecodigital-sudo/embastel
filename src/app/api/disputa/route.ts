import { NextResponse } from "next/server";
import { contagemPorLicitacao } from "@/lib/disputaDb";
import { listTracked } from "@/lib/licitacoesTrackingDb";

export const dynamic = "force-dynamic";

/** As licitações do funil, com quantos lotes cada uma já tem cotados. */
export async function GET() {
  const [tracked, contagem] = await Promise.all([
    listTracked(),
    contagemPorLicitacao(),
  ]);

  return NextResponse.json({
    licitacoes: tracked.map((t) => ({
      numeroControlePNCP: t.numeroControlePNCP,
      objeto: t.objeto,
      orgao: t.orgao,
      municipio: t.municipio,
      uf: t.uf,
      status: t.status,
      valorEstimado: t.valorEstimado,
      dataEncerramentoProposta: t.dataEncerramentoProposta,
      link: t.link,
      ...(contagem[t.numeroControlePNCP] ?? { lotes: 0, cotados: 0 }),
    })),
  });
}
