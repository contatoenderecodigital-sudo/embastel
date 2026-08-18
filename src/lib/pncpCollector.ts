import {
  aplicarCoordenadas,
  aplicarTriagens,
  atualizarStatusColeta,
  lerIndice,
  lerStatusColeta,
  mesclarNoIndice,
  municipiosSemCoordenada,
  podarEFinalizarIndice,
  tentarAssumirColeta,
  type ColetaStatus,
  type CursorColeta,
  type LicitacaoIndexada,
} from "./licitacoesIndexDb";
import { criarNotificacoes } from "./notificacoesDb";
import { geocodeMunicipio } from "./geocode";
import { candidateUfsForRadius, haversineKm } from "./geoUtils";
import { fetchPncpPage, formatPncpDate, pncpPageUrl, type PncpItem } from "./pncpApi";
import { MODALIDADES } from "./pncpTypes";
import { getSettings } from "./settingsDb";
import { combinaComPalavras, exclusaoQueBateu } from "./textoUtils";
import { triagemDisponivel, triarLicitacoes } from "./triagemIA";

// ---------------------------------------------------------------------------
// A coleta é uma MÁQUINA DE ESTADOS RETOMÁVEL, não um trabalho de uma tacada.
//
// Motivo: uma varredura completa do PNCP (SC + PR + RS, pregão e dispensa, 30
// dias) passa de 500 páginas e leva mais de 10 minutos, e ainda precisa
// geocodificar centenas de municípios a 1 requisição por segundo. Um trabalho
// desse tamanho não pode depender de nada dar certo do começo ao fim.
//
// Então cada chamada de avancarColeta() trabalha por um orçamento de tempo,
// grava onde parou (o cursor) e devolve o controle. Se o servidor reiniciar no
// meio — publicação, queda de energia, erro —, a próxima chamada continua
// exatamente dali em vez de recomeçar do zero.
//
// Fases: lendo_pncp → localizando_cidades → triando → concluida
// ---------------------------------------------------------------------------

const INTERVALO_ENTRE_PAGINAS_MS = 400;
const MAX_PAGINAS_POR_CONSULTA = 400;

/**
 * Quantas páginas seguidas podem falhar antes de desistir do bloco (um par
 * UF × modalidade). Três distingue uma página problemática — que se pula — de
 * um bloco ou serviço fora do ar, em que insistir só gasta o orçamento.
 */
const MAX_FALHAS_SEGUIDAS = 3;

/**
 * Quantas falhas seguidas, sem UMA página boa em bloco nenhum, bastam pra
 * concluir que a API do PNCP está fora do ar e encerrar a rodada.
 *
 * A primeira versão disso encerrava a rodada quando uma FATIA de 30s passava
 * sem página boa. Ficou agressivo demais: uma única página lenta no começo de
 * uma fatia derrubava a coleta inteira — medido em 18/08/2026, a varredura
 * parou na página 9 de ~530 com a mensagem "não respondeu nenhuma das 1
 * páginas desta fatia". Quinze falhas seguidas são uns cinco minutos sem nada,
 * aí sim é o serviço, e não azar.
 */
const MAX_FALHAS_SEM_SUCESSO = 15;

// Uma licitação com o prazo vencido não serve pra disputar, mas fica mais dois
// dias no índice pra não sumir da tela no mesmo instante em que fecha.
const CARENCIA_APOS_PRAZO_MS = 2 * 24 * 60 * 60 * 1000;

// Quanto tempo antes do fim do orçamento a gente para de começar coisa nova.
// Para as páginas a margem é pequena porque o próprio fetch recebe o prazo e
// desiste sozinho quando o tempo acaba (ver OpcoesFetch.deadline); o que sobra
// é só a folga pra gravar o resultado da fatia.
const MARGEM_PAGINA_MS = 6_000;
const MARGEM_CIDADE_MS = 2_000;
const MARGEM_TRIAGEM_MS = 15_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function aindaVale(item: PncpItem, agora: number): boolean {
  if (!item.dataEncerramentoProposta) return true;
  const prazo = new Date(item.dataEncerramentoProposta).getTime();
  if (Number.isNaN(prazo)) return true;
  return prazo >= agora - CARENCIA_APOS_PRAZO_MS;
}

