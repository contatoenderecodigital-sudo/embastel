import { NextResponse } from "next/server";
import { lerEstado, publicar } from "@/lib/deployDb";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await lerEstado());
}

export async function POST() {
  const r = await publicar();
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 409 });
  return NextResponse.json({ ok: true, estado: await lerEstado() });
}
