import { jsonStore } from "./jsonStore";
import { fetchPncpPage, formatPncpDate, pncpPageUrl } from "./pncpApi";
import type { PncpItem } from "./pncpApi";
import { getSettings } from "./settingsDb";
import { candidateUfsForRadius } from "./geoUtils";
import { exclusaoQueBateu, palavraQueCombinou } from "./textoUtils";
import { buscarItens, buscarResultados } from "./pncpItens";
import { EXCLUSOES_ITEM } from "./pncpTypes";
import { palavraNoInicio } from "./textoUtils";
import { lerItens, registrarVarredura } from "./itensDb";
import type { ItemGuardado } from "./itensDb";

// Busca de histórico: preço arrematado de licitações ANTIGAS.
//
// POR QUE ISSO EXISTE SEPARADO do varredor de itens.
//
// O índice de licitações guarda só os últimos 30 dias — é o que interessa pra
// participar. Mas o órgão publica o resultado semanas depois da sessão, então
// quase toda licitação ainda dentro da janela de 30 dias está sem resultado.
// Medido em 16/08/2026: de 146 itens do ramo já lidos, exatamente 1 tinha
// preço homologado. Um histórico de preços com uma amostra não serve pra nada.
//
// Aqui a gente vai buscar fora dessa janela: mês a mês pra trás, lendo as
// páginas de publicação do PNCP direto, guardando só as licitações que batem
// com o perfil da loja E já encerraram. Dessas, sim, o resultado costuma estar
// publicado.
//
// Nada disso entra no índice de licitações — seria poluir a tela de busca com
// coisa que fechou há meses. Vai só pro acervo de itens, que é histórico.

type CursorBackfill = {
  /** Quantos meses atrás está a janela sendo lida agora. */
  mesesAtras: number;
  ufIdx: number;
  modalidadeIdx: number;
  pagina: number;
  ufs: string[];
  modalidades: number[];
};

type StatusBackfill = {
  rodando: boolean;
  ultimoSinalEm: number | null;
  cursor: CursorBackfill | null;
  paginasLidas: number;
  licitacoesEncontradas: number;
  itensGuardados: number;
  /** Páginas que o PNCP não entregou. Visível de propósito: histórico com
   *  buraco silencioso é pior do que histórico que avisa que tem buraco. */
  paginasComFalha: number;
  concluido: boolean;
  ultimaRodadaEm: number | null;
  erro: string | null;
};

type BackfillData = { status: StatusBackfill };

const ESTADO_INICIAL: StatusBackfill = {
  rodando: false,
  ultimoSinalEm: null,
  cursor: null,
  paginasLidas: 0,
  licitacoesEncontradas: 0,
  itensGuardados: 0,
  paginasComFalha: 0,
  concluido: false,
  ultimaRodadaEm: null,
  erro: null,
};

const store = jsonStore<BackfillData>("precos-backfill.json", {
  status: { ...ESTADO_INICIAL },
});

/**
 * Até onde voltar. Doze meses cobre um ciclo inteiro de compras públicas
 * (a maioria dos registros de preço dura um ano) e é o limite em que o preço
 * ainda serve de referência — mais velho que isso, a inflação já comeu.
 */
const MESES_PARA_TRAS = 12;

const INTERVALO_MS = 400;
const MARGEM_MS = 5_000;

/**
 * Quantas páginas seguidas podem falhar antes de desistir do bloco (um mês ×
 * UF × modalidade). Três é o bastante pra distinguir uma página problemática
 * — que se pula — de um bloco ou serviço fora do ar, que não adianta insistir.
 */
const MAX_FALHAS_SEGUIDAS = 3;
const VALIDADE_DA_TRAVA_MS = 15 * 60 * 1000;

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Janela de um mês, contada pra trás a partir de hoje. */
function janela(mesesAtras: number): { inicial: string; final: string } {
  const fim = new Date();
  fim.setMonth(fim.getMonth() - mesesAtras);
  const inicio = new Date(fim);
  inicio.setMonth(inicio.getMonth() - 1);
  return { inicial: formatPncpDate(inicio), final: formatPncpDate(fim) };
}

function jaEncerrada(item: PncpItem): boolean {
  if (!item.dataEncerramentoProposta) return false;
  const prazo = new Date(item.dataEncerramentoProposta).getTime();
  return !Number.isNaN(prazo) && prazo < Date.now();
}

export async function lerStatusBackfill(): Promise<StatusBackfill> {
  return (await store.read()).status;
}

async function assumir(): Promise<boolean> {
  return store.update((data) => {
    const agora = Date.now();
    const viva =
      data.status.rodando &&
      data.status.ultimoSinalEm != null &&
      agora - data.status.ultimoSinalEm < VALIDADE_DA_TRAVA_MS;
    if (viva) return false;
    data.status.rodando = true;
    data.status.ultimoSinalEm = agora;
    data.status.erro = null;
    return true;
  });
}

