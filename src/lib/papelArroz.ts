// Regras de layout do papel de arroz.
//
// Tudo aqui é em MILÍMETROS, e a impressão usa unidades físicas de verdade
// (mm no CSS + @page A4) — não pixel. Papel de arroz é cortado com aro ou
// tesoura em cima da medida do bolo; se sair 2mm menor, não serve. Por isso
// nada de "mais ou menos": o círculo de 20cm tem que sair com 20cm na régua.

export const A4_LARGURA_MM = 210;
export const A4_ALTURA_MM = 297;

// Margem que a impressora não consegue imprimir. Quase toda jato de tinta
// doméstica perde ~5mm de borda; abaixo disso o desenho sai cortado.
export const MARGEM_MM = 5;

export const AREA_UTIL_LARGURA_MM = A4_LARGURA_MM - MARGEM_MM * 2; // 200
export const AREA_UTIL_ALTURA_MM = A4_ALTURA_MM - MARGEM_MM * 2; // 287

export type Formato = "redondo" | "quadrado";

// Diâmetros comuns de papel de arroz, em cm. São as medidas que os aros de
// confeitaria usam.
export const DIAMETROS_CM = [10, 12, 15, 18, 20, 21, 23, 25, 28] as const;

export type TamanhoQuadrado = "20x25" | "folha";

export function medidaQuadrado(tamanho: TamanhoQuadrado): {
  larguraMm: number;
  alturaMm: number;
} {
  if (tamanho === "20x25") return { larguraMm: 200, alturaMm: 250 };
  // "Folha inteira" é a área útil da A4 — o máximo que a impressora alcança.
  return { larguraMm: AREA_UTIL_LARGURA_MM, alturaMm: AREA_UTIL_ALTURA_MM };
}

// ---------------------------------------------------------------------------
// Tags (as bolinhas pequenas que vão em bolacha ou em cima do copo)
// ---------------------------------------------------------------------------

// Espaço entre uma tag e outra. Serve pra dar folga na hora de recortar —
// coladas uma na outra é impossível cortar sem estragar a vizinha.
export const ESPACO_ENTRE_TAGS_MM = 3;

export type LayoutTags = {
  porLinha: number;
  linhas: number;
  total: number;
  diametroMm: number;
  // Sobra de cada lado, pra centralizar o conjunto na folha.
  offsetXMm: number;
  offsetYMm: number;
};

/**
 * Quantas tags de `diametroCm` cabem numa folha A4, e onde cada uma fica.
 *
 * Confere com a prática: o usuário disse que de 5cm ele coloca 15 numa folha.
 * Com 3mm de espaço, dá 3 por linha × 5 linhas = 15. Bate.
 */
export function calcularLayoutTags(diametroCm: number): LayoutTags {
  const diametroMm = diametroCm * 10;
  const passo = diametroMm + ESPACO_ENTRE_TAGS_MM;

  // O último item da linha não precisa do espaço depois dele — daí somar o
  // espaço antes de dividir.
  const porLinha = Math.max(
    0,
    Math.floor((AREA_UTIL_LARGURA_MM + ESPACO_ENTRE_TAGS_MM) / passo)
  );
  const linhas = Math.max(
    0,
    Math.floor((AREA_UTIL_ALTURA_MM + ESPACO_ENTRE_TAGS_MM) / passo)
  );

  const larguraOcupada = porLinha * passo - ESPACO_ENTRE_TAGS_MM;
  const alturaOcupada = linhas * passo - ESPACO_ENTRE_TAGS_MM;

  return {
    porLinha,
    linhas,
    total: porLinha * linhas,
    diametroMm,
    offsetXMm: Math.max(0, (AREA_UTIL_LARGURA_MM - larguraOcupada) / 2),
    offsetYMm: Math.max(0, (AREA_UTIL_ALTURA_MM - alturaOcupada) / 2),
  };
}

// ---------------------------------------------------------------------------
// Prompt de imagem
// ---------------------------------------------------------------------------

/**
 * Monta o texto pra gerar a arte num gerador de imagem, quando a pessoa tem
 * o tema na cabeça mas não tem o desenho pronto. Mesma ideia que já é usada
 * nas fichas de produto e nas promoções.
 */
export function montarPromptPapelArroz(input: {
  tema: string;
  nome?: string | null;
  idade?: string | null;
  descricao?: string | null;
  formato: Formato;
}): string {
  const partes: string[] = [];

  partes.push(
    `Arte para papel de arroz comestível, tema "${input.tema.trim()}".`
  );

  if (input.formato === "redondo") {
    partes.push(
      "Composição circular: o desenho precisa caber inteiro dentro de um círculo, sem elementos importantes perto da borda, porque a impressão é recortada em círculo."
    );
  } else {
    partes.push("Composição retangular, ocupando a folha toda.");
  }

  if (input.nome?.trim()) {
    const idade = input.idade?.trim();
    partes.push(
      idade
        ? `Escrever em destaque o nome "${input.nome.trim()}" e o número ${idade} (idade), com tipografia legível e combinando com o tema.`
        : `Escrever em destaque o nome "${input.nome.trim()}", com tipografia legível e combinando com o tema.`
    );
  }

  if (input.descricao?.trim()) {
    partes.push(input.descricao.trim());
  }

  partes.push(
    "Cores vivas e saturadas (a impressão em papel de arroz sai mais clara que na tela), fundo totalmente preenchido sem transparência, sem marca d'água, sem texto extra além do pedido, alta resolução."
  );

  return partes.join(" ");
}
