import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, perfilDoToken } from "@/lib/sessao";
import {
  buscarProdutosLoja,
  importarProdutosLoja,
  precoMinimo,
  precoSugerido,
  statusImportacao,
} from "@/lib/produtosLojaDb";

export const dynamic = "force-dynamic";
// A importação manda o catálogo inteiro num POST só; o tempo padrão não cobre.
export const maxDuration = 60;

/**
 * Busca produtos, já com o preço sugerido e o mínimo calculados.
 *
 * As contas vêm do servidor pra que o celular não precise saber a regra: se
 * um dia o markup mudar, muda num lugar só e todo mundo passa a ver o número
 * novo sem atualizar nada.
 */
export async function GET(request: NextRequest) {
  const termo = request.nextUrl.searchParams.get("q") ?? "";
  if (!termo.trim()) {
    return NextResponse.json({ produtos: [], ...(await statusImportacao()) });
  }

  // O custo NÃO desce pro celular da vendedora.
  //
  // Ela precisa do mínimo pra saber até onde pode negociar, e o mínimo já é
  // calculado aqui — mandar o custo junto seria dar o número mais sensível da
  // empresa a um aparelho que fica no carro e no balcão do cliente, sem que
  // isso ajudasse em nada na venda. Some do JSON, não só da tela: quem abre o
  // navegador de um celular vê a resposta crua.
  const perfil = await perfilDoToken(request.cookies.get(COOKIE_SESSAO)?.value);
  const escondeCusto = perfil === "vendedora";

  const achados = await buscarProdutosLoja(termo);
  return NextResponse.json({
    produtos: achados.map((p) => {
      const linha = {
        codigo: p.codigo,
        descricao: p.descricao,
        unidade: p.unidade,
        precoVenda: p.precoVenda,
        precoSugerido: precoSugerido(p.custo),
        precoMinimo: precoMinimo(p.custo),
      };
      return escondeCusto ? linha : { ...linha, custo: p.custo };
    }),
  });
}

export async function POST(request: NextRequest) {
  // Importar catálogo é trabalho de escritório, e traz custo dentro. Mesmo que
  // a rota esteja liberada pra ela buscar produto, gravar não é o caso dela.
  if ((await perfilDoToken(request.cookies.get(COOKIE_SESSAO)?.value)) === "vendedora") {
    return NextResponse.json(
      { error: "Importar o catálogo não faz parte do seu acesso." },
      { status: 403 }
    );
  }

  const body = await request.json();
  if (!Array.isArray(body?.produtos)) {
    return NextResponse.json(
      { error: "Mande a lista de produtos em `produtos`." },
      { status: 400 }
    );
  }
  const r = await importarProdutosLoja(body.produtos);
  return NextResponse.json({ ...r, ...(await statusImportacao()) });
}
