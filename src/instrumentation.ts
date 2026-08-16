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
  const { iniciarVarredorDeItens } = await import("./lib/itensCollector");

  await iniciarAgendadorDeColeta();
  iniciarVerificadorDeAvisos();
  // Desce ao nível dos lotes: é o que descobre saco plástico dentro de um
  // pregão chamado "material de consumo", e o que forma o histórico de preço
  // arrematado. Anda devagar de propósito (ver itensCollector.ts).
  iniciarVarredorDeItens();

  // Preço arrematado só existe depois que o órgão publica o resultado, o que
  // leva semanas — então quase nada dentro da janela de 30 dias do índice tem
  // preço. Este aqui vai buscar até 12 meses atrás, uma vez só, e depois para.
  const { iniciarBuscaDeHistorico } = await import("./lib/precosBackfill");
  iniciarBuscaDeHistorico();
}
