// Leitura dos ITENS de uma licitação no PNCP, e de quem arrematou cada um.
//
// A busca do painel enxerga só o "objeto" da licitação — o texto de uma linha
// que o órgão escreveu. Isso deixa passar um tipo de oportunidade que é comum:
// um pregão chamado "aquisição de material de consumo" com três lotes de saco
// plástico no meio nunca casa com palavra-chave nenhuma no objeto.
//
// Aqui a gente desce um nível. Duas rotas do PNCP, ambas públicas:
//   itens                     -> descrição, unidade, quantidade, preço estimado
//   itens/{n}/resultados      -> quem venceu, por quanto, quantidade homologada
//
// A segunda é o que vira histórico de preço arrematado. Ela só responde depois
// que o órgão publica o resultado: antes disso o item traz temResultado=false
// e a rota devolve 204 sem corpo.

const BASE = "https://pncp.gov.br/api/pncp/v1";

const TAMANHO_PAGINA = 100;
// Teto por licitação. O maior pregão que a Embastel já enfrentou tinha 126
// lotes; 10 páginas cobrem 1.000 itens, o que é folga de sobra e ainda impede
// que um edital gigante consuma a rodada inteira.
const MAX_PAGINAS = 10;

export type ItemPncp = {
  numeroItem: number;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitarioEstimado: number | null;
  temResultado: boolean;
};

export type ResultadoPncp = {
  fornecedor: string;
  cnpj: string | null;
  valorUnitario: number;
  quantidade: number;
  valorTotal: number;
  dataResultado: string | null;
  /** 1 = ME, 2 = EPP, 3 = demais — segundo a tabela de portes do PNCP. */
  porteId: number | null;
};

/**
 * Quebra o número de controle do PNCP nas partes que as rotas de item pedem.
 * Formato: "95993028000183-1-000038/2026" -> cnpj, sequencial 38, ano 2026.
 */
export function partesDoNumeroControle(
  numeroControlePNCP: string
): { cnpj: string; sequencial: number; ano: number } | null {
  const casa = /^(\d{14})-\d+-(\d+)\/(\d{4})$/.exec(numeroControlePNCP.trim());
  if (!casa) return null;
  // O sequencial vem com zeros à esquerda ("000038") e a rota espera o número.
  const sequencial = Number(casa[2]);
  const ano = Number(casa[3]);
  if (!sequencial || !ano) return null;
  return { cnpj: casa[1], sequencial, ano };
}

class RespostaRuim extends Error {
  constructor(readonly status: number) {
    super(`PNCP respondeu ${status}`);
  }
}

async function buscarJson(url: string, deadline?: number): Promise<unknown | null> {
  const restante = deadline ? deadline - Date.now() : 20_000;
  if (restante <= 0) throw new Error("sem tempo no orçamento");
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(Math.max(1000, Math.min(20_000, restante))),
  });
  // 204 = existe, mas ainda não tem conteúdo (resultado não publicado).
  // 404 = a licitação não expõe itens por essa rota. Nenhum dos dois é erro
  // que valha repetir — devolvem "nada" e a coleta segue.
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) throw new RespostaRuim(res.status);
  return res.json();
}

type ItemBruto = {
  numeroItem?: number;
  descricao?: string;
  unidadeMedida?: string;
  quantidade?: number;
  valorUnitarioEstimado?: number;
  temResultado?: boolean;
};

export async function buscarItens(
  numeroControlePNCP: string,
  deadline?: number
): Promise<ItemPncp[]> {
  const partes = partesDoNumeroControle(numeroControlePNCP);
  if (!partes) return [];

  const itens: ItemPncp[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const url =
      `${BASE}/orgaos/${partes.cnpj}/compras/${partes.ano}/${partes.sequencial}/itens` +
      `?pagina=${pagina}&tamanhoPagina=${TAMANHO_PAGINA}`;
    const dados = (await buscarJson(url, deadline)) as ItemBruto[] | null;
    if (!Array.isArray(dados) || dados.length === 0) break;

    for (const bruto of dados) {
      if (bruto.numeroItem == null) continue;
      itens.push({
        numeroItem: bruto.numeroItem,
        descricao: (bruto.descricao ?? "").trim(),
        unidade: (bruto.unidadeMedida ?? "un").trim(),
        quantidade: Number(bruto.quantidade) || 0,
        valorUnitarioEstimado:
          bruto.valorUnitarioEstimado != null
            ? Number(bruto.valorUnitarioEstimado)
            : null,
        temResultado: bruto.temResultado === true,
      });
    }
    if (dados.length < TAMANHO_PAGINA) break;
  }
  return itens;
}

type ResultadoBruto = {
  nomeRazaoSocialFornecedor?: string;
  niFornecedor?: string;
  valorUnitarioHomologado?: number;
  quantidadeHomologada?: number;
  valorTotalHomologado?: number;
  dataResultado?: string;
  porteFornecedorId?: number;
  dataCancelamento?: string | null;
};

export async function buscarResultados(
  numeroControlePNCP: string,
  numeroItem: number,
  deadline?: number
): Promise<ResultadoPncp[]> {
  const partes = partesDoNumeroControle(numeroControlePNCP);
  if (!partes) return [];

  const url =
    `${BASE}/orgaos/${partes.cnpj}/compras/${partes.ano}/${partes.sequencial}` +
    `/itens/${numeroItem}/resultados`;
  const dados = (await buscarJson(url, deadline)) as ResultadoBruto[] | null;
  if (!Array.isArray(dados)) return [];

  return dados
    // Resultado cancelado não serve de referência de preço: foi anulado.
    .filter((r) => !r.dataCancelamento && r.valorUnitarioHomologado != null)
    .map((r) => ({
      fornecedor: (r.nomeRazaoSocialFornecedor ?? "").trim() || "não informado",
      cnpj: r.niFornecedor ?? null,
      valorUnitario: Number(r.valorUnitarioHomologado) || 0,
      quantidade: Number(r.quantidadeHomologada) || 0,
      valorTotal: Number(r.valorTotalHomologado) || 0,
      dataResultado: r.dataResultado ?? null,
      porteId: r.porteFornecedorId ?? null,
    }));
}

export const PORTE: Record<number, string> = {
  1: "ME",
  2: "EPP",
  3: "Demais",
  4: "Cooperativa",
};
