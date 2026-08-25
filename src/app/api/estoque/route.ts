import { NextRequest, NextResponse } from "next/server";
import { itensParaRepor } from "@/lib/conferenciaDb";
import { listProdutos, addProduto, reporDaConferencia } from "@/lib/estoqueDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const produtos = await listProdutos();
  return NextResponse.json({ produtos });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Traz pro estoque tudo que a conferência já tem abaixo do ideal, sem
  // esperar a próxima contagem. É o que faz o item contado semanas atrás — ou
  // que só ganhou fornecedor depois da contagem — aparecer aqui.
  if (body?.acao === "puxar_da_conferencia") {
    const pendentes = await itensParaRepor();
    const resultado = await reporDaConferencia(pendentes);
    return NextResponse.json({
      ...resultado,
      analisados: pendentes.length,
      produtos: await listProdutos(),
    });
  }

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
