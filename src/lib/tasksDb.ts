import { jsonStore } from "./jsonStore";
import { listRecorrentes } from "./recorrentesDb";

export type Priority = "alta" | "media" | "baixa";

export type Task = {
  id: string;
  title: string;
  priority: Priority;
  done: boolean;
  responsavel: string | null;
  createdAt: number;
  // Presentes só em tarefas geradas automaticamente por uma tarefa
  // recorrente (ver recorrentesDb.ts) — usados pra não duplicar a mesma
  // semana e pra saber que essa tarefa "volta sozinha" na próxima ocorrência.
  recorrenteId?: string | null;
  semanaRef?: string | null;
};

export type TasksData = {
  tasks: Task[];
};

const store = jsonStore<TasksData>("tarefas.json", { tasks: [] });

const PRIORITY_ORDER: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };

// Chave de semana ISO (ex: "2026-W32") — usada pra saber se a ocorrência
// desta semana de uma tarefa recorrente já foi criada, sem depender de
// nenhum agendador externo rodando em segundo plano (não temos um).
function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// Materializa a ocorrência desta semana de cada tarefa recorrente ativa,
// assim que o dia da semana configurado chegar (ou passar) — chamado no
// início de listTasks() porque não há processo em segundo plano rodando
// fora das sessões do painel pra fazer isso sozinho num horário fixo.
async function garantirTarefasRecorrentes(): Promise<void> {
  const recorrentes = (await listRecorrentes()).filter((r) => r.ativo);
  if (!recorrentes.length) return;

  const hoje = new Date();
  const diaHoje = hoje.getDay();
  const semanaAtual = getWeekKey(hoje);

  await store.update((data) => {
    for (const rec of recorrentes) {
      if (diaHoje < rec.diaSemana) continue;
      const jaExiste = data.tasks.some(
        (t) => t.recorrenteId === rec.id && t.semanaRef === semanaAtual
      );
      if (jaExiste) continue;
      data.tasks.push({
        id: `tarefa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: rec.titulo,
        priority: "alta",
        done: false,
        responsavel: rec.responsavel,
        recorrenteId: rec.id,
        semanaRef: semanaAtual,
        createdAt: Date.now(),
      });
    }
  });
}

export async function listTasks(): Promise<Task[]> {
  await garantirTarefasRecorrentes();
  const data = await store.read();
  return [...data.tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdAt - b.createdAt;
  });
}

export async function addTask(
  title: string,
  priority: Priority,
  responsavel: string | null = null
): Promise<Task> {
  return store.update((data) => {
    const task: Task = {
      id: `tarefa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      priority,
      done: false,
      responsavel,
      createdAt: Date.now(),
    };
    data.tasks.push(task);
    return task;
  });
}

export async function updateTask(
  id: string,
  updates: Partial<Pick<Task, "done" | "priority" | "title" | "responsavel">>
): Promise<Task | null> {
  return store.update((data) => {
    const task = data.tasks.find((t) => t.id === id);
    if (!task) return null;
    // Só sobrescreve chaves de fato enviadas — evita o mesmo bug já visto em
    // estoqueDb.ts, onde Object.assign com uma chave presente porém undefined
    // apagava o valor existente sem querer.
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        (task as Record<string, unknown>)[key] = value;
      }
    }
    return task;
  });
}

export async function deleteTask(id: string): Promise<void> {
  await store.update((data) => {
    data.tasks = data.tasks.filter((t) => t.id !== id);
  });
}
