import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";

// 0 = domingo ... 6 = sábado (mesmo mapeamento de Date.getDay()).
export type TarefaRecorrente = {
  id: string;
  titulo: string;
  diaSemana: number;
  responsavel: string | null;
  ativo: boolean;
  criadoEm: string;
};

type RecorrentesData = {
  recorrentes: TarefaRecorrente[];
};

const store = jsonStore<RecorrentesData>("tarefas-recorrentes.json", {
  recorrentes: [],
});

export async function listRecorrentes(): Promise<TarefaRecorrente[]> {
  const data = await store.read();
  return data.recorrentes;
}

export async function addRecorrente(input: {
  titulo: string;
  diaSemana: number;
  responsavel?: string | null;
}): Promise<TarefaRecorrente> {
  return store.update((data) => {
    const recorrente: TarefaRecorrente = {
      id: randomUUID(),
      titulo: input.titulo,
      diaSemana: input.diaSemana,
      responsavel: input.responsavel ?? null,
      ativo: true,
      criadoEm: new Date().toISOString(),
    };
    data.recorrentes.push(recorrente);
    return recorrente;
  });
}

export async function updateRecorrente(
  id: string,
  patch: Partial<Pick<TarefaRecorrente, "titulo" | "diaSemana" | "responsavel" | "ativo">>
): Promise<TarefaRecorrente | null> {
  return store.update((data) => {
    const recorrente = data.recorrentes.find((r) => r.id === id);
    if (!recorrente) return null;
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        (recorrente as Record<string, unknown>)[key] = value;
      }
    }
    return recorrente;
  });
}

export async function deleteRecorrente(id: string): Promise<void> {
  await store.update((data) => {
    data.recorrentes = data.recorrentes.filter((r) => r.id !== id);
  });
}
