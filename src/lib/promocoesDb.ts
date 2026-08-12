import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";

export type Promocao = {
  id: string;
  produto: string;
  precoAntigo: number;
  precoNovo: number;
  destaque: string;
  promptGerado: string;
  criadoEm: string;
};

type PromocoesData = {
  promocoes: Promocao[];
};

const store = jsonStore<PromocoesData>("promocoes.json", { promocoes: [] });

export async function listPromocoes(): Promise<Promocao[]> {
  const data = await store.read();
  return data.promocoes;
}

export async function addPromocao(input: {
  produto: string;
  precoAntigo: number;
  precoNovo: number;
  destaque: string;
  promptGerado: string;
}): Promise<Promocao> {
  return store.update((data) => {
    const promocao: Promocao = {
      id: randomUUID(),
      produto: input.produto,
      precoAntigo: input.precoAntigo,
      precoNovo: input.precoNovo,
      destaque: input.destaque,
      promptGerado: input.promptGerado,
      criadoEm: new Date().toISOString(),
    };
    data.promocoes.push(promocao);
    return promocao;
  });
}

export async function deletePromocao(id: string): Promise<void> {
  await store.update((data) => {
    data.promocoes = data.promocoes.filter((p) => p.id !== id);
  });
}
