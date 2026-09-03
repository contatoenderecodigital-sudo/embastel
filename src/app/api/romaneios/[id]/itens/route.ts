import { NextRequest, NextResponse } from "next/server";
import { addItemRomaneio } from "@/lib/romaneiosDb";
import { listClientes } from "@/lib/clientesDb";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  // Duas formas de entrar na carga: escolhendo do cadastro, ou digitando o
  // nome. O cadastro continua sendo o caminho bom — traz a cidade junto e
  // amarra o item ao cliente —, mas exigi-lo fazia o romaneio parar quando
  // aparecia gente nova, e item não lançado é entrega sem cobrança.
  const nomeDigitado = String(body.clienteNome ?? "").trim();
  if (!body.clienteId && !nomeDigitado) {
    return NextResponse.json(
      { error: "Escolha o cliente ou digite o nome." },
      { status: 400 }
    );
  }

  let cliente: { id: string; nome: string; cidade: string } | null = null;
  if (body.clienteId) {
    const clientes = await listClientes();
    const achado = clientes.find((c) => c.id === body.clienteId);
    if (!achado) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }
    cliente = { id: achado.id, nome: achado.nome, cidade: achado.cidade };
  }
  const formaPagamento = ["dinheiro", "pix", "cheque", "boleto"].includes(body.formaPagamento)
    ? body.formaPagamento
    : "dinheiro";
  const romaneio = await addItemRomaneio(id, {
    clienteId: cliente?.id ?? "",
    clienteNome: cliente?.nome ?? nomeDigitado,
    cidade: cliente?.cidade ?? String(body.cidade ?? "").trim(),
    valor: Number(body.valor) || 0,
    formaPagamento,
    observacao: body.observacao?.trim() || null,
  });
  if (!romaneio) {
    return NextResponse.json({ error: "Romaneio não encontrado." }, { status: 404 });
  }
  return NextResponse.json(romaneio, { status: 201 });
}
