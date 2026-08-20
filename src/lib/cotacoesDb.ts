import { randomUUID } from "node:crypto";
import { radical } from "./casarCategorias";
import { capacidadeConflita, negaAlgumaPalavra, tokens } from "./casarProdutos";
import { jsonStore } from "./jsonStore";

// O histórico de cotação: quem cotou o quê, por quanto, e pra que quantidade.
//
// POR QUE EXISTE. Até 20/08/2026 o custo cotado morava só dentro do lote do
// edital em que foi usado. O saponáceo cotado pra Taió existia no lote 41 de
// Taió e em lugar nenhum mais — no edital seguinte que pedisse saponáceo, o
// painel não sabia de nada e alguém ia caçar o WhatsApp de novo.
//
// A QUANTIDADE FAZ PARTE DO PREÇO. Não é detalhe: "dependendo da quantidade
// até abaixa o valor". Guardar só "Gota Limpa cota saponáceo a R$ 5,03"
// esconde a informação que decide — R$ 5,03 PARA 843 UNIDADES. Num edital de
// 50 unidades esse preço não vale, e usar ele daria um piso otimista demais.
//
// VÁRIOS FORNECEDORES PELO MESMO PRODUTO é o caso normal, não a exceção: cota-
// se com três e usa-se o menor. Por isso nada aqui é sobrescrito por
// fornecedor diferente — a lista guarda as três e a busca devolve ordenado
// pelo mais barato.
//
// NINGUÉM PREENCHE ISTO À MÃO. O registro nasce sozinho quando um custo é
// preenchido na planilha de disputa (ver disputaDb.atualizarLote). Foi uma
// exigência de quem usa: "não quero ficar cadastrando produto por produto
// nesse formulário".

export type Cotacao = {
  id: string;
  /** Como o produto foi descrito — vem da descrição do lote do edital. */
  produto: string;
  marca: string;
  fornecedor: string;
  precoUnitario: number;
  unidade: string;
  /** Pra quantas unidades este preço foi dado. */
  quantidadeCotada: number;
  /** De qual edital veio, quando veio de um. */
  numeroControlePNCP: string | null;
  observacao: string;
  recebidaEm: string;
  atualizadaEm: string;
};

type Dados = { cotacoes: Cotacao[] };

const store = jsonStore<Dados>("cotacoes.json", { cotacoes: [] });

function agora(): string {
  return new Date().toISOString();
}

/**
 * O nome do produto dentro da descrição do edital.
 *
 * A descrição vem inteira: "LIMPA VIDRO 500 ML - Aspecto físico: líquido,
 * composição: lauril éter sulfato de sódio, unidade de fornecimento: frasco".
 * Guardar isso todo envenena a comparação — palavras como "embalagem",
 * "composição", "litros", "unidade" e "limpeza" aparecem em quase todo produto
 * de limpeza, e metade delas basta pra bater. Medido em 20/08/2026: o limpa
 * vidro passou a ser sugerido pra água sanitária, amaciante, detergente e até
 * saco plástico em bobina.
 *
 * O nome de verdade está sempre na cabeça da descrição, antes do travessão ou
 * do primeiro ponto. É só ele que fica.
 */
export function nomeDoProduto(descricao: string): string {
  const bruto = (descricao ?? "").replace(/\s+/g, " ").trim();
  const cabeca = bruto.split(/\s+[-–—]\s+|[.,;:]/)[0] ?? bruto;
  return (cabeca || bruto).slice(0, 60).trim();
}

/**
 * Chave de uma cotação: fornecedor + produto + quantidade.
 *
 * Os três juntos, porque o mesmo fornecedor dá preços diferentes pra
 * quantidades diferentes do mesmo produto, e as duas cotações são válidas ao
 * mesmo tempo. Só quando os três batem é que se trata de correção do mesmo
 * preço, e aí atualiza em vez de duplicar.
 */
function chave(c: {
  fornecedor: string;
  produto: string;
  quantidadeCotada: number;
}): string {
  return [
    c.fornecedor.trim().toLowerCase(),
    tokens(c.produto).sort().join("-"),
    c.quantidadeCotada,
  ].join("|");
}

export type EntradaCotacao = {
  produto: string;
  marca?: string;
  fornecedor: string;
  precoUnitario: number;
  unidade?: string;
  quantidadeCotada?: number;
  numeroControlePNCP?: string | null;
  observacao?: string;
};

export async function registrarCotacao(
  entrada: EntradaCotacao
): Promise<Cotacao | null> {
  const produto = nomeDoProduto(entrada.produto ?? "");
  const fornecedor = (entrada.fornecedor ?? "").trim();
  const preco = Number(entrada.precoUnitario);

  // Sem produto, sem quem cotou ou sem preço não há o que guardar. Registro
  // pela metade aqui vira sugestão errada num edital futuro.
  if (!produto || !fornecedor || !Number.isFinite(preco) || preco <= 0) return null;

  const nova: Cotacao = {
    id: randomUUID(),
    produto,
    marca: (entrada.marca ?? "").trim(),
    fornecedor,
    precoUnitario: preco,
    unidade: (entrada.unidade ?? "un").trim() || "un",
    quantidadeCotada: Math.max(0, Number(entrada.quantidadeCotada) || 0),
    numeroControlePNCP: entrada.numeroControlePNCP ?? null,
    observacao: (entrada.observacao ?? "").trim(),
    recebidaEm: agora(),
    atualizadaEm: agora(),
  };

  return store.update((data) => {
    const k = chave(nova);
    const existente = data.cotacoes.find((c) => chave(c) === k);
    if (existente) {
      existente.precoUnitario = nova.precoUnitario;
      existente.marca = nova.marca || existente.marca;
      existente.unidade = nova.unidade;
      existente.numeroControlePNCP =
        nova.numeroControlePNCP ?? existente.numeroControlePNCP;
      existente.atualizadaEm = nova.atualizadaEm;
      return existente;
    }
    data.cotacoes.push(nova);
    return nova;
  });
}