function paraIndexada(item: PncpItem, vistaEm: number): LicitacaoIndexada {
  return {
    numeroControlePNCP: item.numeroControlePNCP,
    objeto: item.objetoCompra ?? "(sem descrição)",
    informacaoComplementar: item.informacaoComplementar ?? null,
    orgao: item.orgaoEntidade?.razaoSocial ?? "",
    municipio: item.unidadeOrgao?.municipioNome ?? "",
    uf: item.unidadeOrgao?.ufSigla ?? "",
    modalidadeId: item.modalidadeId ?? 0,
    modalidade:
      item.modalidadeNome ??
      (item.modalidadeId ? MODALIDADES[item.modalidadeId] : "") ??
      "",
    situacao: item.situacaoCompraNome ?? "",
    valorEstimado: item.valorTotalEstimado ?? null,
    dataPublicacao: item.dataPublicacaoPncp ?? null,
    dataEncerramentoProposta: item.dataEncerramentoProposta ?? null,
    link:
      item.linkSistemaOrigem ||
      `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
    lat: null,
    lon: null,
    vistaEm,
    triagem: null,
  };
}

function passaNoFiltroDePalavras(
  item: LicitacaoIndexada,
  keywords: string[],
  exclusoes: string[]
): boolean {
  const texto = `${item.objeto} ${item.informacaoComplementar ?? ""}`;
  if (!combinaComPalavras(texto, keywords)) return false;
  // Exclusão derruba a palavra-chave: sem isso o painel apitaria por compra de
  // adubo, remédio e comida pronta só porque o texto cita "embalagens".
  return !exclusaoQueBateu(texto, exclusoes);
}

function dentroDoRaio(
  item: LicitacaoIndexada,
  lojaLat: number,
  lojaLon: number,
  raioKm: number
): boolean {
  // Sem coordenada não dá pra afirmar que está perto — melhor não notificar do
  // que encher o painel de aviso de licitação do outro lado do país.
  if (item.lat == null || item.lon == null) return false;
  return haversineKm(lojaLat, lojaLon, item.lat, item.lon) <= raioKm;
}

// ---------------------------------------------------------------------------

async function montarCursor(): Promise<CursorColeta> {
  const settings = await getSettings();
  if (settings.storeLat == null || settings.storeLon == null) {
    throw new Error(
      "Endereço da loja não configurado — sem ele não dá pra saber o que está perto."
    );
  }

  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - Math.min(Math.max(settings.licitacaoDias, 1), 90));

  return {
    ufs: candidateUfsForRadius(
      settings.storeLat,
      settings.storeLon,
      settings.licitacaoRaioKm
    ).map((uf) => uf ?? null),
    modalidades: settings.licitacaoModalidades.length
      ? settings.licitacaoModalidades
      : [6, 8],
    ufIdx: 0,
    modIdx: 0,
    pagina: 1,
    totalPaginasDaConsulta: 0,
    dataInicial: formatPncpDate(inicio),
    dataFinal: formatPncpDate(hoje),
    novas: [],
    falhas: 0,
    falhasSeguidas: 0,
    falhasSemSucesso: 0,
  };
}

/** Avança o cursor para a próxima consulta (UF × modalidade). Fim = null. */
function proximaConsulta(cursor: CursorColeta): CursorColeta | null {
  const modIdx = cursor.modIdx + 1;
  if (modIdx < cursor.modalidades.length) {
    return { ...cursor, modIdx, pagina: 1, totalPaginasDaConsulta: 0 };
  }
  const ufIdx = cursor.ufIdx + 1;
  if (ufIdx < cursor.ufs.length) {
    return { ...cursor, ufIdx, modIdx: 0, pagina: 1, totalPaginasDaConsulta: 0 };
  }
  return null;
}

async function faseLendoPncp(
  status: ColetaStatus,
  prazoFinal: number
): Promise<void> {
  let cursor = status.cursor ?? (await montarCursor());
  const agora = Date.now();
  const coletadas: LicitacaoIndexada[] = [];
  let paginasLidas = status.paginasLidas;
  let registrosLidos = status.registrosLidos;
  let varreduraTerminou = false;
  // Cursor antigo (gravado antes deste campo existir) começa do zero.
  cursor = {
    ...cursor,
    falhasSeguidas: cursor.falhasSeguidas ?? 0,
    falhasSemSucesso: cursor.falhasSemSucesso ?? 0,
  };

  while (!varreduraTerminou && Date.now() + MARGEM_PAGINA_MS < prazoFinal) {
    const uf = cursor.ufs[cursor.ufIdx] ?? undefined;
    const modalidade = cursor.modalidades[cursor.modIdx];
    const contexto = `${uf ?? "Brasil"}, modalidade ${modalidade}, página ${cursor.pagina}`;

    let json;
    try {
      json = await fetchPncpPage(
        pncpPageUrl({
          modalidade,
          uf,
          dataInicial: cursor.dataInicial,
          dataFinal: cursor.dataFinal,
          pagina: cursor.pagina,
        }),
        contexto,
        {
          // Sem o prazo, uma página teimosa consumia minutos em tentativas e
          // estourava o orçamento desta fatia de trabalho.
          deadline: prazoFinal,
          onRetry: async () => {
            await atualizarStatusColeta({ ultimoSinalEm: Date.now() });
          },
        }
      );
    } catch (erro) {
      // UMA PÁGINA QUE FALHA NÃO ENCERRA O BLOCO.
      //
      // Antes, qualquer recusa do PNCP mandava o cursor pro próximo par
      // UF × modalidade. O efeito foi medido em 18/08/2026: dos ~530 páginas
      // que os seis blocos têm num mês, a coleta leu 74 — cada bloco era
      // abandonado na primeira página recusada, e o painel ficava com uma
      // fração do que existe sem ninguém perceber (o aviso só dizia
      // "recusou 6 blocos").
      //
      // Agora pula só a página. Depois de várias recusas seguidas — sinal de
      // que o problema é o bloco ou o PNCP inteiro, não uma página — aí sim
      // desiste do bloco.
      console.warn(
        `[coleta] pulando ${contexto}: ${erro instanceof Error ? erro.message : erro}`
      );
      const comFalha = {
        ...cursor,
        falhas: cursor.falhas + 1,
        falhasSeguidas: cursor.falhasSeguidas + 1,
        falhasSemSucesso: (cursor.falhasSemSucesso ?? 0) + 1,
      };

      if (comFalha.falhasSemSucesso >= MAX_FALHAS_SEM_SUCESSO) {
        console.warn(
          `[coleta] ${comFalha.falhasSemSucesso} falhas seguidas sem nenhuma página boa; a API do PNCP parece fora do ar. Encerrando a rodada.`
        );
        cursor = comFalha;
        varreduraTerminou = true;
      } else if (comFalha.falhasSeguidas >= MAX_FALHAS_SEGUIDAS) {
        const proxima = proximaConsulta(comFalha);
        cursor = proxima
          ? { ...proxima, falhasSeguidas: 0 }
          : { ...comFalha, falhasSeguidas: 0 };
        if (!proxima) varreduraTerminou = true;
      } else {
        cursor = { ...comFalha, pagina: comFalha.pagina + 1 };
      }

      await sleep(INTERVALO_ENTRE_PAGINAS_MS);
      continue;
    }

    cursor = { ...cursor, falhasSeguidas: 0, falhasSemSucesso: 0 };

    // Guarda o total assim que ele for conhecido, e não só na página 1: se a
    // primeira página do bloco tiver falhado, o total continuaria zerado e o
    // bloco terminaria na página seguinte por engano.
    if (cursor.totalPaginasDaConsulta === 0) {
      cursor = { ...cursor, totalPaginasDaConsulta: json.totalPaginas || 0 };
    }

    for (const item of json.data) {
      registrosLidos += 1;
      if (!item.numeroControlePNCP) continue;
      if (!aindaVale(item, agora)) continue;
      coletadas.push(paraIndexada(item, agora));
    }
    paginasLidas += 1;

    const acabouEstaConsulta =
      json.empty ||
      // Total zero significa "ainda não sei", não "acabou".
      (cursor.totalPaginasDaConsulta > 0 &&
        cursor.pagina >= cursor.totalPaginasDaConsulta) ||
      cursor.pagina >= MAX_PAGINAS_POR_CONSULTA;

    if (acabouEstaConsulta) {
      const proxima = proximaConsulta(cursor);
      if (proxima) {
        cursor = proxima;
      } else {
        varreduraTerminou = true;
      }
    } else {
      cursor = { ...cursor, pagina: cursor.pagina + 1 };
    }

    await sleep(INTERVALO_ENTRE_PAGINAS_MS);
  }

  // Grava tudo que foi lido nesta chamada de uma vez só.
  const novas = await mesclarNoIndice(coletadas);
  cursor = { ...cursor, novas: [...cursor.novas, ...novas] };

  const indice = await lerIndice();
  await atualizarStatusColeta({
    cursor,
    paginasLidas,
    registrosLidos,
    itensNoIndice: indice.items.length,
    ufAtual: cursor.ufs[cursor.ufIdx] ?? "Brasil",
    etapa: varreduraTerminou ? "localizando_cidades" : "lendo_pncp",
    ultimoSinalEm: Date.now(),
  });
}

async function faseLocalizandoCidades(prazoFinal: number): Promise<void> {
  const pendentes = await municipiosSemCoordenada();
  const resolvidas: Array<{
    municipio: string;
    uf: string;
    lat: number;
    lon: number;
  }> = [];

  let restantes = pendentes.length;
  for (const { municipio, uf } of pendentes) {
    if (Date.now() + MARGEM_CIDADE_MS >= prazoFinal) break;
    const coords = await geocodeMunicipio(municipio, uf);
    restantes -= 1;
    if (coords) resolvidas.push({ municipio, uf, lat: coords.lat, lon: coords.lon });
  }

  await aplicarCoordenadas(resolvidas);
  await atualizarStatusColeta({
    cidadesPendentes: restantes,
    // Cidade que o Nominatim não conhece continuaria pendente pra sempre e
    // travaria a fase; só avança quando não sobra ninguém pra tentar.
    etapa: restantes <= 0 ? "triando" : "localizando_cidades",
    ultimoSinalEm: Date.now(),
  });
}

async function faseTriando(prazoFinal: number): Promise<void> {
  const status = await lerStatusColeta();
  const settings = await getSettings();
  const indice = await lerIndice();

  const novas = new Set(status.cursor?.novas ?? []);
  const candidatas = indice.items.filter(
    (item) =>
      novas.has(item.numeroControlePNCP) &&
      item.triagem === null &&
      passaNoFiltroDePalavras(
        item,
        settings.licitacaoKeywords,
        settings.licitacaoExclusoes
      )
  );

  if (candidatas.length && triagemDisponivel() && Date.now() + MARGEM_TRIAGEM_MS < prazoFinal) {
    // Uma fatia por chamada: cada lote é uma ida ao modelo, e o orçamento de
    // tempo aqui é o mesmo da requisição.
    const fatia = candidatas.slice(0, 30);
    const vereditos = await triarLicitacoes(
      fatia.map((i) => ({ numeroControlePNCP: i.numeroControlePNCP, objeto: i.objeto }))
    );
    await aplicarTriagens(vereditos);
    if (vereditos.size) {
      console.log(
        `[coleta] triagem: ${[...vereditos.values()].filter((v) => v.serve).length} de ${vereditos.size} servem.`
      );
    }
    // Sobrou candidata: volta noutra chamada.
    if (fatia.length < candidatas.length && vereditos.size) {
      await atualizarStatusColeta({ ultimoSinalEm: Date.now() });
      return;
    }
  }

  await finalizar();
}

async function finalizar(): Promise<void> {
  const status = await lerStatusColeta();
  const settings = await getSettings();

  const leuAlgo = status.paginasLidas > 0;
  const removidas = await podarEFinalizarIndice(CARENCIA_APOS_PRAZO_MS, leuAlgo);
  const indice = await lerIndice();

  // ----- avisa sobre as novidades que de fato interessam à Embastel
  const novas = new Set(status.cursor?.novas ?? []);
  const lojaLat = settings.storeLat;
  const lojaLon = settings.storeLon;

  const interessantes =
    lojaLat != null && lojaLon != null
      ? indice.items.filter((item) => {
          if (!novas.has(item.numeroControlePNCP)) return false;
          if (!dentroDoRaio(item, lojaLat, lojaLon, settings.licitacaoRaioKm)) return false;
          if (
            !passaNoFiltroDePalavras(
              item,
              settings.licitacaoKeywords,
              settings.licitacaoExclusoes
            )
          ) {
            return false;
          }
          // A IA tem a última palavra quando opinou. Sem chave configurada ela
          // não opina, e aí vale o filtro por palavra — melhor avisar demais do
          // que deixar passar oportunidade.
          return item.triagem ? item.triagem.serve : true;
        })
      : [];

  await criarNotificacoes(
    interessantes.map((item) => ({
      tipo: "licitacao_nova" as const,
      titulo: `Licitação nova em ${item.municipio}/${item.uf}`,
      texto: item.objeto.slice(0, 160),
      href: "/painel/licitacoes",
      chave: `licitacao_nova:${item.numeroControlePNCP}`,
    }))
  );

  await atualizarStatusColeta({
    rodando: false,
    ultimoSinalEm: null,
    terminadaEm: Date.now(),
    etapa: "concluida",
    ufAtual: null,
    cursor: null,
    itensNoIndice: indice.items.length,
    novasNaUltimaColeta: interessantes.length,
    cidadesPendentes: 0,
    erro: !leuAlgo
      ? "O PNCP não respondeu nenhuma consulta desta rodada — em geral é a API deles fora do ar, e não algo do painel. O índice anterior foi mantido e a próxima rodada tenta de novo."
      : status.cursor?.falhas
        ? // Página, e não "bloco": desde 18/08/2026 uma recusa isolada faz
          // pular só aquela página. Dizer "bloco" dava a impressão de um
          // buraco muito maior do que o real.
          `O PNCP não respondeu ${status.cursor.falhas} página(s). O resto foi salvo — a próxima coleta tenta de novo.`
        : null,
  });

  console.log(
    `[coleta] concluída: ${indice.items.length} no índice (${removidas} vencida(s) removida(s)), ${interessantes.length} novidade(s) que interessam.`
  );
}

/**
 * Trabalha por no máximo `orcamentoMs` e devolve o estado. Chamar de novo
 * continua de onde parou. Devolve `concluida: true` quando a varredura acabou.
 */
export async function avancarColeta(orcamentoMs: number): Promise<ColetaStatus> {
  const prazoFinal = Date.now() + orcamentoMs;

  let status = await lerStatusColeta();

  // Nenhuma varredura em andamento: começa uma.
  if (!status.rodando || !status.cursor) {
    const assumiu = await tentarAssumirColeta();
    if (!assumiu) return lerStatusColeta();
    try {
      const cursor = await montarCursor();
      status = await atualizarStatusColeta({
        cursor,
        etapa: "lendo_pncp",
        paginasLidas: 0,
        registrosLidos: 0,
        ultimoSinalEm: Date.now(),
      });
    } catch (erro) {
      return atualizarStatusColeta({
        rodando: false,
        ultimoSinalEm: null,
        etapa: "ociosa",
        erro: erro instanceof Error ? erro.message : "Erro ao iniciar a coleta",
      });
    }
  }

  try {
    switch (status.etapa) {
      case "lendo_pncp":
        await faseLendoPncp(status, prazoFinal);
        break;
      case "localizando_cidades":
        await faseLocalizandoCidades(prazoFinal);
        break;
      case "triando":
        await faseTriando(prazoFinal);
        break;
      default:
        await finalizar();
    }
  } catch (erro) {
    return atualizarStatusColeta({
      rodando: false,
      ultimoSinalEm: null,
      terminadaEm: Date.now(),
      etapa: "ociosa",
      cursor: null,
      erro: erro instanceof Error ? erro.message : "Erro desconhecido na coleta",
    });
  }

  return lerStatusColeta();
}

/**
 * Roda a coleta até o fim, chamando avancarColeta em laço. O processo do
 * painel fica vivo o tempo que precisar, tanto na sua máquina quanto no
 * servidor, então dá pra levar a varredura inteira de uma vez.
 */
export async function coletarAteOFim(): Promise<ColetaStatus> {
  let status = await lerStatusColeta();
  // Teto de segurança: 200 fatias de 30s é mais que suficiente pra qualquer
  // varredura, e impede laço infinito se alguma fase parar de avançar.
  for (let i = 0; i < 200; i++) {
    status = await avancarColeta(30_000);
    if (!status.rodando) break;
  }
  return status;
}

// Trava dentro do processo, pra duas chamadas locais não se atropelarem.
let coletaLocal: Promise<ColetaStatus> | null = null;

export function coletarLicitacoes(): Promise<ColetaStatus> {
  if (coletaLocal) return coletaLocal;
  coletaLocal = coletarAteOFim().finally(() => {
    coletaLocal = null;
  });
  return coletaLocal;
}

// ---------------------------------------------------------------------------
// Agendamento — ligado pelo instrumentation.ts quando o servidor sobe
// ---------------------------------------------------------------------------

let timer: ReturnType<typeof setInterval> | null = null;

export async function iniciarAgendadorDeColeta(): Promise<void> {
  if (timer) return;

  const settings = await getSettings();
  const intervaloMs = Math.max(1, settings.licitacaoIntervaloHoras) * 60 * 60 * 1000;

  const rodarSeNecessario = async () => {
    try {
      const config = await getSettings();
      if (config.storeLat == null || config.storeLon == null) return;
      const indice = await lerIndice();
      const idade = indice.atualizadoEm ? Date.now() - indice.atualizadoEm : Infinity;
      if (idade < intervaloMs) return;
      console.log("[coleta] iniciando varredura do PNCP...");
      await coletarLicitacoes();
    } catch (erro) {
      console.error("[coleta] falhou:", erro);
    }
  };

  setTimeout(rodarSeNecessario, 10_000);
  timer = setInterval(rodarSeNecessario, 30 * 60 * 1000);
}
