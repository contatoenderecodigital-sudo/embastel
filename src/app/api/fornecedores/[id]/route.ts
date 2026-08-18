import { NextRequest, NextResponse } from "next/server";
import { deleteFornecedor, updateFornecedor } from "@/lib/fornecedoresDb";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fornecedor = await updateFornecedor(id, await request.json());
  if (!fornecedor) {
    return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ fornecedor });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteFornecedor(id);
  return NextResponse.json({ ok: true });
}
