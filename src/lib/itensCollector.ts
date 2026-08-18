import { lerIndice } from "./licitacoesIndexDb";
import type { LicitacaoIndexada } from "./licitacoesIndexDb";
import { getSettings } from "./settingsDb";
import { buscarItens, buscarResultados } from "./pncpItens";
import { exclusaoQueBateu, palavraNoInicio, palavraQueCombinou } from "./textoUtils";
import { EXCLUSOES_ITEM } from "./pncpTypes";
import {
  encerrarVarredura,
  lerItens,
  registrarVarredura,
  reabrirParaRevisita,
  sinalDeVida,
  tentarAssumirVarredura,
} from "./itensDb";
import type { ItemGuardado } from "./itensDb";

// Varredura dos itens das licitações do índice.
//
// Roda devagar de propósito. O índice tem mais de 12 mil licitações e cada uma
// custa pelo menos uma requisição ao PNCP; varrer tudo de uma vez seria abuso
// de um serviço público gratuito e ainda tomaria mais de uma hora. Então:
//
//   - trabalha por orçamento de tempo e guarda onde parou (retomável)
//   - respeita um intervalo entre requisições
//   - tem um teto de licitações por rodada
//   - visita primeiro o que rende mais
//
// A ordem de prioridade importa mais do que parece:
//   1. encerradas que bateram no perfil -> preço arrematado, o dado mais raro
//   2. abertas                          -> busca profunda serve pra hoje
//   3. o resto                          -> completa o histórico com o tempo

const INTERVALO_ENTRE_REQUISICOES_MS = 350;
const MAX_LICITACOES_POR_RODADA = 120;
const MARGEM_DE_SEGURANCA_MS = 4_000;

// Revisitar uma licitação encerrada só faz sentido depois que o órgão teve
// tempo de publicar o resultado. Uma semana é o intervalo em que a maioria
// aparece, e evita ficar batendo na mesma rota todo dia à toa.
const ESPERA_PARA_REVISITA_MS = 7 * 24 * 60 * 60 * 1000;

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function encerrada(lic: LicitacaoIndexada): boolean {
  if (!lic.dataEncerramentoProposta) return false;
  const prazo = new Date(lic.dataEncerramentoProposta).getTime();
  return !Number.isNaN(prazo) && prazo < Date.now();
}

/** Julga o OBJETO da licitação — texto curto, resumo da compra inteira. */
function bateNoPerfil(texto: string, keywords: string[], exclusoes: string[]): string | null {
  const palavra = palavraQueCombinou(texto, keywords);
  if (palavra === null) return null;
  if (exclusaoQueBateu(texto, exclusoes)) return null;
  return palavra;
}

/**
 * Julga a DESCRIÇÃO DE UM ITEM, que é outra coisa: um texto longo onde o nome
 * do produto vem primeiro e o resto são características. Por isso a palavra
 * precisa estar no começo (ver palavraNoInicio) e há uma lista de exclusões
 * própria, focada no ruído que só aparece neste nível — material hospitalar
 * descartável, sobretudo.
 */
function itemEDoRamo(
  descricao: string,
  keywords: string[],
  exclusoes: string[]
): string | null {
  const palavra = palavraNoInicio(descricao, keywords);
  if (palavra === null) return null;
  if (exclusaoQueBateu(descricao, exclusoes)) return null;
  if (exclusaoQueBateu(descricao, EXCLUSOES_ITEM)) return null;
  return palavra;
}

/**
 * Ordena as licitações ainda não visitadas por quanto rendem.
 *
 * Dentro de cada grupo, o mais recente primeiro: preço de arremate de dois
 * anos atrás vale muito menos como referência do que o do mês passado.
 */
function ordenarPorPrioridade(
  candidatas: LicitacaoIndexada[],
  keywords: string[],
  exclusoes: string[]
): LicitacaoIndexada[] {
  function grupo(lic: LicitacaoIndexada): number {
    const texto = `${lic.objeto} ${lic.informacaoComplementar ?? ""}`;
    const doPerfil = bateNoPerfil(texto, keywords, exclusoes) !== null;
    if (doPerfil && encerrada(lic)) return 0;
    if (!encerrada(lic)) return 1;
    return 2;
  }
  return [...candidatas].sort((a, b) => {
    const ga = grupo(a);
    const gb = grupo(b);
    if (ga !== gb) return ga - gb;
    return (b.dataPublicacao ?? "").localeCompare(a.dataPublicacao ?? "");
  });
}

