import { NextRequest, NextResponse } from "next/server";
import {
  addItem,
  estaVencido,
  listConferencias,
  listItens,
  salvarConferencia,
  type Periodicidade,
} from "@/lib/conferenciaDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const [itens, conferencias] = await Promise.all([listItens(), listConferencias()]);
  const agora = Date.now();

  return NextResponse.json({
    itens: itens.map((item) => ({ ...item, vencido: estaVencido(item, agora) })),
    conferencias: conferencias.slice(0, 20),
    resumo: {
      total: itens.filter((i) => i.ativo).length,
      vencidosHoje: itens.filter((i) => estaVencido(i, agora)).length,
      semanais: itens.filter((i) => i.ativo && i.periodicidade === "semanal").length,
      quinzenais: itens.filter((i) => i.ativo && i.periodicidade === "quinzenal").length,
    },
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    acao?: "novo_item" | "salvar_conferencia";
    // novo item
    codigo?: string;
    descricao?: string;
    periodicidade?: Periodicidade;
    quantidadeIdeal?: number | null;
    // conferência
    data?: string;
    conferidoPor?: string | null;
    observacao?: string | null;
    contagens?: Array<{ itemId: string; quantidade: number }>;
  };

  if (body.acao === "salvar_conferencia") {
    if (!body.contagens?.length) {
      return NextResponse.json(
        { error: "Nenhuma quantidade foi preenchida." },
        { status: 400 }
      );
    }
    const conferencia = await salvarConferencia({
      data: body.data ?? new Date().toISOString().slice(0, 10),
      conferidoPor: body.conferidoPor ?? null,
      observacao: body.observacao ?? null,
      contagens: body.contagens,
    });
    return NextResponse.json({ conferencia }, { status: 201 });
  }

  if (!body.descricao?.trim()) {
    return NextResponse.json({ error: "Descrição é obrigatória." }, { status: 400 });
  }

  const item = await addItem({
    codigo: body.codigo ?? null,
    descricao: body.descricao,
    periodicidade: body.periodicidade ?? "semanal",
    quantidadeIdeal: body.quantidadeIdeal ?? null,
  });
  return NextResponse.json({ item }, { status: 201 });
}
