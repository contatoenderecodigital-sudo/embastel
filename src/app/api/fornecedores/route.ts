import { NextRequest, NextResponse } from "next/server";
import { listFornecedores, addFornecedor } from "@/lib/fornecedoresDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const fornecedores = await listFornecedores();
  return NextResponse.json({ fornecedores });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.nome?.trim()) {
    return NextResponse.json({ error: "Nome do fornecedor é obrigatório" }, { status: 400 });
  }
  const fornecedor = await addFornecedor(body.nome.trim());
  return NextResponse.json(fornecedor, { status: 201 });
}
