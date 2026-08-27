import { jsonStore } from "./jsonStore";
import { DEFAULT_EXCLUSOES, DEFAULT_KEYWORDS, DEFAULT_MODALIDADES } from "./pncpTypes";

export type Settings = {
  aiAutoReplyEnabled: boolean;
  storeAddress: string | null;
  storeLat: number | null;
  storeLon: number | null;
  // Configuração da coleta automática de licitações. Fica aqui (e não na
  // tela) porque o coletor roda em segundo plano, sem ninguém olhando: ele
  // precisa saber sozinho o que procurar e até onde.
  licitacaoKeywords: string[];
  // Termos que descartam a licitação mesmo tendo casado com uma palavra-chave
  // (ver DEFAULT_EXCLUSOES em pncpTypes.ts).
  licitacaoExclusoes: string[];
  licitacaoRaioKm: number;
  licitacaoModalidades: number[];
  licitacaoDias: number;
  // Intervalo entre coletas automáticas, em horas.
  licitacaoIntervaloHoras: number;
};

const defaults: Settings = {
  // Desligado por padrão: só liga depois que o dono configurar os avisos do dia
  // e decidir conscientemente deixar a IA responder sozinha no WhatsApp.
  aiAutoReplyEnabled: false,
  storeAddress: null,
  storeLat: null,
  storeLon: null,
  licitacaoKeywords: DEFAULT_KEYWORDS,
  licitacaoExclusoes: DEFAULT_EXCLUSOES,
  // 175 km é o recorte que a loja usa pra decidir se vale entregar. Foi 250
  // até 27/08/2026.
  //
  // CUIDADO com a expectativa: mexer aqui NÃO diminui o que se lê do PNCP.
  // O raio escolhe os ESTADOS a varrer (com folga de 300 km sobre o centro de
  // cada um), e de Xanxerê tanto 175 quanto 250 dão os mesmos SC, PR e RS — na
  // prática qualquer valor acima de 8 km dá os três. Depois disso o raio só
  // filtra o que já foi baixado, decidindo o que vira notificação.
  //
  // Quem controla o volume de páginas é `licitacaoDias` (a janela de datas) e
  // a quantidade de modalidades.
  licitacaoRaioKm: 175,
  licitacaoModalidades: DEFAULT_MODALIDADES,
  licitacaoDias: 30,
  licitacaoIntervaloHoras: 6,
};

const store = jsonStore<Settings>("settings.json", defaults);

// O arquivo salvo pode ser de uma versão anterior do painel, sem os campos
// novos — completa com os padrões em vez de devolver undefined pro resto do
// código.
function comPadroes(data: Partial<Settings>): Settings {
  return { ...defaults, ...data };
}

export async function getSettings(): Promise<Settings> {
  return comPadroes(await store.read());
}

export async function setAiAutoReplyEnabled(enabled: boolean): Promise<Settings> {
  return store.update((data) => {
    data.aiAutoReplyEnabled = enabled;
    return comPadroes(data);
  });
}

export async function setStoreLocation(
  address: string,
  lat: number,
  lon: number
): Promise<Settings> {
  return store.update((data) => {
    data.storeAddress = address;
    data.storeLat = lat;
    data.storeLon = lon;
    return comPadroes(data);
  });
}

export async function updateLicitacaoSettings(
  patch: Partial<
    Pick<
      Settings,
      | "licitacaoKeywords"
      | "licitacaoExclusoes"
      | "licitacaoRaioKm"
      | "licitacaoModalidades"
      | "licitacaoDias"
      | "licitacaoIntervaloHoras"
    >
  >
): Promise<Settings> {
  return store.update((data) => {
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        (data as Record<string, unknown>)[key] = value;
      }
    }
    return comPadroes(data);
  });
}
