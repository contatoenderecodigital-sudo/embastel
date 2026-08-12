import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";

export type FormaPagamentoRomaneio = "dinheiro" | "pix" | "cheque" | "boleto";

export type RomaneioItem = {
  id: string;
  clienteId: string;
  clienteNome: string;
  cidade: string;
  valor: number;
  formaPagamento: FormaPagamentoRomaneio;
  observacao: string | null;
  entregue: boolean;
  pago: boolean;
};

export type Romaneio = {
  id: string;
  // Data do romaneio em si (o dia em que a carga vai, não o dia de cada
  // cliente) — pedido do usuário: "deixa pra gente sempre pôr pela data do
  // dia que está sendo feito o romaneio mesmo, pq clientes de dias
  // diferentes podem ficar no mesmo romaneio".
  data: string; // "YYYY-MM-DD"
  observacao: string | null;
  itens: RomaneioItem[];
  criadoEm: string;
};

type RomaneiosData = {
  romaneios: Romaneio[];
};

const store = jsonStore<RomaneiosData>("romaneios.json", { romaneios: [] });

export async function listRomaneios(): Promise<Romaneio[]> {
  const data = await store.read();
  return data.romaneios;
}

export async function getRomaneio(id: string): Promise<Romaneio | null> {
  const data = await store.read();
  return data.romaneios.find((r) => r.id === id) ?? null;
}

export async function addRomaneio(input: {
  data: string;
  observacao?: string | null;
}): Promise<Romaneio> {
  return store.update((data) => {
    const romaneio: Romaneio = {
      id: randomUUID(),
      data: input.data,
      observacao: input.observacao ?? null,
      itens: [],
      criadoEm: new Date().toISOString(),
    };
    data.romaneios.push(romaneio);
    return romaneio;
  });
}

export async function updateRomaneio(
  id: string,
  patch: Partial<Pick<Romaneio, "data" | "observacao">>
): Promise<Romaneio | null> {
  return store.update((data) => {
    const romaneio = data.romaneios.find((r) => r.id === id);
    if (!romaneio) return null;
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        (romaneio as Record<string, unknown>)[key] = value;
      }
    }
    return romaneio;
  });
}

export async function deleteRomaneio(id: string): Promise<void> {
  await store.update((data) => {
    data.romaneios = data.romaneios.filter((r) => r.id !== id);
  });
}

export async function addItemRomaneio(
  romaneioId: string,
  input: {
    clienteId: string;
    clienteNome: string;
    cidade: string;
    valor: number;
    formaPagamento: FormaPagamentoRomaneio;
    observacao?: string | null;
  }
): Promise<Romaneio | null> {
  return store.update((data) => {
    const romaneio = data.romaneios.find((r) => r.id === romaneioId);
    if (!romaneio) return null;
    const item: RomaneioItem = {
      id: randomUUID(),
      clienteId: input.clienteId,
      clienteNome: input.clienteNome,
      cidade: input.cidade,
      valor: input.valor,
      formaPagamento: input.formaPagamento,
      observacao: input.observacao ?? null,
      entregue: false,
      pago: false,
    };
    romaneio.itens.push(item);
    return romaneio;
  });
}

export async function updateItemRomaneio(
  romaneioId: string,
  itemId: string,
  patch: Partial<Pick<RomaneioItem, "valor" | "formaPagamento" | "observacao" | "entregue" | "pago">>
): Promise<Romaneio | null> {
  return store.update((data) => {
    const romaneio = data.romaneios.find((r) => r.id === romaneioId);
    if (!romaneio) return null;
    const item = romaneio.itens.find((i) => i.id === itemId);
    if (!item) return null;
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        (item as Record<string, unknown>)[key] = value;
      }
    }
    return romaneio;
  });
}

export async function deleteItemRomaneio(
  romaneioId: string,
  itemId: string
): Promise<Romaneio | null> {
  return store.update((data) => {
    const romaneio = data.romaneios.find((r) => r.id === romaneioId);
    if (!romaneio) return null;
    romaneio.itens = romaneio.itens.filter((i) => i.id !== itemId);
    return romaneio;
  });
}
