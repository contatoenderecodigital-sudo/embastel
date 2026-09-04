import { jsonStore } from "./jsonStore";

// Os produtos que a loja vende — separados do catálogo de licitação de propósito.
//
// POR QUE DOIS CATÁLOGOS. São dois negócios com custo diferente para o mesmo
// produto: no pregão o preço do fornecedor depende da quantidade daquele
// edital, e na loja é o custo de reposição do dia a dia. Misturar os dois já
// custou caro uma vez, quando cotação de um edital virou custo no outro. Aqui
// o risco seria pior: 20 mil produtos da loja afogariam os lotes de licitação.
//
// POR QUE O ARQUIVO É GRANDE E TUDO BEM. São ~20 mil produtos, uns poucos MB.
// O jsonStore reescreve o arquivo inteiro a cada gravação, o que seria ruim se
// houvesse escrita o tempo todo — mas aqui a escrita acontece só na importação,
// de vez em quando. A leitura, que é o caminho quente, continua barata.

export type ProdutoLoja = {
  codigo: string;
  descricao: string;
  unidade: string;
  /** O que a loja paga pelo produto. */
  custo: number;
  /** O preço que está na loja hoje, como veio do Troll. */
  precoVenda: number;
  atualizadoEm: string;
};

type Dados = {
  produtos: ProdutoLoja[];
  importadoEm: string | null;
};

const store = jsonStore<Dados>("produtos-loja.json", {
  produtos: [],
  importadoEm: null,
});

// A regra de preço da loja, do jeito que ela é praticada — e não a divisão que
// a licitação usa.
//
// Confirmada nos 20.721 produtos do sistema atual: a mediana de venda/custo é
// 1,501, e os preços caem sempre num múltiplo de 5 centavos... na verdade de 25
// centavos, arredondando PRA CIMA. Exemplos reais: custo 7,32 vira 11,00
// (10,98 subiu), custo 3,66 vira 5,50 (5,49 subiu), custo 52,86 vira 79,50.
//
// Cuidado com o nome: "50%" aqui é markup sobre o custo, não margem sobre a
// venda. Vendendo a custo × 1,5 com 10% de imposto, o que sobra é 23,3% — e é
// esse número, não o 50, que diz quanto dá pra descer num desconto.
export const MARKUP_ALVO = 1.5;
export const MARKUP_MINIMO = 1.35;
const DEGRAU = 0.25;

/** Arredonda pra cima no próximo múltiplo de 25 centavos. */
export function arredondarPraCima(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  // Passa por centavos inteiros antes de dividir: em ponto flutuante,
  // 10.98 / 0.25 dá 43.919999999999995 e o teto sobe um degrau a mais.
  const centavos = Math.round(valor * 100);
  const passo = DEGRAU * 100;
  return (Math.ceil(centavos / passo) * passo) / 100;
}

export function precoSugerido(custo: number): number {
  return arredondarPraCima(custo * MARKUP_ALVO);
}

export function precoMinimo(custo: number): number {
  return arredondarPraCima(custo * MARKUP_MINIMO);
}

/** Quanto sobra, em % do preço, depois do imposto. */
export function margemNoPreco(custo: number, preco: number, percentualImposto: number): number {
  if (!preco) return 0;
  return (preco * (1 - percentualImposto / 100) - custo) / preco;
}

export async function listProdutosLoja(): Promise<ProdutoLoja[]> {
  const d = await store.read();
  return d.produtos;
}

export async function statusImportacao(): Promise<{ total: number; importadoEm: string | null }> {
  const d = await store.read();
  return { total: d.produtos.length, importadoEm: d.importadoEm };
}

/**
 * Busca por código ou por pedaço da descrição.
 *
 * Existe aqui e não na tela porque são 20 mil produtos: mandar a lista inteira
 * pro celular da vendedora gastaria a franquia dela e demoraria no sinal fraco.
 * O limite baixo é de propósito — quem está na frente do cliente escolhe entre
 * as primeiras linhas, não rola uma lista de duzentas.
 */
export async function buscarProdutosLoja(termo: string, limite = 25): Promise<ProdutoLoja[]> {
  const alvo = termo.trim().toLowerCase();
  if (!alvo) return [];
  const d = await store.read();
  const palavras = alvo.split(/\s+/).filter(Boolean);

  const achados = d.produtos.filter((p) => {
    if (p.codigo.toLowerCase() === alvo) return true;
    const texto = p.descricao.toLowerCase();
    // Todas as palavras têm que aparecer: quem digita "copo 200" quer copo de
    // 200 ml, não todos os copos mais tudo que tem 200 no nome.
    return palavras.every((w) => texto.includes(w));
  });

  // Código exato primeiro, depois o que começa com o termo, depois o resto.
  achados.sort((a, b) => {
    const pesoA = a.codigo.toLowerCase() === alvo ? 0 : a.descricao.toLowerCase().startsWith(alvo) ? 1 : 2;
    const pesoB = b.codigo.toLowerCase() === alvo ? 0 : b.descricao.toLowerCase().startsWith(alvo) ? 1 : 2;
    return pesoA - pesoB || a.descricao.localeCompare(b.descricao, "pt-BR");
  });

  return achados.slice(0, limite);
}

/**
 * Troca o catálogo inteiro pelo que veio na importação.
 *
 * Substitui em vez de mesclar: o arquivo exportado do sistema da loja é o
 * retrato completo, e mesclar deixaria pra sempre os produtos que foram
 * excluídos de lá — que é justamente o que a vendedora não pode oferecer.
 */
export async function importarProdutosLoja(
  linhas: Array<{ codigo: string; descricao: string; unidade?: string; custo: number; precoVenda: number }>
): Promise<{ importados: number; ignorados: number }> {
  const agora = new Date().toISOString();
  let ignorados = 0;

  const produtos: ProdutoLoja[] = [];
  const vistos = new Set<string>();
  for (const l of linhas) {
    const codigo = String(l.codigo ?? "").trim();
    const descricao = String(l.descricao ?? "").trim();
    // Sem código ou sem nome não dá pra achar nem pra escrever no pedido.
    if (!codigo || !descricao || vistos.has(codigo)) {
      ignorados++;
      continue;
    }
    vistos.add(codigo);
    produtos.push({
      codigo,
      descricao,
      unidade: String(l.unidade ?? "").trim() || "UN",
      custo: Number(l.custo) || 0,
      precoVenda: Number(l.precoVenda) || 0,
      atualizadoEm: agora,
    });
  }

  await store.update((d) => {
    d.produtos = produtos;
    d.importadoEm = agora;
    return d;
  });

  return { importados: produtos.length, ignorados };
}
