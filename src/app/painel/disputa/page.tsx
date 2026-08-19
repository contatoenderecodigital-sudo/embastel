"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DisputaCalculada, LoteCalculado } from "@/lib/disputaDb";

type LicitacaoDaLista = {
  numeroControlePNCP: string;
  objeto: string;
  orgao: string;
  municipio: string;
  uf: string;
  status: string;
  valorEstimado: number | null;
  dataEncerramentoProposta: string | null;
  link: string;
  lotes: number;
  cotados: number;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/**
 * Lê número digitado do jeito brasileiro.
 *
 * Se tem vírgula, ela é o decimal e o ponto é separador de milhar
 * ("1.234,56"). Se não tem, o ponto é o decimal ("13.33") — quem digita rápido
 * usa o ponto do teclado numérico, e apagar esse ponto transformaria 13.33 em
 * 1333, um erro de cem vezes bem no meio de um lance.
 */
function paraNumero(texto: string): number {
  const t = (texto ?? "").trim();
  if (!t) return 0;
  const limpo = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : t.replace(/,/g, "");
  const n = Number(limpo.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export default function DisputaPage() {
  const [licitacoes, setLicitacoes] = useState<LicitacaoDaLista[] | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [disputa, setDisputa] = useState<DisputaCalculada | null>(null);
  const [carregandoDisputa, setCarregandoDisputa] = useState(false);
  const [modoPregao, setModoPregao] = useState(false);
  const [busca, setBusca] = useState("");
  const [soCotados, setSoCotados] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    fetch("/api/disputa")
      .then((r) => r.json())
      .then((d) => setLicitacoes(d.licitacoes ?? []))
      .catch(() => setErro("Não deu pra carregar as licitações do funil."));
  }, []);

  const carregarDisputa = useCallback(async (numero: string) => {
    setCarregandoDisputa(true);
    try {
      const res = await fetch(`/api/disputa/${encodeURIComponent(numero)}`);
      const d = await res.json();
      setDisputa(d.disputa);
    } catch {
      setErro("Não deu pra carregar a planilha.");
    } finally {
      setCarregandoDisputa(false);
    }
  }, []);

  function abrir(numero: string) {
    setEscolhida(numero);
    setDisputa(null);
    setErro(null);
    setAviso(null);
    setBusca("");
    carregarDisputa(numero);
  }

  async function chamar(metodo: string, corpo?: unknown, query = "") {
    if (!escolhida) return;
    const res = await fetch(
      `/api/disputa/${encodeURIComponent(escolhida)}${query}`,
      {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      }
    );
    const d = await res.json();
    if (!res.ok) {
      setErro(d.error ?? "Não deu pra salvar.");
      return null;
    }
    if (d.disputa) setDisputa(d.disputa);
    return d;
  }

  async function importar() {
    setImportando(true);
    setErro(null);
    setAviso(null);
    const d = await chamar("POST", { acao: "importar-do-pncp" });
    setImportando(false);
    if (!d) return;
    setAviso(
      d.importados
        ? `${d.importados} lote(s) vieram do edital.${
            d.jaExistiam ? ` ${d.jaExistiam} já estavam aqui.` : ""
          } Agora é só preencher o custo que o fornecedor cotou.`
        : "O PNCP não devolveu nenhum lote novo pra este edital."
    );
  }

  const salvarLote = (loteId: string, campo: string, valor: unknown) =>
    chamar("PATCH", { loteId, [campo]: valor });

  const lotesVisiveis = useMemo(() => {
    if (!disputa) return [];
    const termo = busca.trim().toLowerCase();
    return disputa.lotes.filter((l) => {
      if (l.descartado) return false;
      if (soCotados && l.custoUnitario <= 0) return false;
      if (!termo) return true;
      return (
        l.numero.toLowerCase().includes(termo) ||
        l.descricao.toLowerCase().includes(termo) ||
        l.fornecedor.toLowerCase().includes(termo)
      );
    });
  }, [disputa, busca, soCotados]);

  const numInput =
    "w-full rounded border border-neutral-300 px-1.5 py-1 text-right text-[12px] tabular-nums outline-none focus:border-brand";

  // ------------------------------------------------- escolher a licitação --
  if (!escolhida) {
    return (
      <div className="space-y-5 p-6 md:p-8">
        <header>
          <h1 className="text-2xl font-bold text-neutral-900">Disputa</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Até quanto dá pra baixar em cada lote. Os lotes vêm do próprio
            edital — você só preenche o custo que o fornecedor cotou pra aquela
            quantidade, e o painel calcula o piso pra você olhar durante o
            pregão.
          </p>
        </header>

        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {!licitacoes ? (
          <div className="text-sm text-neutral-500">Carregando…</div>
        ) : licitacoes.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-neutral-700">
              Nenhuma licitação no seu funil ainda.
            </p>
            <p className="mt-1 text-[12.5px] text-neutral-500">
              Vá em <b>Licitações</b>, clique em <b>+ Acompanhar</b> na que te
              interessa, e ela aparece aqui pra montar a planilha.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {licitacoes.map((l) => (
              <button
                key={l.numeroControlePNCP}
                onClick={() => abrir(l.numeroControlePNCP)}
                className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-4 text-left shadow-sm transition-colors hover:border-brand/50 hover:bg-neutral-50/60"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[220px] flex-1">
                    <div className="text-[13.5px] font-semibold text-neutral-900">
                      {l.orgao}
                    </div>
                    <div className="text-[11.5px] text-neutral-500">
                      {l.municipio}/{l.uf}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] text-neutral-600">
                      {l.objeto}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {l.lotes > 0 ? (
                      <>
                        <div className="text-[13px] font-bold text-neutral-900">
                          {l.cotados}/{l.lotes}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          lotes cotados
                        </div>
                      </>
                    ) : (
                      <div className="rounded-lg bg-neutral-100 px-2.5 py-1 text-[11.5px] font-medium text-neutral-600">
                        montar planilha
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------- a planilha ----
  const t = disputa?.totais;

  return (
    <div className="space-y-4 p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            setEscolhida(null);
            setDisputa(null);
            setModoPregao(false);
          }}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-50"
        >
          ← Outras licitações
        </button>
        <h1 className="text-lg font-bold text-neutral-900">
          {licitacoes?.find((l) => l.numeroControlePNCP === escolhida)?.orgao ??
            "Disputa"}
        </h1>
        <button
          onClick={() => setModoPregao(!modoPregao)}
          className={`ml-auto rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ${
            modoPregao
              ? "brand-gradient text-white"
              : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          {modoPregao ? "Sair do modo pregão" : "Modo pregão"}
        </button>
      </div>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}
      {aviso && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {aviso}
        </div>
      )}

      {carregandoDisputa && !disputa ? (
        <div className="text-sm text-neutral-500">Carregando planilha…</div>
      ) : !disputa ? null : disputa.lotes.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-neutral-700">
            A planilha está vazia.
          </p>
          <p className="mx-auto mt-1 max-w-lg text-[12.5px] text-neutral-500">
            Traga os lotes do edital: número, descrição, quantidade e preço de
            referência vêm prontos do PNCP. Você só preenche o custo.
          </p>
          <button
            onClick={importar}
            disabled={importando}
            className="brand-gradient mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          >
            {importando ? "Buscando no PNCP…" : "Trazer os lotes do edital"}
          </button>
          <button
            onClick={() => chamar("POST", { numero: "", descricao: "" })}
            className="ml-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Adicionar lote na mão
          </button>
        </div>
      ) : (
        <>
          {/* ------------------------------------------------------ resumo -- */}
          {t && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { r: "Lotes", v: String(t.lotes), a: "no edital" },
                {
                  r: "Cotados",
                  v: `${t.cotados}/${t.lotes}`,
                  a: t.semCusto ? `${t.semCusto} sem custo ainda` : "todos com custo",
                  forte: t.semCusto === 0,
                },
                {
                  r: "Piso da proposta",
                  v: brl(t.pisoTotal),
                  a: "soma dos lotes cotados",
                },
                {
                  r: "Referência do órgão",
                  v: brl(t.referenciaTotal),
                  a: "o que eles estimaram",
                },
              ].map((c) => (
                <div
                  key={c.r}
                  className={`rounded-2xl border px-4 py-3 shadow-sm ${
                    c.forte
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-neutral-200/70 bg-white"
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    {c.r}
                  </div>
                  <div className="text-xl font-bold tabular-nums text-neutral-900">
                    {c.v}
                  </div>
                  <div className="text-[11px] text-neutral-500">{c.a}</div>
                </div>
              ))}
            </div>
          )}

          {t && t.abaixoDoPiso > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {t.abaixoDoPiso} lote(s) com lance abaixo do piso — nesses o
              contrato dá prejuízo.
            </div>
          )}

          {/* ------------------------------------------------ barra de ação -- */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Achar lote pelo número ou descrição"
              className="min-w-[220px] flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              onClick={() => setSoCotados(!soCotados)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium ${
                soCotados
                  ? "brand-gradient text-white shadow-sm"
                  : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              Só os que já tenho custo
            </button>

            {!modoPregao && (
              <>
                <label className="flex items-center gap-1.5 text-[12px] text-neutral-600">
                  Imposto padrão
                  <input
                    defaultValue={String(disputa.impostoPadrao)}
                    onBlur={(e) =>
                      chamar("PATCH", { impostoPadrao: paraNumero(e.target.value) })
                    }
                    className="w-16 rounded border border-neutral-300 px-1.5 py-1 text-right text-[12px] tabular-nums outline-none focus:border-brand"
                  />
                  %
                </label>
                <label className="flex items-center gap-1.5 text-[12px] text-neutral-600">
                  Margem padrão
                  <input
                    defaultValue={String(disputa.margemPadrao)}
                    onBlur={(e) =>
                      chamar("PATCH", { margemPadrao: paraNumero(e.target.value) })
                    }
                    className="w-16 rounded border border-neutral-300 px-1.5 py-1 text-right text-[12px] tabular-nums outline-none focus:border-brand"
                  />
                  %
                </label>
                <button
                  onClick={() => chamar("POST", { acao: "reaplicar-padroes" })}
                  title="Aplica o imposto e a margem acima em todos os lotes"
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Aplicar em todos
                </button>
                <button
                  onClick={importar}
                  disabled={importando}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                >
                  {importando ? "Buscando…" : "Buscar lotes de novo"}
                </button>
              </>
            )}
          </div>

          {/* ----------------------------------------------------- a tabela -- */}
          <div className="overflow-x-auto rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-[12px]">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">Lote</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-right">Qtd</th>
                  {!modoPregao && (
                    <>
                      <th className="px-3 py-2 text-left">Fornecedor</th>
                      <th className="px-3 py-2 text-right">Custo un.</th>
                      <th className="px-3 py-2 text-right">Frete</th>
                      <th className="px-3 py-2 text-right">Imp%</th>
                      <th className="px-3 py-2 text-right">Marg%</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-right">Ref. órgão</th>
                  <th className="bg-brand/5 px-3 py-2 text-right font-bold text-brand">
                    Piso
                  </th>
                  <th className="px-3 py-2 text-right">Empate</th>
                  <th className="px-3 py-2 text-right">Meu lance</th>
                  {!modoPregao && <th className="px-2 py-2" />}
                </tr>
              </thead>
              <tbody>
                {lotesVisiveis.map((l: LoteCalculado) => {
                  const semCusto = l.custoUnitario <= 0;
                  return (
                    <tr
                      key={l.id}
                      className={`border-b border-neutral-100 last:border-0 ${
                        l.abaixoDoPiso ? "bg-red-50" : semCusto ? "bg-amber-50/40" : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-semibold tabular-nums text-neutral-800">
                        {l.numero || "—"}
                      </td>
                      <td className="max-w-[280px] px-3 py-2">
                        <div className={modoPregao ? "" : "line-clamp-2"}>
                          {l.descricao || "sem descrição"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                        {l.quantidade.toLocaleString("pt-BR")} {l.unidade}
                      </td>

                      {!modoPregao && (
                        <>
                          <td className="px-3 py-2">
                            <input
                              defaultValue={l.fornecedor}
                              onBlur={(e) =>
                                salvarLote(l.id, "fornecedor", e.target.value)
                              }
                              placeholder="quem cotou"
                              className="w-28 rounded border border-neutral-300 px-1.5 py-1 text-[12px] outline-none focus:border-brand"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              defaultValue={l.custoUnitario || ""}
                              inputMode="decimal"
                              placeholder="0,00"
                              onBlur={(e) =>
                                salvarLote(
                                  l.id,
                                  "custoUnitario",
                                  paraNumero(e.target.value)
                                )
                              }
                              className={`${numInput} w-20 ${
                                semCusto ? "border-amber-400 bg-amber-50" : ""
                              }`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              defaultValue={l.freteTotal || ""}
                              inputMode="decimal"
                              placeholder="0,00"
                              title="Frete do lote inteiro — é rateado pela quantidade"
                              onBlur={(e) =>
                                salvarLote(l.id, "freteTotal", paraNumero(e.target.value))
                              }
                              className={`${numInput} w-20`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              defaultValue={l.percentualImpostos}
                              inputMode="decimal"
                              onBlur={(e) =>
                                salvarLote(
                                  l.id,
                                  "percentualImpostos",
                                  paraNumero(e.target.value)
                                )
                              }
                              className={`${numInput} w-14`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              defaultValue={l.margemAlvo}
                              inputMode="decimal"
                              onBlur={(e) =>
                                salvarLote(l.id, "margemAlvo", paraNumero(e.target.value))
                              }
                              className={`${numInput} w-14`}
                            />
                          </td>
                        </>
                      )}

                      <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                        {l.referenciaUnitaria != null ? brl(l.referenciaUnitaria) : "—"}
                      </td>

                      <td
                        className={`bg-brand/5 px-3 py-2 text-right font-bold tabular-nums ${
                          modoPregao ? "text-[17px]" : "text-[13px]"
                        } ${semCusto ? "text-neutral-400" : "text-brand"}`}
                      >
                        {semCusto ? "sem custo" : brl(l.pisoUnitario)}
                        {!semCusto && l.folgaPercentual != null && (
                          <div className="text-[10px] font-medium text-neutral-500">
                            folga {pct(l.folgaPercentual)}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                        {semCusto ? "—" : brl(l.empateUnitario)}
                      </td>

                      <td className="px-3 py-2">
                        <input
                          defaultValue={l.meuLance ?? ""}
                          inputMode="decimal"
                          placeholder="0,00"
                          onBlur={(e) =>
                            salvarLote(l.id, "meuLance", paraNumero(e.target.value))
                          }
                          className={`${numInput} ${modoPregao ? "w-24 text-[14px]" : "w-20"} ${
                            l.abaixoDoPiso ? "border-red-400 bg-red-50 font-bold" : ""
                          }`}
                        />
                        {l.margemDoLance != null && !semCusto && (
                          <div
                            className={`text-right text-[10px] font-semibold ${
                              l.abaixoDoPiso ? "text-red-600" : "text-emerald-700"
                            }`}
                          >
                            {pct(l.margemDoLance)}
                          </div>
                        )}
                      </td>

                      {!modoPregao && (
                        <td className="px-2 py-2 text-right">
                          <button
                            onClick={() => salvarLote(l.id, "descartado", true)}
                            title="Tirar da disputa"
                            className="rounded px-1.5 py-1 text-[14px] leading-none text-neutral-400 hover:bg-red-50 hover:text-red-600"
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {lotesVisiveis.length === 0 && (
            <p className="text-center text-sm text-neutral-500">
              Nenhum lote bate com esse filtro.
            </p>
          )}

          {!modoPregao && (
            <button
              onClick={() => chamar("POST", { numero: "", descricao: "" })}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              + Adicionar lote na mão
            </button>
          )}
        </>
      )}
    </div>
  );
}
