import { NextRequest, NextResponse } from "next/server";
import { listProdutos, addProduto } from "@/lib/estoqueDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const produtos = await listProdutos();
  return NextResponse.json({ produtos });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.nome?.trim() || !body.fornecedor?.trim()) {
    return NextResponse.json(
      { error: "Nome do produto e fornecedor são obrigatórios" },
      { status: 400 }
    );
  }
  const produto = await addProduto({
    nome: body.nome.trim(),
    fornecedor: body.fornecedor.trim(),
    situacao: body.situacao ?? "falta",
    quantidadeSugerida:
      body.quantidadeSugerida != null && body.quantidadeSugerida !== ""
        ? Number(body.quantidadeSugerida)
        : null,
    observacao: body.observacao?.trim() || null,
  });
  return NextResponse.json(produto, { status: 201 });
}
