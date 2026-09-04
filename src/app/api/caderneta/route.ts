import { NextRequest, NextResponse } from "next/server";
import {
  aplicarJurosDoMes,
  competenciaAnterior,
  competenciaAtual,
  lancarFicha,
  listLancamentos,
  registrarPagamento,
  saldos,
} from "@/lib/cadernetaDb";
import { listClientes } from "@/lib/clientesDb";

export const dynamic = "force-dynamic";

/** Quem deve, quanto, e há quanto tempo — na ordem em que se cobra. */
export async function GET(request: NextRequest) {
  const clienteId = request.nextUrl.searchParams.get("clienteId");
  if (clienteId) {
    return NextResponse.json({ lancamentos: await listLancamentos(clienteId) });
  }

  const [lista, clientes] = await Promise.all([saldos(), listClientes()]);
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const agora = Date.now();

  return NextResponse.json({
    competencia: competenciaAtual(),
    // O mês que chega ao escritório no dia 01 é o anterior — a tela já
    // sugere ele, pra ninguém lançar ficha de agosto como sendo de setembro.
    competenciaDasFichas: competenciaAnterior(competenciaAtual()),
    devedores: lista
      .filter((s) => s.saldo > 0)
      .map((s) => {
        const c = porId.get(s.clienteId);
        return {
          ...s,
          nome: c?.nome ?? "(cliente removido)",
          telefone: c?.telefone ?? null,
          cidade: c?.cidade ?? "",
          diasDevendo: s.devendoDesde
            ? Math.floor((agora - new Date(s.devendoDesde).getTime()) / 86_400_000)
            : 0,
        };
      }),
    total: lista.reduce((soma, s) => soma + Math.max(0, s.saldo), 0),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body?.acao === "juros-do-mes") {
    const competencia = String(body.competencia || competenciaAtual());
    return NextResponse.json(await aplicarJurosDoMes(competencia));
  }

  const clienteId = String(body?.clienteId ?? "").trim();
  const valor = Number(body?.valor);
  if (!clienteId || !Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json(
      { error: "Escolha o cliente e informe um valor maior que zero." },
      { status: 400 }
    );
  }

  if (body.acao === "pagamento") {
    return NextResponse.json({
      lancamento: await registrarPagamento({
        clienteId,
        valor,
        observacao: body.observacao,
      }),
    });
  }

  return NextResponse.json({
    lancamento: await lancarFicha({
      clienteId,
      competencia: String(body.competencia || competenciaAnterior(competenciaAtual())),
      valor,
      observacao: body.observacao,
    }),
  });
}
