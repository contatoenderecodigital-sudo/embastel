import { NextRequest, NextResponse } from "next/server";
import { listPedidos, updatePedido } from "@/lib/pedidosDb";
import { addItemRomaneio, addRomaneio, listRomaneios } from "@/lib/romaneiosDb";

export const dynamic = "force-dynamic";

// Transforma os pedidos em aberto num romaneio de entrega.
//
// É o fluxo que o usuário descreveu em 13/08/2026: os pedidos vão sendo
// anotados na rota e ficam acumulando; quando ele manda gerar o romaneio,
// esses pedidos "saem" da lista de em aberto e passam a ser a carga do dia.
// Nada é apagado — cada pedido guarda o romaneioId de onde foi parar.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    data?: string;
    // Quando não vier, entram todos os pedidos em aberto.
    pedidoIds?: string[];
    observacao?: string | null;
  };

  const data = body.data ?? new Date().toISOString().slice(0, 10);

  const pedidos = await listPedidos();
  const emAberto = pedidos.filter(
    (p) => p.status === "pendente" && !p.romaneioId
  );
  const selecionados = body.pedidoIds?.length
    ? emAberto.filter((p) => body.pedidoIds!.includes(p.id))
    : emAberto;

  if (!selecionados.length) {
    return NextResponse.json(
      { error: "Nenhum pedido em aberto pra colocar no romaneio." },
      { status: 400 }
    );
  }

  // Reaproveita o romaneio daquele dia se já existir — senão criar dois pela
  // mesma data deixaria a carga dividida em dois papéis.
  const existentes = await listRomaneios();
  const romaneio =
    existentes.find((r) => r.data === data) ??
    (await addRomaneio({ data, observacao: body.observacao ?? null }));

  for (const pedido of selecionados) {
    await addItemRomaneio(romaneio.id, {
      clienteId: pedido.clienteId,
      clienteNome: pedido.clienteNome,
      cidade: pedido.cidade,
      valor: pedido.valorTotal,
      formaPagamento: pedido.formaPagamento,
      observacao: pedido.observacao,
    });
    await updatePedido(pedido.id, { romaneioId: romaneio.id });
  }

  return NextResponse.json({
    romaneioId: romaneio.id,
    data: romaneio.data,
    pedidosIncluidos: selecionados.length,
    valorTotal:
      Math.round(selecionados.reduce((s, p) => s + p.valorTotal, 0) * 100) / 100,
  });
}
