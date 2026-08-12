import { haversineKm } from "./geoUtils";
import { lerIndice } from "./licitacoesIndexDb";
import { exclusaoQueBateu, palavraQueCombinou } from "./textoUtils";
import type { LicitacaoResultado } from "./pncpTypes";

export { MODALIDADES, DEFAULT_MODALIDADES, DEFAULT_KEYWORDS } from "./pncpTypes";
export type { LicitacaoResultado } from "./pncpTypes";

// A busca NÃO fala mais com o PNCP durante a requisição do usuário.
//
// Antes ela consultava a API ao vivo e, pra não demorar demais, lia só as 4
// primeiras páginas de cada Estado × modalidade — 200 registros de um universo
// que, medido em 12/08/2026, era de 2.310 pregões eletrônicos + 3.050
// dispensas só em Santa Catarina nos últimos 30 dias. Resultado: das 10
// licitações catarinenses que batiam com o perfil da loja e ainda estavam
// abertas naquele dia, a busca encontrava zero (todas estavam da página 26 em
// diante), e ainda assim levava 2min33s pra responder.
//
// Agora quem varre o PNCP inteiro é o coletor em segundo plano
// (pncpCollector.ts), que guarda tudo num índice local já com a coordenada do
// município resolvida. Aqui só filtramos esse índice em memória — instantâneo.

export type ResultadoBusca = {
  items: LicitacaoResultado[];
  // Quando o índice foi atualizado pela última vez (null = coleta nunca rodou).
  atualizadoEm: number | null;
  totalNoIndice: number;
};

export async function searchLicitacoes(options: {
  keywords: string[];
  // Termos que descartam a licitação mesmo casando com uma palavra-chave.
  exclusoes?: string[];
  uf?: string;
  modalidades?: number[];
  // Só inclui licitações cujo prazo de encerramento ainda tem pelo menos
  // esse número de dias — evita mostrar oportunidades em cima da hora sem
  // tempo hábil pra preparar a proposta. Undefined/0 = sem filtro.
  minDeadlineDays?: number;
  // Filtra por distância real até o município, a partir do endereço da loja.
  raio?: { lat: number; lon: number; km: number };
  // Mostra também o que a IA marcou como fora do ramo (pra conferir se ela
  // está descartando algo que não devia).
  incluirDescartadasPelaIA?: boolean;
}): Promise<ResultadoBusca> {
  const indice = await lerIndice();
  const agora = Date.now();
  const modalidades = options.modalidades?.length ? new Set(options.modalidades) : null;

  const items: LicitacaoResultado[] = [];

  for (const item of indice.items) {
    if (modalidades && !modalidades.has(item.modalidadeId)) continue;
    if (options.uf && item.uf !== options.uf) continue;

    const texto = `${item.objeto} ${item.informacaoComplementar ?? ""}`;

    const palavraCombinada = palavraQueCombinou(texto, options.keywords);
    if (palavraCombinada === null) continue;

    // Exclusão vence a palavra-chave: "ureia acondicionada em EMBALAGENS de
    // 50kg" casa com "embalagem" mas é adubo, não embalagem à venda.
    if (options.exclusoes?.length && exclusaoQueBateu(texto, options.exclusoes)) {
      continue;
    }

    // A IA já leu esta e disse que não é do ramo — só aparece se a pessoa
    // pedir explicitamente pra ver as descartadas.
    if (!options.incluirDescartadasPelaIA && item.triagem && !item.triagem.serve) {
      continue;
    }

    // Prazo: sempre esconde o que já fechou, e opcionalmente o que fecha cedo
    // demais pra dar tempo de montar a proposta.
    if (item.dataEncerramentoProposta) {
      const prazo = new Date(item.dataEncerramentoProposta).getTime();
      if (!Number.isNaN(prazo)) {
        // Comparação em milissegundos, não em dias arredondados: para um
        // prazo que venceu há poucas horas, Math.ceil da fração negativa
        // devolve -0, e `-0 < 0` é falso — licitação encerrada ontem passava
        // pelo filtro e aparecia como "fecha hoje".
        if (prazo < agora) continue;
        if (options.minDeadlineDays) {
          const diasRestantes = Math.ceil((prazo - agora) / 86400000);
          if (diasRestantes < options.minDeadlineDays) continue;
        }
      }
    }

    let distanceKm: number | undefined;
    if (options.raio) {
      if (item.lat == null || item.lon == null) continue;
      const dist = haversineKm(options.raio.lat, options.raio.lon, item.lat, item.lon);
      if (dist > options.raio.km) continue;
      distanceKm = Math.round(dist);
    }

    items.push({
      numeroControlePNCP: item.numeroControlePNCP,
      objeto: item.objeto,
      informacaoComplementar: item.informacaoComplementar,
      orgao: item.orgao,
      municipio: item.municipio,
      uf: item.uf,
      modalidade: item.modalidade,
      situacao: item.situacao,
      valorEstimado: item.valorEstimado,
      dataEncerramentoProposta: item.dataEncerramentoProposta,
      link: item.link,
      distanceKm,
      vistaEm: item.vistaEm,
      palavraCombinada: palavraCombinada || undefined,
      triagem: item.triagem ?? undefined,
    });
  }

  // Prazo mais apertado primeiro — é o que precisa de decisão hoje.
  items.sort((a, b) => {
    if (!a.dataEncerramentoProposta) return 1;
    if (!b.dataEncerramentoProposta) return -1;
    return a.dataEncerramentoProposta.localeCompare(b.dataEncerramentoProposta);
  });

  return {
    items,
    atualizadoEm: indice.atualizadoEm,
    totalNoIndice: indice.items.length,
  };
}
