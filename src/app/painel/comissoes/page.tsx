"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Romaneio } from "@/lib/romaneiosDb";
import type { PagamentoComissao } from "@/lib/comissoesDb";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Saldo = {
  totalVendido: number;
  comissaoTotal: number;
  totalPago: number;
  aPagar: number;
  percentual: number;
  pagamentos: PagamentoComissao[];
};

function mesLabel(mesKey: string): string {
  const [ano, mes] = mesKey.split("-");
  const nomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${nomes[Number(mes) - 1]} de ${ano}`;
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ComissoesPage() {
  const [romaneios, setRomaneios] = useState<Romaneio[]>([]);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mesAberto, setMesAberto] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [romRes, comRes] = await Promise.all([
        fetch("/api/romaneios"),
        fetch("/api/comissoes"),
      ]);
      setRomaneios((await romRes.json()).romaneios ?? []);
      setSaldo(await comRes.json());
    } catch {
      setErro("Erro ao carregar as comissões.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function registrarPagamento() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/comissoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacao: observacao.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao registrar o pagamento");
      setSaldo(data);
      setObservacao("");
      setConfirmando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar o pagamento");
    } finally {
      setSalvando(false);
    }
  }

  async function desfazerPagamento(id: string) {
    await fetch(`/api/comissoes/${id}`, { method: "DELETE" });
    await load();
  }

  const porMes = useMemo(() => {
    const grupos = new Map<string, Romaneio[]>();
    for (const r of romaneios) {
      const mesKey = r.data.slice(0, 7);
      const lista = grupos.get(mesKey) ?? [];
      lista.push(r);
      grupos.set(mesKey, lista);
    }
    const percentual = saldo?.percentual ?? 0.05;
    return Array.from(grupos.entries())
      .map(([mesKey, lista]) => {
        const ordenados = [...lista].sort((a, b) => b.data.localeCompare(a.data));
        const totalVendas = ordenados.reduce(
          (soma, r) => soma + r.itens.reduce((s, i) => s + i.valor, 0),
          0
        );
        return {
          mesKey,
          romaneios: ordenados,
          totalVendas,
          comissao: totalVendas * percentual,
        };
      })
      .sort((a, b) => b.mesKey.localeCompare(a.mesKey));
  }, [romaneios, saldo?.percentual]);

  const temSaldo = (saldo?.aPagar ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">
          Comissão — Ketlyn
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          5% sobre tudo que vira romaneio. O valor vai acumulando até você
          registrar o pagamento.
        </p>
      </div>

      {loading && <p className="text-sm text-neutral-500">Carregando...</p>}

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* ------------------------------------------------- saldo em aberto */}
      {!loading && saldo && (
        <div className="sidebar-gradient overflow-hidden rounded-2xl text-white shadow-lg shadow-black/10">
          <div className="p-6">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#a4898b]">
              A pagar pra Ketlyn agora
            </p>
            <p
              className={`mt-1 text-[38px] font-extrabold leading-none tracking-tight ${
                temSaldo ? "brand-gradient-text" : "text-emerald-400"
              }`}
            >
              {currency.format(saldo.aPagar)}
            </p>
            {!temSaldo && (
              <p className="mt-2 text-[12.5px] text-[#cbb9ba]">
                Tudo quitado. O valor volta a subir no próximo romaneio.
              </p>
            )}

            <div className="mt-5 grid grid-cols-3 gap-4 border-t border-white/[0.08] pt-4 text-[12px]">
              <div>
                <div className="text-[#8a7778]">Vendido no total</div>
                <div className="mt-0.5 font-semibold text-white">
                  {currency.format(saldo.totalVendido)}
                </div>
              </div>
              <div>
                <div className="text-[#8a7778]">Comissão gerada</div>
                <div className="mt-0.5 font-semibold text-white">
                  {currency.format(saldo.comissaoTotal)}
                </div>
              </div>
              <div>
                <div className="text-[#8a7778]">Já pago</div>
                <div className="mt-0.5 font-semibold text-emerald-400">
                  {currency.format(saldo.totalPago)}
                </div>
              </div>
            </div>
          </div>

          {temSaldo && (
            <div className="border-t border-white/[0.08] bg-black/20 px-6 py-4">
              {confirmando ? (
                <div className="space-y-3">
                  <p className="text-[13px] text-white">
                    Registrar o pagamento de{" "}
                    <b className="font-bold">{currency.format(saldo.aPagar)}</b>? O
                    saldo zera e volta a contar do zero.
                  </p>
                  <input
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Observação (opcional) — ex: pago em dinheiro"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-[13px] text-white outline-none placeholder:text-[#8a7778] focus:border-white/30"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={registrarPagamento}
                      disabled={salvando}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {salvando ? "Registrando..." : "Confirmar pagamento"}
                    </button>
                    <button
                      onClick={() => setConfirmando(false)}
                      className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#cbb9ba] hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmando(true)}
                  className="rounded-lg bg-emerald-600 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-lg shadow-black/20 transition-transform hover:-translate-y-px hover:bg-emerald-500"
                >
                  Já paguei — zerar o saldo
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------ pagamentos */}
      {saldo && saldo.pagamentos.length > 0 && (
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-neutral-500">
            Pagamentos registrados
          </h2>
          <div className="space-y-2">
            {saldo.pagamentos.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-neutral-900">
                    {currency.format(p.valor)}
                  </p>
                  <p className="text-[11.5px] text-neutral-500">
                    {formatarDataHora(p.pagoEm)}
                    {p.observacao ? ` · ${p.observacao}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => desfazerPagamento(p.id)}
                  className="shrink-0 text-[11.5px] text-neutral-400 hover:text-red-600"
                  title="O valor volta pro saldo em aberto"
                >
                  Desfazer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------- histórico mês */}
      {!loading && porMes.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nenhum romaneio registrado ainda — a comissão aparece aqui assim que
          tiver vendas.
        </p>
      )}

      {porMes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
            Quanto foi gerado em cada mês
          </h2>
          {porMes.map((mes) => (
            <div
              key={mes.mesKey}
              className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm"
            >
              <button
                onClick={() => setMesAberto(mesAberto === mes.mesKey ? null : mes.mesKey)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
              >
                <div>
                  <p className="font-semibold text-neutral-900">{mesLabel(mes.mesKey)}</p>
                  <p className="text-xs text-neutral-500">
                    {mes.romaneios.length} romaneio(s) · Vendido:{" "}
                    {currency.format(mes.totalVendas)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="brand-gradient-text text-lg font-extrabold">
                    {currency.format(mes.comissao)}
                  </span>
                  <span className="text-neutral-400">
                    {mesAberto === mes.mesKey ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {mesAberto === mes.mesKey && (
                <div className="space-y-2 border-t border-neutral-100 px-6 py-4">
                  {mes.romaneios.map((r) => {
                    const totalRomaneio = r.itens.reduce((s, i) => s + i.valor, 0);
                    return (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-lg bg-neutral-50 px-3.5 py-2 text-sm"
                      >
                        <span className="text-neutral-700">
                          {formatarData(r.data)} · {r.itens.length} cliente(s)
                        </span>
                        <span className="font-medium text-neutral-900">
                          {currency.format(totalRomaneio)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
