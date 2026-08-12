import Anthropic from "@anthropic-ai/sdk";
import type { WhatsAppMessage } from "@/lib/whatsappDb";

// Haiku 4.5: o modelo mais em conta da Anthropic, suficiente para
// responder perguntas simples de atendimento (horário, endereço, catálogo).
const MODEL = "claude-haiku-4-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Faltando a variável de ambiente ANTHROPIC_API_KEY. Configure-a em .env.local."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export type AiDecision =
  | { action: "reply"; message: string }
  | { action: "escalate"; reason: string };

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["reply", "escalate"] },
    message: {
      type: "string",
      description:
        "Resposta a ser enviada ao cliente no WhatsApp. Só preencher quando action for 'reply'.",
    },
    reason: {
      type: "string",
      description:
        "Motivo curto para um humano assumir a conversa. Só preencher quando action for 'escalate'.",
    },
  },
  required: ["action"],
  additionalProperties: false,
} as const;

function buildSystemPrompt(notices: string[]): string {
  const noticesText = notices.length
    ? notices.map((n) => `- ${n}`).join("\n")
    : "(nenhum aviso cadastrado hoje)";

  return `Você é o atendimento automático de WhatsApp da Embastel Embalagens, distribuidora de embalagens, descartáveis, produtos de festa e confeitaria em Xanxerê/SC.

Responda de forma curta, educada e direta, em português do Brasil. Baseie-se apenas nas informações abaixo — nunca invente preço, prazo de entrega ou disponibilidade de estoque que não estejam aqui.

Avisos de hoje (cadastrados pela loja):
${noticesText}

Escolha action="reply" quando a pergunta puder ser respondida com segurança usando essas informações, ou for algo genérico (horário de funcionamento, endereço, formas de contato, o que a loja vende em geral).

Escolha action="escalate" (com um motivo curto) quando envolver: preço específico de um item, negociação, reclamação, pedido de nota fiscal/boleto, ou qualquer pergunta que você não tenha certeza de responder corretamente. Nesse caso um humano da Embastel vai assumir a conversa — não invente uma resposta só para parecer útil.`;
}

function buildUserContent(customerMessage: string, history: WhatsAppMessage[]): string {
  const historyText = history
    .slice(-10)
    .map((m) => `${m.direction === "in" ? "Cliente" : "Embastel"}: ${m.text}`)
    .join("\n");

  return `Histórico recente da conversa:\n${historyText || "(sem histórico anterior)"}\n\nNova mensagem do cliente:\n${customerMessage}`;
}

export async function decideAiReply(params: {
  customerMessage: string;
  history: WhatsAppMessage[];
  notices: string[];
}): Promise<AiDecision> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 400,
    system: buildSystemPrompt(params.notices),
    messages: [
      { role: "user", content: buildUserContent(params.customerMessage, params.history) },
    ],
    output_config: {
      format: { type: "json_schema", schema: RESPONSE_SCHEMA },
    },
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    return { action: "escalate", reason: "A IA não retornou uma resposta válida." };
  }

  const parsed = JSON.parse(textBlock.text) as {
    action: string;
    message?: string;
    reason?: string;
  };

  if (parsed.action === "reply" && parsed.message) {
    return { action: "reply", message: parsed.message };
  }
  return {
    action: "escalate",
    reason: parsed.reason ?? "A IA optou por não responder sozinha.",
  };
}
