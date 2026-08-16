import { jsonStore } from "./jsonStore";

// Uma licitação como fica guardada no índice local. É o registro do PNCP já
// limpo e com a coordenada do município resolvida — assim a busca do usuário
// não precisa tocar em rede nenhuma.
export type LicitacaoIndexada = {
  numeroControlePNCP: string;
  objeto: string;
  informacaoComplementar: string | null;
  orgao: string;
  municipio: string;
  uf: string;
  modalidadeId: number;
  modalidade: string;
  situacao: string;
  valorEstimado: number | null;
  dataPublicacao: string | null;
  dataEncerramentoProposta: string | null;
  link: string;
  lat: number | null;
  lon: number | null;
  // Quando esta licitação entrou no índice pela primeira vez — é o que
  // define "nova" pra fins de notificação e do selo "novidade" na tela.
  vistaEm: number;
  // Veredito da IA sobre "a Embastel vende isso?" (ver triagemIA.ts).
  // null = ainda não avaliada (sem ANTHROPIC_API_KEY, ou já estava no índice
  // antes da triagem existir).
  triagem: { serve: boolean; motivo: string } | null;
};

type IndexData = {
  items: LicitacaoIndexada[];
  atualizadoEm: number | null;
};

const store = jsonStore<IndexData>("licitacoes-indice.json", {
  items: [],
  atualizadoEm: null,
});

export async function lerIndice(): Promise<IndexData> {
  return store.read();
}

export async function gravarIndice(items: LicitacaoIndexada[]): Promise<void> {
  await store.update((data) => {
    data.items = items;
    data.atualizadoEm = Date.now();
  });
}

/**
 * Junta um lote de licitações ao índice, sem apagar o que já estava lá.
 * Devolve os números das que são realmente novas.
 *
 * Grava uma vez por lote (e não por página lida) de propósito: no Postgres
 * cada update reescreve o documento inteiro, que tem milhares de registros.
 */
export async function mesclarNoIndice(
  novos: LicitacaoIndexada[]
): Promise<string[]> {
  if (!novos.length) return [];
  return store.update((data) => {
    const porNumero = new Map(data.items.map((i) => [i.numeroControlePNCP, i]));
    const recemChegadas: string[] = [];

    for (const novo of novos) {
      const anterior = porNumero.get(novo.numeroControlePNCP);
      if (anterior) {
        // Já conhecida: atualiza os dados públicos, mas preserva o que custou
        // caro pra descobrir (coordenada, veredito da IA) e desde quando ela é
        // conhecida — senão ela viraria "novidade" a cada varredura.
        porNumero.set(novo.numeroControlePNCP, {
          ...novo,
          lat: anterior.lat,
          lon: anterior.lon,
          triagem: anterior.triagem,
          vistaEm: anterior.vistaEm,
        });
      } else {
        porNumero.set(novo.numeroControlePNCP, novo);
        recemChegadas.push(novo.numeroControlePNCP);
      }
    }

    data.items = [...porNumero.values()];
    return recemChegadas;
  });
}

/** Municípios presentes no índice que ainda estão sem coordenada. */
export async function municipiosSemCoordenada(): Promise<
  Array<{ municipio: string; uf: string }>
> {
  const data = await store.read();
  const pendentes = new Map<string, { municipio: string; uf: string }>();
  for (const item of data.items) {
    if (item.lat != null || !item.municipio || !item.uf) continue;
    pendentes.set(`${item.municipio}|${item.uf}`, {
      municipio: item.municipio,
      uf: item.uf,
    });
  }
  return [...pendentes.values()];
}

/** Aplica a coordenada encontrada a todas as licitações daquele município. */
export async function aplicarCoordenadas(
  coordenadas: Array<{ municipio: string; uf: string; lat: number; lon: number }>
): Promise<void> {
  if (!coordenadas.length) return;
  await store.update((data) => {
    const mapa = new Map(
      coordenadas.map((c) => [`${c.municipio}|${c.uf}`, c])
    );
    for (const item of data.items) {
      if (item.lat != null) continue;
      const coord = mapa.get(`${item.municipio}|${item.uf}`);
      if (coord) {
        item.lat = coord.lat;
        item.lon = coord.lon;
      }
    }
  });
}

export async function aplicarTriagens(
  vereditos: Map<string, { serve: boolean; motivo: string }>
): Promise<void> {
  if (!vereditos.size) return;
  await store.update((data) => {
    for (const item of data.items) {
      const veredito = vereditos.get(item.numeroControlePNCP);
      if (veredito) item.triagem = veredito;
    }
  });
}

/**
 * Remove do índice o que já venceu e marca a varredura como concluída.
 * A poda só acontece no fim de uma varredura completa — durante ela o índice
 * fica misturando registros da rodada anterior com os novos, e tudo bem.
 */
