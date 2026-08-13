import { NextResponse } from "next/server";
import { excluirPagamento } from "@/lib/comissoesDb";

export const dynamic = "force-dynamic";

// Desfaz um pagamento registrado por engano — o valor volta pro saldo devido.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await excluirPagamento(id);
  return NextResponse.json({ ok: true });
}
