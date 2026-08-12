"use client";

import { useCallback, useEffect, useState } from "react";
import type { Priority, Task } from "@/lib/tasksDb";
import type { TarefaRecorrente } from "@/lib/recorrentesDb";
import { FUNCIONARIOS } from "@/lib/funcionarios";

const PRIORITY_LABEL: Record<Priority, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const PRIORITY_STYLE: Record<Priority, string> = {
  alta: "bg-red-50 text-red-700 border-red-100",
  media: "bg-amber-50 text-amber-700 border-amber-100",
  baixa: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

const DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export default function TarefasPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [responsavel, setResponsavel] = useState("");
  const [loading, setLoading] = useState(false);

  const [recorrentes, setRecorrentes] = useState<TarefaRecorrente[]>([]);
  const [showRecorrentes, setShowRecorrentes] = useState(false);
  const [recTitulo, setRecTitulo] = useState("");
  const [recDia, setRecDia] = useState(1);
  const [recResponsavel, setRecResponsavel] = useState("");
  const [savingRec, setSavingRec] = useState(false);

  const loadTasks = useCallback(async () => {
    const res = await fetch("/api/tarefas");
    const data = await res.json();
    setTasks(data.tasks ?? []);
  }, []);

  const loadRecorrentes = useCallback(async () => {
    const res = await fetch("/api/tarefas-recorrentes");
    const data = await res.json();
    setRecorrentes(data.recorrentes ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTasks();
    loadRecorrentes();
  }, [loadTasks, loadRecorrentes]);

  async function handleAdd() {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, priority, responsavel }),
      });
      setTitle("");
      setResponsavel("");
      await loadTasks();
    } finally {
      setLoading(false);
    }
  }

  async function toggleDone(task: Task) {
    await fetch(`/api/tarefas/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    });
    await loadTasks();
  }

  async function handleResponsavelChange(taskId: string, novoResponsavel: string) {
    await fetch(`/api/tarefas/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responsavel: novoResponsavel || null }),
    });
    await loadTasks();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/tarefas/${id}`, { method: "DELETE" });
    await loadTasks();
  }

  async function handleAddRecorrente() {
    if (!recTitulo.trim()) return;
    setSavingRec(true);
    try {
      await fetch("/api/tarefas-recorrentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: recTitulo,
          diaSemana: recDia,
          responsavel: recResponsavel,
        }),
      });
      setRecTitulo("");
      setRecResponsavel("");
      await loadRecorrentes();
    } finally {
      setSavingRec(false);
    }
  }

  async function toggleRecorrenteAtivo(rec: TarefaRecorrente) {
    await fetch(`/api/tarefas-recorrentes/${rec.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !rec.ativo }),
    });
    await loadRecorrentes();
  }

  async function handleDeleteRecorrente(id: string) {
    await fetch(`/api/tarefas-recorrentes/${id}`, { method: "DELETE" });
    await loadRecorrentes();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">Tarefas</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          O que fazer, organizado por prioridade — e quem é o responsável.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="Nova tarefa..."
          className="min-w-[200px] flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <select
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          <option value="">Sem responsável</option>
          {FUNCIONARIOS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={loading || !title.trim()}
          className="brand-gradient rounded-md px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand/20 transition-transform hover:-translate-y-px disabled:opacity-50"
        >
          Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 && (
          <p className="text-sm text-neutral-500">Nenhuma tarefa cadastrada.</p>
        )}
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200/70 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md ${
              task.done ? "opacity-50" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => toggleDone(task)}
              className="h-4 w-4 accent-brand"
            />
            <span
              className={`flex-1 text-sm text-neutral-900 ${task.done ? "line-through" : ""}`}
            >
              {task.title}
              {task.recorrenteId && (
                <span
                  title="Tarefa semanal — volta sozinha toda semana"
                  className="ml-1.5 text-xs text-neutral-400"
                >
                  🔁
                </span>
              )}
            </span>
            <select
              value={task.responsavel ?? ""}
              onChange={(e) => handleResponsavelChange(task.id, e.target.value)}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700 outline-none focus:border-brand focus:bg-white"
            >
              <option value="">Atribuir a...</option>
              {FUNCIONARIOS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[task.priority]}`}
            >
              {PRIORITY_LABEL[task.priority]}
            </span>
            <button
              onClick={() => handleDelete(task.id)}
              className="text-xs text-neutral-400 hover:text-red-600"
            >
              Excluir
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <button
          onClick={() => setShowRecorrentes((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <h2 className="text-[14px] font-semibold text-neutral-900">
              Tarefas semanais recorrentes {recorrentes.length > 0 && `(${recorrentes.length})`}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Cadastre algo pra voltar sozinho toda semana, tipo &quot;passar o estoque&quot;.
            </p>
          </div>
          <span className="text-neutral-400">{showRecorrentes ? "▲" : "▼"}</span>
        </button>

        {showRecorrentes && (
          <div className="space-y-4 border-t border-neutral-100 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              <input
                value={recTitulo}
                onChange={(e) => setRecTitulo(e.target.value)}
                placeholder="Ex: Passar estoque dos itens principais"
                className="min-w-[220px] flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <select
                value={recDia}
                onChange={(e) => setRecDia(Number(e.target.value))}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                {DIAS_SEMANA.map((dia, i) => (
                  <option key={dia} value={i}>
                    {dia}
                  </option>
                ))}
              </select>
              <select
                value={recResponsavel}
                onChange={(e) => setRecResponsavel(e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                <option value="">Sem responsável fixo</option>
                {FUNCIONARIOS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddRecorrente}
                disabled={savingRec || !recTitulo.trim()}
                className="brand-gradient rounded-md px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand/20 disabled:opacity-50"
              >
                Criar
              </button>
            </div>

            {recorrentes.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma tarefa recorrente cadastrada.</p>
            ) : (
              <div className="space-y-2">
                {recorrentes.map((rec) => (
                  <div
                    key={rec.id}
                    className={`flex flex-wrap items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-2.5 ${
                      !rec.ativo ? "opacity-50" : ""
                    }`}
                  >
                    <span className="flex-1 text-sm text-neutral-800">{rec.titulo}</span>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-neutral-600">
                      Toda {DIAS_SEMANA[rec.diaSemana]}
                    </span>
                    {rec.responsavel && (
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-neutral-600">
                        {rec.responsavel}
                      </span>
                    )}
                    <button
                      onClick={() => toggleRecorrenteAtivo(rec)}
                      className="text-xs font-medium text-neutral-500 hover:text-brand"
                    >
                      {rec.ativo ? "Pausar" : "Reativar"}
                    </button>
                    <button
                      onClick={() => handleDeleteRecorrente(rec.id)}
                      className="text-xs text-neutral-400 hover:text-red-600"
                    >
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
