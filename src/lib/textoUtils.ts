// Normalização usada na busca por palavra-chave: o objeto da compra no PNCP
// vem em caixa alta, com acento e sem padrão nenhum ("AQUISIÇÃO DE COPOS
// DESCARTÁVEIS"), então comparar cru erra o óbvio. Serve tanto no servidor
// (coletor) quanto no cliente (filtro da tela).
const MARCAS_DE_ACENTO = /[̀-ͯ]/g;

export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(MARCAS_DE_ACENTO, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Verdadeiro se o texto contém pelo menos uma das palavras-chave. */
export function combinaComPalavras(texto: string, palavras: string[]): boolean {
  return Boolean(palavraQueCombinou(texto, palavras));
}

/**
 * Qual palavra-chave casou (null se nenhuma). Devolver a palavra em vez de um
 * booleano permite mostrar na tela POR QUE aquela licitação apareceu — que é
 * como a pessoa percebe que "confeitaria" está trazendo bolo pronto e ajusta.
 * Lista vazia casa com tudo.
 */
export function palavraQueCombinou(texto: string, palavras: string[]): string | null {
  const alvo = normalizarTexto(texto);
  const termos = palavras.map((p) => p.trim()).filter(Boolean);
  if (!termos.length) return "";
  for (const termo of termos) {
    if (alvo.includes(normalizarTexto(termo))) return termo;
  }
  return null;
}

/**
 * Como `palavraQueCombinou`, mas só aceita a palavra se ela aparecer no
 * COMEÇO do texto — e devolve a que aparece mais cedo, não a primeira da lista.
 *
 * Existe por causa da descrição de item do PNCP, que é escrita como
 * "Nome do produto atributo: valor, atributo: valor, ...". A identidade do
 * produto está no começo; o resto são características. E "embalagem" aparece
 * como característica de quase tudo que o governo compra: café ("Embalagem
 * primária: a vácuo"), grampeador ("EMBALAGEM: Caixa contendo 5000"), agulha
 * ("embalagem individual").
 *
 * Medido em 16/08/2026 sobre 161 itens já lidos do PNCP: casar em qualquer
 * posição trazia 2 itens do ramo pra cada 3 de fora (grampeador, café, arroz,
 * bisturi). Exigindo a palavra nos primeiros 60 caracteres, sobraram 84; com
 * as exclusões de item junto, 53 — dos quais 51 são mercadoria da loja.
 *
 * 60 caracteres e não menos: descrições de catálogo põem o nome primeiro mas
 * a palavra-chave nos atributos ("Prato aplicação: refeição, características
 * adicionais: descartável"), e apertar pra 40 perdia esses.
 */
export function palavraNoInicio(
  texto: string,
  palavras: string[],
  limite = 60
): string | null {
  const alvo = normalizarTexto(texto);
  let melhorTermo: string | null = null;
  let melhorPosicao = Number.POSITIVE_INFINITY;

  for (const termo of palavras.map((p) => p.trim()).filter(Boolean)) {
    const posicao = alvo.indexOf(normalizarTexto(termo));
    if (posicao >= 0 && posicao < melhorPosicao) {
      melhorPosicao = posicao;
      melhorTermo = termo;
    }
  }

  return melhorPosicao <= limite ? melhorTermo : null;
}

/**
 * Qual termo de exclusão apareceu no texto (null se nenhum). Uma licitação que
 * bate numa exclusão é descartada mesmo tendo casado com uma palavra-chave —
 * é o que separa "aquisição de embalagens" de "ureia acondicionada em
 * embalagens de 50kg".
 */
export function exclusaoQueBateu(texto: string, exclusoes: string[]): string | null {
  const alvo = normalizarTexto(texto);
  for (const termo of exclusoes.map((e) => e.trim()).filter(Boolean)) {
    if (alvo.includes(normalizarTexto(termo))) return termo;
  }
  return null;
}
