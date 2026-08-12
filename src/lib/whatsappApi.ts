const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Faltando a variável de ambiente ${name}. Configure-a em .env.local.`
    );
  }
  return value;
}

export async function sendWhatsAppText(to: string, body: string) {
  const token = requireEnv("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body },
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Erro ao enviar mensagem no WhatsApp: ${JSON.stringify(data)}`
    );
  }
  return data;
}
