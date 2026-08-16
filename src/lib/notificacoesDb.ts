import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";

export type TipoNotificacao =
  | "licitacao_nova"
  | "licitacao_prazo"
  | "whatsapp"
  | "estoque"
  | "documento"
  | "contrato"
  | "sistema";

export type Notificacao = {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  texto: string;
  href: string;
  criadoEm: number;
  lida: boolean;
  // Chave de deduplicação: impede que a mesma notificação (ex: "prazo
  // apertado" da mesma licitação) seja recriada a cada rodada do verificador.
  chave: string;
};

type NotificacoesData = {
  notificacoes: Notificacao[];
};

const store = jsonStore<NotificacoesData>("notificacoes.json", { notificacoes: [] });

// Mantém o arquivo pequeno — notificação velha e lida não serve pra nada.
const MAX_GUARDADAS = 200;

export async function listNotificacoes(): Promise<Notificacao[]> {
  const data = await store.read();
  return [...data.notificacoes].sort((a, b) => b.criadoEm - a.criadoEm);
}

export async function contarNaoLidas(): Promise<number> {
  const data = await store.read();
  return data.notificacoes.filter((n) => !n.lida).length;
}

/**
 * Cria a notificação só se ainda não existir uma com a mesma `chave`.
 * Devolve as que foram de fato criadas — é o que o front usa pra decidir se
 * toca o som e dispara a notificação do navegador.
 */
export async function criarNotificacoes(
  novas: Array<Omit<Notificacao, "id" | "criadoEm" | "lida">>
): Promise<Notificacao[]> {
  if (!novas.length) return [];
  return store.update((data) => {
    const existentes = new Set(data.notificacoes.map((n) => n.chave));
    const criadas: Notificacao[] = [];
    for (const nova of novas) {
      if (existentes.has(nova.chave)) continue;
      existentes.add(nova.chave);
      const notificacao: Notificacao = {
        ...nova,
        id: randomUUID(),
        criadoEm: Date.now(),
        lida: false,
      };
      data.notificacoes.push(notificacao);
      criadas.push(notificacao);
    }
    if (data.notificacoes.length > MAX_GUARDADAS) {
      data.notificacoes.sort((a, b) => b.criadoEm - a.criadoEm);
      data.notificacoes = data.notificacoes.slice(0, MAX_GUARDADAS);
    }
    return criadas;
  });
}

export async function marcarLida(id: string): Promise<void> {
  await store.update((data) => {
    const notificacao = data.notificacoes.find((n) => n.id === id);
    if (notificacao) notificacao.lida = true;
  });
}

export async function marcarTodasLidas(): Promise<void> {
  await store.update((data) => {
    for (const notificacao of data.notificacoes) notificacao.lida = true;
  });
}

export async function limparLidas(): Promise<void> {
  await store.update((data) => {
    data.notificacoes = data.notificacoes.filter((n) => !n.lida);
  });
}
