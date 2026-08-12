import { jsonStore } from "./jsonStore";

export type LicitacaoStatus =
  | "de_olho"
  | "preparando"
  | "enviada"
  | "ganhou"
  | "perdeu";

export type TrackedLicitacao = {
  numeroControlePNCP: string;
  objeto: string;
  orgao: string;
  municipio: string;
  uf: string;
  modalidade: string;
  valorEstimado: number | null;
  dataEncerramentoProposta: string | null;
  link: string;
  status: LicitacaoStatus;
  notes: string;
  aiSummary: string | null;
  createdAt: number;
  updatedAt: number;
};

type TrackingData = {
  items: TrackedLicitacao[];
};

const store = jsonStore<TrackingData>("licitacoes-acompanhadas.json", { items: [] });

export async function listTracked(): Promise<TrackedLicitacao[]> {
  const data = await store.read();
  return [...data.items].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function trackLicitacao(
  input: Omit<
    TrackedLicitacao,
    "status" | "notes" | "aiSummary" | "createdAt" | "updatedAt"
  >
): Promise<TrackedLicitacao> {
  return store.update((data) => {
    const existing = data.items.find(
      (i) => i.numeroControlePNCP === input.numeroControlePNCP
    );
    if (existing) return existing;

    const now = Date.now();
    const item: TrackedLicitacao = {
      ...input,
      status: "de_olho",
      notes: "",
      aiSummary: null,
      createdAt: now,
      updatedAt: now,
    };
    data.items.push(item);
    return item;
  });
}

export async function updateTracked(
  numeroControlePNCP: string,
  updates: Partial<Pick<TrackedLicitacao, "status" | "notes" | "aiSummary">>
): Promise<TrackedLicitacao | null> {
  return store.update((data) => {
    const item = data.items.find(
      (i) => i.numeroControlePNCP === numeroControlePNCP
    );
    if (!item) return null;
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        (item as Record<string, unknown>)[key] = value;
      }
    }
    item.updatedAt = Date.now();
    return item;
  });
}

export async function untrackLicitacao(numeroControlePNCP: string): Promise<void> {
  await store.update((data) => {
    data.items = data.items.filter(
      (i) => i.numeroControlePNCP !== numeroControlePNCP
    );
  });
}
