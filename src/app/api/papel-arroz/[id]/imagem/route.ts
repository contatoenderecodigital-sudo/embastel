import { NextResponse } from "next/server";
import { lerImagem } from "@/lib/papelArrozDb";

export const dynamic = "force-dynamic";

// Serve o arquivo da arte guardada. Fica atrás do login como todo o resto do
// painel (ver src/proxy.ts) — arte de cliente não é conteúdo público.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const imagem = await lerImagem(id);

  if (!imagem) {
    return NextResponse.json({ error: "Arte não encontrada." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(imagem.buffer), {
    headers: {
      "Content-Type": imagem.tipo,
      // O arquivo nunca muda depois de salvo (id novo a cada arte), então
      // vale cache longo — evita rebaixar a mesma arte a cada reimpressão.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
