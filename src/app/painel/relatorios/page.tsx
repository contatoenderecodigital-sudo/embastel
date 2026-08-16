"use client";

import { useCallback, useEffect, useState } from "react";
import type { Relatorio } from "@/lib/relatorios";

const PERIODOS: Array<[number, string]> = [
  [30, "30 dias"],
  [90, "3 meses"],
  [180, "6 meses"],
  [365, "1 ano"],
  [0, "Tudo"],
];

function dinheiro(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function mesLegivel(mes: string): string {
  const [ano, m] = mes.split("-");
  const nomes = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  return `${nomes[Number(m) - 1]}/${ano.slice(2)}`;
}

export default function RelatoriosPage() {
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [dias, setDias] = useState(180);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/relatorios?dias=${dias}`);
      if (!res.ok) throw new Error();
      setDados(await res.json());
    } catch {
      setErro("Não deu pra carregar os relatórios.");
    }
  }, [dias]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  if (!dados) {
    return <div className="p-8 text-sm text-neutral-500">Carregando números…</div>;
  }

  const maiorMes = Math.max(
    1,
    ...dados.porMes.map((m) => m.ganhas + m.perdidas)
  );
  const maiorFunil = Math.max(1, ...dados.funil.map((f) => f.quantidade));

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Relatórios</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Onde vale a pena gastar o tempo de montar proposta.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-neutral-200 bg-white p-1 text-sm font-medium shadow-sm">
          {PERIODOS.map(([valor, texto]) => (
            <button
              key={valor}
              onClick={() => setDias(valor)}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                dias === valor
                  ? "brand-gradient text-white shadow-sm"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </header>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {dados.poucosDados && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          Ainda há pouco histórico ({dados.ganhas + dados.perdidas} licitação(ões)
          com desfecho). Os percentuais aqui só ficam confiáveis depois de umas
          dez disputas — até lá, leia como tendência, não como estatística.
        </div>
      )}

      {/* ---------------------------------------------------- números-chave -- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            [
              "Taxa de vitória",
              dados.taxaVitoria == null
                ? "—"
                : `${Math.round(dados.taxaVitoria * 100)}%`,
              `${dados.ganhas} ganhas de ${dados.ganhas + dados.perdidas} com desfecho`,
            ],
            [
              "Valor disputado",
              dinheiro(dados.valorDisputado),
              `${dados.disputadas} proposta(s) enviada(s)`,
            ],
            [
              "Valor ganho",
              dinheiro(dados.valorGanho),
              dados.ticketMedioGanho
                ? `ticket médio ${dinheiro(dados.ticketMedioGanho)}`
                : "sem ganhas no período",
            ],
            [
              "A receber",
              dinheiro(dados.contratos.aReceber),
              dados.contratos.emAtraso > 0
                ? `${dinheiro(dados.contratos.emAtraso)} atrasado`
                : "nada atrasado",
            ],
          ] as Array<[string, string, string]>
        ).map(([rotulo, valor, nota]) => (
          <div
            key={rotulo}
            className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-4 shadow-sm"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {rotulo}
            </div>
            <div className="mt-1 text-xl font-bold text-neutral-900">{valor}</div>
            <div className="mt-0.5 text-[11.5px] text-neutral-500">{nota}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ------------------------------------------------------- funil -- */}
        <section className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-neutral-900">Funil</h2>
          <p className="mb-3 text-[11.5px] text-neutral-500">
            Onde estão as licitações que você está acompanhando.
          </p>
          <div className="space-y-1.5">
            {dados.funil.map((f) => (
              <div key={f.status} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-[12.5px] text-neutral-600">
                  {f.rotulo}
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-neutral-100">
                  <div
                    className={`h-full rounded-md ${
                      f.status === "ganhou" || f.status === "entregando"
                        ? "bg-emerald-500"
                        : f.status === "perdeu"
                          ? "bg-neutral-400"
                          : "brand-gradient"
                    }`}
                    style={{
                      width: `${Math.max(f.quantidade > 0 ? 6 : 0, (f.quantidade / maiorFunil) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-7 shrink-0 text-right text-[12.5px] font-semibold text-neutral-800">
                  {f.quantidade}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------ por mês -- */}
        <section className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-neutral-900">Ganhas e perdidas por mês</h2>
          <p className="mb-3 text-[11.5px] text-neutral-500">
            Verde ganhou, cinza perdeu.
          </p>
          {dados.porMes.length === 0 ? (
            <p className="text-[12.5px] text-neutral-500">
              Nenhuma licitação com desfecho no período.
            </p>
          ) : (
            <div className="flex h-40 items-end gap-2">
              {dados.porMes.map((m) => (
                <div key={m.mes} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 flex-col justify-end gap-0.5">
                    {m.ganhas > 0 && (
                      <div
                        title={`${m.ganhas} ganha(s) · ${dinheiro(m.valorGanho)}`}
                        className="w-full rounded-t bg-emerald-500"
                        style={{ height: `${(m.ganhas / maiorMes) * 100}%` }}
                      />
                    )}
                    {m.perdidas > 0 && (
                      <div
                        title={`${m.perdidas} perdida(s)`}
                        className="w-full rounded-t bg-neutral-300"
                        style={{ height: `${(m.perdidas / maiorMes) * 100}%` }}
                      />
                    )}
                  </div>
                  <span className="text-[10.5px] text-neutral-500">
                    {mesLegivel(m.mes)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ------------------------------------------------------------ órgãos */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-neutral-900">
          Órgãos: onde você ganha
        </h2>
        <p className="mb-3 text-[11.5px] text-neutral-500">
          Ordenado por valor ganho. Órgão onde você disputa muito e ganha pouco é
          onde o preço não fecha — ou onde tem concorrente local forte.
        </p>
        {dados.orgaos.length === 0 ? (
          <p className="text-[12.5px] text-neutral-500">
            Nenhuma proposta enviada no período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="border-b border-neutral-200 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="py-2 pr-3">Órgão</th>
                  <th className="w-24 px-3 py-2 text-center">Disputou</th>
                  <th className="w-24 px-3 py-2 text-center">Ganhou</th>
                  <th className="w-24 px-3 py-2 text-center">Taxa</th>
                  <th className="w-32 px-3 py-2 text-right">Valor ganho</th>
                </tr>
              </thead>
              <tbody>
                {dados.orgaos.map((o) => {
                  const taxa = o.disputadas > 0 ? o.ganhas / o.disputadas : 0;
                  return (
                    <tr
                      key={`${o.orgao}|${o.municipio}`}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="py-2 pr-3">
                        <div className="text-[13px] font-medium text-neutral-900">
                          {o.orgao}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {o.municipio}
                          {o.uf && `/${o.uf}`}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-[13px] text-neutral-700">
                        {o.disputadas}
                      </td>
                      <td className="px-3 py-2 text-center text-[13px] font-semibold text-emerald-700">
                        {o.ganhas}
                      </td>
                      <td
                        className={`px-3 py-2 text-center text-[13px] font-semibold ${
                          taxa >= 0.5
                            ? "text-emerald-700"
                            : taxa > 0
                              ? "text-amber-600"
                              : "text-neutral-400"
                        }`}
                      >
                        {Math.round(taxa * 100)}%
                      </td>
                      <td className="px-3 py-2 text-right text-[13px] text-neutral-800">
                        {dinheiro(o.valorGanho)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- pendências */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-neutral-900">Contratos em andamento</h2>
          <dl className="mt-3 space-y-1.5 text-[13px]">
            {(
              [
                ["Ativos", String(dados.contratos.ativos)],
                ["Valor total", dinheiro(dados.contratos.valorTotal)],
                ["Saldo a fornecer", dinheiro(dados.contratos.saldoAFornecer)],
                ["A receber", dinheiro(dados.contratos.aReceber)],
                ["Atrasado", dinheiro(dados.contratos.emAtraso)],
              ] as Array<[string, string]>
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-neutral-600">{k}</dt>
                <dd className="font-semibold text-neutral-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-neutral-900">Documentação</h2>
          <dl className="mt-3 space-y-1.5 text-[13px]">
            {(
              [
                ["Vencidos", dados.documentos.vencidos, "text-red-600"],
                ["Vencendo", dados.documentos.venceEmBreve, "text-orange-600"],
                ["Sem arquivo", dados.documentos.semArquivo, "text-amber-600"],
              ] as Array<[string, number, string]>
            ).map(([k, v, cor]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-neutral-600">{k}</dt>
                <dd className={`font-semibold ${v > 0 ? cor : "text-neutral-400"}`}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11.5px] text-neutral-500">
            Documento vencido derruba na habilitação mesmo com o melhor preço.
          </p>
        </div>
      </section>
    </div>
  );
}
