import { NextResponse } from "next/server";
import { avancarBackfill, lerStatusBackfill, reiniciarBackfill } from "@/lib/precosBackfill";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ historico: await lerStatusBackfill() });
}

export async function POST() {
  return NextResponse.json(await avancarBackfill(45_000));
}

/** Recomeça do mês mais recente — útil se as palavras-chave mudarem. */
export async function DELETE() {
  await reiniciarBackfill();
  return NextResponse.json({ ok: true });
}
