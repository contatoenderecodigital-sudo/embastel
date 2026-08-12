import Anthropic from "@anthropic-ai/sdk";

// Triagem das licitações novas por IA.
//
// POR QUE ISSO EXISTE: filtro por palavra-chave não consegue distinguir
// "comprar copo descartável" de "comprar refeição SERVIDA em copo
// descartável". Medido em 12/08/2026 numa busca real, com lista de palavras
// já ajustada: entravam ureia "acondicionada em embalagens", fraldas
// "descartáveis", bolos de uma "empresa de confeitaria", lavagem de veículos
// ("higienização") e compra de móveis que citava "utensílios". A palavra está
// no texto — o produto não é o que a loja vende.
//
// Isso é julgamento de linguagem, não casamento de string. Roda só sobre o que
// é NOVO em cada coleta (uma dúzia por dia), em lote, com o modelo mais barato
// da Anthropic — custa fração de centavo por rodada.

const MODEL = "claude-haiku-4-5";

// Lotes: mandar uma licitação por chamada desperdiça o prompt do sistema, que
// é maior que o próprio objeto da compra.
const TAMANHO_DO_LOTE = 15;

export type Triagem = {
  serve: boolean;
  motivo: string;
};

export type ItemParaTriagem = {
  numeroControlePNCP: string;
  objeto: string;
};

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

export function triagemDisponivel(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `Você faz a triagem de licitações públicas para a Embastel Embalagens, uma distribuidora de Xanxerê/SC.

O QUE A EMBASTEL VENDE (produtos, de prateleira):
- Embalagens: sacos e sacolas plásticas, sacos de papel, caixas, potes, bandejas, marmitex vazio, filme, papelão.
- Descartáveis: copos, pratos, talheres, guardanapos, papel toalha, papel higiênico, touca, luva.
- Utensílios de cozinha e copa: formas, assadeiras, panelas, potes, itens de bazar.
- Confeitaria: formas de papel, embalagens de bolo, cake board, itens decorativos — a EMBALAGEM e o UTENSÍLIO, nunca o alimento.
- Produtos de festa: balões, toalhas, descartáveis temáticos, velas.
- Limpeza e higiene: detergente, desinfetante, água sanitária, sabão, rodo, vassoura, pano.

O QUE ELA NÃO FAZ:
- Não vende alimento, bebida, refeição pronta, marmita pronta, bolo, salgado, gênero alimentício, hortifruti nem carne.
- Não vende medicamento, material hospitalar/ambulatorial, fralda geriátrica, insumo agrícola nem combustível.
- Não vende móveis, eletrodomésticos, eletrônicos, equipamentos nem ferramentas.
- Não presta serviço nenhum: nada de lavagem, lavanderia, dedetização, manutenção, limpeza terceirizada, buffet ou locação.

REGRA DE DECISÃO: responda serve=true somente se a licitação estiver comprando, como MERCADORIA, pelo menos um item da primeira lista. Se o objeto for serviço, alimento, remédio, móvel ou equipamento — mesmo que o texto cite "embalagem", "descartável", "higienização" ou "utensílio" de passagem — responda serve=false.

Na dúvida entre um objeto misto (ex: "gêneros alimentícios e materiais de copa"), responda serve=true apenas se a parte que a Embastel fornece for relevante, não um detalhe solto.

O motivo deve ter no máximo 12 palavras, direto ao ponto.`;

const SCHEMA = {
  type: "object",
  properties: {
    avaliacoes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "O id exatamente como recebido." },
          serve: { type: "boolean" },
          motivo: { type: "string" },
        },
        required: ["id", "serve", "motivo"],
        additionalProperties: false,
      },
    },
  },
  required: ["avaliacoes"],
  additionalProperties: false,
} as const;

async function triarLote(
  itens: ItemParaTriagem[]
): Promise<Map<string, Triagem>> {
  const resultado = new Map<string, Triagem>();
  const anthropic = getClient();
  if (!anthropic) return resultado;

  const lista = itens
    .map((i, n) => `[${n}] ${i.objeto.slice(0, 400).replace(/\s+/g, " ")}`)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Avalie cada licitação abaixo. Use como "id" o número entre colchetes.\n\n${lista}`,
      },
    ],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  });

  const bloco = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  if (!bloco) return resultado;

  const parsed = JSON.parse(bloco.text) as {
    avaliacoes: Array<{ id: string; serve: boolean; motivo: string }>;
  };

  for (const avaliacao of parsed.avaliacoes ?? []) {
    const indice = Number(avaliacao.id);
    const item = itens[indice];
    if (!item) continue;
    resultado.set(item.numeroControlePNCP, {
      serve: avaliacao.serve,
      motivo: avaliacao.motivo,
    });
  }
  return resultado;
}

/**
 * Tria uma lista de licitações. Devolve um mapa numeroControlePNCP → veredito.
 * Sem ANTHROPIC_API_KEY configurada devolve mapa vazio, e quem chamou segue
 * com o filtro por palavra-chave — a triagem é um reforço, não um requisito.
 */
export async function triarLicitacoes(
  itens: ItemParaTriagem[]
): Promise<Map<string, Triagem>> {
  const resultado = new Map<string, Triagem>();
  if (!itens.length || !triagemDisponivel()) return resultado;

  for (let i = 0; i < itens.length; i += TAMANHO_DO_LOTE) {
    const lote = itens.slice(i, i + TAMANHO_DO_LOTE);
    try {
      const avaliacoes = await triarLote(lote);
      for (const [chave, valor] of avaliacoes) resultado.set(chave, valor);
    } catch (error) {
      // Um lote que falhou não pode derrubar a coleta: as licitações desse
      // lote simplesmente ficam sem veredito e aparecem do mesmo jeito.
      console.warn("[triagem] lote falhou:", error);
    }
  }

  return resultado;
}
