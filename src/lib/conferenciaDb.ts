import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";
import { ITENS_INICIAIS } from "./conferenciaSeed";

// Conferência de estoque — a contagem que o dono faz toda segunda com o
// pessoal do estoque (o Valdecir).
//
// Não se confunde com o módulo Estoque, que é uma lista de "o que falta pedir".
// Aqui é o contrário: uma rotina fixa de contar produto por produto e comparar
// com o ideal.

export type Periodicidade = "semanal" | "quinzenal";

export type ItemConferencia = {
  id: string;
  codigo: string;
  descricao: string;
  periodicidade: Periodicidade;
  // Quanto deveria ter em estoque. Opcional de propósito — o usuário disse
  // que nem sempre sabe o número ideal na hora de cadastrar.
  quantidadeIdeal: number | null;
  // Última contagem registrada, pra saber de quem chegou a vez.
  ultimaContagem: number | null;
  ultimaConferenciaEm: string | null;
  ativo: boolean;
  criadoEm: string;
};

export type RegistroContagem = {
  itemId: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  quantidadeIdeal: number | null;
};

export type Conferencia = {
  id: string;
  data: string; // "YYYY-MM-DD"
  conferidoPor: string | null;
  itens: RegistroContagem[];
  observacao: string | null;
  criadoEm: string;
};

type ConferenciaData = {
  itens: ItemConferencia[];
  conferencias: Conferencia[];
};

// A lista das fotos entra como estado inicial: na primeira vez que a tela
// abre, ela já vem preenchida em vez de vazia. Depois disso quem manda é o
// que está salvo — editar ou apagar item aqui não volta atrás.
const store = jsonStore<ConferenciaData>("conferencia-estoque.json", {
  itens: ITENS_INICIAIS.map((item) => ({
    id: randomUUID(),
    codigo: item.codigo,
    descricao: item.descricao,
    periodicidade: item.periodicidade,
    quantidadeIdeal: null,
    ultimaContagem: null,
    ultimaConferenciaEm: null,
    ativo: true,
    criadoEm: new Date().toISOString(),
  })),
  conferencias: [],
});

const DIAS_MS = 24 * 60 * 60 * 1000;

/**
 * Um item entra na conferência de hoje se nunca foi contado, ou se já passou
 * o intervalo dele.
 *
 * A conta é por data da última contagem, e não por semana par/ímpar: se a
 * conferência de uma segunda for pulada (feriado, correria), o item continua
 * pendente na semana seguinte em vez de sumir até a outra quinzena.
 */
export function estaVencido(item: ItemConferencia, agora = Date.now()): boolean {
  if (!item.ativo) return false;
  if (!item.ultimaConferenciaEm) return true;
  const intervaloDias = item.periodicidade === "quinzenal" ? 14 : 7;
  const passados = (agora - new Date(item.ultimaConferenciaEm).getTime()) / DIAS_MS;
  // Meio dia de folga: contar 09h numa segunda e 08h na outra não deve
  // esconder o item por mais uma semana.
  return passados >= intervaloDias - 0.5;
}

export async function listItens(): Promise<ItemConferencia[]> {
  const data = await store.read();
  return [...data.itens].sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
}

export async function addItem(input: {
  codigo?: string | null;
  descricao: string;
  periodicidade: Periodicidade;
  quantidadeIdeal?: number | null;
}): Promise<ItemConferencia> {
  return store.update((data) => {
    const item: ItemConferencia = {
      id: randomUUID(),
      codigo: input.codigo?.trim() || "",
      descricao: input.descricao.trim(),
      periodicidade: input.periodicidade,
      quantidadeIdeal: input.quantidadeIdeal ?? null,
      ultimaContagem: null,
      ultimaConferenciaEm: null,
      ativo: true,
      criadoEm: new Date().toISOString(),
    };
    data.itens.push(item);
    return item;
  });
}

export async function updateItem(
  id: string,
  patch: Partial<
    Pick<
      ItemConferencia,
      "codigo" | "descricao" | "periodicidade" | "quantidadeIdeal" | "ativo"
    >
  >
): Promise<ItemConferencia | null> {
  return store.update((data) => {
    const item = data.itens.find((i) => i.id === id);
    if (!item) return null;
    for (const [chave, valor] of Object.entries(patch)) {
      if (valor !== undefined) {
        (item as Record<string, unknown>)[chave] = valor;
      }
    }
    return item;
  });
}

export async function deleteItem(id: string): Promise<void> {
  await store.update((data) => {
    data.itens = data.itens.filter((i) => i.id !== id);
  });
}

export async function listConferencias(): Promise<Conferencia[]> {
  const data = await store.read();
  return [...data.conferencias].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/**
 * Fecha a conferência do dia: guarda o que foi contado e marca esses itens
 * como conferidos, o que reinicia a contagem de quando eles vencem de novo.
 */
export async function salvarConferencia(input: {
  data: string;
  conferidoPor?: string | null;
  observacao?: string | null;
  contagens: Array<{ itemId: string; quantidade: number }>;
}): Promise<Conferencia> {
  return store.update((data) => {
    const agora = new Date().toISOString();
    const registros: RegistroContagem[] = [];

    for (const contagem of input.contagens) {
      const item = data.itens.find((i) => i.id === contagem.itemId);
      if (!item) continue;
      registros.push({
        itemId: item.id,
        codigo: item.codigo,
        descricao: item.descricao,
        quantidade: contagem.quantidade,
        quantidadeIdeal: item.quantidadeIdeal,
      });
      item.ultimaContagem = contagem.quantidade;
      item.ultimaConferenciaEm = agora;
    }

    const conferencia: Conferencia = {
      id: randomUUID(),
      data: input.data,
      conferidoPor: input.conferidoPor ?? null,
      itens: registros,
      observacao: input.observacao ?? null,
      criadoEm: agora,
    };
    data.conferencias.push(conferencia);
    return conferencia;
  });
}

export async function excluirConferencia(id: string): Promise<void> {
  await store.update((data) => {
    data.conferencias = data.conferencias.filter((c) => c.id !== id);
  });
}
