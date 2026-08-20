import { randomUUID } from "node:crypto";
import { calcularPrecos, margemNoPreco, PADROES } from "./catalogoDb";
import { registrarCotacao } from "./cotacoesDb";
import { jsonStore } from "./jsonStore";
import { buscarItens } from "./pncpItens";

// A planilha de disputa: até quanto dá pra baixar em cada lote, durante o
// pregão.
//
// POR QUE NÃO É O CATÁLOGO. O catálogo guarda produto com custo e margem
// fixos. Não serve, e o motivo é a forma como a cotação acontece de verdade:
// o preço que o fornecedor faz depende da QUANTIDADE que aquele edital pede —
// pergunta-se "quanto você me faz de 5.000 unidades", e a resposta muda a cada
// edital. Custo, então, não é atributo do produto; é um número daquela
// disputa. Cadastrar produto por produto com margem fixa dá trabalho antes e
// entrega um número errado depois.
//
// PARA QUE SERVE, NA PRÁTICA. No pregão eletrônico a sala de disputa aceita
// lance de poucos em poucos segundos e a tela do portal não mostra custo,
// frete nem imposto — só o preço de referência do órgão. Sem esta planilha a
// conta de "posso cobrir esse lance?" é feita de cabeça, no susto. Aqui ela
// já está pronta: cada lote com o PISO calculado, pra bater o olho e responder.
//
// Os lotes vêm do próprio PNCP (numeroItem, descrição, unidade, quantidade e
// valor estimado), então ninguém digita a planilha do edital. O que se
// preenche é uma coluna só: quanto o fornecedor cotou.

export type LoteDisputa = {
  id: string;
  /** Número do item/lote no edital. */
  numero: string;
  descricao: string;
  unidade: string;
  /** Quantidade que o edital pede — é sobre ela que se pede a cotação. */
  quantidade: number;
  /** Preço de referência do órgão, por unidade. Vem do PNCP. */
  referenciaUnitaria: number | null;

  /** De quem veio a cotação — a empresa. Texto livre. */
  fornecedor: string;
  /**
   * A marca do produto ofertado.
   *
   * Campo separado do fornecedor de propósito: são coisas diferentes e o
   * pregão cobra as duas. A proposta tem que declarar a marca item por item, e
   * um mesmo fornecedor trabalha com várias (o Gota Limpa e o Mileva chegaram
   * na mesma lista). Declarar marca errada, ou não declarar, desclassifica.
   */
  marca: string;
  /** Quanto o fornecedor cobra por unidade NESSA quantidade. */
  custoUnitario: number;
  /** Frete do lote inteiro. É rateado pela quantidade na hora da conta. */
  freteTotal: number;
  /** Impostos sobre a venda, em % do preço de venda. */
  percentualImpostos: number;
  /** Margem mínima aceitável, em % sobre o preço de venda. */
  margemAlvo: number;

  /** Último lance dado na sessão, pra ver a margem que sobrou. */
  meuLance: number | null;
  /** Fora da disputa: some da tela de pregão sem perder o registro. */
  descartado: boolean;
  observacao: string;
};

export type Disputa = {
  numeroControlePNCP: string;
  /** Aplicados a todo lote novo. Poupam redigitar em edital de 126 lotes. */
  impostoPadrao: number;
  margemPadrao: number;
  lotes: LoteDisputa[];
  criadoEm: string;
  atualizadoEm: string;
};

type Dados = { disputas: Disputa[] };

const store = jsonStore<Dados>("disputas.json", { disputas: [] });

function agora(): string {
  return new Date().toISOString();
}

function novaDisputa(numeroControlePNCP: string): Disputa {
  const t = agora();
  return {
    numeroControlePNCP,
    impostoPadrao: PADROES.percentualImpostos,
    margemPadrao: PADROES.margemAlvo,
    lotes: [],
    criadoEm: t,
    atualizadoEm: t,
  };
}

// ---------------------------------------------------------------- a conta --

export type LoteCalculado = LoteDisputa & {
  /** Custo de aquisição por unidade, já com o frete rateado. */
  custoTotalUnitario: number;
  /** O número que importa: abaixo disto o lance come a margem. */
  pisoUnitario: number;
  /** Onde a margem zera. Abaixo daqui a venda dá prejuízo. */
  empateUnitario: number;
  pisoTotal: number;
  /**
   * Quanto dá pra cair a partir da referência do órgão até bater no piso, em %.
   * É o fôlego da disputa: 40% quer dizer que dá pra brigar; 3% quer dizer que
   * não vale entrar.
   */
  folgaPercentual: number | null;
  /** Margem real se o lance atual for o vencedor. */
  margemDoLance: number | null;
  /** O lance já passou do piso. */
  abaixoDoPiso: boolean;

  /**
   * O preço em que a conta de faturamento e lucro é feita.
   *
   * É o lance que já foi dado, quando existe; senão o preço de referência do
   * órgão. Referência é o teto — a disputa só empurra pra baixo — então o que
   * sai daqui é o melhor caso, e não uma promessa.
   */
  precoConsiderado: number | null;
  /** Quanto a prefeitura paga por este lote nesse preço. */
  faturamentoPrevisto: number;
  /** O que sobra depois do imposto e do custo. É o lucro do lote. */
  lucroPrevisto: number;
  /** O mesmo, se a disputa empurrar até o piso — o pior caso aceitável. */
  lucroNoPiso: number;
  /** O lote fecha: dá pra vender acima do piso. */
  vale: boolean;
};

