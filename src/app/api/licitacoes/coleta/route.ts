import { NextRequest, NextResponse } from "next/server";
import { lerIndice, lerStatusColeta } from "@/lib/licitacoesIndexDb";
import { coletarLicitacoes } from "@/lib/pncpCollector";
import { getSettings, updateLicitacaoSettings } from "@/lib/settingsDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const [status, indice, settings] = await Promise.all([
    lerStatusColeta(),
    lerIndice(),
    getSettings(),
  ]);
  return NextResponse.json({
    status,
    atualizadoEm: indice.atualizadoEm,
    totalNoIndice: indice.items.length,
    config: {
      raioKm: settings.licitacaoRaioKm,
      dias: settings.licitacaoDias,
      modalidades: settings.licitacaoModalidades,
      keywords: settings.licitacaoKeywords,
      exclusoes: settings.licitacaoExclusoes,
      intervaloHoras: settings.licitacaoIntervaloHoras,
      pausada: settings.licitacaoColetaPausada,
    },
  });
}

export async function POST() {
  const settings = await getSettings();
  if (settings.storeLat == null || settings.storeLon == null) {
    return NextResponse.json(
      { error: "Salve o endereço da loja primeiro — a coleta usa ele como centro." },
      { status: 400 }
    );
  }

  // Dispara e responde na hora: a coleta lê centenas de páginas do PNCP e
  // levaria minutos — quem acompanha o progresso é o GET acima. Se já houver
  // uma coleta viva, a trava em arquivo dentro do coletor ignora esta chamada.
  void coletarLicitacoes();
  return NextResponse.json({ iniciada: true });
}

// Ajusta o que a coleta automática procura (raio, período, modalidades e as
// palavras-chave que definem o que vira notificação de "licitação nova").
export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as {
    raioKm?: number;
    dias?: number;
    modalidades?: number[];
    keywords?: string[];
    exclusoes?: string[];
    intervaloHoras?: number;
    pausada?: boolean;
  };

  const settings = await updateLicitacaoSettings({
    licitacaoRaioKm: body.raioKm,
    licitacaoDias: body.dias,
    licitacaoModalidades: body.modalidades,
    licitacaoKeywords: body.keywords,
    licitacaoExclusoes: body.exclusoes,
    licitacaoIntervaloHoras: body.intervaloHoras,
    licitacaoColetaPausada: body.pausada,
  });

  return NextResponse.json({
    config: {
      raioKm: settings.licitacaoRaioKm,
      dias: settings.licitacaoDias,
      modalidades: settings.licitacaoModalidades,
      keywords: settings.licitacaoKeywords,
      exclusoes: settings.licitacaoExclusoes,
      intervaloHoras: settings.licitacaoIntervaloHoras,
      pausada: settings.licitacaoColetaPausada,
    },
  });
}
