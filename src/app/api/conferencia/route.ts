import { NextRequest, NextResponse } from "next/server";
import { listProdutos, reporDaConferencia } from "@/lib/estoqueDb";
import {
  RESPONSAVEIS,
  addItem,
  atribuirEmLote,
  distribuirQuinzenais,
  estaVencido,
  listConferencias,
  listItens,
  listLocais,
  salvarConferencia,
  type Periodicidade,
} from "@/lib/conferenciaDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const [itens, conferencias, locais, produtosEstoque] = await Promise.all([
    listItens(),
    listConferencias(),
    listLocais(),
    listProdutos(),
  ]);

  // Fornecedores que já existem em algum lugar da casa: os do estoque mais os
  // que já foram digitados na própria conferência. Serve de sugestão pra que
  // "Ibras" e "ibras" não virem dois fornecedores e partam o pedido em dois.
  const fornecedores = [
    ...new Set(
      [
        ...produtosEstoque.map((p) => p.fornecedor),
        ...itens.map((i) => i.fornecedor),
      ]
        .map((f) => (f ?? "").trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const agora = Date.now();
  const ativos = itens.filter((i) => i.ativo);

  // Quantos itens vencidos cada pessoa tem hoje — é o número que ela quer ver
  // ao chegar, antes de sair andando pelo depósito.
  // Começa com as duas pessoas zeradas: os botões de filtro precisam aparecer
  // já na primeira vez, antes de qualquer item ter dono.
  const porResponsavel = new Map<string, { total: number; vencidos: number }>(
    RESPONSAVEIS.map((nome) => [nome, { total: 0, vencidos: 0 }])
  );
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
    responsaveis: [...RESPONSAVEIS],
    locais,
    fornecedores,
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
    acao?: "novo_item" | "salvar_conferencia" | "distribuir_quinzenais";
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

  if (body.acao === "distribuir_quinzenais") {
    return NextResponse.json(await distribuirQuinzenais());
  }

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

    // Contou abaixo do ideal, vira linha de pedido na aba Estoque, já no
    // fornecedor certo. Feito aqui e não dentro de salvarConferencia pra que
    // a conferência não dependa do estoque pra ser gravada: se a reposição
    // falhar, a contagem — que é o dado que não pode se perder — já está salva.
    let reposicao = { criados: 0, atualizados: 0 };
    try {
      reposicao = await reporDaConferencia(
        conferencia.itens.map((i) => ({
          nome: i.descricao,
          fornecedor: i.fornecedor,
          quantidade: i.quantidade,
          quantidadeIdeal: i.quantidadeIdeal,
        }))
      );
    } catch {
      // silencioso: a contagem está gravada, e o estoque se resolve na próxima
    }

    return NextResponse.json({ conferencia, reposicao }, { status: 201 });
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
