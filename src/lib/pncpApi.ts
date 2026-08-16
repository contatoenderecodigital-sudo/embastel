// Camada crua de acesso à API pública de consulta do PNCP. Só faz requisição
// e trata instabilidade — quem decide o que fazer com os dados é o coletor
// (pncpCollector.ts).

export type PncpItem = {
  numeroControlePNCP: string;
  objetoCompra?: string;
  informacaoComplementar?: string | null;
  orgaoEntidade?: { razaoSocial?: string; cnpj?: string };
  unidadeOrgao?: { municipioNome?: string; ufSigla?: string };
  modalidadeId?: number;
  modalidadeNome?: string;
  situacaoCompraNome?: string;
  valorTotalEstimado?: number | null;
  dataPublicacaoPncp?: string | null;
  dataEncerramentoProposta?: string | null;
  anoCompra?: number;
  sequencialCompra?: number;
  linkSistemaOrigem?: string | null;
};

export type PncpResponse = {
  data: PncpItem[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
  empty: boolean;
};

const BASE_URL = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";

// A API do PNCP só aceita alguns tamanhos fixos de página (10/20/50);
// outros valores (ex: 100) retornam 400 "Tamanho de página inválido".
export const PAGE_SIZE = 50;

// Alguns dias o PNCP responde devagar sem chegar a dar erro — sem timeout
// próprio, isso deixava a busca inteira travada esperando minutos por página.
const REQUEST_TIMEOUT_MS = 20000;

// O PNCP corta com 429 quando a leitura é longa (a coleta lê centenas de
// páginas seguidas). Medido em uso real: backoff curto (2/4/6/8s) não bastava
// — a coleta morria na página 33. Mas exagerar também machuca: com 6
// tentativas até 60s, uma página ruim segurava a coleta por quase 5 minutos
// sem dar sinal de vida. Este meio-termo gasta no máximo ~2,5 min por página
// perdida (4 tentativas: 20s de timeout + 3/8/20/40s de espera).
const MAX_RETRIES = 4;
const BACKOFF_MS = [3000, 8000, 20000, 40000];

// Erro "limpo" pra mostrar na tela — nunca inclui o HTML/corpo cru da
// resposta (a PNCP retorna uma página de erro em HTML pro 429, não JSON).
export class PncpFetchError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatPncpDate(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export function pncpPageUrl(params: {
  modalidade: number;
  uf?: string;
  dataInicial: string;
  dataFinal: string;
  pagina: number;
}): URL {
  const url = new URL(BASE_URL);
  url.searchParams.set("dataInicial", params.dataInicial);
  url.searchParams.set("dataFinal", params.dataFinal);
  url.searchParams.set("codigoModalidadeContratacao", String(params.modalidade));
  if (params.uf) url.searchParams.set("uf", params.uf);
  url.searchParams.set("pagina", String(params.pagina));
  url.searchParams.set("tamanhoPagina", String(PAGE_SIZE));
  return url;
}

export type OpcoesFetch = {
  /**
   * Chamado antes de cada espera de backoff. Quem coleta usa pra dar sinal de
   * vida: uma página problemática segura a execução por minutos aqui dentro, e
   * sem avisar ninguém a trava da coleta expirava e outra rodada começava por
   * cima da que ainda estava viva.
   */
  onRetry?: (tentativa: number, esperaMs: number) => void | Promise<void>;
  /**
   * Instante (Date.now()) além do qual não vale mais insistir. Sem o prazo,
   * uma única página teimosa consumia ~2min50s em tentativas e estourava o
   * orçamento da rodada inteira, que era perdida no meio. Com ele, a leitura
   * desiste a tempo, grava onde parou, e a próxima rodada continua dali.
   */
  deadline?: number;
};

export async function fetchPncpPage(
  url: URL,
  context: string,
  opcoes: OpcoesFetch = {},
  attempt = 1
): Promise<PncpResponse> {
  const { onRetry, deadline } = opcoes;

  // Se o prazo é curto, a espera pela resposta encolhe junto — não adianta
  // esperar 20s por uma página quando restam 5s de orçamento.
  const timeout = deadline
    ? Math.max(1000, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now()))
    : REQUEST_TIMEOUT_MS;

  function podeTentarDeNovo(esperaMs: number): boolean {
    if (attempt > MAX_RETRIES) return false;
    if (!deadline) return true;
    // Só tenta de novo se ainda sobrar tempo pra espera E pra requisição.
    return Date.now() + esperaMs + 2000 < deadline;
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    // Timeout ou falha de rede — trata igual a uma instabilidade
    // momentânea: mesma lógica de retry/backoff dos status 429/502-504.
    const espera = BACKOFF_MS[attempt - 1] ?? 40000;
    if (podeTentarDeNovo(espera)) {
      await onRetry?.(attempt, espera);
      await sleep(espera);
      return fetchPncpPage(url, context, opcoes, attempt + 1);
    }
    throw new PncpFetchError(
      504,
      `O PNCP não respondeu a tempo (${context}) após ${attempt} tentativa(s).`
    );
  }

  // 429 = rate limit; 502/503/504 = instabilidade momentânea do gateway do
  // PNCP (observado em uso real) — ambos valem retry com backoff.
  if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
    const espera = BACKOFF_MS[attempt - 1] ?? 40000;
    if (podeTentarDeNovo(espera)) {
      await onRetry?.(attempt, espera);
      await sleep(espera);
      return fetchPncpPage(url, context, opcoes, attempt + 1);
    }
    throw new PncpFetchError(
      res.status,
      `O PNCP não respondeu (erro ${res.status}, ${context}) após ${attempt} tentativa(s).`
    );
  }

  // 204 = sem conteúdo: o PNCP usa isso quando a consulta não tem resultado
  // nenhum, e o corpo vazio quebra o res.json().
  if (res.status === 204) {
    return { data: [], totalRegistros: 0, totalPaginas: 0, numeroPagina: 1, empty: true };
  }

  if (!res.ok) {
    // A PNCP normalmente responde erro em JSON ({"message": "..."}), mas
    // pode devolver uma página HTML de erro — nesse caso não repassamos o
    // HTML pra tela, só o status.
    let detail = "";
    try {
      const data = (await res.json()) as { message?: string };
      if (data?.message) detail = ` — ${data.message}`;
    } catch {
      // resposta não era JSON (ex: página HTML de erro); ignora o corpo.
    }
    throw new PncpFetchError(
      res.status,
      `O PNCP respondeu com erro ${res.status} (${context})${detail}.`
    );
  }

  return (await res.json()) as PncpResponse;
}
