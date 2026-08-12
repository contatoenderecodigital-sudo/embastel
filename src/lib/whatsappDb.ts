import { jsonStore } from "./jsonStore";

export type WhatsAppMessage = {
  id: string;
  direction: "in" | "out";
  text: string;
  timestamp: number;
  status?: "sent" | "delivered" | "read" | "failed" | "received";
  origin?: "human" | "ai";
};

export type Conversation = {
  waId: string;
  name?: string;
  lastMessageAt: number;
  messages: WhatsAppMessage[];
  aiEnabled?: boolean;
  needsAttention?: boolean;
  needsAttentionReason?: string;
};

export type WhatsAppData = {
  conversations: Record<string, Conversation>;
};

const store = jsonStore<WhatsAppData>("whatsapp.json", { conversations: {} });

export async function upsertIncomingMessage(
  waId: string,
  name: string | undefined,
  message: WhatsAppMessage
) {
  return store.update((data) => {
    const conversation = data.conversations[waId] ?? {
      waId,
      name,
      lastMessageAt: 0,
      messages: [],
    };
    if (name) conversation.name = name;
    conversation.messages.push(message);
    conversation.lastMessageAt = message.timestamp;
    data.conversations[waId] = conversation;
    return conversation;
  });
}

export async function appendOutgoingMessage(
  waId: string,
  message: WhatsAppMessage
) {
  return store.update((data) => {
    const conversation = data.conversations[waId] ?? {
      waId,
      lastMessageAt: 0,
      messages: [],
    };
    conversation.messages.push(message);
    conversation.lastMessageAt = message.timestamp;
    data.conversations[waId] = conversation;
    return conversation;
  });
}

export async function getConversation(
  waId: string
): Promise<Conversation | undefined> {
  const data = await store.read();
  return data.conversations[waId];
}

export async function setConversationAiEnabled(waId: string, enabled: boolean) {
  await store.update((data) => {
    const conversation = data.conversations[waId];
    if (!conversation) return;
    conversation.aiEnabled = enabled;
  });
}

export async function setNeedsAttention(waId: string, reason: string | null) {
  await store.update((data) => {
    const conversation = data.conversations[waId];
    if (!conversation) return;
    conversation.needsAttention = reason !== null;
    conversation.needsAttentionReason = reason ?? undefined;
  });
}

export async function listConversations() {
  const data = await store.read();
  return Object.values(data.conversations).sort((a, b) => {
    if (!!a.needsAttention !== !!b.needsAttention) {
      return a.needsAttention ? -1 : 1;
    }
    return b.lastMessageAt - a.lastMessageAt;
  });
}
