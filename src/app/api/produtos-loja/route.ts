import { NextRequest, NextResponse } from "next/server";
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
  const achados = await buscarProdutosLoja(termo);
  return NextResponse.json({
    produtos: achados.map((p) => ({
      ...p,
      precoSugerido: precoSugerido(p.custo),
      precoMinimo: precoMinimo(p.custo),
    })),
  });
}

export async function POST(request: NextRequest) {
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
