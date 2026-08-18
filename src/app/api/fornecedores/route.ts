import { NextRequest, NextResponse } from "next/server";
import {
  addFornecedor,
  CATEGORIAS_SUGERIDAS,
  fornecedoresParaTexto,
  listCategorias,
  listFornecedores,
} from "@/lib/fornecedoresDb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // ?para=<texto do edital> devolve só quem atende aquele objeto.
  const para = request.nextUrl.searchParams.get("para");
  if (para) {
    return NextResponse.json({ atendem: await fornecedoresParaTexto(para) });
  }

  const [fornecedores, categorias] = await Promise.all([
    listFornecedores(),
    listCategorias(),
  ]);
  return NextResponse.json({
    fornecedores,
    categorias,
    categoriasSugeridas: CATEGORIAS_SUGERIDAS,
    resumo: {
      total: fornecedores.length,
      semCategoria: fornecedores.filter((f) => f.categorias.length === 0).length,
      semTelefone: fornecedores.filter((f) => !f.telefone).length,
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.nome?.trim()) {
    return NextResponse.json(
      { error: "Nome do fornecedor é obrigatório" },
      { status: 400 }
    );
  }
  const fornecedor = await addFornecedor(body);
  return NextResponse.json({ fornecedor }, { status: 201 });
}
