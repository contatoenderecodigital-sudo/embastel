import { criarNotificacoes } from "./notificacoesDb";
import { listTracked } from "./licitacoesTrackingDb";
import { listConversations } from "./whatsappDb";
import { listProdutos } from "./estoqueDb";

// Verificador de avisos. Roda em segundo plano enquanto o servidor está no ar
// e transforma em notificação as coisas que antes só apareciam se alguém
// estivesse olhando a tela na hora certa.

const INTERVALO_MS = 5 * 60 * 1000;

// Prazo já vencido devolve -1 de propósito: Math.ceil de fração negativa
// devolve -0, e `-0 < 0` é falso — sem isso, uma licitação que fechou de
// manhã ainda dispararia o aviso de "fecha hoje" à noite.
function diasAte(dataISO: string | null): number | null {
  if (!dataISO) return null;
  const alvo = new Date(dataISO).getTime();
  if (Number.isNaN(alvo)) return null;
  const restante = alvo - Date.now();
  if (restante < 0) return -1;
  return Math.ceil(restante / 86400000);
}

export async function verificarAvisos(): Promise<void> {
  const pendentes: Parameters<typeof criarNotificacoes>[0] = [];

  // ----- licitações do funil com prazo chegando
  const acompanhadas = await listTracked();
  for (const item of acompanhadas) {
    if (item.status === "ganhou" || item.status === "perdeu") continue;
    const dias = diasAte(item.dataEncerramentoProposta);
    if (dias === null || dias < 0) continue;

    // Dois toques: um de antecedência (3 dias) e outro de urgência (1 dia).
    // A chave inclui o marco, então cada um avisa uma vez só.
    for (const marco of [3, 1]) {
      if (dias > marco) continue;
      pendentes.push({
        tipo: "licitacao_prazo",
        titulo:
          marco === 1
            ? `Fecha ${dias === 0 ? "hoje" : "amanhã"}: ${item.orgao}`
            : `Faltam ${dias} dia(s): ${item.orgao}`,
        texto: item.objeto.slice(0, 160),
        href: "/painel/licitacoes",
        chave: `licitacao_prazo:${item.numeroControlePNCP}:${marco}`,
      });
      break;
    }
  }

  // ----- conversas de WhatsApp que a IA não teve segurança de responder
  const conversas = await listConversations();
  for (const conversa of conversas) {
    if (!conversa.needsAttention) continue;
    pendentes.push({
      tipo: "whatsapp",
      titulo: `${conversa.name ?? conversa.waId} está esperando resposta`,
      texto: conversa.needsAttentionReason ?? "A IA preferiu não responder sozinha.",
      href: "/painel/whatsapp",
      // lastMessageAt na chave: se a pessoa mandar mensagem de novo depois de
      // resolvido, vira um aviso novo em vez de ficar mudo.
      chave: `whatsapp:${conversa.waId}:${conversa.lastMessageAt}`,
    });
  }

  // ----- produtos que zeraram
  const produtos = await listProdutos();
  for (const produto of produtos) {
    if (produto.situacao !== "falta") continue;
    pendentes.push({
      tipo: "estoque",
      titulo: `Acabou: ${produto.nome}`,
      texto: `Fornecedor ${produto.fornecedor}. Marcado como em falta.`,
      href: "/painel/estoque",
      chave: `estoque:${produto.id}:${produto.atualizadoEm}`,
    });
  }

  await criarNotificacoes(pendentes);
}

let timer: ReturnType<typeof setInterval> | null = null;

export function iniciarVerificadorDeAvisos(): void {
  if (timer) return;
  const rodar = () => {
    verificarAvisos().catch((error) =>
      console.error("[avisos] falhou:", error)
    );
  };
  setTimeout(rodar, 15_000);
  timer = setInterval(rodar, INTERVALO_MS);
}
