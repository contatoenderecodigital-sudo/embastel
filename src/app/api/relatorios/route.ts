import { NextRequest, NextResponse } from "next/server";
import { montarRelatorio } from "@/lib/relatorios";
import type { Periodo } from "@/lib/relatorios";

export const dynamic = "force-dynamic";

const PERIODOS_ACEITOS = [30, 90, 180, 365, 0];

export async function GET(request: NextRequest) {
  const bruto = Number(request.nextUrl.searchParams.get("dias") ?? 180);
  const dias = (PERIODOS_ACEITOS.includes(bruto) ? bruto : 180) as Periodo;
  return NextResponse.json(await montarRelatorio(dias));
}
