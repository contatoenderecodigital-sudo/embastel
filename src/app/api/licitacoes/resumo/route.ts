import { NextResponse } from "next/server";
import { searchLicitacoes } from "@/lib/pncp";
import { listTracked } from "@/lib/licitacoesTrackingDb";
import { lerStatusColeta } from "@/lib/licitacoesIndexDb";
import { getSettings } from "@/lib/settingsDb";

export const dynamic = "force-dynamic";

const UM_DIA = 86400000;

// Resumo que o Painel inicial usa. Fica no servidor pra home não ter que
// baixar o índice inteiro nem saber as regras de "o que interessa".
export async function GET() {
  const settings = await getSettings();

  const raio =
    settings.storeLat != null && settings.storeLon != null
      ? {
          lat: settings.storeLat,
          lon: settings.storeLon,
          km: settings.licitacaoRaioKm,
        }
      : undefined;

  const [busca, tracked, coleta] = await Promise.all([
    searchLicitacoes({
      keywords: settings.licitacaoKeywords,
      exclusoes: settings.licitacaoExclusoes,
      raio,
    }),
    listTracked(),
    lerStatusColeta(),
  ]);

  const agora = Date.now();
  const novas24h = busca.items.filter(
    (i) => (i.vistaEm ?? 0) >= agora - UM_DIA
  ).length;

  const fechandoEmSeteDias = busca.items.filter((i) => {
    if (!i.dataEncerramentoProposta) return false;
    const dias = Math.ceil(
      (new Date(i.dataEncerramentoProposta).getTime() - agora) / UM_DIA
    );
    return dias >= 0 && dias <= 7;
  }).length;

  const noFunil = tracked.filter(
    (t) => t.status !== "ganhou" && t.status !== "perdeu"
  );

  const funilUrgente = noFunil.filter((t) => {
    if (!t.dataEncerramentoProposta) return false;
    const dias = Math.ceil(
      (new Date(t.dataEncerramentoProposta).getTime() - agora) / UM_DIA
    );
    return dias >= 0 && dias <= 3;
  });

  const ganhas = tracked.filter((t) => t.status === "ganhou");

  return NextResponse.json({
    abertasNoPerfil: busca.items.length,
    novas24h,
    fechandoEmSeteDias,
    valorNoFunil: noFunil.reduce((soma, t) => soma + (t.valorEstimado ?? 0), 0),
    quantidadeNoFunil: noFunil.length,
    funilUrgente: funilUrgente.length,
    valorGanho: ganhas.reduce((soma, t) => soma + (t.valorEstimado ?? 0), 0),
    quantidadeGanha: ganhas.length,
    indiceAtualizadoEm: busca.atualizadoEm,
    totalNoIndice: busca.totalNoIndice,
    coletaRodando: coleta.rodando,
    // As 3 mais urgentes, pra home mostrar direto o que precisa de decisão.
    proximas: busca.items
      .filter((i) => i.dataEncerramentoProposta)
      .slice(0, 3)
      .map((i) => ({
        numeroControlePNCP: i.numeroControlePNCP,
        orgao: i.orgao,
        municipio: i.municipio,
        uf: i.uf,
        objeto: i.objeto,
        valorEstimado: i.valorEstimado,
        dataEncerramentoProposta: i.dataEncerramentoProposta,
        distanceKm: i.distanceKm,
      })),
  });
}
