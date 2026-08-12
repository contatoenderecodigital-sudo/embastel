import { NextRequest, NextResponse } from "next/server";
import { listRomaneios, addRomaneio } from "@/lib/romaneiosDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const romaneios = await listRomaneios();
  return NextResponse.json({ romaneios });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.data) {
    return NextResponse.json({ error: "Data do romaneio é obrigatória" }, { status: 400 });
  }
  const romaneio = await addRomaneio({
    data: body.data,
    observacao: body.observacao?.trim() || null,
  });
  return NextResponse.json(romaneio, { status: 201 });
}
