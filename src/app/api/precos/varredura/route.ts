import { NextResponse } from "next/server";
import { avancarVarredura } from "@/lib/itensCollector";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Empurra a varredura à mão, pra quem não quer esperar o ritmo automático.
export async function POST() {
  const resultado = await avancarVarredura(45_000);
  return NextResponse.json(resultado);
}