export function calcularLote(l: LoteDisputa): LoteCalculado {
  // O frete costuma ser cobrado pelo carregamento inteiro, não por unidade.
  // Rateia pela quantidade do lote; quantidade zerada não pode virar divisão
  // por zero (daria Infinity no piso e a tela mostraria lixo no meio do pregão).
  const freteUnitario = l.quantidade > 0 ? l.freteTotal / l.quantidade : 0;
  const { custoTotal, precoMinimo, precoEmpate } = calcularPrecos({
    custo: l.custoUnitario,
    freteUnitario,
    percentualImpostos: l.percentualImpostos,
    margemAlvo: l.margemAlvo,
  });

  const folga =
    l.referenciaUnitaria && l.referenciaUnitaria > 0
      ? (l.referenciaUnitaria - precoMinimo) / l.referenciaUnitaria
      : null;

  // O lance dado manda; sem ele, a referência do órgão.
  const preco = l.meuLance ?? l.referenciaUnitaria;

  return {
    ...l,
    // Lote gravado antes do campo existir vem sem marca; sem isso a tela
    // receberia undefined e quebraria no .trim() do formulário.
    marca: l.marca ?? "",
    custoTotalUnitario: custoTotal,
    pisoUnitario: precoMinimo,
    empateUnitario: precoEmpate,
    pisoTotal: precoMinimo * l.quantidade,
    folgaPercentual: folga,
    margemDoLance:
      l.meuLance != null
        ? margemNoPreco(
            {
              custo: l.custoUnitario,
              freteUnitario,
              percentualImpostos: l.percentualImpostos,
            },
            l.meuLance
          )
        : null,
    // Sem custo cotado não existe piso de verdade — o piso seria zero e todo
    // lance pareceria seguro. Nesse estado nunca se acusa "abaixo do piso".
    abaixoDoPiso:
      l.meuLance != null && l.custoUnitario > 0 && l.meuLance < precoMinimo,

    precoConsiderado: preco,
    faturamentoPrevisto: preco != null ? preco * l.quantidade : 0,
    // Lucro = o que entra menos o imposto sobre a venda, menos o que se pagou.
    // O imposto incide sobre o preço de venda, não sobre o custo.
    lucroPrevisto:
      preco != null && l.custoUnitario > 0
        ? (preco * (1 - (l.percentualImpostos || 0) / 100) - custoTotal) * l.quantidade
        : 0,
    lucroNoPiso:
      l.custoUnitario > 0
        ? (precoMinimo * (1 - (l.percentualImpostos || 0) / 100) - custoTotal) *
          l.quantidade
        : 0,
    vale: l.custoUnitario > 0 && folga != null && folga > 0,
  };
}

export type DisputaCalculada = Omit<Disputa, "lotes"> & {
  lotes: LoteCalculado[];
  totais: {
    lotes: number;
    cotados: number;
    semCusto: number;
    abaixoDoPiso: number;
    /** Quantos lotes cotados de fato dão lucro. */
    valem: number;
    /** Cotados que não fecham: o preço do fornecedor passou da referência. */
    naoFecham: number;
    /**
     * Faturamento e lucro somando SÓ os lotes que fecham.
     *
     * Só os que fecham de propósito: somar lote de prejuízo junto dava um
     * número que não corresponde a nenhuma decisão real — ninguém vai ofertar
     * onde perde dinheiro, então esse lote não entra na proposta e não deve
     * entrar no total.
     */
    faturamentoPrevisto: number;
    lucroPrevisto: number;
    /** O mesmo lucro, se a disputa empurrar tudo até o piso. */
    lucroNoPiso: number;
  };
};

