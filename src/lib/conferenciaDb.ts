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

// Quem cuida do quê. A Eli e o Valdecir tomam conta de partes diferentes do
// estoque, e o estoque não fica tudo num lugar só — então uma lista única de
// 129 itens obriga cada um a garimpar os seus no meio dos do outro, andando
// pelo depósito fora de ordem.
//
// São só estes dois, escolhidos numa lista — não é campo de digitar. Digitar
// o nome 129 vezes acabaria com "Valdecir", "valdecir" e "Valdecír" na base, e
// o filtro compara texto exato: cada grafia viraria uma pessoa diferente, com
// a lista dele partida em três.
//
// Pra incluir mais alguém depois, basta acrescentar aqui — a tela monta os
// botões e os menus a partir desta lista.
export const RESPONSAVEIS = ["Eli", "Valdecir"] as const;

export type ItemConferencia = {
  id: string;
  codigo: string;
  descricao: string;
  periodicidade: Periodicidade;
  /** Nome de quem confere este item. Vazio = ainda não dividido. */
  responsavel: string;
  /** Onde o item fica guardado — prateleira, galpão, sala. */
  local: string;
  /**
   * De quem se compra este item. Vazio = ainda não sabido.
   *
   * Existe pra ligar a contagem ao pedido: quem conta e vê que acabou precisa
   * que aquilo vire linha de pedido do fornecedor certo, sem redigitar o
   * produto na aba Estoque. Texto livre porque a lista de fornecedores da loja
   * muda direto e travar num cadastro fechado só faria o item ficar sem dono.
   */
  fornecedor: string;
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
  // Copiados no fechamento: se o item mudar de dono depois, o histórico
  // continua mostrando quem contou naquele dia.
  responsavel: string;
  local: string;
  fornecedor: string;
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
    responsavel: "",
    fornecedor: "",
    local: "",
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
  // Itens salvos antes da divisão por pessoa não têm os campos novos. Sem
  // este preenchimento, a tela receberia `undefined` e quebraria no filtro.
  return [...data.itens]
    .map((item) => ({
      ...item,
      responsavel: item.responsavel ?? "",
      local: item.local ?? "",
      fornecedor: item.fornecedor ?? "",
    }))
    .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
}

/**
 * Só aceita nome que está na lista. Vazio significa "sem dono" e é válido.
 *
 * A tela já oferece um menu fechado, mas a rota da API é pública pra quem
 * está logado — sem esta checagem, uma chamada errada plantaria um terceiro
 * nome na base e partiria a lista de alguém sem ninguém entender por quê.
 */
function responsavelValido(nome: string): string {
  const limpo = nome.trim();
  if (!limpo) return "";
  return (RESPONSAVEIS as readonly string[]).includes(limpo) ? limpo : "";
}

