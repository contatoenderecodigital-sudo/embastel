import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";

export type Fornecedor = {
  id: string;
  nome: string;
  criadoEm: string;
};

type FornecedoresData = {
  fornecedores: Fornecedor[];
};

// Lista inicial passada pelo usuário em 2026-08-10 — só entra no arquivo se
// ele ainda não existir (primeira vez que o app roda); depois disso quem
// manda é o que estiver salvo em disco.
const NOMES_INICIAIS = [
  "Pennacchi", "Galvanotek", "Copozan", "Hiperpack", "Fibraform",
  "Cia Canoinhas", "Orleplast", "Plast Lar", "Da Colônia", "Reval",
  "Cristalcopo", "Apti", "Bela Vista", "Bigfer", "Curifest",
  "Cotherpack", "Dispafilm", "Fracipel", "Jandira", "JF Pack",
  "Mirandinha", "Libreplast", "Pettit", "Prática Estampa", "Predilecta",
  "Inoven", "Prevemax", "Reiki", "Prodac", "Riberball",
  "Sanremo", "Softworks", "Tritec", "Wyda",
];

const store = jsonStore<FornecedoresData>("fornecedores.json", {
  fornecedores: NOMES_INICIAIS.map((nome) => ({
    id: randomUUID(),
    nome,
    criadoEm: new Date().toISOString(),
  })),
});

export async function listFornecedores(): Promise<Fornecedor[]> {
  const data = await store.read();
  return [...data.fornecedores].sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function addFornecedor(nome: string): Promise<Fornecedor> {
  return store.update((data) => {
    const fornecedor: Fornecedor = {
      id: randomUUID(),
      nome,
      criadoEm: new Date().toISOString(),
    };
    data.fornecedores.push(fornecedor);
    return fornecedor;
  });
}

export async function deleteFornecedor(id: string): Promise<void> {
  await store.update((data) => {
    data.fornecedores = data.fornecedores.filter((f) => f.id !== id);
  });
}
