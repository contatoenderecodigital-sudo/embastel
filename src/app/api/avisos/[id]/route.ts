import { NextRequest, NextResponse } from "next/server";
import { removeNotice } from "@/lib/noticesDb";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await removeNotice(id);
  return NextResponse.json({ ok: true });
}
