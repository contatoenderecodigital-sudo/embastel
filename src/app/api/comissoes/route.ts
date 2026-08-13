import { NextRequest, NextResponse } from "next/server";
import { listPagamentos, registrarPagamento } from "@/lib/comissoesDb";
import { listRomaneios } from "@/lib/romaneiosDb";
import { PERCENTUAL_COMISSAO } from "@/lib/comissao";

export const dynamic = "force-dynamic";

// Devolve o saldo devido hoje: 5% de tudo que já virou romaneio, menos o que
// já foi pago. O cálculo fica no servidor pra tela e o painel inicial nunca
// discordarem entre si.
async function calcularSaldo() {
  const [romaneios, pagamentos] = await Promise.all([
    listRomaneios(),
    listPagamentos(),
  ]);

  const totalVendido = romaneios.reduce(
    (soma, r) => soma + r.itens.reduce((s, i) => s + i.valor, 0),
    0
  );
  const comissaoTotal = Math.round(totalVendido * PERCENTUAL_COMISSAO * 100) / 100;
  const totalPago = Math.round(
    pagamentos.reduce((s, p) => s + p.valor, 0) * 100
  ) / 100;

  return {
    totalVendido,
    comissaoTotal,
    totalPago,
    // Nunca negativo: se alguém pagar a mais, o saldo devido é zero, não
    // um valor negativo que confundiria na tela.
    aPagar: Math.max(0, Math.round((comissaoTotal - totalPago) * 100) / 100),
    percentual: PERCENTUAL_COMISSAO,
    pagamentos,
  };
}

export async function GET() {
  return NextResponse.json(await calcularSaldo());
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    valor?: number;
    observacao?: string | null;
  };

  const saldo = await calcularSaldo();
  // Sem valor informado, quita o saldo inteiro — que é o caso normal do
  // botão "marquei que paguei".
  const valor = body.valor != null ? Number(body.valor) : saldo.aPagar;

  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json(
      { error: "Não há saldo em aberto pra registrar." },
      { status: 400 }
    );
  }

  await registrarPagamento({
    valor,
    totalVendidoNoMomento: saldo.totalVendido,
    observacao: body.observacao ?? null,
  });

  return NextResponse.json(await calcularSaldo());
}
