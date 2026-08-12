import Anthropic from "@anthropic-ai/sdk";
import type { TrackedLicitacao } from "@/lib/licitacoesTrackingDb";

// Haiku 4.5: barato o bastante pra rodar em toda licitação acompanhada sem
// pesar no bolso.
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

// Resumo baseado nos dados públicos do PNCP (objeto, valor, prazo, órgão) —
// não lê o PDF do edital completo. O endpoint de arquivos do PNCP
// (/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos) se mostrou lento/
// instável em teste (timeout repetido), então não foi usado por enquanto.
export async function summarizeLicitacao(item: TrackedLicitacao): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 300,
    system: `Você ajuda a Embastel Embalagens (distribuidora de embalagens, descartáveis, produtos de festa, confeitaria e limpeza, em Xanxerê/SC) a avaliar rapidamente se vale a pena participar de uma licitação pública, com base só nos dados públicos do PNCP (sem acesso ao edital completo).

Responda em português, em no máximo 3 frases curtas e diretas: (1) o que está sendo comprado, em linguagem simples; (2) se parece algo que a Embastel poderia fornecer, e por quê; (3) um alerta prático se houver (prazo apertado, valor muito baixo/alto pro porte da empresa, ou falta de informação). Não invente detalhes que não estejam nos dados fornecidos.`,
    messages: [
      {
        role: "user",
        content: `Órgão: ${item.orgao}
Local: ${item.municipio}/${item.uf}
Modalidade: ${item.modalidade}
Objeto: ${item.objeto}
Valor estimado: ${
          item.valorEstimado
            ? `R$ ${item.valorEstimado.toLocaleString("pt-BR")}`
            : "não informado"
        }
Prazo final da proposta: ${item.dataEncerramentoProposta ?? "não informado"}`,
      },
    ],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  return textBlock?.text ?? "Não foi possível gerar o resumo.";
}
