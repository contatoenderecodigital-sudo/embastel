import { NextRequest, NextResponse } from "next/server";
import {
  excluirCotacao,
  listCotacoes,
  registrarCotacao,
  resumoCotacoes,
} from "@/lib/cotacoesDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const [cotacoes, resumo] = await Promise.all([listCotacoes(), resumoCotacoes()]);
  return NextResponse.json({ cotacoes, resumo });
}

/** Cotação avulsa — a que não veio de nenhum edital. */
export async function POST(request: NextRequest) {
  const cotacao = await registrarCotacao(await request.json());
  if (!cotacao) {
    return NextResponse.json(
      { error: "Precisa de produto, fornecedor e preço." },
      { status: 400 }
    );
  }
  return NextResponse.json({ cotacao }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta o id." }, { status: 400 });
  await excluirCotacao(id);
  return NextResponse.json({ ok: true });
}
