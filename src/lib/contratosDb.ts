import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";
import { diasAteVencer, hojeISO } from "./documentosDb";

// Contratos e atas de registro de preços — o que acontece DEPOIS de ganhar.
//
// Ganhar não é o fim: numa ata de registro de preços a Embastel fica
// fornecendo por meses, e é aí que o dinheiro entra de verdade. Até aqui o
// painel parava no kanban, em "ganhou", e o resto vivia na cabeça de alguém.
//
// As três perguntas que este módulo existe pra responder:
//   1. Quanto ainda posso fornecer de cada item, e até quando a ata vale?
//   2. O que já entreguei e faturei?
//   3. Quanto a prefeitura está me devendo, e há quantos dias?
//
// A terceira é a que nenhum portal de licitação responde: as "faturas" deles
// são o que VOCÊ paga à plataforma, não o que o órgão te deve.

export type TipoContrato = "contrato" | "ata";

export type ItemContrato = {
  id: string;
  descricao: string;
  unidade: string;
  /** Quantidade contratada / registrada na ata. */
  quantidade: number;
  precoUnitario: number;
};

export type ItemFornecido = {
  itemId: string;
  quantidade: number;
  /**
   * Preço congelado no momento do fornecimento. Numa ata longa o preço pode
   * ser reequilibrado; o histórico tem que continuar batendo com a nota que
   * já foi emitida.
   */
  precoUnitario: number;
};

/** Um empenho / ordem de fornecimento: o órgão pedindo uma parte do total. */
export type Fornecimento = {
  id: string;
  numeroEmpenho: string | null;
  data: string;
  itens: ItemFornecido[];
  entregueEm: string | null;
  notaFiscal: string | null;
  notaEmitidaEm: string | null;
  /** Prazo de pagamento em dias, contado da emissão da nota. */
  prazoPagamentoDias: number | null;
  pagoEm: string | null;
  observacao: string | null;
  criadoEm: string;
};

