export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Centroide aproximado de cada UF — só serve pra decidir rapidamente quais
// estados vale a pena consultar no PNCP antes de filtrar por distância real
// (cidade a cidade, via geocodeMunicipio). Não é preciso o suficiente pra
// medir distância final, só pra descartar estados obviamente longe demais.
export const UF_CENTROID: Record<string, { lat: number; lon: number }> = {
  AC: { lat: -9.02, lon: -70.81 },
  AL: { lat: -9.57, lon: -36.78 },
  AP: { lat: 1.41, lon: -51.78 },
  AM: { lat: -4.0, lon: -65.0 },
  BA: { lat: -12.58, lon: -41.7 },
  CE: { lat: -5.2, lon: -39.5 },
  DF: { lat: -15.8, lon: -47.86 },
  ES: { lat: -19.5, lon: -40.6 },
  GO: { lat: -15.9, lon: -49.6 },
  MA: { lat: -5.0, lon: -45.5 },
  MT: { lat: -12.7, lon: -56.0 },
  MS: { lat: -20.5, lon: -54.7 },
  MG: { lat: -18.7, lon: -44.5 },
  PA: { lat: -5.0, lon: -52.5 },
  PB: { lat: -7.2, lon: -36.8 },
  PR: { lat: -24.7, lon: -51.6 },
  PE: { lat: -8.4, lon: -37.8 },
  PI: { lat: -7.5, lon: -42.8 },
  RJ: { lat: -22.3, lon: -42.7 },
  RN: { lat: -5.6, lon: -36.6 },
  RS: { lat: -29.5, lon: -53.4 },
  RO: { lat: -10.9, lon: -62.8 },
  RR: { lat: 2.0, lon: -61.5 },
  SC: { lat: -27.4, lon: -50.6 },
  SP: { lat: -22.2, lon: -48.8 },
  SE: { lat: -10.6, lon: -37.4 },
  TO: { lat: -10.3, lon: -48.3 },
};

// Estados são grandes — o centróide não representa bem a borda, então é
// preciso uma margem pra não descartar um vizinho que tem cidade colada na
// divisa. Mas exagerar custa caro: a 450km de margem, um raio de 250km a
// partir de Xanxerê ainda puxava São Paulo (centróide a ~600km), e o coletor
// gastava umas 450 páginas de leitura num estado cuja cidade mais próxima
// está a mais de 500km — nenhuma entraria no filtro final de distância.
// 300km cobre a largura típica da metade de um estado do Sul/Sudeste.
const UF_CENTROID_BUFFER_KM = 300;

export function candidateUfsForRadius(
  lat: number,
  lon: number,
  km: number
): (string | undefined)[] {
  // Raio muito grande: mais vale buscar sem filtro de UF (nacional) do que
  // montar uma lista enorme de estados candidatos.
  if (km >= 1200) return [undefined];

  const candidates = Object.entries(UF_CENTROID)
    .filter(([, c]) => haversineKm(lat, lon, c.lat, c.lon) <= km + UF_CENTROID_BUFFER_KM)
    .map(([uf]) => uf);

  return candidates.length ? candidates : [undefined];
}
