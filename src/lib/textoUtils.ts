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
