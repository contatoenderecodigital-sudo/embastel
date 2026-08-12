import { jsonStore } from "./jsonStore";

type Coords = { lat: number; lon: number };
type GeocodeCache = Record<string, Coords | null>;

const store = jsonStore<GeocodeCache>("geocode-cache.json", {});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// O Nominatim (geocodificador do OpenStreetMap, gratuito) exige um
// User-Agent identificando o app e no máximo ~1 requisição por segundo —
// respeitamos os dois. Ver https://operations.osmfoundation.org/policies/nominatim/
const USER_AGENT =
  "EmbastelPainel/1.0 (uso interno da Embastel Embalagens, embastelembalagens.com.br)";
let lastRequestAt = 0;

async function nominatimSearch(query: string): Promise<Coords | null> {
  const wait = 1100 - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

// Geocodifica um endereço livre (ex: da loja) — sempre busca ao vivo, sem
// cache, porque isso só roda quando o usuário salva/muda o endereço.
export async function geocodeAddress(address: string) {
  try {
    return await nominatimSearch(`${address}, Brasil`);
  } catch {
    return null;
  }
}

function cacheKey(municipio: string, uf: string) {
  return `${municipio.trim().toLowerCase()}|${uf.trim().toUpperCase()}`;
}

/**
 * Lê o cache inteiro de uma vez. Usado pela busca, que precisa da coordenada
 * de centenas de municípios de uma vez só e não pode ficar chamando o
 * Nominatim durante uma requisição do usuário.
 */
export async function getGeocodeCache(): Promise<GeocodeCache> {
  return store.read();
}

/** Coordenada já conhecida, sem tocar na rede. `undefined` = nunca consultado. */
export function lookupCached(
  cache: GeocodeCache,
  municipio: string,
  uf: string
): Coords | null | undefined {
  return cache[cacheKey(municipio, uf)];
}

// Geocodifica cidade+UF com cache local em disco — o mesmo município
// aparece repetido em várias licitações, então cachear evita bater no
// Nominatim de novo a cada busca (e evita estourar o limite de 1 req/s).
export async function geocodeMunicipio(
  municipio: string,
  uf: string
): Promise<Coords | null> {
  const key = cacheKey(municipio, uf);
  const cache = await store.read();
  if (key in cache) return cache[key];

  let result: Coords | null;
  try {
    result = await nominatimSearch(`${municipio}, ${uf}, Brasil`);
  } catch {
    result = null;
  }
  await store.update((data) => {
    data[key] = result;
  });
  return result;
}
