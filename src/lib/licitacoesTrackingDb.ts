import { jsonStore } from "./jsonStore";

// As etapas pelas quais uma licitação passa, na ordem em que acontecem.
//
// Antes eram só cinco, e paravam em "ganhou" — mas ganhar não é o fim: num
// registro de preços a Embastel fica fornecendo por meses depois da ata
// assinada, e é justamente aí que o dinheiro entra. Também faltavam as duas
// etapas do meio, que num pregão eletrônico são momentos separados: a sessão
// de lances (em disputa) e a conferência de documentos de quem venceu no
// preço (habilitação) — dá pra vencer a disputa e ainda cair na habilitação
// por causa de uma certidão vencida.
export type LicitacaoStatus =
  // Salvou pra decidir depois. Separada de "de_olho" porque as duas coisas
  // são decisões diferentes: aqui ainda não se sabe se compensa participar;
  // lá já se sabe que sim, e o que falta é a data chegar. Misturar as duas
  // fazia a primeira coluna crescer sem parar, com o que vale e o que não
  // vale no mesmo monte, e a leitura do quadro deixava de valer.
  | "avaliar"
  | "de_olho"
  | "preparando"
  | "enviada"
  | "em_disputa"
  | "habilitacao"
  | "ganhou"
  | "entregando"
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
      status: "avaliar",
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
