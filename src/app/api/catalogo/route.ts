import { NextRequest, NextResponse } from "next/server";
import {
  calcularPrecos,
  criarProduto,
  listProdutosCatalogo,
} from "@/lib/catalogoDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const produtos = await listProdutosCatalogo();
  return NextResponse.json({
    produtos: produtos.map((p) => ({ ...p, precos: calcularPrecos(p) })),
  });
}

export async function POST(request: NextRequest) {
  const produto = await criarProduto(await request.json());
  return NextResponse.json({ produto }, { status: 201 });
}
