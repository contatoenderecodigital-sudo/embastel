import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";

export type Ficha = {
  id: string;
  titulo: string;
  categoria: string | null;
  // Linhas livres tipo "Base 10cm", "Tempero de alho" — nunca preço, o
  // usuário foi explícito: "nunca quero por preços, sempre mudam".
  variantes: string[];
  // Data URI (base64) da foto do produto — guardado direto no JSON pra não
  // precisar de rota de upload/armazenamento de arquivo separada.
  imagemDataUrl: string | null;
  observacao: string | null;
  criadoEm: string;
};

type FichasData = {
  fichas: Ficha[];
};

const store = jsonStore<FichasData>("fichas.json", { fichas: [] });

export async function listFichas(): Promise<Ficha[]> {
  const data = await store.read();
  return data.fichas;
}

export async function addFicha(input: {
  titulo: string;
  categoria?: string | null;
  variantes: string[];
  imagemDataUrl?: string | null;
  observacao?: string | null;
}): Promise<Ficha> {
  return store.update((data) => {
    const ficha: Ficha = {
      id: randomUUID(),
      titulo: input.titulo,
      categoria: input.categoria ?? null,
      variantes: input.variantes,
      imagemDataUrl: input.imagemDataUrl ?? null,
      observacao: input.observacao ?? null,
      criadoEm: new Date().toISOString(),
    };
    data.fichas.push(ficha);
    return ficha;
  });
}

export async function updateFicha(
  id: string,
  patch: Partial<Pick<Ficha, "titulo" | "categoria" | "variantes" | "imagemDataUrl" | "observacao">>
): Promise<Ficha | null> {
  return store.update((data) => {
    const ficha = data.fichas.find((f) => f.id === id);
    if (!ficha) return null;
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        (ficha as Record<string, unknown>)[key] = value;
      }
    }
    return ficha;
  });
}

export async function deleteFicha(id: string): Promise<void> {
  await store.update((data) => {
    data.fichas = data.fichas.filter((f) => f.id !== id);
  });
}