export async function podarEFinalizarIndice(
  carenciaMs: number,
  // Só marca o índice como atualizado quando a varredura de fato leu alguma
  // coisa. Numa rodada em que o PNCP recusou tudo, o índice continua velho —
  // e precisa continuar parecendo velho, senão o agendador acha que já
  // atualizou e só tenta de novo daqui a 6 horas.
  marcarComoAtualizado: boolean
): Promise<number> {
  return store.update((data) => {
    const limite = Date.now() - carenciaMs;
    const antes = data.items.length;
    data.items = data.items.filter((item) => {
      if (!item.dataEncerramentoProposta) return true;
      const prazo = new Date(item.dataEncerramentoProposta).getTime();
      if (Number.isNaN(prazo)) return true;
      return prazo >= limite;
    });
    if (marcarComoAtualizado) data.atualizadoEm = Date.now();
    return antes - data.items.length;
  });
}

// ---------------------------------------------------------------------------
// Estado da coleta — em arquivo separado de propósito: o progresso é gravado
// a cada página lida, e não faz sentido reescrever o índice inteiro (que pode
// ter milhares de registros) só pra atualizar um contador.
// ---------------------------------------------------------------------------

// Onde a varredura parou. É o que permite a coleta ser retomada de onde ficou:
// uma varredura completa do PNCP leva minutos, e cada chamada de avancarColeta
// empurra o cursor um pouco mais em vez de refazer tudo.
export type CursorColeta = {
  ufs: Array<string | null>;
  modalidades: number[];
  ufIdx: number;
  modIdx: number;
  pagina: number;
  totalPaginasDaConsulta: number;
  dataInicial: string;
  dataFinal: string;
  // Licitações que entraram no índice nesta varredura — usadas no fim para
  // triagem por IA e para os avisos de "licitação nova".
  novas: string[];
  falhas: number;
};

export type ColetaStatus = {
  rodando: boolean;
  iniciadaEm: number | null;
  terminadaEm: number | null;
  cursor: CursorColeta | null;
  // Batimento cardíaco da coleta em andamento. É o que permite saber se o
  // `rodando: true` no arquivo é de uma coleta viva ou de uma que morreu no
  // meio (servidor derrubado, por exemplo).
  ultimoSinalEm: number | null;
  erro: string | null;
  // Progresso da rodada atual (ou da última concluída).
  etapa: "ociosa" | "lendo_pncp" | "localizando_cidades" | "triando" | "concluida";
  ufAtual: string | null;
  paginasLidas: number;
  paginasTotais: number;
  registrosLidos: number;
  itensNoIndice: number;
  novasNaUltimaColeta: number;
  cidadesPendentes: number;
};

const statusInicial: ColetaStatus = {
  rodando: false,
  iniciadaEm: null,
  terminadaEm: null,
  cursor: null,
  ultimoSinalEm: null,
  erro: null,
  etapa: "ociosa",
  ufAtual: null,
  paginasLidas: 0,
  paginasTotais: 0,
  registrosLidos: 0,
  itensNoIndice: 0,
  novasNaUltimaColeta: 0,
  cidadesPendentes: 0,
};

const statusStore = jsonStore<ColetaStatus>("licitacoes-coleta.json", statusInicial);

export async function lerStatusColeta(): Promise<ColetaStatus> {
  const status = await statusStore.read();
  return { ...statusInicial, ...status };
}

export async function atualizarStatusColeta(
  patch: Partial<ColetaStatus>
): Promise<ColetaStatus> {
  return statusStore.update((data) => {
    Object.assign(data, patch);
    return { ...statusInicial, ...data };
  });
}

// Uma coleta sem sinal de vida por mais tempo que isso é considerada morta e
// outra pode assumir. O coletor dá sinal a cada 1,5s de progresso e também a
// cada tentativa de backoff, então 10 minutos de silêncio significa mesmo que
// algo morreu (servidor derrubado no meio, por exemplo).
const VALIDADE_DA_TRAVA_MS = 10 * 60 * 1000;

/**
 * Tenta assumir a coleta. Devolve `false` se já existe outra viva.
 *
 * A trava fica no arquivo, e não só em memória, de propósito: em
 * desenvolvimento o Next recarrega os módulos a quente e cria instâncias
 * novas, cada uma com suas variáveis zeradas — foi exatamente assim que duas
 * coletas acabaram rodando ao mesmo tempo, uma sobrescrevendo o progresso da
 * outra. O arquivo é o único ponto que as duas instâncias enxergam igual.
 */
export async function tentarAssumirColeta(): Promise<boolean> {
  return statusStore.update((data) => {
    const agora = Date.now();
    const viva =
      data.rodando &&
      data.ultimoSinalEm != null &&
      agora - data.ultimoSinalEm < VALIDADE_DA_TRAVA_MS;
    if (viva) return false;

    Object.assign(data, {
      rodando: true,
      iniciadaEm: agora,
      ultimoSinalEm: agora,
      terminadaEm: null,
      erro: null,
      etapa: "lendo_pncp",
      ufAtual: null,
      paginasLidas: 0,
      paginasTotais: 0,
      registrosLidos: 0,
      novasNaUltimaColeta: 0,
      cidadesPendentes: 0,
    });
    return true;
  });
}
