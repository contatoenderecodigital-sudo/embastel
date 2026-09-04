import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";

// A caderneta: o que cada cliente deve à loja.
//
// COMO FUNCIONA NA VIDA REAL. O cliente marca no caixa durante o mês. No dia 01
// as fichas do mês anterior chegam ao escritório, são somadas por cliente,
// grampeadas e guardadas na pasta. O cliente é avisado no WhatsApp, e alguns
// recebem a visita do entregador pra cobrar.
//
// POR QUE CONTA CORRENTE, e não uma lista de fichas em aberto. O juro incide
// sobre o SALDO inteiro que sobrou, não sobre cada ficha separada — então não
// existe "ficha mais velha" a perseguir, nem faz diferença qual ficha um
// pagamento parcial abate. Um saldo que sobe e desce conta a mesma história com
// muito menos peça pra dar errado.
//
// Não se confunde com fichasDb.ts, que é ficha TÉCNICA de produto, com foto.

export type TipoLancamento = "ficha" | "pagamento" | "juros";

export type Lancamento = {
  id: string;
  clienteId: string;
  tipo: TipoLancamento;
  /** Sempre positivo. Quem decide se soma ou abate é o tipo. */
  valor: number;
  /**
   * Mês a que o lançamento se refere, "AAAA-MM".
   *
   * É o mês em que o cliente MARCOU, não o dia em que a ficha foi digitada —
   * as de agosto chegam ao escritório em setembro, e guardar a data de
   * digitação faria a dívida parecer mais nova do que é.
   */
  competencia: string;
  observacao: string | null;
  criadoEm: string;
};

type Dados = { lancamentos: Lancamento[] };

const store = jsonStore<Dados>("caderneta.json", { lancamentos: [] });

/** 2% ao mês sobre o que sobrou. Zerou, não corre juro nenhum. */
export const JUROS_AO_MES = 0.02;

