import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";

export type SituacaoEstoque = "ok" | "baixo" | "falta";

export type ProdutoEstoque = {
  id: string;
  nome: string;
  fornecedor: string;
  situacao: SituacaoEstoque;
  quantidadeSugerida: number | null;
  observacao: string | null;
  /**
   * Quem pôs esta linha aqui.
   *
   * Separa o que a contagem do depósito controla do que uma pessoa marcou à
   * mão. A conferência manda na situação das linhas que ela mesma criou — uma
   * contagem nova é a melhor evidência que existe. Já o que alguém marcou como
   * falta na unha não é rebaixado por uma contagem: quem marcou viu algo que a
   * contagem não vê (pedido grande a caminho, lote com defeito).
   *
   * Ausente nas linhas criadas antes deste campo — tratadas como "manual",
   * que é o comportamento mais cuidadoso.
   */
  origem?: "conferencia" | "manual";
  criadoEm: string;
  atualizadoEm: string;
};

type EstoqueData = {
  produtos: ProdutoEstoque[];
};

const store = jsonStore<EstoqueData>("estoque.json", { produtos: [] });

export async function listProdutos(): Promise<ProdutoEstoque[]> {
  const data = await store.read();
  return data.produtos;
}

export async function addProduto(input: {
  nome: string;
  fornecedor: string;
  situacao: SituacaoEstoque;
  quantidadeSugerida?: number | null;
  observacao?: string | null;
}): Promise<ProdutoEstoque> {
  return store.update((data) => {
    const now = new Date().toISOString();
    const produto: ProdutoEstoque = {
      id: randomUUID(),
      nome: input.nome,
      fornecedor: input.fornecedor,
      situacao: input.situacao,
      quantidadeSugerida: input.quantidadeSugerida ?? null,
      observacao: input.observacao ?? null,
      criadoEm: now,
      atualizadoEm: now,
    };
    data.produtos.push(produto);
    return produto;
  });
}

export async function updateProduto(
  id: string,
  patch: Partial<
    Pick<ProdutoEstoque, "nome" | "fornecedor" | "situacao" | "quantidadeSugerida" | "observacao">
  >
): Promise<ProdutoEstoque | null> {
  return store.update((data) => {
    const produto = data.produtos.find((p) => p.id === id);
    if (!produto) return null;
    // Object.assign copia até chaves com valor undefined — sem filtrar,
    // mandar {situacao: "baixo"} apagaria nome/fornecedor/etc que a rota
    // deixou como undefined por não terem sido enviados no PATCH.
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        (produto as Record<string, unknown>)[key] = value;
      }
    }
    produto.atualizadoEm = new Date().toISOString();
    return produto;
  });
}

export async function deleteProduto(id: string): Promise<void> {
  await store.update((data) => {
    data.produtos = data.produtos.filter((p) => p.id !== id);
  });
}

/**
 * Joga no estoque o que a conferência encontrou abaixo do ideal.
 *
 * É a ponte entre contar e pedir. Antes disso, quem contava e via que tinha
 * acabado precisava abrir a aba Estoque e redigitar o produto e o fornecedor
 * na mão — e é justamente na hora de digitar de novo, com o depósito pela
 * metade, que o item some da lista e o pedido vai incompleto.
 *
 * NÃO DUPLICA. Se o produto já está na lista do mesmo fornecedor, atualiza a
 * situação e a quantidade em vez de criar outra linha: conferir de novo na
 * semana seguinte não pode encher a tela de repetidos.
 *
 * QUEM MANDA NA SITUAÇÃO depende de quem criou a linha. Nas que vieram da
 * própria conferência, a contagem de hoje manda: achou três unidades, deixa de
 * ser "falta" e vira "baixo". Nas que alguém marcou à mão, "falta" não é
 * rebaixado por contagem — quem marcou viu algo que a contagem não vê.
 */
export async function reporDaConferencia(
  itens: Array<{
    nome: string;
    fornecedor: string;
    quantidade: number;
    quantidadeIdeal: number | null;
  }>
): Promise<{ criados: number; atualizados: number }> {
  let criados = 0;
  let atualizados = 0;

  await store.update((data) => {
    const agora = new Date().toISOString();

    for (const item of itens) {
      const nome = item.nome.trim();
      const fornecedor = item.fornecedor.trim();
      // Sem fornecedor não dá pra montar pedido nenhum, e a linha só sujaria a
      // tela — o item fica fora até alguém dizer de quem se compra.
      if (!nome || !fornecedor) continue;
      if (item.quantidadeIdeal == null) continue;
      if (item.quantidade >= item.quantidadeIdeal) continue;

      const situacao: SituacaoEstoque = item.quantidade <= 0 ? "falta" : "baixo";
      const sugerida = Math.max(1, item.quantidadeIdeal - item.quantidade);

      const existente = data.produtos.find(
        (p) =>
          p.nome.trim().toLowerCase() === nome.toLowerCase() &&
          p.fornecedor.trim().toLowerCase() === fornecedor.toLowerCase()
      );

      if (existente) {
        const daConferencia = existente.origem === "conferencia";
        if (daConferencia || !(existente.situacao === "falta" && situacao === "baixo")) {
          existente.situacao = situacao;
        }
        existente.quantidadeSugerida = sugerida;
        existente.atualizadoEm = agora;
        atualizados++;
      } else {
        data.produtos.push({
          id: randomUUID(),
          nome,
          fornecedor,
          situacao,
          quantidadeSugerida: sugerida,
          observacao: "Veio da conferência de estoque",
          origem: "conferencia",
          criadoEm: agora,
          atualizadoEm: agora,
        });
        criados++;
      }
    }

    return data;
  });

  return { criados, atualizados };
}
