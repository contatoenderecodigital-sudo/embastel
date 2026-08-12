import { NextRequest, NextResponse } from "next/server";
import { searchLicitacoes } from "@/lib/pncp";
import { getSettings } from "@/lib/settingsDb";

export const dynamic = "force-dynamic";

// Filtra o índice local montado pelo coletor (ver src/lib/pncpCollector.ts).
// Não toca no PNCP — responde em milissegundos.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const keywords = (searchParams.get("keywords") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  // A lista de exclusões vem das configurações, não da URL: ela é a mesma que
  // o coletor usa pra decidir o que vira notificação, então tem que ser uma só.
  const { licitacaoExclusoes } = await getSettings();
  const uf = searchParams.get("uf") || undefined;
  const minDeadlineDays = searchParams.get("minDeadlineDays")
    ? Number(searchParams.get("minDeadlineDays"))
    : undefined;
  const raioKm = searchParams.get("raioKm") ? Number(searchParams.get("raioKm")) : undefined;
  const modalidadesParam = searchParams.get("modalidades");
  const modalidades = modalidadesParam
    ? modalidadesParam
        .split(",")
        .map(Number)
        .filter((n) => !Number.isNaN(n))
    : undefined;

  let raio: { lat: number; lon: number; km: number } | undefined;
  if (raioKm) {
    const settings = await getSettings();
    if (settings.storeLat == null || settings.storeLon == null) {
      return NextResponse.json(
        { error: "Configure o endereço da loja antes de buscar por raio." },
        { status: 400 }
      );
    }
    raio = { lat: settings.storeLat, lon: settings.storeLon, km: raioKm };
  }

  try {
    const result = await searchLicitacoes({
      keywords,
      exclusoes: licitacaoExclusoes,
      uf,
      modalidades,
      minDeadlineDays,
      raio,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro na busca" },
      { status: 500 }
    );
  }
}
