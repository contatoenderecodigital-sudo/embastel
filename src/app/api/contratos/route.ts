import { NextRequest, NextResponse } from "next/server";
import { criarContrato, listContratos } from "@/lib/contratosDb";
import { listTracked } from "@/lib/licitacoesTrackingDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const contratos = await listContratos();
  const ativos = contratos.filter((c) => !c.encerrado);

  // Licitações já ganhas no kanban que ainda não viraram contrato. Evita ter
  // que redigitar órgão e objeto — e evita esquecer de registrar uma ata.
  const jaImportadas = new Set(
    contratos.map((c) => c.numeroControlePNCP).filter(Boolean)
  );
  const ganhasSemContrato = (await listTracked())
    .filter(
      (l) =>
        (l.status === "ganhou" || l.status === "entregando") &&
        !jaImportadas.has(l.numeroControlePNCP)
    )
    .map((l) => ({
      numeroControlePNCP: l.numeroControlePNCP,
      objeto: l.objeto,
      orgao: l.orgao,
      municipio: l.municipio,
      uf: l.uf,
      valorEstimado: l.valorEstimado,
    }));

  return NextResponse.json({
    contratos,
    ganhasSemContrato,
    resumo: {
      ativos: ativos.length,
      valorTotal: ativos.reduce((s, c) => s + c.valorTotal, 0),
      saldoAFornecer: ativos.reduce((s, c) => s + c.saldoValor, 0),
      aReceber: contratos.reduce((s, c) => s + c.aReceber, 0),
      emAtraso: contratos.reduce((s, c) => s + c.emAtraso, 0),
      vencendo: ativos.filter(
        (c) => c.diasAteFimVigencia != null && c.diasAteFimVigencia <= 60
      ).length,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const contrato = await criarContrato(await request.json());
    return NextResponse.json({ contrato }, { status: 201 });
  } catch (erro) {
    return NextResponse.json(
      {
        error:
          erro instanceof Error ? erro.message : "Não deu pra cadastrar o contrato.",
      },
      { status: 400 }
    );
  }
}
