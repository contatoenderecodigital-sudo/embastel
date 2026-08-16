import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";

// Catálogo de produtos pra licitação: o que a Embastel vende, com custo.
//
// Duas coisas que ele resolve, e que nenhum portal resolve:
//
// 1. REDIGITAÇÃO. Todo pregão exige marca, fabricante e código item por item.
//    Num pregão de 126 lotes — número real da última proposta enviada pela
//    Embastel — isso é horas de digitação repetindo o que já se sabe.
//
// 2. PISO DE LANCE. A tela de proposta do portal mostra só o preço de
//    referência do órgão e o total proposto. Não há campo de custo, de frete,
//    de imposto, nem aviso de "você está abaixo do seu piso". Ou seja: a conta
//    que decide se o contrato dá lucro é feita de cabeça, no meio de uma sala
//    de disputa com lance de 3 em 3 segundos.
//
// Não se confunde com o módulo Estoque (o que falta pedir) nem com as Fichas
// de produto (material de marketing).

export type ProdutoCatalogo = {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  marca: string | null;
  fabricante: string | null;
  /** Código do fabricante, EAN, referência — o que o edital pedir. */
  codigoFabricante: string | null;
  fornecedor: string | null;
  /** Quanto a Embastel paga pelo item, sem impostos. */
  custo: number;
  /** Frete de compra rateado por unidade, quando existe. */
  freteUnitario: number;
  /** Impostos sobre a venda, em % do preço de venda. */
  percentualImpostos: number;
  /** Margem mínima aceitável, em % sobre o preço de venda. */
  margemAlvo: number;
  observacao: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

type CatalogoData = {
  produtos: ProdutoCatalogo[];
};

const store = jsonStore<CatalogoData>("catalogo.json", { produtos: [] });

/** Sugestões iniciais quando o produto é novo e ninguém preencheu nada. */
export const PADROES = {
  percentualImpostos: 10,
  margemAlvo: 15,
};

export type PrecosCalculados = {
  /** Custo total de aquisição por unidade (compra + frete). */
  custoTotal: number;
  /**
   * Menor preço de venda que ainda paga custo, imposto e a margem alvo.
   *
   * Imposto e margem incidem sobre o PREÇO DE VENDA, não sobre o custo — por
   * isso a conta é custo / (1 - imposto% - margem%), e não custo × (1 + soma).
   * A diferença não é pequena: com 10% de imposto e 15% de margem sobre um
   * custo de R$ 10,00, a conta certa dá R$ 13,33 e a errada dá R$ 12,50 —
   * lance a R$ 12,50 e a margem real cai pra 10%, um terço a menos do que se
   * pretendia. (Conferido: 12,50 × 0,9 = 11,25; 11,25 − 10 = 1,25; 1,25 /
   * 12,50 = 10%.)
   */
  precoMinimo: number;
  /** Preço em que a margem zera: abaixo disso a venda dá prejuízo. */
  precoEmpate: number;
};

export function calcularPrecos(p: {
  custo: number;
  freteUnitario: number;
  percentualImpostos: number;
  margemAlvo: number;
}): PrecosCalculados {
  const custoTotal = (p.custo || 0) + (p.freteUnitario || 0);
  const imposto = (p.percentualImpostos || 0) / 100;
  const margem = (p.margemAlvo || 0) / 100;

  // Se imposto + margem chegam a 100%, a divisão explode. Trava em 95% pra
  // devolver um número absurdo e visível em vez de Infinity na tela.
  const restanteAlvo = Math.max(0.05, 1 - imposto - margem);
  const restanteEmpate = Math.max(0.05, 1 - imposto);

  return {
    custoTotal,
    precoMinimo: custoTotal / restanteAlvo,
    precoEmpate: custoTotal / restanteEmpate,
  };
}

/** Margem real, em %, se o lance for fechado a esse preço. */
export function margemNoPreco(
  p: { custo: number; freteUnitario: number; percentualImpostos: number },
  preco: number
): number {
  if (!preco) return 0;
  const custoTotal = (p.custo || 0) + (p.freteUnitario || 0);
  const liquido = preco * (1 - (p.percentualImpostos || 0) / 100);
  return (liquido - custoTotal) / preco;
}

export async function listProdutosCatalogo(): Promise<ProdutoCatalogo[]> {
  const data = await store.read();
  return [...data.produtos].sort((a, b) =>
    a.descricao.localeCompare(b.descricao, "pt-BR")
  );
}

type Entrada = Partial<
  Omit<ProdutoCatalogo, "id" | "criadoEm" | "atualizadoEm">
>;

export async function criarProduto(entrada: Entrada): Promise<ProdutoCatalogo> {
  const agora = new Date().toISOString();
  return store.update((data) => {
    const produto: ProdutoCatalogo = {
      id: randomUUID(),
      codigo: entrada.codigo?.trim() || "",
      descricao: entrada.descricao?.trim() || "Sem descrição",
      unidade: entrada.unidade?.trim() || "un",
      marca: entrada.marca?.trim() || null,
      fabricante: entrada.fabricante?.trim() || null,
      codigoFabricante: entrada.codigoFabricante?.trim() || null,
      fornecedor: entrada.fornecedor?.trim() || null,
      custo: Number(entrada.custo) || 0,
      freteUnitario: Number(entrada.freteUnitario) || 0,
      percentualImpostos:
        entrada.percentualImpostos != null
          ? Number(entrada.percentualImpostos)
          : PADROES.percentualImpostos,
      margemAlvo:
        entrada.margemAlvo != null ? Number(entrada.margemAlvo) : PADROES.margemAlvo,
      observacao: entrada.observacao?.trim() || null,
      ativo: entrada.ativo ?? true,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    data.produtos.push(produto);
    return produto;
  });
}

export async function atualizarProduto(
  id: string,
  entrada: Entrada
): Promise<ProdutoCatalogo | null> {
  return store.update((data) => {
    const p = data.produtos.find((x) => x.id === id);
    if (!p) return null;
    const texto = [
      "codigo",
      "descricao",
      "unidade",
      "marca",
      "fabricante",
      "codigoFabricante",
      "fornecedor",
      "observacao",
    ] as const;
    for (const campo of texto) {
      const valor = entrada[campo];
      if (valor === undefined) continue;
      const limpo = typeof valor === "string" ? valor.trim() : "";
      // descricao e unidade nunca podem ficar vazias — são o que identifica o
      // produto na lista e na proposta.
      if (campo === "descricao" || campo === "unidade" || campo === "codigo") {
        if (limpo) (p as Record<string, unknown>)[campo] = limpo;
      } else {
        (p as Record<string, unknown>)[campo] = limpo || null;
      }
    }
    const numericos = [
      "custo",
      "freteUnitario",
      "percentualImpostos",
      "margemAlvo",
    ] as const;
    for (const campo of numericos) {
      if (entrada[campo] !== undefined) p[campo] = Number(entrada[campo]) || 0;
    }
    if (entrada.ativo !== undefined) p.ativo = entrada.ativo;
    p.atualizadoEm = new Date().toISOString();
    return p;
  });
}

export async function excluirProduto(id: string): Promise<void> {
  await store.update((data) => {
    data.produtos = data.produtos.filter((p) => p.id !== id);
  });
}
