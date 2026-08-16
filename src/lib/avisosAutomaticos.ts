import { criarNotificacoes } from "./notificacoesDb";
import { listTracked } from "./licitacoesTrackingDb";
import { listConversations } from "./whatsappDb";
import { listProdutos } from "./estoqueDb";
import {
  MARCOS_AVISO,
  diasAteVencer,
  hojeISO,
  listDocumentos,
} from "./documentosDb";

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

  // ----- certidões de habilitação chegando no vencimento
  //
  // É o aviso que mais protege dinheiro: perder na habilitação por uma CND
  // vencida significa perder uma licitação que já tinha sido ganha no preço.
  // Quatro marcos porque os prazos de renovação são muito diferentes entre si
  // — balanço depende do contador (60 dias), CRF do FGTS sai na hora (7).
  const hoje = hojeISO();
  const documentos = await listDocumentos();
  for (const doc of documentos) {
    if (doc.naoVence || !doc.dataValidade) continue;
    const dias = diasAteVencer(doc.dataValidade, hoje);

    if (dias < 0) {
      // Vencido avisa uma vez por dia, e não uma vez só: documento vencido
      // impede de participar, então não pode virar aviso lido e esquecido.
      pendentes.push({
        tipo: "documento",
        titulo: `VENCIDO: ${doc.nome}`,
        texto: `Venceu há ${Math.abs(dias)} dia(s). Sem ele a Embastel é inabilitada.`,
        href: "/painel/documentos",
        chave: `documento_vencido:${doc.id}:${hoje}`,
      });
      continue;
    }

    // Só o marco mais próximo dispara — sem isso, cadastrar um documento que
    // vence em 5 dias criaria os quatro avisos de uma vez.
    for (const marco of [...MARCOS_AVISO].sort((a, b) => a - b)) {
      if (dias > marco) continue;
      pendentes.push({
        tipo: "documento",
        titulo:
          dias === 0
            ? `Vence hoje: ${doc.nome}`
            : `Vence em ${dias} dia(s): ${doc.nome}`,
        texto: doc.orgaoEmissor
          ? `Emitido por ${doc.orgaoEmissor}. Renove antes da próxima sessão.`
          : "Renove antes da próxima sessão de licitação.",
        href: "/painel/documentos",
        chave: `documento_prazo:${doc.id}:${doc.dataValidade}:${marco}`,
      });
      break;
    }
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