export async function listCotacoes(): Promise<Cotacao[]> {
  const data = await store.read();
  return [...data.cotacoes].sort((a, b) =>
    b.atualizadaEm.localeCompare(a.atualizadaEm)
  );
}

export async function excluirCotacao(id: string): Promise<void> {
  await store.update((data) => {
    data.cotacoes = data.cotacoes.filter((c) => c.id !== id);
  });
}

export type Sugestao = Cotacao & {
  /** Quanto da descrição do lote bateu, de 0 a 1. */
  nota: number;
  /**
   * A cotação foi dada pra uma quantidade bem menor que a do lote.
   *
   * Vale como alerta, não como impedimento: comprar mais costuma baratear, e o
   * preço guardado tende a ser um teto. O contrário — cotação de 1.000 usada
   * num lote de 50 — é que engana, porque o fornecedor não repete aquele preço.
   */
  quantidadeDiferente: boolean;
};

const NOTA_MINIMA = 0.5;

/** Fornecedor que na verdade é um lembrete de "falta preencher". */
export const PLACEHOLDER = /preencher|a confirmar|^\s*$/i;

/**
 * Cotações que servem pra este lote, da mais barata pra mais cara.
 *
 * Ordena por preço e não por semelhança de texto de propósito: quando duas
 * cotações descrevem o mesmo produto, o que decide é qual sai mais barato — é
 * exatamente pra isso que se cota com três fornecedores.
 */
export async function sugerirParaLote(
  descricao: string,
  quantidadeDoLote = 0
): Promise<Sugestao[]> {
  // Compara cabeça com cabeça: do lado do lote a descrição também vem inteira,
  // e o nome do produto está no começo dela.
  const alvo = tokens(nomeDoProduto(descricao));
  if (alvo.length === 0) return [];

  const bate = (a: string, b: string) =>
    a === b || b.startsWith(radical(a)) || a.startsWith(radical(b));

  const saida: Sugestao[] = [];
  for (const c of await listCotacoes()) {
    // Cotação sem fornecedor de verdade não vira sugestão: ela existe pra
    // alguém completar, e oferecer ela pra outro lote espalha o buraco.
    if (PLACEHOLDER.test(c.fornecedor)) continue;

    const meus = tokens(c.produto);
    if (meus.length === 0) continue;

    // 1 litro e 5 litros têm as mesmas palavras. Sem esta checagem o preço do
    // galão de 5 L entrava num lote de 1 L e o piso saía cinco vezes maior.
    if (capacidadeConflita(c.produto, descricao)) continue;

    // O edital que diz "SEM CLORO" não pode receber cloro. Oferecer o que o
    // edital proíbe desclassifica a proposta.
    if (negaAlgumaPalavra(descricao, meus)) continue;

    // TODA palavra do nome do produto tem que aparecer no lote — o
    // substantivo e os adjetivos.
    //
    // Exigir só o substantivo não bastava: "limpa vidro" tem duas palavras, e
    // bater só o "limpa" já dava nota 0,5, o mínimo. Resultado visto na tela:
    // o limpa vidro foi oferecido pra LIMPA ALUMÍNIO, LIMPA FORNO, LIMPA PEDRA
    // e LIMPADOR MULTIUSO. É o adjetivo que diz qual produto é.
    //
    // Número fica de fora da exigência porque a capacidade já foi conferida
    // acima, e o edital costuma pôr o volume em outra coluna: "SAPONÁCEO 300
    // ML" cotado serve pro lote escrito só como "Saponáceo".
    const palavras = meus.filter((t) => !/^\d+$/.test(t));
    if (palavras.length === 0) continue;
    if (!palavras.every((t) => alvo.some((d) => bate(t, d)))) continue;

    const casaram = meus.filter((t) => alvo.some((d) => bate(t, d)));
    const nota = casaram.length / meus.length;
    if (nota < NOTA_MINIMA) continue;

    saida.push({
      ...c,
      nota,
      quantidadeDiferente:
        quantidadeDoLote > 0 &&
        c.quantidadeCotada > 0 &&
        c.quantidadeCotada > quantidadeDoLote * 2,
    });
  }

  return saida.sort((a, b) => a.precoUnitario - b.precoUnitario);
}

/** Produtos distintos no histórico, com quantos fornecedores cotaram cada um. */
export async function resumoCotacoes(): Promise<{
  total: number;
  fornecedores: number;
  produtos: number;
}> {
  const cotacoes = await listCotacoes();
  return {
    total: cotacoes.length,
    fornecedores: new Set(cotacoes.map((c) => c.fornecedor.toLowerCase())).size,
    produtos: new Set(cotacoes.map((c) => tokens(c.produto).sort().join("-"))).size,
  };
}
