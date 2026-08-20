import { NextRequest, NextResponse } from "next/server";
import {
  excluirCotacao,
  listCotacoes,
  registrarCotacao,
  resumoCotacoes,
} from "@/lib/cotacoesDb";
import { listFornecedoresLicitacao } from "@/lib/fornecedoresLicitacaoDb";
import { normalizarTexto } from "@/lib/textoUtils";

export const dynamic = "force-dynamic";

export async function GET() {
  const [cotacoes, resumo, fornecedores] = await Promise.all([
    listCotacoes(),
    resumoCotacoes(),
    listFornecedoresLicitacao(),
  ]);

  // O telefone de quem cotou vem junto: a lista existe pra decidir pra quem
  // ligar, e ter que abrir outra tela pra achar o número quebra o uso.
  // Cruzamento pelo nome, que é o que a planilha de disputa grava — sem id,
  // porque o campo é texto livre e nem todo fornecedor cotado está na agenda.
  const agenda = new Map(
    fornecedores.map((f) => [normalizarTexto(f.nome), f])
  );

  return NextResponse.json({
    resumo,
    cotacoes: cotacoes.map((c) => {
      const f = agenda.get(normalizarTexto(c.fornecedor));
      return {
        ...c,
        telefone: f?.telefone ?? "",
        contato: f?.contato ?? "",
        naAgenda: Boolean(f),
      };
    }),
    fornecedoresConhecidos: fornecedores.map((f) => f.nome),
  });
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
