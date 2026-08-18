import { lerStatusColeta } from "./licitacoesIndexDb";
import { avancarVarredura } from "./itensCollector";
import { avancarBackfill, lerStatusBackfill } from "./precosBackfill";

// Um único relógio para as leituras secundárias do PNCP.
//
// POR QUE ISSO EXISTE. Cada leitura nasceu com o próprio setInterval: a
// varredura dos lotes a cada 5 minutos, o histórico de preço a cada 10. Some
// a coleta principal de licitações, que roda a cada 6 horas, e em certos
// momentos os três falavam com o PNCP ao mesmo tempo, do mesmo servidor.
//
// O PNCP é um serviço público gratuito e corta com 429 quando apanha demais.
// Medido em 18/08/2026: o histórico perdeu 316 de 1.181 páginas (27%), e a
// coleta principal — a que alimenta a busca, a mais importante das três —
// levou recusa nos seis blocos.
//
// Aqui elas passam a andar em fila, uma de cada vez, e sempre atrás da coleta
// principal. Mais devagar de propósito: preferir terminar o que importa a
// tentar tudo junto e não terminar nada.

const INTERVALO_MS = 5 * 60 * 1000;
const ORCAMENTO_POR_TAREFA_MS = 45_000;
const PRIMEIRA_RODADA_MS = 90_000;

let temporizador: ReturnType<typeof setInterval> | null = null;
let rodando = false;

/** A coleta de licitações tem prioridade — as outras esperam a vez. */
async function coletaPrincipalEstaRodando(): Promise<boolean> {
  try {
    return (await lerStatusColeta()).rodando === true;
  } catch {
    // Sem conseguir ler o status, o seguro é não disputar.
    return true;
  }
}

async function rodarUmaVez(): Promise<void> {
  // Trava simples de processo: uma rodada que passou dos 5 minutos não pode
  // ganhar companhia da rodada seguinte.
  if (rodando) return;
  rodando = true;
  try {
    if (await coletaPrincipalEstaRodando()) return;

    // Primeiro os lotes das licitações que já estão no índice: é o que serve
    // pra participar de algo que ainda está aberto.
    await avancarVarredura(ORCAMENTO_POR_TAREFA_MS);

    if (await coletaPrincipalEstaRodando()) return;

    // Depois o histórico de preço, que é pesquisa e não tem pressa. Para
    // sozinho quando chega aos 12 meses.
    const historico = await lerStatusBackfill().catch(() => null);
    if (!historico?.concluido) {
      await avancarBackfill(ORCAMENTO_POR_TAREFA_MS);
    }
  } catch (erro) {
    console.error("[leitura de fundo] falhou:", erro);
  } finally {
    rodando = false;
  }
}

export function iniciarLeiturasDeFundo(): void {
  if (temporizador) return;
  setTimeout(() => void rodarUmaVez(), PRIMEIRA_RODADA_MS);
  temporizador = setInterval(() => void rodarUmaVez(), INTERVALO_MS);
}