/** Locais já usados, pra virarem sugestão em vez de digitação. */
export async function listLocais(): Promise<string[]> {
  const data = await store.read();
  const locais = new Set<string>();
  for (const item of data.itens) {
    if (item.local) locais.add(item.local);
  }
  return [...locais].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function addItem(input: {
  codigo?: string | null;
  descricao: string;
  periodicidade: Periodicidade;
  responsavel?: string | null;
  fornecedor?: string | null;
  local?: string | null;
  quantidadeIdeal?: number | null;
}): Promise<ItemConferencia> {
  return store.update((data) => {
    const item: ItemConferencia = {
      id: randomUUID(),
      codigo: input.codigo?.trim() || "",
      descricao: input.descricao.trim(),
      periodicidade: input.periodicidade,
      responsavel: responsavelValido(input.responsavel ?? ""),
      fornecedor: (input.fornecedor ?? "").trim(),
      local: input.local?.trim() || "",
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
      | "codigo"
      | "descricao"
      | "periodicidade"
      | "responsavel"
      | "fornecedor"
      | "local"
      | "quantidadeIdeal"
      | "ativo"
    >
  >
): Promise<ItemConferencia | null> {
  return store.update((data) => {
    const item = data.itens.find((i) => i.id === id);
    if (!item) return null;
    for (const [chave, valor] of Object.entries(patch)) {
      if (valor === undefined) continue;
      (item as Record<string, unknown>)[chave] =
        chave === "responsavel" ? responsavelValido(String(valor)) : valor;
    }
    return item;
  });
}

/**
 * Aplica responsável e/ou local a vários itens de uma vez.
 *
 * São 129 itens na lista da Embastel. Dividir isso entre duas pessoas item a
 * item seria 129 idas ao servidor e uma tarde perdida — e é o tipo de coisa
 * que a pessoa desiste no meio, deixando metade da lista sem dono.
 *
 * Campo não enviado fica como está: dá pra marcar o responsável de um grupo
 * sem mexer no local que já estava certo.
 */
export async function atribuirEmLote(input: {
  ids: string[];
  responsavel?: string | null;
  local?: string | null;
}): Promise<number> {
  if (!input.ids.length) return 0;
  const alvo = new Set(input.ids);
  return store.update((data) => {
    let alterados = 0;
    for (const item of data.itens) {
      if (!alvo.has(item.id)) continue;
      if (input.responsavel !== undefined) {
        item.responsavel = responsavelValido(input.responsavel ?? "");
      }
      if (input.local !== undefined) {
        item.local = input.local?.trim() || "";
      }
      alterados += 1;
    }
    return alterados;
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
        responsavel: item.responsavel ?? "",
        local: item.local ?? "",
        fornecedor: item.fornecedor ?? "",
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

/**
 * Espalha os quinzenais entre as duas semanas do ciclo.
 *
 * O PROBLEMA. A conta de vencimento é por data da última contagem. Quando os
 * itens são cadastrados todos no mesmo dia — ou conferidos todos de uma vez,
 * como aconteceu em 24/08/2026 — eles passam a vencer todos juntos, de 14 em
 * 14 dias. Na prática isso dá uma semana com a lista inteira e a seguinte
 * quase vazia, e quem confere sente o serviço dobrar e sumir sem motivo.
 *
 * O QUE FAZ. Metade dos quinzenais tem a última contagem recuada em 7 dias.
 * Recuar a data faz o item vencer uma semana antes, e daí em diante o
 * intervalo de 14 dias mantém os dois grupos alternando sozinhos.
 *
 * POR QUE POR PESSOA E POR LOCAL. A divisão é feita dentro da lista de cada
 * responsável, não no monte: metade do total pode ser toda da Eli e não
 * resolver nada pro Valdecir. E a ordem de corte é por local, pra que os itens
 * da mesma semana fiquem perto uns dos outros no depósito — dividir por ordem
 * alfabética manda a pessoa atravessar o galpão a cada item.
 *
 * Itens nunca contados ficam de fora: eles já estão vencidos e precisam ser
 * contados agora. Depois da primeira contagem, rodar de novo os distribui.
 */
export async function distribuirQuinzenais(): Promise<{
  movidos: number;
  porResponsavel: Record<string, { estaSemana: number; naOutra: number }>;
}> {
  const porResponsavel: Record<string, { estaSemana: number; naOutra: number }> = {};
  let movidos = 0;

  await store.update((data) => {
    const grupos = new Map<string, ItemConferencia[]>();
    for (const item of data.itens) {
      if (!item.ativo) continue;
      if (item.periodicidade !== "quinzenal") continue;
      if (!item.ultimaConferenciaEm) continue;
      const dono = item.responsavel ?? "";
      const atual = grupos.get(dono);
      if (atual) atual.push(item);
      else grupos.set(dono, [item]);
    }

    for (const [dono, itens] of grupos) {
      itens.sort(
        (a, b) =>
          (a.local ?? "").localeCompare(b.local ?? "", "pt-BR") ||
          a.descricao.localeCompare(b.descricao, "pt-BR")
      );
      let estaSemana = 0;
      let naOutra = 0;
      itens.forEach((item, i) => {
        if (i % 2 === 1) {
          const recuado = new Date(item.ultimaConferenciaEm!).getTime() - 7 * DIAS_MS;
          item.ultimaConferenciaEm = new Date(recuado).toISOString();
          movidos++;
          estaSemana++;
        } else {
          naOutra++;
        }
      });
      porResponsavel[dono || "sem dono"] = { estaSemana, naOutra };
    }

    return data;
  });

  return { movidos, porResponsavel };
}
