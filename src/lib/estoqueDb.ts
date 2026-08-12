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
