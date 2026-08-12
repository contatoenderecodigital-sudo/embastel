import { NextRequest, NextResponse } from "next/server";
import { deleteFornecedor } from "@/lib/fornecedoresDb";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteFornecedor(id);
  return NextResponse.json({ ok: true });
}
