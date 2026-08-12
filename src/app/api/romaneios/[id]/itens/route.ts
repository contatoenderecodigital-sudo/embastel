import { NextRequest, NextResponse } from "next/server";
import { addItemRomaneio } from "@/lib/romaneiosDb";
import { listClientes } from "@/lib/clientesDb";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  if (!body.clienteId) {
    return NextResponse.json({ error: "Escolhe o cliente" }, { status: 400 });
  }
  const clientes = await listClientes();
  const cliente = clientes.find((c) => c.id === body.clienteId);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
  const formaPagamento = ["dinheiro", "pix", "cheque", "boleto"].includes(body.formaPagamento)
    ? body.formaPagamento
    : "dinheiro";
  const romaneio = await addItemRomaneio(id, {
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    cidade: cliente.cidade,
    valor: Number(body.valor) || 0,
    formaPagamento,
    observacao: body.observacao?.trim() || null,
  });
  if (!romaneio) {
    return NextResponse.json({ error: "Romaneio não encontrado." }, { status: 404 });
  }
  return NextResponse.json(romaneio, { status: 201 });
}
