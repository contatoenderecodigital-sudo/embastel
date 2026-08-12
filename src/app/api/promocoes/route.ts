import { NextRequest, NextResponse } from "next/server";
import { listPromocoes, addPromocao } from "@/lib/promocoesDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const promocoes = await listPromocoes();
  return NextResponse.json({ promocoes });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.produto?.trim() || !body.promptGerado?.trim()) {
    return NextResponse.json({ error: "Produto e prompt são obrigatórios" }, { status: 400 });
  }
  const promocao = await addPromocao({
    produto: body.produto.trim(),
    precoAntigo: Number(body.precoAntigo) || 0,
    precoNovo: Number(body.precoNovo) || 0,
    destaque: body.destaque?.trim() || "",
    promptGerado: body.promptGerado.trim(),
  });
  return NextResponse.json(promocao, { status: 201 });
}