function montar(d: Disputa): DisputaCalculada {
  const lotes = d.lotes.map(calcularLote);
  const valendo = lotes.filter((l) => !l.descartado);
  const cotados = valendo.filter((l) => l.custoUnitario > 0);
  const valem = cotados.filter((l) => l.vale);
  return {
    ...d,
    lotes,
    totais: {
      lotes: valendo.length,
      cotados: cotados.length,
      semCusto: valendo.length - cotados.length,
      abaixoDoPiso: valendo.filter((l) => l.abaixoDoPiso).length,
      valem: valem.length,
      naoFecham: cotados.length - valem.length,
      faturamentoPrevisto: valem.reduce((s, l) => s + l.faturamentoPrevisto, 0),
      lucroPrevisto: valem.reduce((s, l) => s + l.lucroPrevisto, 0),
      lucroNoPiso: valem.reduce((s, l) => s + l.lucroNoPiso, 0),
    },
  };
}

// ------------------------------------------------------------- leitura -----

export async function lerDisputa(
  numeroControlePNCP: string
): Promise<DisputaCalculada> {
  const data = await store.read();
  const achada = data.disputas.find(
    (d) => d.numeroControlePNCP === numeroControlePNCP
  );
  return montar(achada ?? novaDisputa(numeroControlePNCP));
}

/** Quantos lotes cada licitação já tem, pra listar na entrada da tela. */
export async function contagemPorLicitacao(): Promise<
  Record<string, { lotes: number; cotados: number }>
> {
  const data = await store.read();
  const mapa: Record<string, { lotes: number; cotados: number }> = {};
  for (const d of data.disputas) {
    const valendo = d.lotes.filter((l) => !l.descartado);
    mapa[d.numeroControlePNCP] = {
      lotes: valendo.length,
      cotados: valendo.filter((l) => l.custoUnitario > 0).length,
    };
  }
  return mapa;
}

// ------------------------------------------------------------- escrita -----

/** Pega (ou cria) a disputa dentro de uma transação já aberta. */
function pegar(data: Dados, numero: string): Disputa {
  let d = data.disputas.find((x) => x.numeroControlePNCP === numero);
  if (!d) {
    d = novaDisputa(numero);
    data.disputas.push(d);
  }
  return d;
}

type EntradaLote = Partial<Omit<LoteDisputa, "id">>;

function aplicarLote(l: LoteDisputa, e: EntradaLote): void {
  const num = (v: unknown, fallback = 0): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  if (e.numero !== undefined) l.numero = String(e.numero).trim();
  if (e.descricao !== undefined) l.descricao = e.descricao.trim();
  if (e.unidade !== undefined) l.unidade = e.unidade.trim() || "un";
  if (e.quantidade !== undefined) l.quantidade = Math.max(0, num(e.quantidade));
  if (e.referenciaUnitaria !== undefined) {
    const n = Number(e.referenciaUnitaria);
    l.referenciaUnitaria = Number.isFinite(n) && n > 0 ? n : null;
  }
  if (e.fornecedor !== undefined) l.fornecedor = e.fornecedor.trim();
  if (e.marca !== undefined) l.marca = e.marca.trim();
  if (e.custoUnitario !== undefined) l.custoUnitario = Math.max(0, num(e.custoUnitario));
  if (e.freteTotal !== undefined) l.freteTotal = Math.max(0, num(e.freteTotal));
  if (e.percentualImpostos !== undefined) {
    l.percentualImpostos = Math.max(0, num(e.percentualImpostos));
  }
  if (e.margemAlvo !== undefined) l.margemAlvo = Math.max(0, num(e.margemAlvo));
  if (e.meuLance !== undefined) {
    const n = Number(e.meuLance);
    l.meuLance = Number.isFinite(n) && n > 0 ? n : null;
  }
  if (e.descartado !== undefined) l.descartado = Boolean(e.descartado);
  if (e.observacao !== undefined) l.observacao = e.observacao.trim();
}

export async function salvarPadroes(
  numero: string,
  padroes: { impostoPadrao?: number; margemPadrao?: number }
): Promise<DisputaCalculada> {
  return store.update((data) => {
    const d = pegar(data, numero);
    if (padroes.impostoPadrao !== undefined) {
      d.impostoPadrao = Math.max(0, Number(padroes.impostoPadrao) || 0);
    }
    if (padroes.margemPadrao !== undefined) {
      d.margemPadrao = Math.max(0, Number(padroes.margemPadrao) || 0);
    }
    d.atualizadoEm = agora();
    return montar(d);
  });
}

export async function adicionarLote(
  numero: string,
  entrada: EntradaLote
): Promise<DisputaCalculada> {
  return store.update((data) => {
    const d = pegar(data, numero);
    const lote: LoteDisputa = {
      id: randomUUID(),
      numero: "",
      descricao: "",
      unidade: "un",
      quantidade: 0,
      referenciaUnitaria: null,
      fornecedor: "",
      marca: "",
      custoUnitario: 0,
      freteTotal: 0,
      percentualImpostos: d.impostoPadrao,
      margemAlvo: d.margemPadrao,
      meuLance: null,
      descartado: false,
      observacao: "",
    };
    aplicarLote(lote, entrada);
    d.lotes.push(lote);
    d.atualizadoEm = agora();
    return montar(d);
  });
}

