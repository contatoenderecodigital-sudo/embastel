import { jsonStore } from "./jsonStore";

// As licitações que a pessoa olhou e disse "essa não me serve".
//
// POR QUE UMA LISTA SEPARADA, e não apagar do índice: o coletor varre o PNCP
// de 6 em 6 horas e regrava o índice. Apagar de lá faria a mesma licitação
// voltar na próxima rodada, e a pessoa descartaria de novo, pra sempre. Aqui
// o descarte é uma decisão que fica — o índice continua sendo o retrato do
// que o PNCP tem, e esta lista é o que a casa já resolveu ignorar.
//
// Guarda-se o motivo porque descarte é decisão de negócio: seis meses depois
// ninguém lembra por que aquele pregão de R$ 400 mil foi jogado fora, e sem o
// motivo não dá pra saber se a regra mudou.

export type LicitacaoDescartada = {
  numeroControlePNCP: string;
  /** Guardado só pra tela do histórico não precisar cruzar com o índice. */
  objeto: string;
  municipio: string;
  uf: string;
  motivo: string;
  descartadaEm: number;
};

type Dados = { items: LicitacaoDescartada[] };

const store = jsonStore<Dados>("licitacoes-descartadas.json", { items: [] });

export async function listarDescartadas(): Promise<LicitacaoDescartada[]> {
  const d = await store.read();
  return [...d.items].sort((a, b) => b.descartadaEm - a.descartadaEm);
}

/** Só os números, que é o que a busca precisa pra filtrar rápido. */
export async function numerosDescartados(): Promise<Set<string>> {
  const d = await store.read();
  return new Set(d.items.map((i) => i.numeroControlePNCP));
}

export async function descartar(entrada: {
  numeroControlePNCP: string;
  objeto?: string;
  municipio?: string;
  uf?: string;
  motivo?: string;
}): Promise<LicitacaoDescartada[]> {
  const d = await store.update((data) => {
    const numero = entrada.numeroControlePNCP.trim();
    if (!numero) return data;
    // Descartar duas vezes é o mesmo que descartar uma — a tela pode mandar
    // repetido se a pessoa clicar rápido, e isso não pode virar linha dobrada.
    if (data.items.some((i) => i.numeroControlePNCP === numero)) return data;
    data.items.push({
      numeroControlePNCP: numero,
      objeto: entrada.objeto ?? "",
      municipio: entrada.municipio ?? "",
      uf: entrada.uf ?? "",
      motivo: (entrada.motivo ?? "").trim(),
      descartadaEm: Date.now(),
    });
    return data;
  });
  return [...d.items].sort((a, b) => b.descartadaEm - a.descartadaEm);
}

/** Desfaz o descarte — a licitação volta a aparecer na busca. */
export async function restaurar(numeroControlePNCP: string): Promise<LicitacaoDescartada[]> {
  const d = await store.update((data) => {
    data.items = data.items.filter(
      (i) => i.numeroControlePNCP !== numeroControlePNCP
    );
    return data;
  });
  return [...d.items].sort((a, b) => b.descartadaEm - a.descartadaEm);
}
