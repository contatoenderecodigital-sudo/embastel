import { NextRequest, NextResponse } from "next/server";
import { listClientes, addCliente, FORMAS_PAGAMENTO } from "@/lib/clientesDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientes = await listClientes();
  return NextResponse.json({ clientes });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.nome?.trim() || !body.cidade?.trim()) {
    return NextResponse.json(
      { error: "Nome e cidade são obrigatórios" },
      { status: 400 }
    );
  }
  const cliente = await addCliente({
    nome: body.nome.trim(),
    cidade: body.cidade.trim(),
    razaoSocial: body.razaoSocial?.trim() || null,
    cnpj: body.cnpj?.trim() || null,
    endereco: body.endereco?.trim() || null,
    telefone: body.telefone?.trim() || null,
    formaPagamentoPadrao: FORMAS_PAGAMENTO.includes(body.formaPagamentoPadrao)
      ? body.formaPagamentoPadrao
      : null,
    observacao: body.observacao?.trim() || null,
  });
  return NextResponse.json(cliente, { status: 201 });
}
