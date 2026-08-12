import { NextRequest, NextResponse } from "next/server";
import { getSettings, setStoreLocation } from "@/lib/settingsDb";
import { geocodeAddress } from "@/lib/geocode";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    address: settings.storeAddress,
    lat: settings.storeLat,
    lon: settings.storeLon,
  });
}

export async function POST(request: NextRequest) {
  const { address } = (await request.json()) as { address?: string };
  if (!address || !address.trim()) {
    return NextResponse.json({ error: "Endereço obrigatório" }, { status: 400 });
  }

  const coords = await geocodeAddress(address.trim());
  if (!coords) {
    return NextResponse.json(
      {
        error:
          "Não encontramos esse endereço. Tenta ser mais específico (rua, número, cidade, UF).",
      },
      { status: 422 }
    );
  }

  const settings = await setStoreLocation(address.trim(), coords.lat, coords.lon);
  return NextResponse.json({
    address: settings.storeAddress,
    lat: settings.storeLat,
    lon: settings.storeLon,
  });
}