export type ResultadoRodada = {
  visitadas: number;
  itensNovos: number;
  restantes: number;
  concluida: boolean;
  erro: string | null;
};

/**
 * Empurra a varredura por um pedaço de tempo e devolve o que fez.
 * Chamar de novo continua de onde parou.
 */
export async function avancarVarredura(orcamentoMs = 45_000): Promise<ResultadoRodada> {
  const prazoFinal = Date.now() + orcamentoMs - MARGEM_DE_SEGURANCA_MS;

  if (!(await tentarAssumirVarredura())) {
    return {
      visitadas: 0,
      itensNovos: 0,
      restantes: 0,
      concluida: false,
      erro: "Já existe uma varredura em andamento.",
    };
  }

  let visitadas = 0;
  let itensNovos = 0;
  let restantes = 0;

  try {
    const [{ licitacaoKeywords, licitacaoExclusoes }, indice, guardado] =
      await Promise.all([getSettings(), lerIndice(), lerItens()]);

    // Encerradas sem resultado publicado voltam pra fila depois de uma semana.
    const paraRevisitar = guardado.aguardandoResultado.filter((numero) => {
      const visitadaEm = guardado.varridas[numero];
      return visitadaEm != null && Date.now() - visitadaEm > ESPERA_PARA_REVISITA_MS;
    });
    if (paraRevisitar.length) await reabrirParaRevisita(paraRevisitar);

    const jaVistas = new Set(Object.keys(guardado.varridas));
    for (const numero of paraRevisitar) jaVistas.delete(numero);

    const pendentes = indice.items.filter(
      (lic) => !jaVistas.has(lic.numeroControlePNCP)
    );
    restantes = pendentes.length;

    const fila = ordenarPorPrioridade(
      pendentes,
      licitacaoKeywords,
      licitacaoExclusoes
    ).slice(0, MAX_LICITACOES_POR_RODADA);

    for (const lic of fila) {
      if (Date.now() >= prazoFinal) break;

      try {
        const itensPncp = await buscarItens(lic.numeroControlePNCP, prazoFinal);
        const guardar: ItemGuardado[] = [];
        let faltamResultados = false;

        for (const item of itensPncp) {
          const palavra = itemEDoRamo(
            item.descricao,
            licitacaoKeywords,
            licitacaoExclusoes
          );
          // Só o que é do ramo da loja é guardado — ver o comentário em
          // itensDb.ts sobre o tamanho do arquivo.
          if (palavra === null) continue;

          let resultados: Awaited<ReturnType<typeof buscarResultados>> = [];
          if (item.temResultado) {
            if (Date.now() >= prazoFinal) break;
            await esperar(INTERVALO_ENTRE_REQUISICOES_MS);
            resultados = await buscarResultados(
              lic.numeroControlePNCP,
              item.numeroItem,
              prazoFinal
            );
          } else if (encerrada(lic)) {
            // Encerrou mas o resultado ainda não saiu — vale voltar depois.
            faltamResultados = true;
          }

          guardar.push({
            numeroControlePNCP: lic.numeroControlePNCP,
            numeroItem: item.numeroItem,
            descricao: item.descricao,
            unidade: item.unidade,
            quantidade: item.quantidade,
            valorUnitarioEstimado: item.valorUnitarioEstimado,
            resultados,
            orgao: lic.orgao,
            municipio: lic.municipio,
            uf: lic.uf,
            modalidade: lic.modalidade,
            dataEncerramentoProposta: lic.dataEncerramentoProposta,
            link: lic.link,
            palavraCombinada: palavra,
            atualizadoEm: Date.now(),
          });
        }

        await registrarVarredura(lic.numeroControlePNCP, guardar, faltamResultados);
        itensNovos += guardar.length;
      } catch {
        // Uma licitação problemática não pode matar a rodada. Marca como
        // visitada sem itens: na pior das hipóteses perde-se uma, e a
        // varredura segue em vez de travar sempre na mesma.
        await registrarVarredura(lic.numeroControlePNCP, [], false);
      }

      visitadas += 1;
      await sinalDeVida({ licitacoesVarridas: visitadas });
      await esperar(INTERVALO_ENTRE_REQUISICOES_MS);
    }

    await encerrarVarredura(null);
    return {
      visitadas,
      itensNovos,
      restantes: Math.max(0, restantes - visitadas),
      concluida: restantes - visitadas <= 0,
      erro: null,
    };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "falha na varredura";
    await encerrarVarredura(mensagem);
    return { visitadas, itensNovos, restantes, concluida: false, erro: mensagem };
  }
}