export async function atualizarLote(
  numero: string,
  loteId: string,
  entrada: EntradaLote
): Promise<DisputaCalculada | null> {
  const resultado = await store.update((data) => {
    const d = data.disputas.find((x) => x.numeroControlePNCP === numero);
    const l = d?.lotes.find((x) => x.id === loteId);
    if (!d || !l) return null;
    aplicarLote(l, entrada);
    d.atualizadoEm = agora();
    return { disputa: montar(d), lote: { ...l } };
  });

  if (!resultado) return null;

  // Preencher o custo aqui também guarda a cotação no histórico, pra ela
  // servir no próximo edital que pedir o mesmo produto. É automático de
  // propósito: quem usa a tela pediu pra não ter que cadastrar produto em
  // formulário nenhum (ver cotacoesDb.ts).
  //
  // Fora da transação acima: são dois arquivos diferentes, e a fila do
  // jsonStore é por arquivo — chamar de dentro não travaria, mas deixaria a
  // gravação das disputas presa esperando a das cotações sem necessidade.
  const l = resultado.lote;
  if (entrada.custoUnitario !== undefined && l.custoUnitario > 0 && l.fornecedor) {
    await registrarCotacao({
      produto: l.descricao,
      marca: l.marca,
      fornecedor: l.fornecedor,
      precoUnitario: l.custoUnitario,
      unidade: l.unidade,
      quantidadeCotada: l.quantidade,
      numeroControlePNCP: numero,
    });
  }

  return resultado.disputa;
}

export async function removerLote(
  numero: string,
  loteId: string
): Promise<DisputaCalculada | null> {
  return store.update((data) => {
    const d = data.disputas.find((x) => x.numeroControlePNCP === numero);
    if (!d) return null;
    d.lotes = d.lotes.filter((l) => l.id !== loteId);
    d.atualizadoEm = agora();
    return montar(d);
  });
}

/**
 * Traz os lotes do edital direto do PNCP.
 *
 * É o que tira a digitação do caminho: número, descrição, unidade, quantidade
 * e preço de referência já vêm prontos, e sobra uma coluna pra preencher — o
 * custo que o fornecedor cotou. Um pregão de 126 lotes deixa de ser uma tarde
 * de digitação.
 *
 * Não duplica: lote com número que já está na planilha é pulado, então dá pra
 * rodar de novo depois que o órgão republica o edital com itens a mais.
 */
export async function importarDoPncp(
  numero: string
): Promise<{ importados: number; jaExistiam: number; disputa: DisputaCalculada }> {
  const itens = await buscarItens(numero);

  return store.update((data) => {
    const d = pegar(data, numero);
    const conhecidos = new Set(d.lotes.map((l) => l.numero));
    let importados = 0;
    let jaExistiam = 0;

    for (const item of itens) {
      const chave = String(item.numeroItem);
      if (conhecidos.has(chave)) {
        jaExistiam++;
        continue;
      }
      d.lotes.push({
        id: randomUUID(),
        numero: chave,
        descricao: item.descricao,
        unidade: item.unidade || "un",
        quantidade: item.quantidade,
        referenciaUnitaria: item.valorUnitarioEstimado,
        fornecedor: "",
        marca: "",
        custoUnitario: 0,
        freteTotal: 0,
        percentualImpostos: d.impostoPadrao,
        margemAlvo: d.margemPadrao,
        meuLance: null,
        descartado: false,
        observacao: "",
      });
      conhecidos.add(chave);
      importados++;
    }

    d.lotes.sort(
      (a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0)
    );
    d.atualizadoEm = agora();
    return { importados, jaExistiam, disputa: montar(d) };
  });
}

/**
 * Reaplica imposto e margem padrão a todos os lotes que ainda estão no valor
 * antigo. Serve pra quando se descobre a alíquota real do Simples no meio do
 * preenchimento e não se quer refazer lote por lote.
 */
export async function reaplicarPadroes(
  numero: string
): Promise<DisputaCalculada | null> {
  return store.update((data) => {
    const d = data.disputas.find((x) => x.numeroControlePNCP === numero);
    if (!d) return null;
    for (const l of d.lotes) {
      l.percentualImpostos = d.impostoPadrao;
      l.margemAlvo = d.margemPadrao;
    }
    d.atualizadoEm = agora();
    return montar(d);
  });
}

export async function apagarDisputa(numero: string): Promise<void> {
  await store.update((data) => {
    data.disputas = data.disputas.filter((d) => d.numeroControlePNCP !== numero);
  });
}
