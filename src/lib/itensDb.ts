import { jsonStore } from "./jsonStore";
import type { ResultadoPncp } from "./pncpItens";

// Itens de licitação que interessam à Embastel, e por quanto foram arrematados.
//
// O QUE ENTRA AQUI É FILTRADO NA GRAVAÇÃO, não na leitura. O coletor lê todos
// os itens de uma licitação, mas só guarda os que batem com o perfil da loja.
// Sem isso o arquivo cresceria sem limite: 12 mil licitações no índice, com
// dezenas de lotes cada, dariam centenas de milhares de registros — e a maior
// parte seria medicamento, combustível e obra, que não têm nada a ver com a
// loja.
//
// Com o filtro, um pregão de "material de consumo" com 200 lotes contribui com
// os 3 lotes de saco plástico e mais nada.

export type ItemGuardado = {
  numeroControlePNCP: string;
  numeroItem: number;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitarioEstimado: number | null;
  resultados: ResultadoPncp[];
  // Copiado do índice pra que a busca não precise cruzar dois arquivos.
  orgao: string;
  municipio: string;
  uf: string;
  modalidade: string;
  dataEncerramentoProposta: string | null;
  link: string;
  /** Palavra do perfil que fez este item ser guardado. */
  palavraCombinada: string;
  atualizadoEm: number;
};

export type StatusVarredura = {
  rodando: boolean;
  ultimoSinalEm: number | null;
  licitacoesVarridas: number;
  itensGuardados: number;
  ultimaRodadaEm: number | null;
  erro: string | null;
};

type ItensData = {
  itens: ItemGuardado[];
  /**
   * Licitações já visitadas, com o instante da visita. Impede refazer a mesma
   * leitura toda rodada — e é o que torna a varredura retomável.
   *
   * Guardamos mesmo as que não renderam item nenhum: "não tem nada meu aqui"
   * é uma resposta que também custou uma requisição.
   */
  varridas: Record<string, number>;
  /** Itens que ainda não tinham resultado publicado, pra revisitar depois. */
  aguardandoResultado: string[];
  status: StatusVarredura;
};

const store = jsonStore<ItensData>("licitacoes-itens.json", {
  itens: [],
  varridas: {},
  aguardandoResultado: [],
  status: {
    rodando: false,
    ultimoSinalEm: null,
    licitacoesVarridas: 0,
    itensGuardados: 0,
    ultimaRodadaEm: null,
    erro: null,
  },
});

export async function lerItens(): Promise<ItensData> {
  return store.read();
}

export async function jaVarridas(): Promise<Set<string>> {
  const data = await store.read();
  return new Set(Object.keys(data.varridas));
}

/** Grava o resultado da visita a uma licitação. */
export async function registrarVarredura(
  numeroControlePNCP: string,
  itens: ItemGuardado[],
  faltamResultados: boolean
): Promise<void> {
  await store.update((data) => {
    data.varridas[numeroControlePNCP] = Date.now();
    // Substitui os itens dessa licitação em vez de acumular: uma revisita
    // (pra buscar resultado que ainda não existia) tem que atualizar, não
    // duplicar.
    data.itens = data.itens.filter(
      (i) => i.numeroControlePNCP !== numeroControlePNCP
    );
    data.itens.push(...itens);

    const pendentes = new Set(data.aguardandoResultado);
    if (faltamResultados && itens.length > 0) {
      pendentes.add(numeroControlePNCP);
    } else {
      pendentes.delete(numeroControlePNCP);
    }
    data.aguardandoResultado = [...pendentes];
    data.status.itensGuardados = data.itens.length;
  });
}

/**
 * Marca uma licitação pra ser revisitada. Usado quando o resultado ainda não
 * estava publicado — o preço arrematado é o dado mais valioso do módulo, e
 * vale voltar por ele.
 */
export async function reabrirParaRevisita(numeros: string[]): Promise<void> {
  if (!numeros.length) return;
  await store.update((data) => {
    for (const numero of numeros) delete data.varridas[numero];
  });
}

const VALIDADE_DA_TRAVA_MS = 10 * 60 * 1000;

/**
 * Trava em arquivo, igual à do coletor de licitações. O motivo é o mesmo: em
 * desenvolvimento o Next recria o módulo a cada alteração, e uma trava só em
 * memória deixava duas varreduras rodando em cima uma da outra.
 */
export async function tentarAssumirVarredura(): Promise<boolean> {
  return store.update((data) => {
    const agora = Date.now();
    const viva =
      data.status.rodando &&
      data.status.ultimoSinalEm != null &&
      agora - data.status.ultimoSinalEm < VALIDADE_DA_TRAVA_MS;
    if (viva) return false;
    data.status.rodando = true;
    data.status.ultimoSinalEm = agora;
    data.status.erro = null;
    return true;
  });
}

export async function sinalDeVida(patch: Partial<StatusVarredura> = {}): Promise<void> {
  await store.update((data) => {
    Object.assign(data.status, patch, { ultimoSinalEm: Date.now() });
  });
}

export async function encerrarVarredura(erro: string | null = null): Promise<void> {
  await store.update((data) => {
    data.status.rodando = false;
    data.status.ultimaRodadaEm = Date.now();
    data.status.erro = erro;
  });
}

export async function lerStatusVarredura(): Promise<StatusVarredura> {
  return (await store.read()).status;
}
