import { lerItens } from "./itensDb";
import type { ItemGuardado } from "./itensDb";
import { normalizarTexto } from "./textoUtils";

// Busca dentro dos itens já varridos. Duas perguntas, mesma base:
//
//   "por quanto o saco de lixo 100L foi arrematado nas últimas licitações?"
//        -> itens encerrados, com resultado publicado
//
//   "quais licitações abertas têm saco de lixo em algum lote?"
//        -> itens de licitações com prazo em aberto
//
// A segunda é a que a busca por objeto não consegue responder: um pregão
// chamado "material de consumo" não casa com palavra nenhuma no título.

export type ItemEncontrado = ItemGuardado & {
  /** Menor preço homologado do item, quando há resultado. */
  menorPreco: number | null;
  vencedor: string | null;
  /** Diferença entre o arrematado e o que o órgão estimava, em %. */
  descontoSobreEstimado: number | null;
  aberta: boolean;
};

export type BuscaPrecos = {
  termo: string;
  abertas: ItemEncontrado[];
  arrematados: ItemEncontrado[];
  estatistica: {
    amostras: number;
    menor: number | null;
    mediana: number | null;
    maior: number | null;
    unidadeMaisComum: string | null;
  } | null;
};

function decorar(item: ItemGuardado, agora: number): ItemEncontrado {
  const validos = item.resultados.filter((r) => r.valorUnitario > 0);
  // O menor preço é o que interessa: em pregão de menor preço, foi ele que
  // levou. Quando há mais de um resultado (lote com vários fornecedores), o
  // menor continua sendo a referência mais dura pra precificar contra.
  const menor = validos.length
    ? validos.reduce((a, b) => (a.valorUnitario <= b.valorUnitario ? a : b))
    : null;

  const prazo = item.dataEncerramentoProposta
    ? new Date(item.dataEncerramentoProposta).getTime()
    : null;

  return {
    ...item,
    menorPreco: menor?.valorUnitario ?? null,
    vencedor: menor?.fornecedor ?? null,
    descontoSobreEstimado:
      menor && item.valorUnitarioEstimado && item.valorUnitarioEstimado > 0
        ? (item.valorUnitarioEstimado - menor.valorUnitario) /
          item.valorUnitarioEstimado
        : null,
    aberta: prazo != null && !Number.isNaN(prazo) && prazo > agora,
  };
}

/** Todas as palavras do termo precisam aparecer — busca mais precisa que "ou". */
function combina(descricao: string, termos: string[]): boolean {
  const alvo = normalizarTexto(descricao);
  return termos.every((t) => alvo.includes(t));
}

export async function buscarPrecos(options: {
  termo: string;
  uf?: string;
  /** Só considera resultado publicado nos últimos N meses. */
  mesesMax?: number;
}): Promise<BuscaPrecos> {
  const termos = normalizarTexto(options.termo)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const { itens } = await lerItens();
  const agora = Date.now();

  if (!termos.length) {
    return { termo: options.termo, abertas: [], arrematados: [], estatistica: null };
  }

  const corte = options.mesesMax
    ? new Date(agora - options.mesesMax * 30 * 86400000).toISOString().slice(0, 10)
    : null;

  const encontrados = itens
    .filter((i) => combina(i.descricao, termos))
    .filter((i) => !options.uf || i.uf === options.uf)
    .map((i) => decorar(i, agora));

  const abertas = encontrados
    .filter((i) => i.aberta)
    .sort((a, b) =>
      (a.dataEncerramentoProposta ?? "").localeCompare(
        b.dataEncerramentoProposta ?? ""
      )
    );

  const arrematados = encontrados
    .filter((i) => i.menorPreco != null)
    .filter((i) => {
      if (!corte) return true;
      const data = i.resultados[0]?.dataResultado;
      return !data || data >= corte;
    })
    .sort((a, b) => {
      const da = a.resultados[0]?.dataResultado ?? "";
      const db = b.resultados[0]?.dataResultado ?? "";
      return db.localeCompare(da);
    });

  // ------------------------------------------------------------ estatística
  const precos = arrematados
    .map((i) => i.menorPreco!)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  let estatistica: BuscaPrecos["estatistica"] = null;
  if (precos.length) {
    const meio = Math.floor(precos.length / 2);
    const unidades = new Map<string, number>();
    for (const i of arrematados) {
      unidades.set(i.unidade, (unidades.get(i.unidade) ?? 0) + 1);
    }
    const unidadeMaisComum =
      [...unidades.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    estatistica = {
      amostras: precos.length,
      menor: precos[0],
      // Mediana, não média: um lote com unidade trocada (preço por caixa
      // contra preço por unidade) distorce a média inteira e passa
      // despercebido. A mediana aguenta esse tipo de sujeira.
      mediana:
        precos.length % 2 === 1
          ? precos[meio]
          : (precos[meio - 1] + precos[meio]) / 2,
      maior: precos[precos.length - 1],
      unidadeMaisComum,
    };
  }

  return { termo: options.termo, abertas, arrematados, estatistica };
}
