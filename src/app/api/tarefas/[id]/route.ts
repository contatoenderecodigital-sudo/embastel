import { NextRequest, NextResponse } from "next/server";
import { deleteTask, updateTask } from "@/lib/tasksDb";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const updates = (await request.json()) as {
    done?: boolean;
    priority?: "alta" | "media" | "baixa";
    title?: string;
    responsavel?: string | null;
  };

  const task = await updateTask(id, updates);
  if (!task) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ task });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteTask(id);
  return NextResponse.json({ ok: true });
}
