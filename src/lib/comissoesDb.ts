import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";

// Pagamentos de comissão já quitados com a Ketlyn.
//
// A comissão não é um relatório do mês: é uma DÍVIDA que acumula. O total
// devido é 5% de tudo que já virou romaneio, menos o que já foi pago. Quando
// o pagamento é registrado, o saldo zera e volta a subir a partir do próximo
// romaneio — foi exatamente assim que o usuário descreveu em 13/08/2026:
// "você vai sempre acumulando quanto que eu tenho que pagar pra ela de
// comissão, e quando eu clicar que eu paguei, aí você zera".

export type PagamentoComissao = {
  id: string;
  valor: number;
  // Quanto tinha sido vendido (acumulado) no momento do pagamento. Guardado
  // pra dar pra reconstruir o histórico mesmo se a regra de % mudar depois.
  totalVendidoNoMomento: number;
  observacao: string | null;
  pagoEm: string;
};

type ComissoesData = {
  pagamentos: PagamentoComissao[];
};

const store = jsonStore<ComissoesData>("comissoes-pagas.json", { pagamentos: [] });

export async function listPagamentos(): Promise<PagamentoComissao[]> {
  const data = await store.read();
  return [...data.pagamentos].sort((a, b) => b.pagoEm.localeCompare(a.pagoEm));
}

export async function registrarPagamento(input: {
  valor: number;
  totalVendidoNoMomento: number;
  observacao?: string | null;
}): Promise<PagamentoComissao> {
  return store.update((data) => {
    const pagamento: PagamentoComissao = {
      id: randomUUID(),
      valor: Math.round(input.valor * 100) / 100,
      totalVendidoNoMomento: input.totalVendidoNoMomento,
      observacao: input.observacao ?? null,
      pagoEm: new Date().toISOString(),
    };
    data.pagamentos.push(pagamento);
    return pagamento;
  });
}

export async function excluirPagamento(id: string): Promise<void> {
  await store.update((data) => {
    data.pagamentos = data.pagamentos.filter((p) => p.id !== id);
  });
}