export function competenciaAtual(agora = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

/** O mês anterior ao informado — é o que chega ao escritório no dia 01. */
export function competenciaAnterior(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return mes === 1
    ? `${ano - 1}-12`
    : `${ano}-${String(mes - 1).padStart(2, "0")}`;
}

function ordenar(l: Lancamento[]): Lancamento[] {
  // Por competência e, dentro do mês, pela ordem em que foram lançados. O juro
  // do mês precisa vir DEPOIS do saldo que o gerou e ANTES das fichas novas,
  // e é a ordem de criação que garante isso.
  return [...l].sort(
    (a, b) =>
      a.competencia.localeCompare(b.competencia) ||
      a.criadoEm.localeCompare(b.criadoEm)
  );
}

const sinal = (tipo: TipoLancamento) => (tipo === "pagamento" ? -1 : 1);

export type SaldoCliente = {
  clienteId: string;
  saldo: number;
  /**
   * Desde quando o saldo não zera. Null = está em dia.
   *
   * É a data em que a dívida saiu do zero pela última vez — e não a do
   * lançamento mais antigo. Cliente que quitou em março e voltou a marcar em
   * agosto deve desde agosto, não desde sempre.
   */
  devendoDesde: string | null;
  ultimoPagamentoEm: string | null;
  /** Quanto já foi cobrado de juro no total, pra dar pra explicar a conta. */
  jurosAcumulados: number;
};

export function calcularSaldo(
  clienteId: string,
  lancamentos: Lancamento[]
): SaldoCliente {
  const meus = ordenar(lancamentos.filter((l) => l.clienteId === clienteId));
  let saldo = 0;
  let devendoDesde: string | null = null;
  let ultimoPagamentoEm: string | null = null;
  let jurosAcumulados = 0;

  for (const l of meus) {
    const antes = saldo;
    saldo = Math.round((saldo + sinal(l.tipo) * l.valor) * 100) / 100;
    if (l.tipo === "juros") jurosAcumulados += l.valor;
    if (l.tipo === "pagamento") ultimoPagamentoEm = l.criadoEm;
    // Saiu do zero agora: é daqui que a dívida atual começa a contar.
    if (antes <= 0 && saldo > 0) devendoDesde = l.criadoEm;
    if (saldo <= 0) devendoDesde = null;
  }

  return {
    clienteId,
    saldo,
    devendoDesde,
    ultimoPagamentoEm,
    jurosAcumulados: Math.round(jurosAcumulados * 100) / 100,
  };
}

export async function listLancamentos(clienteId?: string): Promise<Lancamento[]> {
  const d = await store.read();
  const todos = ordenar(d.lancamentos);
  return clienteId ? todos.filter((l) => l.clienteId === clienteId) : todos;
}

export async function saldoDe(clienteId: string): Promise<SaldoCliente> {
  const d = await store.read();
  return calcularSaldo(clienteId, d.lancamentos);
}

/** Todos os clientes que já tiveram movimento, com o saldo de cada um. */
export async function saldos(): Promise<SaldoCliente[]> {
  const d = await store.read();
  const ids = [...new Set(d.lancamentos.map((l) => l.clienteId))];
  return (
    ids
      .map((id) => calcularSaldo(id, d.lancamentos))
      // Quem deve há mais tempo primeiro: é a ordem em que se cobra.
      .sort((a, b) =>
        (a.devendoDesde ?? "9999").localeCompare(b.devendoDesde ?? "9999")
      )
  );
}

async function lancar(
  entrada: Omit<Lancamento, "id" | "criadoEm">
): Promise<Lancamento> {
  const novo: Lancamento = {
    ...entrada,
    valor: Math.round(Math.abs(entrada.valor) * 100) / 100,
    id: randomUUID(),
    criadoEm: new Date().toISOString(),
  };
  await store.update((d) => {
    d.lancamentos.push(novo);
    return d;
  });
  return novo;
}

/** O total que o cliente marcou num mês. */
export async function lancarFicha(entrada: {
  clienteId: string;
  competencia: string;
  valor: number;
  observacao?: string | null;
}): Promise<Lancamento> {
  return lancar({
    clienteId: entrada.clienteId,
    tipo: "ficha",
    valor: entrada.valor,
    competencia: entrada.competencia,
    observacao: entrada.observacao ?? null,
  });
}

export async function registrarPagamento(entrada: {
  clienteId: string;
  valor: number;
  competencia?: string;
  observacao?: string | null;
}): Promise<Lancamento> {
  return lancar({
    clienteId: entrada.clienteId,
    tipo: "pagamento",
    valor: entrada.valor,
    competencia: entrada.competencia ?? competenciaAtual(),
    observacao: entrada.observacao ?? null,
  });
}

/**
 * Passa os 2% em todo mundo que ficou devendo, uma vez por mês.
 *
 * NÃO PODE RODAR DUAS VEZES no mesmo mês, e por isso a checagem por
 * competência: é um botão que uma pessoa aperta, e quem aperta dois botões
 * seguidos sem ver a tela responder é o normal, não a exceção. Cobrar juro em
 * dobro de cliente é do tipo de erro que só aparece quando ele reclama.
 *
 * Roda ANTES de lançar as fichas do mês: o juro é sobre o que já se devia, e
 * nunca sobre o que acabou de ser marcado.
 */
export async function aplicarJurosDoMes(competencia: string): Promise<{
  aplicados: number;
  total: number;
  jaTinha: number;
}> {
  const d = await store.read();
  const ids = [...new Set(d.lancamentos.map((l) => l.clienteId))];

  let aplicados = 0;
  let total = 0;
  let jaTinha = 0;
  const novos: Lancamento[] = [];
  const agora = new Date().toISOString();

  for (const id of ids) {
    const jaAplicado = d.lancamentos.some(
      (l) =>
        l.clienteId === id && l.tipo === "juros" && l.competencia === competencia
    );
    if (jaAplicado) {
      jaTinha++;
      continue;
    }
    const { saldo } = calcularSaldo(id, d.lancamentos);
    if (saldo <= 0) continue;

    const juros = Math.round(saldo * JUROS_AO_MES * 100) / 100;
    if (juros <= 0) continue;

    novos.push({
      id: randomUUID(),
      clienteId: id,
      tipo: "juros",
      valor: juros,
      competencia,
      observacao: `2% sobre o saldo de ${saldo.toFixed(2)}`,
      criadoEm: agora,
    });
    aplicados++;
    total += juros;
  }

  if (novos.length) {
    await store.update((dados) => {
      dados.lancamentos.push(...novos);
      return dados;
    });
  }

  return { aplicados, total: Math.round(total * 100) / 100, jaTinha };
}

export async function excluirLancamento(id: string): Promise<void> {
  await store.update((d) => {
    d.lancamentos = d.lancamentos.filter((l) => l.id !== id);
    return d;
  });
}
