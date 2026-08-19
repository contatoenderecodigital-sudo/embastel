import { NextRequest, NextResponse } from "next/server";
import {
  addFornecedorLicitacao,
  CATEGORIAS_SUGERIDAS,
  cotadoresParaTexto,
  importarDaLoja,
  listCategorias,
  listFornecedoresLicitacao,
  prontoParaCotar,
  UFS_SUGERIDAS,
} from "@/lib/fornecedoresLicitacaoDb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // ?para=<objeto do edital> devolve só quem cota aquilo.
  const para = request.nextUrl.searchParams.get("para");
  if (para) {
    return NextResponse.json({ atendem: await cotadoresParaTexto(para) });
  }

  const [fornecedores, categorias] = await Promise.all([
    listFornecedoresLicitacao(),
    listCategorias(),
  ]);
  return NextResponse.json({
    fornecedores,
    categorias,
    categoriasSugeridas: CATEGORIAS_SUGERIDAS,
    ufsSugeridas: UFS_SUGERIDAS,
    resumo: {
      total: fornecedores.length,
      prontos: fornecedores.filter(prontoParaCotar).length,
      confirmados: fornecedores.filter((f) => f.atendeLicitacao === "sim").length,
      aPerguntar: fornecedores.filter((f) => f.atendeLicitacao === "nao_sei").length,
      semTelefone: fornecedores.filter((f) => !f.telefone).length,
      semCategoria: fornecedores.filter((f) => f.categorias.length === 0).length,
      semPrazo: fornecedores.filter((f) => f.prazoEntregaDias == null).length,
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Um POST com {acao:"importar-da-loja"} copia a agenda da loja pra cá.
  if (body?.acao === "importar-da-loja") {
    return NextResponse.json(await importarDaLoja());
  }

  if (!body.nome?.trim()) {
    return NextResponse.json(
      { error: "Nome do fornecedor é obrigatório" },
      { status: 400 }
    );
  }
  return NextResponse.json(
    { fornecedor: await addFornecedorLicitacao(body) },
    { status: 201 }
  );
}
