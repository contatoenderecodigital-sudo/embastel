import { NextRequest, NextResponse } from "next/server";
import { deleteCliente, updateCliente } from "@/lib/clientesDb";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const cliente = await updateCliente(id, {
    nome: body.nome?.trim(),
    razaoSocial: body.razaoSocial !== undefined ? body.razaoSocial?.trim() || null : undefined,
    cnpj: body.cnpj !== undefined ? body.cnpj?.trim() || null : undefined,
    endereco: body.endereco !== undefined ? body.endereco?.trim() || null : undefined,
    cidade: body.cidade?.trim(),
    telefone: body.telefone !== undefined ? body.telefone?.trim() || null : undefined,
    formaPagamentoPadrao: body.formaPagamentoPadrao !== undefined ? body.formaPagamentoPadrao || null : undefined,
    observacao: body.observacao !== undefined ? body.observacao?.trim() || null : undefined,
  });
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
  return NextResponse.json(cliente);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteCliente(id);
  return NextResponse.json({ ok: true });
}
