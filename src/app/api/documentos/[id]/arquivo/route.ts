import { NextRequest, NextResponse } from "next/server";
import { anexarArquivo, lerArquivo } from "@/lib/documentosDb";

export const dynamic = "force-dynamic";
// Certidão escaneada e balanço passam fácil de alguns MB; o tempo padrão não
// dá conta de receber e gravar isso numa conexão ruim.
export const maxDuration = 60;

/** Baixa o arquivo atual, ou uma versão antiga via ?versao=<id>. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const versao = request.nextUrl.searchParams.get("versao") ?? undefined;
  const arquivo = await lerArquivo(id, versao);
  if (!arquivo) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(arquivo.buffer), {
    headers: {
      "Content-Type": arquivo.tipo,
      // inline pro PDF abrir na aba; o nome fica correto se a pessoa salvar.
      "Content-Disposition": `inline; filename="${encodeURIComponent(arquivo.nome)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const form = await request.formData();
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }
    const doc = await anexarArquivo(id, {
      nome: arquivo.name,
      buffer: Buffer.from(await arquivo.arrayBuffer()),
    });
    if (!doc) {
      return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ documento: doc });
  } catch (erro) {
    return NextResponse.json(
      { error: erro instanceof Error ? erro.message : "Não deu pra enviar o arquivo." },
      { status: 400 }
    );
  }
}