export type Contrato = {
  id: string;
  tipo: TipoContrato;
  numero: string;
  orgao: string;
  municipio: string;
  uf: string;
  /** Liga com a licitação acompanhada no kanban, quando veio de lá. */
  numeroControlePNCP: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  itens: ItemContrato[];
  fornecimentos: Fornecimento[];
  observacao: string | null;
  encerrado: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

type ContratosData = {
  contratos: Contrato[];
};

const store = jsonStore<ContratosData>("contratos.json", { contratos: [] });

/** Marcos de aviso do fim da vigência, em dias. */
export const MARCOS_VIGENCIA = [60, 30, 15, 7] as const;

/** A partir daqui o saldo é pouco e vale avisar que a ata está acabando. */
export const LIMITE_SALDO_BAIXO = 0.9;

/** Quando o edital não diz, 30 dias é o prazo usual de pagamento público. */
export const PRAZO_PAGAMENTO_PADRAO = 30;

// ------------------------------------------------------------------- contas

export type ItemComSaldo = ItemContrato & {
  quantidadeFornecida: number;
  saldoQuantidade: number;
  valorTotal: number;
  valorFornecido: number;
};

export type FornecimentoCalculado = Fornecimento & {
  valor: number;
  /** Data limite de pagamento, quando dá pra calcular. */
  vencePagamentoEm: string | null;
  diasDeAtraso: number;
  pago: boolean;
};

export type ContratoCalculado = Contrato & {
  itensComSaldo: ItemComSaldo[];
  fornecimentosCalculados: FornecimentoCalculado[];
  valorTotal: number;
  valorFornecido: number;
  saldoValor: number;
  percentualUsado: number;
  diasAteFimVigencia: number | null;
  vigenciaVencida: boolean;
  aReceber: number;
  emAtraso: number;
};

export function calcular(contrato: Contrato, hoje = hojeISO()): ContratoCalculado {
  const fornecidoPorItem = new Map<string, number>();
  for (const forn of contrato.fornecimentos) {
    for (const item of forn.itens) {
      fornecidoPorItem.set(
        item.itemId,
        (fornecidoPorItem.get(item.itemId) ?? 0) + item.quantidade
      );
    }
  }

  const itensComSaldo: ItemComSaldo[] = contrato.itens.map((item) => {
    const fornecida = fornecidoPorItem.get(item.id) ?? 0;
    return {
      ...item,
      quantidadeFornecida: fornecida,
      // Não deixa negativo: fornecer a mais que o registrado é erro de
      // digitação, e saldo negativo só polui a tela.
      saldoQuantidade: Math.max(0, item.quantidade - fornecida),
      valorTotal: item.quantidade * item.precoUnitario,
      valorFornecido: fornecida * item.precoUnitario,
    };
  });

  const fornecimentosCalculados: FornecimentoCalculado[] =
    contrato.fornecimentos.map((forn) => {
      const valor = forn.itens.reduce(
        (soma, i) => soma + i.quantidade * i.precoUnitario,
        0
      );
      const vencePagamentoEm =
        forn.notaEmitidaEm && !forn.pagoEm
          ? somarDias(forn.notaEmitidaEm, forn.prazoPagamentoDias ?? PRAZO_PAGAMENTO_PADRAO)
          : null;
      const dias = vencePagamentoEm ? diasAteVencer(vencePagamentoEm, hoje) : 0;
      return {
        ...forn,
        valor,
        vencePagamentoEm,
        diasDeAtraso: dias < 0 ? Math.abs(dias) : 0,
        pago: forn.pagoEm != null,
      };
    });

  const valorTotal = itensComSaldo.reduce((s, i) => s + i.valorTotal, 0);
  const valorFornecido = fornecimentosCalculados.reduce((s, f) => s + f.valor, 0);

  // "A receber" é o que já foi faturado e ainda não caiu na conta. Entrega
  // sem nota emitida não entra: ainda não há o que cobrar.
  const naoPagos = fornecimentosCalculados.filter(
    (f) => !f.pago && f.notaEmitidaEm
  );

  const diasAteFimVigencia = contrato.vigenciaFim
    ? diasAteVencer(contrato.vigenciaFim, hoje)
    : null;

  return {
    ...contrato,
    itensComSaldo,
    fornecimentosCalculados,
    valorTotal,
    valorFornecido,
    saldoValor: Math.max(0, valorTotal - valorFornecido),
    percentualUsado: valorTotal > 0 ? valorFornecido / valorTotal : 0,
    diasAteFimVigencia,
    vigenciaVencida: diasAteFimVigencia != null && diasAteFimVigencia < 0,
    aReceber: naoPagos.reduce((s, f) => s + f.valor, 0),
    emAtraso: naoPagos
      .filter((f) => f.diasDeAtraso > 0)
      .reduce((s, f) => s + f.valor, 0),
  };
}

/** Soma dias a "YYYY-MM-DD" sem passar por fuso horário. */
function somarDias(iso: string, dias: number): string {
  const base = new Date(
    Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10))
    )
  );
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

// --------------------------------------------------------------------- CRUD

export async function listContratos(): Promise<ContratoCalculado[]> {
  const data = await store.read();
  const hoje = hojeISO();
  return data.contratos
    .map((c) => calcular(c, hoje))
    .sort((a, b) => {
      // Encerrado vai pro fim; entre os ativos, o que vence antes vem primeiro.
      if (a.encerrado !== b.encerrado) return a.encerrado ? 1 : -1;
      if (a.vigenciaFim && b.vigenciaFim) {
        return a.vigenciaFim.localeCompare(b.vigenciaFim);
      }
      if (a.vigenciaFim) return -1;
      if (b.vigenciaFim) return 1;
      return b.criadoEm.localeCompare(a.criadoEm);
    });
}

/** Lista crua, sem as contas — pro verificador de avisos. */
export async function listContratosCru(): Promise<Contrato[]> {
  return (await store.read()).contratos;
}

type EntradaContrato = {
  tipo?: TipoContrato;
  numero?: string;
  orgao?: string;
  municipio?: string;
  uf?: string;
  numeroControlePNCP?: string | null;
  vigenciaInicio?: string | null;
  vigenciaFim?: string | null;
  observacao?: string | null;
  encerrado?: boolean;
  itens?: Array<{
    id?: string;
    descricao: string;
    unidade?: string;
    quantidade: number;
    precoUnitario: number;
  }>;
};

