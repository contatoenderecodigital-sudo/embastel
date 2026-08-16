import { NextRequest, NextResponse } from "next/server";
import {
  criarDocumento,
  diasAteVencer,
  hojeISO,
  listDocumentos,
  situacaoDe,
} from "@/lib/documentosDb";
import { CATEGORIAS, TIPOS_DOCUMENTO } from "@/lib/documentosTipos";

export const dynamic = "force-dynamic";

export async function GET() {
  const hoje = hojeISO();
  const documentos = await listDocumentos();

  const comSituacao = documentos.map((doc) => ({
    ...doc,
    situacao: situacaoDe(doc, hoje),
    diasParaVencer:
      doc.dataValidade && !doc.naoVence
        ? diasAteVencer(doc.dataValidade, hoje)
        : null,
  }));

  // O que o edital vai pedir e a Embastel ainda não tem cadastrado. É a
  // pergunta que a biblioteca da Licitar Digital não consegue responder,
  // porque lá o documento não tem tipo.
  const cadastrados = new Set(documentos.map((d) => d.tipoId));
  const faltando = TIPOS_DOCUMENTO.filter(
    (t) => t.essencial && !cadastrados.has(t.id)
  ).map((t) => ({ id: t.id, nome: t.nome, categoria: t.categoria }));

  return NextResponse.json({
    documentos: comSituacao,
    tipos: TIPOS_DOCUMENTO,
    categorias: CATEGORIAS,
    faltando,
    resumo: {
      total: documentos.length,
      vencidos: comSituacao.filter((d) => d.situacao === "vencido").length,
      venceEmBreve: comSituacao.filter((d) => d.situacao === "vence_em_breve").length,
      semArquivo: comSituacao.filter((d) => d.situacao === "sem_arquivo").length,
      faltando: faltando.length,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const doc = await criarDocumento(body);
    return NextResponse.json({ documento: doc }, { status: 201 });
  } catch (erro) {
    return NextResponse.json(
      {
        error:
          erro instanceof Error ? erro.message : "Não deu pra cadastrar o documento.",
      },
      { status: 400 }
    );
  }
}
