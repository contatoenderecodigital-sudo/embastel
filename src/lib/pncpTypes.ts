// Constantes e tipos usados tanto no servidor (pncp.ts) quanto direto no
// cliente (página de licitações) — por isso ficam separados de pncp.ts, que
// importa libs só-servidor (geocode.ts usa node:fs) e não pode ser
// importado por um Client Component sem quebrar o build.

export const MODALIDADES: Record<number, string> = {
  1: "Leilão - Eletrônico",
  2: "Diálogo Competitivo",
  3: "Concurso",
  4: "Concorrência - Eletrônica",
  5: "Concorrência - Presencial",
  6: "Pregão - Eletrônico",
  7: "Pregão - Presencial",
  8: "Dispensa de Licitação",
  9: "Inexigibilidade",
  10: "Manifestação de Interesse",
  11: "Pré-qualificação",
  12: "Credenciamento",
  13: "Leilão - Presencial",
};

export const DEFAULT_MODALIDADES = [6, 8];

// Palavras que fazem uma licitação aparecer. São mais específicas do que
// "embalagens" solto de propósito: o objeto da compra no PNCP é texto corrido,
// e termo genérico casa com qualquer coisa que só CITE a palavra.
export const DEFAULT_KEYWORDS = [
  "embalagem",
  "embalagens",
  "descartáve",
  "copo plástico",
  "saco plástico",
  "sacola",
  "guardanapo",
  "marmitex",
  "papel toalha",
  "utensílio",
  "copa e cozinha",
  "material de limpeza",
  "produtos de festa",
  "forma de papel",
  "bandeja",
];

// Palavras que DERRUBAM a licitação mesmo que ela tenha batido acima.
//
// Sem isso o filtro é ingênuo e enche a tela de coisa que não é do ramo. Todos
// os exemplos abaixo foram medidos em 12/08/2026, numa busca real: "sacos de
// ureia agrícola acondicionada em EMBALAGENS de 50kg" (é adubo), "fraldas
// geriátricas DESCARTÁVEIS" (é saúde), "produtos de panificação, CONFEITARIA,
// salgados" (é comida pronta), "refeições preparadas em recipientes
// DESCARTÁVEIS" (é marmita pronta), "bolos de pote — empresa especializada em
// CONFEITARIA" (é o bolo, não a forma). Dos 14 resultados daquele dia, 10 eram
// falso positivo desse tipo.
//
// A Embastel vende a embalagem e o utensílio — não o alimento, o remédio nem
// o insumo agrícola que vai dentro.
export const DEFAULT_EXCLUSOES = [
  "gêneros alimentícios",
  "insumos alimentícios",
  "refeições preparadas",
  "refeição preparada",
  "panificação",
  "salgados",
  "bolos de pote",
  "merenda escolar",
  "hortifruti",
  "carnes",
  "medicamento",
  "ambulatoria",
  "fralda",
  "agrícola",
  "ureia",
  "fertilizante",
  "combustível",
  "material ambulatorial",
  // Serviço, não mercadoria. A prefeitura usa as mesmas palavras ("limpeza",
  // "higienização") tanto pra comprar detergente quanto pra contratar quem
  // lava o carro ou o ar-condicionado — e a Embastel não presta serviço.
  "prestação de serviços",
  "prestacao de servicos",
  "locação",
  "lavanderia",
  "lavagem",
  "ar condicionado",
  "ar-condicionado",
  "controle de vetores",
  "dedetização",
  // Compras de bem durável que só citam "utensílios" de passagem.
  "eletrodoméstico",
  "eletrodomesticos",
  "mobiliário",
  "móveis",
];

export type LicitacaoResultado = {
  numeroControlePNCP: string;
  objeto: string;
  informacaoComplementar: string | null;
  orgao: string;
  municipio: string;
  uf: string;
  modalidade: string;
  situacao: string;
  valorEstimado: number | null;
  dataEncerramentoProposta: string | null;
  link: string;
  // Só presente quando a busca foi feita por raio a partir do endereço da
  // loja (não por Estado) — distância em linha reta até o município.
  distanceKm?: number;
  // Quando a licitação entrou no índice local. Usado pra marcar como
  // "novidade" o que apareceu nas últimas horas.
  vistaEm?: number;
  // Qual palavra-chave fez esta licitação aparecer — mostrado na tela pra
  // deixar claro o motivo e facilitar ajustar a lista.
  palavraCombinada?: string;
  // Veredito da IA sobre "a Embastel vende isso?" (ver triagemIA.ts).
  triagem?: { serve: boolean; motivo: string };
};