export async function criarContrato(entrada: EntradaContrato): Promise<Contrato> {
  const agora = new Date().toISOString();
  return store.update((data) => {
    const contrato: Contrato = {
      id: randomUUID(),
      tipo: entrada.tipo ?? "ata",
      numero: entrada.numero?.trim() || "sem número",
      orgao: entrada.orgao?.trim() || "",
      municipio: entrada.municipio?.trim() || "",
      uf: entrada.uf?.trim().toUpperCase() || "",
      numeroControlePNCP: entrada.numeroControlePNCP || null,
      vigenciaInicio: entrada.vigenciaInicio || null,
      vigenciaFim: entrada.vigenciaFim || null,
      itens: (entrada.itens ?? []).map((i) => ({
        id: randomUUID(),
        descricao: i.descricao.trim(),
        unidade: i.unidade?.trim() || "un",
        quantidade: Number(i.quantidade) || 0,
        precoUnitario: Number(i.precoUnitario) || 0,
      })),
      fornecimentos: [],
      observacao: entrada.observacao?.trim() || null,
      encerrado: false,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    data.contratos.push(contrato);
    return contrato;
  });
}

export async function atualizarContrato(
  id: string,
  entrada: EntradaContrato
): Promise<Contrato | null> {
  return store.update((data) => {
    const c = data.contratos.find((x) => x.id === id);
    if (!c) return null;

    if (entrada.tipo !== undefined) c.tipo = entrada.tipo;
    if (entrada.numero !== undefined) c.numero = entrada.numero.trim() || c.numero;
    if (entrada.orgao !== undefined) c.orgao = entrada.orgao.trim();
    if (entrada.municipio !== undefined) c.municipio = entrada.municipio.trim();
    if (entrada.uf !== undefined) c.uf = entrada.uf.trim().toUpperCase();
    if (entrada.vigenciaInicio !== undefined) {
      c.vigenciaInicio = entrada.vigenciaInicio || null;
    }
    if (entrada.vigenciaFim !== undefined) c.vigenciaFim = entrada.vigenciaFim || null;
    if (entrada.observacao !== undefined) {
      c.observacao = entrada.observacao?.trim() || null;
    }
    if (entrada.encerrado !== undefined) c.encerrado = entrada.encerrado;

    if (entrada.itens !== undefined) {
      // Item já fornecido não pode sumir: o histórico de empenho aponta pro id
      // dele, e sem o item a nota antiga ficaria sem descrição nem preço.
      const fornecidos = new Set(
        c.fornecimentos.flatMap((f) => f.itens.map((i) => i.itemId))
      );
      const enviados = new Map(entrada.itens.filter((i) => i.id).map((i) => [i.id!, i]));
      const mantidos = c.itens.filter(
        (i) => enviados.has(i.id) || fornecidos.has(i.id)
      );
      for (const item of mantidos) {
        const novo = enviados.get(item.id);
        if (!novo) continue;
        item.descricao = novo.descricao.trim();
        item.unidade = novo.unidade?.trim() || "un";
        item.quantidade = Number(novo.quantidade) || 0;
        item.precoUnitario = Number(novo.precoUnitario) || 0;
      }
      const novos = entrada.itens
        .filter((i) => !i.id)
        .map((i) => ({
          id: randomUUID(),
          descricao: i.descricao.trim(),
          unidade: i.unidade?.trim() || "un",
          quantidade: Number(i.quantidade) || 0,
          precoUnitario: Number(i.precoUnitario) || 0,
        }));
      c.itens = [...mantidos, ...novos];
    }

    c.atualizadoEm = new Date().toISOString();
    return c;
  });
}

export async function excluirContrato(id: string): Promise<void> {
  await store.update((data) => {
    data.contratos = data.contratos.filter((c) => c.id !== id);
  });
}

// ------------------------------------------------------------ fornecimentos

type EntradaFornecimento = {
  numeroEmpenho?: string | null;
  data?: string;
  itens?: Array<{ itemId: string; quantidade: number; precoUnitario?: number }>;
  entregueEm?: string | null;
  notaFiscal?: string | null;
  notaEmitidaEm?: string | null;
  prazoPagamentoDias?: number | null;
  pagoEm?: string | null;
  observacao?: string | null;
};

export async function adicionarFornecimento(
  contratoId: string,
  entrada: EntradaFornecimento
): Promise<Contrato | null> {
  return store.update((data) => {
    const c = data.contratos.find((x) => x.id === contratoId);
    if (!c) return null;
    const forn: Fornecimento = {
      id: randomUUID(),
      numeroEmpenho: entrada.numeroEmpenho?.trim() || null,
      data: entrada.data || hojeISO(),
      itens: (entrada.itens ?? [])
        .filter((i) => Number(i.quantidade) > 0)
        .map((i) => ({
          itemId: i.itemId,
          quantidade: Number(i.quantidade),
          // Sem preço informado, usa o do contrato — o caso normal.
          precoUnitario:
            i.precoUnitario != null
              ? Number(i.precoUnitario)
              : (c.itens.find((x) => x.id === i.itemId)?.precoUnitario ?? 0),
        })),
      entregueEm: entrada.entregueEm || null,
      notaFiscal: entrada.notaFiscal?.trim() || null,
      notaEmitidaEm: entrada.notaEmitidaEm || null,
      prazoPagamentoDias: entrada.prazoPagamentoDias ?? PRAZO_PAGAMENTO_PADRAO,
      pagoEm: entrada.pagoEm || null,
      observacao: entrada.observacao?.trim() || null,
      criadoEm: new Date().toISOString(),
    };
    c.fornecimentos.push(forn);
    c.atualizadoEm = forn.criadoEm;
    return c;
  });
}

export async function atualizarFornecimento(
  contratoId: string,
  fornecimentoId: string,
  entrada: EntradaFornecimento
): Promise<Contrato | null> {
  return store.update((data) => {
    const c = data.contratos.find((x) => x.id === contratoId);
    const f = c?.fornecimentos.find((x) => x.id === fornecimentoId);
    if (!c || !f) return null;

    if (entrada.numeroEmpenho !== undefined) {
      f.numeroEmpenho = entrada.numeroEmpenho?.trim() || null;
    }
    if (entrada.data !== undefined && entrada.data) f.data = entrada.data;
    if (entrada.entregueEm !== undefined) f.entregueEm = entrada.entregueEm || null;
    if (entrada.notaFiscal !== undefined) {
      f.notaFiscal = entrada.notaFiscal?.trim() || null;
    }
    if (entrada.notaEmitidaEm !== undefined) {
      f.notaEmitidaEm = entrada.notaEmitidaEm || null;
    }
    if (entrada.prazoPagamentoDias !== undefined) {
      f.prazoPagamentoDias = entrada.prazoPagamentoDias;
    }
    if (entrada.pagoEm !== undefined) f.pagoEm = entrada.pagoEm || null;
    if (entrada.observacao !== undefined) {
      f.observacao = entrada.observacao?.trim() || null;
    }
    if (entrada.itens !== undefined) {
      f.itens = entrada.itens
        .filter((i) => Number(i.quantidade) > 0)
        .map((i) => ({
          itemId: i.itemId,
          quantidade: Number(i.quantidade),
          precoUnitario:
            i.precoUnitario != null
              ? Number(i.precoUnitario)
              : (c.itens.find((x) => x.id === i.itemId)?.precoUnitario ?? 0),
        }));
    }
    c.atualizadoEm = new Date().toISOString();
    return c;
  });
}

export async function excluirFornecimento(
  contratoId: string,
  fornecimentoId: string
): Promise<void> {
  await store.update((data) => {
    const c = data.contratos.find((x) => x.id === contratoId);
    if (!c) return;
    c.fornecimentos = c.fornecimentos.filter((f) => f.id !== fornecimentoId);
    c.atualizadoEm = new Date().toISOString();
  });
}
