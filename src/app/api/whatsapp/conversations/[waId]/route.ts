import { NextRequest, NextResponse } from "next/server";
import { setConversationAiEnabled, setNeedsAttention } from "@/lib/whatsappDb";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ waId: string }> }
) {
  const { waId } = await params;
  const { aiEnabled } = (await request.json()) as { aiEnabled?: boolean };

  if (typeof aiEnabled === "boolean") {
    await setConversationAiEnabled(waId, aiEnabled);
    if (aiEnabled) {
      await setNeedsAttention(waId, null);
    }
  }

  return NextResponse.json({ ok: true });
}
