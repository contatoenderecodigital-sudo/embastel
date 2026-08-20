import { normalizarTexto } from "./textoUtils";

// Casar "o que o fornecedor vende" com "o que o edital pede".
//
// Mora num arquivo só porque as duas agendas usam — a da loja
// (fornecedoresDb) e a de licitação (fornecedoresLicitacaoDb) — e as duas
// precisam casar exatamente igual: se a regra divergir, o mesmo edital acha
// fornecedor numa tela e não acha na outra.

/**
 * Radical da palavra, pra aguentar o plural do português.
 *
 * Buscar a palavra inteira não funciona, e o motivo é menos óbvio do que
 * parece: "descartavel" NÃO está dentro de "descartaveis" — o plural de
 * "-ável" é "-áveis", e a última letra muda. O mesmo vale pra "papel/papeis".
 * (É por isso que a lista de palavras-chave das licitações guarda
 * "descartáve", truncado, em vez de "descartável".)
 *
 * Cortar a última letra resolve esse caso e ainda pega o plural simples
 * ("bandeja" → "bandej", que está em "bandejas"). O piso de 5 letras evita o
 * outro extremo: com piso 4, "prato" virava "prat" e casava com
 * "prateleiras" — testado, aparecia mesmo.
 */
export function radical(palavra: string): string {
  return palavra.slice(0, Math.max(5, palavra.length - 1));
}

/**
 * Quais das categorias aparecem no texto, e com que força.
 *
 * Basta UMA palavra da categoria aparecer. Exigir todas deixaria de fora o
 * caso mais comum: a categoria "Prato e talher descartável" não apareceria num
 * edital que pede só "pratos descartáveis". E o custo de errar é assimétrico —
 * um nome a mais na lista é um telefonema desnecessário; um nome a menos é uma
 * cotação que não foi pedida e um lote que ficou sem preço.
 */
export function casarCategorias(
  categorias: string[],
  alvoNormalizado: string
): { batem: string[]; forca: number } {
  const batem: string[] = [];
  let forca = 0;

  for (const categoria of categorias) {
    const c = normalizarTexto(categoria);
    if (!c) continue;
    const palavras = c.split(" ").filter((p) => p.length >= 4);
    const acertos = palavras.filter((p) => alvoNormalizado.includes(radical(p))).length;
    if (acertos > 0) {
      batem.push(categoria);
      // Categoria inteira escrita no edital vale mais que uma palavra solta.
      forca += alvoNormalizado.includes(c) ? acertos + 2 : acertos;
    }
  }

  return { batem, forca };
}
