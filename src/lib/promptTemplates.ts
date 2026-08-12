const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Prompt pra gerar só a FOTO do produto (sem preço, sem texto nenhum) —
// usado na ficha de produto quando o usuário não tem uma foto própria à
// mão e descreve o produto (ex: "cakeboard de MDF redonda").
export function buildFotoProdutoPrompt(descricaoProduto: string): string {
  return `Fotografia de produto profissional para catálogo/e-commerce: ${descricaoProduto}.
Fundo branco liso e completamente vazio (sem props, sem cenário, sem sombra forte).
Produto centralizado, ocupando a maior parte do quadro, em ângulo levemente elevado (3/4) que mostre bem o formato e o material.
Iluminação de estúdio, suave e uniforme, sem reflexos exagerados.
Foto nítida, realista, alta resolução, estilo catálogo comercial.
NÃO incluir nenhum texto, número, preço, marca d'água, logotipo ou elemento gráfico sobreposto — só o produto puro, pronto pra eu montar o layout por cima depois.
Formato quadrado (1:1).`;
}

// Prompt pra gerar a arte de promoção inteira (produto + de/por + destaque),
// já com a identidade visual da Embastel (maroon #7a1f2b + branco/preto).
export function buildPromocaoPrompt(input: {
  produto: string;
  precoAntigo: number;
  precoNovo: number;
  destaque: string;
}): string {
  const antigoTxt = currency.format(input.precoAntigo);
  const novoTxt = currency.format(input.precoNovo);
  const desconto =
    input.precoAntigo > 0
      ? Math.round((1 - input.precoNovo / input.precoAntigo) * 100)
      : null;

  return `Crie uma arte de promoção para redes sociais (post quadrado, formato 1:1, estilo Instagram feed) para a Embastel Embalagens, uma distribuidora de embalagens e produtos de festa/confeitaria.

PRODUTO: ${input.produto}
PREÇO ANTIGO (deve aparecer riscado): ${antigoTxt}
PREÇO NOVO/PROMOCIONAL (deve aparecer em destaque, bem maior): ${novoTxt}${
    desconto !== null ? `\nDESCONTO: aproximadamente ${desconto}% — pode incluir um selo/tag "${desconto}% OFF" se ficar visualmente bom` : ""
  }
${input.destaque ? `DESTAQUE/CHAMADA ADICIONAL: ${input.destaque}` : ""}

IDENTIDADE VISUAL:
- Cor principal: vinho/bordô escuro (#7a1f2b), usada em faixas, fundo de destaque ou tipografia principal.
- Fundo predominantemente branco ou bem claro, visual limpo, comercial, não poluído.
- Tipografia bold, grande, moderna, tudo em maiúsculas nos títulos.
- Preço antigo pequeno e riscado; preço novo grande, em destaque, cor vinho ou em uma faixa amarela chamativa.
- Espaço reservado pra foto do produto (${input.produto}) ocupando boa parte do quadro, fundo neutro atrás dela.
- Sem elementos genéricos de banco de imagem, sem excesso de ícones — visual de encarte comercial de distribuidora, direto ao ponto.

IMPORTANTE: os únicos valores em R$ que devem aparecer na imagem são exatamente os dois informados acima (preço antigo riscado e preço novo em destaque) — não invente outros números, não adicione parcelamento nem outros textos de preço.`;
}
