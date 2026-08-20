import { radical } from "./casarCategorias";
import { normalizarTexto } from "./textoUtils";

// Casar a lista de preços que o fornecedor mandou com os lotes do edital.
//
// O problema que resolve: o fornecedor manda "Saponáceo multiuso 300ml — 4,50"
// no WhatsApp, e o edital pede "SAPONÁCEO MULTIUSO CREMOSO. COMPONENTE ATIVOS
// AGENTE TENSOATIVO ANIÔNICO. FRASCO COM 300 ML." São a mesma coisa escrita de
// dois jeitos, e alguém teria que ler os dois lados e digitar o preço lote por
// lote.
//
// NADA AQUI GRAVA SOZINHO. A função devolve propostas com nota, e quem decide
// é a pessoa na tela — preço errado num lote é dinheiro perdido no pregão, e
// um casamento automático que erra em 1 de 20 é pior que digitar os 20.

export type ItemDaLista = {
  /** A linha crua, pra pessoa reconhecer o que veio da lista dela. */
  linha: string;
  descricao: string;
  preco: number;
};

/**
 * Lê a lista colada e separa descrição de preço.
 *
 * Aceita o que o fornecedor manda de verdade: linha do WhatsApp, colado do
 * Excel (separado por tab ou ;), com ou sem "R$".
 *
 * O preço é o ÚLTIMO número com cara de dinheiro da linha, e não o primeiro:
 * lista de fornecedor é cheia de número no meio da descrição ("copo 200 ml",
 * "caixa com 100"), e pegar o primeiro faria o volume da embalagem virar
 * preço.
 */
export function analisarLista(texto: string): ItemDaLista[] {
  const itens: ItemDaLista[] = [];

  for (const bruta of (texto ?? "").split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    // Precisa ter letra: linha só de números é cabeçalho, total ou lixo.
    if (!/[a-zA-ZÀ-ÿ]/.test(linha)) continue;

    // Número com decimal (12,34 / 12.34 / 1.234,56), opcionalmente com R$.
    const dinheiro = [...linha.matchAll(/R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{1,2}|\d+\.\d{2})/g)];
    if (dinheiro.length === 0) continue;

    const ultimo = dinheiro[dinheiro.length - 1];
    const cru = ultimo[1];
    const preco = cru.includes(",")
      ? Number(cru.replace(/\./g, "").replace(",", "."))
      : Number(cru);
    if (!Number.isFinite(preco) || preco <= 0) continue;

    // Tira do texto só a ocorrência do preço, preservando o resto da linha.
    const descricao = (linha.slice(0, ultimo.index) + linha.slice(ultimo.index! + ultimo[0].length))
      .replace(/[\t;|]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/[-–—:]\s*$/, "")
      .trim();

    if (!descricao) continue;
    itens.push({ linha, descricao, preco });
  }

  return itens;
}

/**
 * Palavras que valem pra comparar.
 *
 * Números entram (300, 5, 100): "frasco com 300 ml" e "300ml" são a mesma
 * informação, e é ela que separa um saponáceo de 300 ml de um de 500 ml. Por
 * isso a normalização abaixo também separa dígito de letra — sem isso "300ml"
 * seria um token só e nunca casaria com "300 ML" escrito separado no edital.
 */
const RUIDO = new Set([
  "para", "com", "sem", "dos", "das", "por", "que", "cada", "tipo", "unid",
  "unidade", "unidades", "caixa", "pacote", "fardo", "aproximadamente",
  "minimo", "minima", "maximo", "maxima", "cor", "medindo", "contendo",
]);

function tokens(texto: string): string[] {
  const normal = normalizarTexto(texto)
    // separa dígito de letra: "300ml" -> "300 ml", "5l" -> "5 l"
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2");

  const saida: string[] = [];
  for (const t of normal.split(/[^a-z0-9]+/)) {
    if (!t) continue;
    if (/^\d+$/.test(t)) {
      // Número de um dígito é fraco demais ("1 par", "2 unidade").
      if (t.length >= 2) saida.push(t);
      continue;
    }
    if (t.length < 4 || RUIDO.has(t)) continue;
    saida.push(t);
  }
  return [...new Set(saida)];
}

export type LoteParaCasar = {
  id: string;
  numero: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  referenciaUnitaria: number | null;
  custoUnitario: number;
};

export type Proposta = {
  item: ItemDaLista;
  loteId: string;
  numeroLote: string;
  descricaoLote: string;
  quantidade: number;
  unidade: string;
  referenciaUnitaria: number | null;
  /** Quanto do que o fornecedor escreveu aparece no lote, de 0 a 1. */
  nota: number;
  /** As palavras que casaram — é o que deixa a pessoa conferir num relance. */
  palavras: string[];
  /** O lote já tinha custo preenchido; aplicar vai sobrescrever. */
  jaTinhaCusto: boolean;
};

// Abaixo disto não se propõe nada. Dois acertos num texto de edital de 300
// caracteres ainda é coincidência frequente ("papel" + "branco" casa com
// papel higiênico, papel toalha e pano de prato branco); exigir metade das
// palavras do fornecedor derruba esse tipo de par.
const NOTA_MINIMA = 0.5;
const ACERTOS_MINIMOS = 2;

/**
 * Para cada item da lista, o lote que mais se parece com ele.
 *
 * Um lote só é proposto uma vez: se dois itens da lista disputam o mesmo lote,
 * fica o de nota maior e o outro sai sem par. É o comportamento certo pra
 * lista que traz o mesmo produto em duas embalagens — só uma delas serve pro
 * que o edital pede, e propor as duas faria a pessoa aplicar a errada.
 */
export function casarComLotes(
  itens: ItemDaLista[],
  lotes: LoteParaCasar[]
): { propostas: Proposta[]; semPar: ItemDaLista[] } {
  const tokensDoLote = new Map(lotes.map((l) => [l.id, tokens(l.descricao)]));

  const candidatas: Proposta[] = [];
  for (const item of itens) {
    const meus = tokens(item.descricao);
    if (meus.length === 0) continue;

    let melhor: Proposta | null = null;
    for (const lote of lotes) {
      const doLote = tokensDoLote.get(lote.id) ?? [];
      const casaram = meus.filter((t) =>
        doLote.some((d) => d === t || d.startsWith(radical(t)) || t.startsWith(radical(d)))
      );
      const nota = casaram.length / meus.length;
      if (casaram.length < ACERTOS_MINIMOS || nota < NOTA_MINIMA) continue;
      if (melhor && melhor.nota >= nota) continue;

      melhor = {
        item,
        loteId: lote.id,
        numeroLote: lote.numero,
        descricaoLote: lote.descricao,
        quantidade: lote.quantidade,
        unidade: lote.unidade,
        referenciaUnitaria: lote.referenciaUnitaria,
        nota,
        palavras: casaram,
        jaTinhaCusto: lote.custoUnitario > 0,
      };
    }
    if (melhor) candidatas.push(melhor);
  }

  // Um lote por proposta: quem tem nota maior fica com ele.
  const porLote = new Map<string, Proposta>();
  for (const c of candidatas.sort((a, b) => b.nota - a.nota)) {
    if (!porLote.has(c.loteId)) porLote.set(c.loteId, c);
  }

  const propostas = [...porLote.values()].sort(
    (a, b) => (Number(a.numeroLote) || 0) - (Number(b.numeroLote) || 0)
  );
  const casados = new Set(propostas.map((p) => p.item.linha));

  return {
    propostas,
    semPar: itens.filter((i) => !casados.has(i.linha)),
  };
}
