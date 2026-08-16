import { NextRequest, NextResponse } from "next/server";
import {
  addItem,
  atribuirEmLote,
  estaVencido,
  listConferencias,
  listItens,
  listResponsaveisELocais,
  salvarConferencia,
  type Periodicidade,
} from "@/lib/conferenciaDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const [itens, conferencias, sugestoes] = await Promise.all([
    listItens(),
    listConferencias(),
    listResponsaveisELocais(),
  ]);
  const agora = Date.now();
  const ativos = itens.filter((i) => i.ativo);

  // Quantos itens vencidos cada pessoa tem hoje — é o número que ela quer ver
  // ao chegar, antes de sair andando pelo depósito.
  const porResponsavel = new Map<string, { total: number; vencidos: number }>();
  for (const item of ativos) {
    const chave = item.responsavel || "";
    const atual = porResponsavel.get(chave) ?? { total: 0, vencidos: 0 };
    atual.total += 1;
    if (estaVencido(item, agora)) atual.vencidos += 1;
    porResponsavel.set(chave, atual);
  }

  return NextResponse.json({
    itens: itens.map((item) => ({ ...item, vencido: estaVencido(item, agora) })),
    conferencias: conferencias.slice(0, 20),
    responsaveis: sugestoes.responsaveis,
    locais: sugestoes.locais,
    porResponsavel: [...porResponsavel.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    resumo: {
      total: ativos.length,
      vencidosHoje: itens.filter((i) => estaVencido(i, agora)).length,
      semanais: ativos.filter((i) => i.periodicidade === "semanal").length,
      quinzenais: ativos.filter((i) => i.periodicidade === "quinzenal").length,
      semResponsavel: ativos.filter((i) => !i.responsavel).length,
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
    responsavel?: string | null;
    local?: string | null;
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
    responsavel: body.responsavel ?? null,
    local: body.local ?? null,
    quantidadeIdeal: body.quantidadeIdeal ?? null,
  });
  return NextResponse.json({ item }, { status: 201 });
}

/** Atribuição em massa: marca responsável e/ou local de vários itens. */
export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as {
    ids?: string[];
    responsavel?: string | null;
    local?: string | null;
  };
  if (!body.ids?.length) {
    return NextResponse.json({ error: "Nenhum item selecionado." }, { status: 400 });
  }
  const alterados = await atribuirEmLote({
    ids: body.ids,
    responsavel: body.responsavel,
    local: body.local,
  });
  return NextResponse.json({ alterados });
}
