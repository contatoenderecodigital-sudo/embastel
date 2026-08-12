import { NextRequest, NextResponse } from "next/server";
import {
  appendOutgoingMessage,
  setNeedsAttention,
  upsertIncomingMessage,
} from "@/lib/whatsappDb";
import { getSettings } from "@/lib/settingsDb";
import { listNotices } from "@/lib/noticesDb";
import { decideAiReply } from "@/lib/aiReply";
import { sendWhatsAppText } from "@/lib/whatsappApi";

// Verificação do webhook exigida pela Meta ao cadastrar a URL no app do WhatsApp Business.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
      };
    }>;
  }>;
};

// Depois de guardar a mensagem recebida, decide se a IA responde sozinha
// ou se marca a conversa como "precisa de você" (nunca as duas coisas).
async function maybeAutoReply(
  waId: string,
  customerMessage: string,
  history: Parameters<typeof decideAiReply>[0]["history"],
  conversationAiEnabled: boolean | undefined
) {
  const settings = await getSettings();
  if (!settings.aiAutoReplyEnabled) return;
  if (conversationAiEnabled === false) return;

  try {
    const notices = (await listNotices()).map((n) => n.text);
    const decision = await decideAiReply({ customerMessage, history, notices });

    if (decision.action === "reply") {
      await sendWhatsAppText(waId, decision.message);
      await appendOutgoingMessage(waId, {
        id: `ai-${Date.now()}`,
        direction: "out",
        text: decision.message,
        timestamp: Date.now(),
        status: "sent",
        origin: "ai",
      });
      await setNeedsAttention(waId, null);
    } else {
      await setNeedsAttention(waId, decision.reason);
    }
  } catch (error) {
    await setNeedsAttention(
      waId,
      `Erro ao consultar a IA: ${error instanceof Error ? error.message : "desconhecido"}`
    );
  }
}

// Recebe mensagens novas enviadas pelos clientes via WhatsApp.
export async function POST(request: NextRequest) {
  const payload = (await request.json()) as WhatsAppWebhookPayload;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contact = value?.contacts?.[0];
      for (const message of value?.messages ?? []) {
        const text = message.text?.body ?? `[mensagem do tipo ${message.type}]`;
        const conversation = await upsertIncomingMessage(
          message.from,
          contact?.profile?.name,
          {
            id: message.id,
            direction: "in",
            text,
            timestamp: Number(message.timestamp) * 1000,
            status: "received",
          }
        );

        await maybeAutoReply(
          message.from,
          text,
          conversation.messages.slice(0, -1),
          conversation.aiEnabled
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
