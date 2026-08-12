import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";

export type FormaPagamento = "dinheiro" | "pix" | "cheque" | "boleto";
export const FORMAS_PAGAMENTO: FormaPagamento[] = ["dinheiro", "pix", "cheque", "boleto"];

export type Cliente = {
  id: string;
  nome: string;
  razaoSocial: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string;
  telefone: string | null;
  formaPagamentoPadrao: FormaPagamento | null;
  observacao: string | null;
  criadoEm: string;
};

type ClientesData = {
  clientes: Cliente[];
};

const store = jsonStore<ClientesData>("clientes.json", { clientes: [] });

export async function listClientes(): Promise<Cliente[]> {
  const data = await store.read();
  return data.clientes;
}

export async function addCliente(input: {
  nome: string;
  cidade: string;
  razaoSocial?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  formaPagamentoPadrao?: FormaPagamento | null;
  observacao?: string | null;
}): Promise<Cliente> {
  return store.update((data) => {
    const cliente: Cliente = {
      id: randomUUID(),
      nome: input.nome,
      razaoSocial: input.razaoSocial ?? null,
      cnpj: input.cnpj ?? null,
      endereco: input.endereco ?? null,
      cidade: input.cidade,
      telefone: input.telefone ?? null,
      formaPagamentoPadrao: input.formaPagamentoPadrao ?? null,
      observacao: input.observacao ?? null,
      criadoEm: new Date().toISOString(),
    };
    data.clientes.push(cliente);
    return cliente;
  });
}

export async function updateCliente(
  id: string,
  patch: Partial<
    Pick<
      Cliente,
      | "nome"
      | "razaoSocial"
      | "cnpj"
      | "endereco"
      | "cidade"
      | "telefone"
      | "formaPagamentoPadrao"
      | "observacao"
    >
  >
): Promise<Cliente | null> {
  return store.update((data) => {
    const cliente = data.clientes.find((c) => c.id === id);
    if (!cliente) return null;
    // Só sobrescreve chaves de fato enviadas — mesmo cuidado de estoqueDb.ts
    // e tasksDb.ts pra não deixar Object.assign apagar campo com undefined.
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        (cliente as Record<string, unknown>)[key] = value;
      }
    }
    return cliente;
  });
}

export async function deleteCliente(id: string): Promise<void> {
  await store.update((data) => {
    data.clientes = data.clientes.filter((c) => c.id !== id);
  });
}
