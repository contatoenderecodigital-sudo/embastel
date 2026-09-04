import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";

export type FormaPagamento = "dinheiro" | "pix" | "cheque" | "boleto";
export const FORMAS_PAGAMENTO: FormaPagamento[] = ["dinheiro", "pix", "cheque", "boleto"];

export type Cliente = {
  id: string;
  nome: string;
  razaoSocial: string | null;
  /**
   * Física ou jurídica — muda o documento que se pede.
   *
   * De pessoa jurídica basta o CNPJ: nome, endereço e situação a gente
   * consulta online quando precisar. De pessoa física não dá pra consultar
   * nada, então o cadastro tem que guardar CPF, endereço, telefone e e-mail —
   * é o que permite cobrar quem some.
   *
   * Ausente nos cadastros antigos, que nasceram sem o campo: quem tem CNPJ é
   * tratado como jurídica, o resto como física.
   */
  tipoPessoa?: "fisica" | "juridica";
  cnpj: string | null;
  /** Só de pessoa física. */
  cpf?: string | null;
  email?: string | null;
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
  tipoPessoa?: "fisica" | "juridica";
  cnpj?: string | null;
  cpf?: string | null;
  email?: string | null;
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
      // Sem escolha explícita, quem informou CNPJ é jurídica.
      tipoPessoa: input.tipoPessoa ?? (input.cnpj ? "juridica" : "fisica"),
      cnpj: input.cnpj ?? null,
      cpf: input.cpf ?? null,
      email: input.email ?? null,
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
      | "tipoPessoa"
      | "cpf"
      | "email"
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
