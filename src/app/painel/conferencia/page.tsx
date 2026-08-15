"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Conferencia, ItemConferencia, Periodicidade } from "@/lib/conferenciaDb";

type ItemComStatus = ItemConferencia & { vencido: boolean };

type Dados = {
  itens: ItemComStatus[];
  conferencias: Conferencia[];
  resumo: {
    total: number;
    vencidosHoje: number;
    semanais: number;
    quinzenais: number;
  };
};

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function ConferenciaPage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [aba, setAba] = useState<"conferir" | "lista" | "historico">("conferir");
  const [erro, setErro] = useState<string | null>(null);

  // Quantidades digitadas nesta rodada, por id do item.
  const [contagens, setContagens] = useState<Record<string, string>>({});
  const [conferidoPor, setConferidoPor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);

  // Cadastro de item novo
  const [novoCodigo, setNovoCodigo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novaPeriodicidade, setNovaPeriodicidade] = useState<Periodicidade>("semanal");

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/conferencia");
      if (!res.ok) throw new Error("Falha ao carregar");
      setDados(await res.json());
    } catch {
      setErro("Não deu pra carregar a lista.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const paraConferir = useMemo(() => {
    if (!dados) return [];
    const ativos = dados.itens.filter((i) => i.ativo);
    return mostrarTodos ? ativos : ativos.filter((i) => i.vencido);
  }, [dados, mostrarTodos]);

  const preenchidos = useMemo(
    () =>
      Object.entries(contagens).filter(
        ([, v]) => v.trim() !== "" && !Number.isNaN(Number(v))
      ),
    [contagens]
  );

  async function salvar() {
    if (!preenchidos.length) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/conferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "salvar_conferencia",
          data: hojeISO(),
          conferidoPor: conferidoPor.trim() || null,
          observacao: observacao.trim() || null,
          contagens: preenchidos.map(([itemId, valor]) => ({
            itemId,
            quantidade: Number(valor),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar");
      setSucesso(`${preenchidos.length} item(ns) conferido(s) e registrado(s).`);
      setContagens({});
      setObservacao("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarItem() {
    if (!novaDescricao.trim()) return;
    await fetch("/api/conferencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "novo_item",
        codigo: novoCodigo,
        descricao: novaDescricao,
        periodicidade: novaPeriodicidade,
      }),
    });
    setNovoCodigo("");
    setNovaDescricao("");
    await carregar();
  }

  async function alterarItem(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/conferencia/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await carregar();
  }

  async function removerItem(id: string) {
    await fetch(`/api/conferencia/${id}`, { method: "DELETE" });
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div className="tela-only">
        <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">
          Conferência de estoque
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          A contagem de toda segunda com o pessoal do estoque. Semanais aparecem
          toda semana; quinzenais, a cada duas.
        </p>
      </div>

      <div className="tela-only flex w-fit gap-1 rounded-xl border border-neutral-200 bg-white p-1 text-sm font-medium shadow-sm">
        {(
          [
            ["conferir", `Conferir hoje${dados ? ` (${dados.resumo.vencidosHoje})` : ""}`],
            ["lista", `Lista de itens${dados ? ` (${dados.resumo.total})` : ""}`],
            ["historico", "Histórico"],
          ] as Array<[typeof aba, string]>
        ).map(([valor, texto]) => (
          <button
            key={valor}
            onClick={() => setAba(valor)}
            className={`rounded-lg px-4 py-1.5 transition-colors ${
              aba === valor
                ? "brand-gradient text-white shadow-sm"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="tela-only rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sucesso}
        </div>
      )}

      {/* ================================================== CONFERIR HOJE == */}
      {aba === "conferir" && dados && (
        <div className="space-y-4">
          <div className="tela-only flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200/70 bg-white px-5 py-3.5 shadow-sm">
            <p className="text-[13px] text-neutral-600">
              <b className="font-semibold text-neutral-900">{paraConferir.length}</b>{" "}
              item(ns) pra contar hoje ·{" "}
              <b className="font-semibold text-neutral-900">{preenchidos.length}</b>{" "}
              preenchido(s)
            </p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[12px] text-neutral-600">
                <input
                  type="checkbox"
                  checked={mostrarTodos}
                  onChange={(e) => setMostrarTodos(e.target.checked)}
                />
                Mostrar todos, mesmo os que não venceram
              </label>
              <button
                onClick={() => window.print()}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Imprimir pra levar
              </button>
            </div>
          </div>

          {paraConferir.length === 0 ? (
            <div className="tela-only rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
              <p className="text-sm font-medium text-neutral-700">
                Nenhum item vencido hoje.
              </p>
              <p className="mt-1.5 text-[12.5px] text-neutral-500">
                Tudo que precisava ser contado já foi. Marque &quot;mostrar
                todos&quot; se quiser conferir algo fora da vez.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
              <table className="w-full text-left">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-4 py-2.5">Produto</th>
                    <th className="w-24 px-3 py-2.5 text-center">Tem</th>
                    <th className="w-24 px-3 py-2.5 text-center">Ideal</th>
                  </tr>
                </thead>
                <tbody>
                  {paraConferir.map((item) => {
                    const valor = contagens[item.id] ?? "";
                    const abaixo =
                      item.quantidadeIdeal != null &&
                      valor !== "" &&
                      Number(valor) < item.quantidadeIdeal;
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-neutral-100 last:border-0"
                      >
                        <td className="px-4 py-2">
                          <div className="text-[13.5px] font-medium text-neutral-900">
                            {item.descricao}
                          </div>
                          <div className="text-[11px] text-neutral-400">
                            {item.codigo && `cód. ${item.codigo} · `}
                            {item.periodicidade === "quinzenal" ? "quinzenal" : "semanal"}
                            {item.ultimaContagem != null &&
                              ` · última contagem: ${item.ultimaContagem}`}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={valor}
                            onChange={(e) =>
                              setContagens((c) => ({ ...c, [item.id]: e.target.value }))
                            }
                            className={`w-full rounded-lg border px-2 py-1.5 text-center text-sm outline-none ${
                              abaixo
                                ? "border-red-400 bg-red-50 text-red-700"
                                : "border-neutral-300 focus:border-brand"
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={item.quantidadeIdeal ?? ""}
                            placeholder="—"
                            onChange={(e) =>
                              alterarItem(item.id, {
                                quantidadeIdeal:
                                  e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-center text-sm text-neutral-600 outline-none focus:border-brand focus:bg-white"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {paraConferir.length > 0 && (
            <div className="tela-only space-y-3 rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={conferidoPor}
                  onChange={(e) => setConferidoPor(e.target.value)}
                  placeholder="Quem conferiu (ex: Valdecir)"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <input
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Observação da conferência (opcional)"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>
              <button
                onClick={salvar}
                disabled={salvando || !preenchidos.length}
                className="brand-gradient w-full rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/20 transition-transform hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0"
              >
                {salvando
                  ? "Salvando..."
                  : preenchidos.length
                    ? `Salvar conferência (${preenchidos.length} item(ns))`
                    : "Preencha ao menos um item"}
              </button>
              <p className="text-[11.5px] text-neutral-400">
                Só entra na conferência o que você preencher. O que ficar em branco
                continua pendente pra próxima.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ====================================================== LISTA ====== */}
      {aba === "lista" && dados && (
        <div className="tela-only space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900">
            <b className="font-semibold">Confira esta lista antes de usar.</b> Ela foi
            transcrita das fotos das suas listagens, e transcrição de foto erra:
            código cortado na borda, risco que parece meio apagado, &quot;15D&quot; que
            parece outra coisa. Corrija, apague e acrescente à vontade aqui.
          </div>

          <div className="grid gap-3 rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm sm:grid-cols-[100px_1fr_150px_auto]">
            <input
              value={novoCodigo}
              onChange={(e) => setNovoCodigo(e.target.value)}
              placeholder="Código"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <input
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
              placeholder="Descrição do produto"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <select
              value={novaPeriodicidade}
              onChange={(e) => setNovaPeriodicidade(e.target.value as Periodicidade)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal</option>
            </select>
            <button
              onClick={adicionarItem}
              disabled={!novaDescricao.trim()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
            <table className="w-full text-left">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="w-20 px-4 py-2.5">Cód.</th>
                  <th className="px-3 py-2.5">Descrição</th>
                  <th className="w-32 px-3 py-2.5">Periodicidade</th>
                  <th className="w-24 px-3 py-2.5 text-center">Ideal</th>
                  <th className="w-16 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {dados.itens.map((item) => (
                  <tr key={item.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-1.5 text-[12px] text-neutral-400">
                      {item.codigo || "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        defaultValue={item.descricao}
                        onBlur={(e) => {
                          if (e.target.value !== item.descricao) {
                            alterarItem(item.id, { descricao: e.target.value });
                          }
                        }}
                        className="w-full rounded border border-transparent px-1.5 py-1 text-[13px] text-neutral-800 outline-none hover:border-neutral-200 focus:border-brand"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={item.periodicidade}
                        onChange={(e) =>
                          alterarItem(item.id, { periodicidade: e.target.value })
                        }
                        className="w-full rounded border border-neutral-200 px-1.5 py-1 text-[12px] outline-none focus:border-brand"
                      >
                        <option value="semanal">Semanal</option>
                        <option value="quinzenal">Quinzenal</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        defaultValue={item.quantidadeIdeal ?? ""}
                        placeholder="—"
                        onBlur={(e) =>
                          alterarItem(item.id, {
                            quantidadeIdeal:
                              e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="w-full rounded border border-neutral-200 px-1.5 py-1 text-center text-[12px] outline-none focus:border-brand"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        onClick={() => removerItem(item.id)}
                        className="text-[11px] text-neutral-400 hover:text-red-600"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================== HISTÓRICO ===== */}
      {aba === "historico" && dados && (
        <div className="tela-only space-y-3">
          {dados.conferencias.length === 0 && (
            <p className="text-sm text-neutral-500">
              Nenhuma conferência registrada ainda.
            </p>
          )}
          {dados.conferencias.map((conf) => {
            const abaixoDoIdeal = conf.itens.filter(
              (i) => i.quantidadeIdeal != null && i.quantidade < i.quantidadeIdeal
            );
            return (
              <div
                key={conf.id}
                className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-neutral-900">
                    {formatarData(conf.data)}
                    {conf.conferidoPor && (
                      <span className="ml-2 text-[12px] font-normal text-neutral-500">
                        por {conf.conferidoPor}
                      </span>
                    )}
                  </p>
                  <span className="text-[12px] text-neutral-500">
                    {conf.itens.length} item(ns)
                    {abaixoDoIdeal.length > 0 && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">
                        {abaixoDoIdeal.length} abaixo do ideal
                      </span>
                    )}
                  </span>
                </div>
                {conf.observacao && (
                  <p className="mt-1.5 text-[12.5px] text-neutral-600">
                    {conf.observacao}
                  </p>
                )}
                {abaixoDoIdeal.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {abaixoDoIdeal.map((i) => (
                      <div
                        key={i.itemId}
                        className="flex justify-between rounded-lg bg-red-50/60 px-3 py-1.5 text-[12.5px]"
                      >
                        <span className="text-neutral-700">{i.descricao}</span>
                        <span className="font-medium text-red-700">
                          tinha {i.quantidade} · ideal {i.quantidadeIdeal}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
