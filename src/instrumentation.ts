// Roda uma vez quando o servidor Next sobe (ver
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md).
// É aqui que ligamos os trabalhos de segundo plano do painel — o coletor de
// licitações do PNCP e o verificador de prazos/avisos.
export async function register() {
  // Só no runtime Node: o coletor lê e grava arquivo em disco, o que não
  // existe no runtime Edge.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { iniciarAgendadorDeColeta } = await import("./lib/pncpCollector");
  const { iniciarVerificadorDeAvisos } = await import("./lib/avisosAutomaticos");
  const { iniciarLeiturasDeFundo } = await import("./lib/pncpLeituraDeFundo");

  await iniciarAgendadorDeColeta();
  iniciarVerificadorDeAvisos();

  // As duas leituras secundárias — lotes das licitações e histórico de preço
  // arrematado — andam em fila num relógio só, sempre atrás da coleta
  // principal. Ver pncpLeituraDeFundo.ts: rodando soltas, as três disputavam o
  // PNCP e as recusas derrubavam justamente a mais importante.
  iniciarLeiturasDeFundo();
}
