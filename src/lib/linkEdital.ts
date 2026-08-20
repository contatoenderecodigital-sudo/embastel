import { partesDoNumeroControle } from "./pncpItens";

/**
 * Endereço do edital, garantido.
 *
 * O PNCP devolve `linkSistemaOrigem` com o endereço do portal do órgão, mas
 * nem todo órgão preenche — e alguns preenchem com UM ESPAÇO. Espaço é
 * truthy, então `link || fallback` passava reto e a tela renderizava
 * `href=" "`, que o navegador resolve como "a própria página": clicar em
 * "Edital" recarregava o painel. Aconteceu com Victor Graeff/RS em
 * 20/08/2026, num edital que fechava no dia seguinte.
 *
 * Quando não há link do órgão, cai na página do PNCP, que sempre existe e é
 * montada a partir do número de controle.
 */
export function linkDoEdital(
  numeroControlePNCP: string,
  linkDoOrgao?: string | null
): string {
  const limpo = (linkDoOrgao ?? "").trim();
  if (limpo) return limpo;

  const partes = partesDoNumeroControle(numeroControlePNCP);
  if (!partes) return "https://pncp.gov.br/app/editais";
  return `https://pncp.gov.br/app/editais/${partes.cnpj}/${partes.ano}/${partes.sequencial}`;
}