async function salvar(patch: Partial<StatusBackfill>): Promise<void> {
  await store.update((data) => {
    Object.assign(data.status, patch, { ultimoSinalEm: Date.now() });
  });
}

/** Zera e recomeça do mês mais recente. */
export async function reiniciarBackfill(): Promise<void> {
  await store.update((data) => {
    data.status = { ...ESTADO_INICIAL };
  });
}

export type RodadaBackfill = {
  paginasLidas: number;
  licitacoesLidas: number;
  itensGuardados: number;
  mesesAtras: number;
  concluido: boolean;
  erro: string | null;
};

/**
 * Empurra o histórico por uma fatia de tempo. Retomável: guarda em que mês,
 * UF, modalidade e página parou, e a próxima chamada continua dali.
 */
export async function avancarBackfill(orcamentoMs = 45_000): Promise<RodadaBackfill> {
  const prazo = Date.now() + orcamentoMs - MARGEM_MS;

  if (!(await assumir())) {
    return {
      paginasLidas: 0,
      licitacoesLidas: 0,
      itensGuardados: 0,
      mesesAtras: 0,
      concluido: false,
      erro: "Já existe uma busca de histórico em andamento.",
    };
  }

  let paginasLidas = 0;
  let licitacoesLidas = 0;
  let itensGuardados = 0;
  let falhasSeguidas = 0;
  let totalDeFalhas = 0;

  try {
    const settings = await getSettings();
    const estado = await lerStatusBackfill();

    if (estado.concluido) {
      await salvar({ rodando: false, ultimaRodadaEm: Date.now() });
      return {
        paginasLidas: 0,
        licitacoesLidas: 0,
        itensGuardados: 0,
        mesesAtras: MESES_PARA_TRAS,
        concluido: true,
        erro: null,
      };
    }

    let cursor: CursorBackfill;
    if (estado.cursor) {
      cursor = estado.cursor;
    } else {
      // Mesma vizinhança que a coleta normal usa — não adianta histórico de
      // preço de um estado onde a loja nunca vai entregar por causa do frete.
      const ufsCandidatas =
        settings.storeLat != null && settings.storeLon != null
          ? candidateUfsForRadius(
              settings.storeLat,
              settings.storeLon,
              settings.licitacaoRaioKm
            )
          : ["SC"];
      cursor = {
        // Começa em 1 mês atrás: o mês corrente já é coberto pelo varredor
        // normal, que trabalha em cima do índice.
        mesesAtras: 1,
        ufIdx: 0,
        modalidadeIdx: 0,
        pagina: 1,
        ufs: ufsCandidatas.filter((u): u is string => Boolean(u)),
        modalidades: settings.licitacaoModalidades,
      };
      if (!cursor.ufs.length) cursor.ufs = ["SC"];
    }

    const jaVistas = new Set(Object.keys((await lerItens()).varridas));

    while (Date.now() < prazo) {
      if (cursor.mesesAtras > MESES_PARA_TRAS) {
        await salvar({ concluido: true, cursor, rodando: false, ultimaRodadaEm: Date.now() });
        return {
          paginasLidas,
          licitacoesLidas,
          itensGuardados,
          mesesAtras: cursor.mesesAtras,
          concluido: true,
          erro: null,
        };
      }

      const uf = cursor.ufs[cursor.ufIdx];
      const modalidade = cursor.modalidades[cursor.modalidadeIdx];
      const { inicial, final } = janela(cursor.mesesAtras);

      let resposta;
      let falhou = false;
      try {
        resposta = await fetchPncpPage(
          pncpPageUrl({ modalidade, uf, dataInicial: inicial, dataFinal: final, pagina: cursor.pagina }),
          `histórico ${uf} mod ${modalidade} ${cursor.mesesAtras}m`,
          { deadline: prazo, onRetry: () => salvar({}) }
        );
        falhasSeguidas = 0;
      } catch {
        // Página que falha NÃO encerra o bloco.
        //
        // A primeira versão tratava falha como "última página" e seguia pro
        // próximo estado. O efeito foi medido em 16/08/2026: o Paraná tem 78
        // páginas de pregão no mês, e duas falhas seguidas descartaram os dois
        // blocos do estado depois de ler 4 páginas. O histórico ficava com
        // buracos enormes sem ninguém perceber.
        //
        // Agora a página é pulada e a leitura continua na seguinte. Só depois
        // de várias falhas em sequência — sinal de que o problema é o bloco ou
        // o PNCP inteiro, não uma página — é que o bloco é abandonado.
        falhou = true;
        falhasSeguidas += 1;
        totalDeFalhas += 1;
        resposta = null;
      }

      paginasLidas += 1;

      const registros = resposta?.data ?? [];
      const desistirDoBloco = falhasSeguidas >= MAX_FALHAS_SEGUIDAS;
      const ultimaPagina = falhou
        ? desistirDoBloco
        : !resposta || resposta.empty || cursor.pagina >= (resposta.totalPaginas || 1);

      for (const bruto of registros) {
        if (Date.now() >= prazo) break;
        if (!bruto.numeroControlePNCP) continue;
        if (jaVistas.has(bruto.numeroControlePNCP)) continue;
        if (!jaEncerrada(bruto)) continue;

        const texto = `${bruto.objetoCompra ?? ""} ${bruto.informacaoComplementar ?? ""}`;
        if (palavraQueCombinou(texto, settings.licitacaoKeywords) === null) continue;
        if (exclusaoQueBateu(texto, settings.licitacaoExclusoes)) continue;

        jaVistas.add(bruto.numeroControlePNCP);
        licitacoesLidas += 1;

        try {
          await esperar(INTERVALO_MS);
          const itens = await buscarItens(bruto.numeroControlePNCP, prazo);
          const guardar: ItemGuardado[] = [];

          for (const item of itens) {
            const palavra = palavraNoInicio(item.descricao, settings.licitacaoKeywords);
            if (palavra === null) continue;
            if (exclusaoQueBateu(item.descricao, settings.licitacaoExclusoes)) continue;
            if (exclusaoQueBateu(item.descricao, EXCLUSOES_ITEM)) continue;
            // Sem resultado publicado o item não serve pro que este módulo
            // existe. Guardar seria encher o acervo de linha vazia.
            if (!item.temResultado) continue;

            await esperar(INTERVALO_MS);
            const resultados = await buscarResultados(
              bruto.numeroControlePNCP,
              item.numeroItem,
              prazo
            );
            if (!resultados.length) continue;

            guardar.push({
              numeroControlePNCP: bruto.numeroControlePNCP,
              numeroItem: item.numeroItem,
              descricao: item.descricao,
              unidade: item.unidade,
              quantidade: item.quantidade,
              valorUnitarioEstimado: item.valorUnitarioEstimado,
              resultados,
              orgao: bruto.orgaoEntidade?.razaoSocial ?? "",
              municipio: bruto.unidadeOrgao?.municipioNome ?? "",
              uf: bruto.unidadeOrgao?.ufSigla ?? uf,
              modalidade: bruto.modalidadeNome ?? String(modalidade),
              dataEncerramentoProposta: bruto.dataEncerramentoProposta ?? null,
              link:
                bruto.linkSistemaOrigem ??
                `https://pncp.gov.br/app/editais/${bruto.numeroControlePNCP}`,
              palavraCombinada: palavra,
              atualizadoEm: Date.now(),
            });
          }

          await registrarVarredura(bruto.numeroControlePNCP, guardar, false);
          itensGuardados += guardar.length;
        } catch {
          await registrarVarredura(bruto.numeroControlePNCP, [], false);
        }
      }

      // Avança o cursor: página -> modalidade -> UF -> mês.
      if (ultimaPagina) {
        falhasSeguidas = 0;
        cursor.pagina = 1;
        cursor.modalidadeIdx += 1;
        if (cursor.modalidadeIdx >= cursor.modalidades.length) {
          cursor.modalidadeIdx = 0;
          cursor.ufIdx += 1;
          if (cursor.ufIdx >= cursor.ufs.length) {
            cursor.ufIdx = 0;
            cursor.mesesAtras += 1;
          }
        }
      } else {
        cursor.pagina += 1;
      }

      await salvar({
        cursor,
        paginasLidas: estado.paginasLidas + paginasLidas,
        licitacoesEncontradas: estado.licitacoesEncontradas + licitacoesLidas,
        itensGuardados: estado.itensGuardados + itensGuardados,
        paginasComFalha: estado.paginasComFalha + totalDeFalhas,
      });

      await esperar(INTERVALO_MS);
    }

    await salvar({ rodando: false, ultimaRodadaEm: Date.now(), cursor });
    return {
      paginasLidas,
      licitacoesLidas,
      itensGuardados,
      mesesAtras: cursor.mesesAtras,
      concluido: false,
      erro: null,
    };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "falha no histórico";
    await salvar({ rodando: false, erro: mensagem, ultimaRodadaEm: Date.now() });
    return {
      paginasLidas,
      licitacoesLidas,
      itensGuardados,
      mesesAtras: 0,
      concluido: false,
      erro: mensagem,
    };
  }
}
