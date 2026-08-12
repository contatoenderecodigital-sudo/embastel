import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppText } from "@/lib/whatsappApi";
import {
  appendOutgoingMessage,
  setConversationAiEnabled,
  setNeedsAttention,
} from "@/lib/whatsappDb";

export async function POST(request: NextRequest) {
  const { to, text } = (await request.json()) as { to?: string; text?: string };

  if (!to || !text) {
    return NextResponse.json(
      { error: "Informe 'to' (número) e 'text' (mensagem)." },
      { status: 400 }
    );
  }

  try {
    const result = await sendWhatsAppText(to, text);
    const messageId = result?.messages?.[0]?.id ?? `local-${Date.now()}`;
    await appendOutgoingMessage(to, {
      id: messageId,
      direction: "out",
      text,
      timestamp: Date.now(),
      status: "sent",
      origin: "human",
    });
    // Você assumiu a conversa manualmente: a IA para de responder aqui
    // até você reativá-la (evita ela e você responderem ao mesmo tempo).
    await setConversationAiEnabled(to, false);
    await setNeedsAttention(to, null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
