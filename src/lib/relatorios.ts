import { listTracked } from "./licitacoesTrackingDb";
import type { LicitacaoStatus } from "./licitacoesTrackingDb";
import { listContratos } from "./contratosDb";
import { listDocumentos, situacaoDe } from "./documentosDb";

// Os números que nenhum portal de licitação mostra.
//
// A Licitar Digital não tem relatório nenhum: nem propostas enviadas no
// período, nem taxa de vitória, nem valor disputado contra ganho, nem quais
// órgãos mais compram de você. Isso é justamente o que decide onde vale a
// pena gastar o tempo de montar proposta — 126 lotes levam horas.

export type Periodo = 30 | 90 | 180 | 365 | 0;

export type ResumoFunil = { status: LicitacaoStatus; rotulo: string; quantidade: number };

export const ROTULO_STATUS: Record<LicitacaoStatus, string> = {
  avaliar: "Avaliar",
  de_olho: "De olho",
  preparando: "Preparando",
  enviada: "Proposta enviada",
  em_disputa: "Em disputa",
  habilitacao: "Habilitação",
  ganhou: "Ganhou",
  entregando: "Entregando",
  perdeu: "Perdeu",
};

// Etapas em que a Embastel já gastou trabalho de verdade — montou e mandou
// proposta. É a base honesta pra taxa de vitória: contar "avaliar" ou
// "de_olho" como disputa infla o denominador com coisa que nunca virou
// proposta.
const DISPUTADAS: LicitacaoStatus[] = [
  "enviada",
  "em_disputa",
  "habilitacao",
  "ganhou",
  "entregando",
  "perdeu",
];

const GANHAS: LicitacaoStatus[] = ["ganhou", "entregando"];

export type Relatorio = {
  periodoDias: Periodo;
  funil: ResumoFunil[];
  disputadas: number;
  ganhas: number;
  perdidas: number;
  /**
   * Só conta o que já teve desfecho. Licitação ainda em disputa não é vitória
   * nem derrota, e jogá-la no denominador faria a taxa despencar sozinha toda
   * vez que uma proposta nova fosse enviada.
   */
  taxaVitoria: number | null;
  valorDisputado: number;
  valorGanho: number;
  ticketMedioGanho: number | null;
  /** Ganho segundo os contratos cadastrados — o número que virou dinheiro. */
  valorContratado: number;
  porMes: Array<{ mes: string; ganhas: number; perdidas: number; valorGanho: number }>;
  orgaos: Array<{
    orgao: string;
    municipio: string;
    uf: string;
    disputadas: number;
    ganhas: number;
    valorGanho: number;
  }>;
  contratos: {
    ativos: number;
    valorTotal: number;
    saldoAFornecer: number;
    aReceber: number;
    emAtraso: number;
  };
  documentos: { vencidos: number; venceEmBreve: number; semArquivo: number };
  /** Sem histórico não há estatística — a tela avisa em vez de mentir. */
  poucosDados: boolean;
};

function mesDe(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function montarRelatorio(periodoDias: Periodo = 180): Promise<Relatorio> {
  const [tracked, contratos, documentos] = await Promise.all([
    listTracked(),
    listContratos(),
    listDocumentos(),
  ]);

  const corte =
    periodoDias > 0 ? Date.now() - periodoDias * 86400000 : Number.NEGATIVE_INFINITY;
  // updatedAt e não createdAt: o que interessa é quando a licitação chegou ao
  // estágio atual — uma acompanhada há 8 meses e ganha ontem conta no mês
  // passado, não no de quando foi vista.
  const noPeriodo = tracked.filter((t) => t.updatedAt >= corte);

  const funil: ResumoFunil[] = (Object.keys(ROTULO_STATUS) as LicitacaoStatus[]).map(
    (status) => ({
      status,
      rotulo: ROTULO_STATUS[status],
      quantidade: noPeriodo.filter((t) => t.status === status).length,
    })
  );

  const disputadasItens = noPeriodo.filter((t) => DISPUTADAS.includes(t.status));
  const ganhasItens = noPeriodo.filter((t) => GANHAS.includes(t.status));
  const perdidasItens = noPeriodo.filter((t) => t.status === "perdeu");

  const valorDisputado = disputadasItens.reduce(
    (s, t) => s + (t.valorEstimado ?? 0),
    0
  );
  const valorGanho = ganhasItens.reduce((s, t) => s + (t.valorEstimado ?? 0), 0);

  const comDesfecho = ganhasItens.length + perdidasItens.length;

  // -------------------------------------------------------------- por mês
  const mapaMes = new Map<string, { ganhas: number; perdidas: number; valorGanho: number }>();
  for (const t of [...ganhasItens, ...perdidasItens]) {
    const mes = mesDe(t.updatedAt);
    const atual = mapaMes.get(mes) ?? { ganhas: 0, perdidas: 0, valorGanho: 0 };
    if (t.status === "perdeu") {
      atual.perdidas += 1;
    } else {
      atual.ganhas += 1;
      atual.valorGanho += t.valorEstimado ?? 0;
    }
    mapaMes.set(mes, atual);
  }
  const porMes = [...mapaMes.entries()]
    .map(([mes, v]) => ({ mes, ...v }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  // --------------------------------------------------------------- órgãos
  const mapaOrgao = new Map<
    string,
    { orgao: string; municipio: string; uf: string; disputadas: number; ganhas: number; valorGanho: number }
  >();
  for (const t of disputadasItens) {
    const chave = `${t.orgao}|${t.municipio}|${t.uf}`;
    const atual = mapaOrgao.get(chave) ?? {
      orgao: t.orgao,
      municipio: t.municipio,
      uf: t.uf,
      disputadas: 0,
      ganhas: 0,
      valorGanho: 0,
    };
    atual.disputadas += 1;
    if (GANHAS.includes(t.status)) {
      atual.ganhas += 1;
      atual.valorGanho += t.valorEstimado ?? 0;
    }
    mapaOrgao.set(chave, atual);
  }
  const orgaos = [...mapaOrgao.values()].sort(
    (a, b) => b.valorGanho - a.valorGanho || b.disputadas - a.disputadas
  );

  const ativos = contratos.filter((c) => !c.encerrado);

  return {
    periodoDias,
    funil,
    disputadas: disputadasItens.length,
    ganhas: ganhasItens.length,
    perdidas: perdidasItens.length,
    taxaVitoria: comDesfecho > 0 ? ganhasItens.length / comDesfecho : null,
    valorDisputado,
    valorGanho,
    ticketMedioGanho: ganhasItens.length > 0 ? valorGanho / ganhasItens.length : null,
    valorContratado: contratos.reduce((s, c) => s + c.valorTotal, 0),
    porMes,
    orgaos,
    contratos: {
      ativos: ativos.length,
      valorTotal: ativos.reduce((s, c) => s + c.valorTotal, 0),
      saldoAFornecer: ativos.reduce((s, c) => s + c.saldoValor, 0),
      aReceber: contratos.reduce((s, c) => s + c.aReceber, 0),
      emAtraso: contratos.reduce((s, c) => s + c.emAtraso, 0),
    },
    documentos: {
      vencidos: documentos.filter((d) => situacaoDe(d) === "vencido").length,
      venceEmBreve: documentos.filter((d) => situacaoDe(d) === "vence_em_breve").length,
      semArquivo: documentos.filter((d) => situacaoDe(d) === "sem_arquivo").length,
    },
    poucosDados: comDesfecho < 3,
  };
}
