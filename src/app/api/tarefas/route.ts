import { NextRequest, NextResponse } from "next/server";
import { addTask, listTasks, type Priority } from "@/lib/tasksDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const tasks = await listTasks();
  return NextResponse.json({ tasks });
}

const VALID_PRIORITIES: Priority[] = ["alta", "media", "baixa"];

export async function POST(request: NextRequest) {
  const { title, priority, responsavel } = (await request.json()) as {
    title?: string;
    priority?: string;
    responsavel?: string;
  };

  if (!title || !title.trim()) {
    return NextResponse.json(
      { error: "Informe um título para a tarefa." },
      { status: 400 }
    );
  }
  const finalPriority: Priority = VALID_PRIORITIES.includes(priority as Priority)
    ? (priority as Priority)
    : "media";

  const task = await addTask(title.trim(), finalPriority, responsavel?.trim() || null);
  return NextResponse.json({ task });
}
