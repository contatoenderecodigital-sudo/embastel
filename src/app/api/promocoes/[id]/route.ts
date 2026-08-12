import { NextRequest, NextResponse } from "next/server";
import { deletePromocao } from "@/lib/promocoesDb";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deletePromocao(id);
  return NextResponse.json({ ok: true });
}
