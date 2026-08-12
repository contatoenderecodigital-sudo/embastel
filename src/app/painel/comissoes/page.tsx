"use client";

import { useEffect, useMemo, useState } from "react";
import type { Romaneio } from "@/lib/romaneiosDb";
import { PERCENTUAL_COMISSAO } from "@/lib/comissao";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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

export default function ComissoesPage() {
  const [romaneios, setRomaneios] = useState<Romaneio[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesAberto, setMesAberto] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/romaneios");
      const data = await res.json();
      setRomaneios(data.romaneios ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const porMes = useMemo(() => {
    const grupos = new Map<string, Romaneio[]>();
    for (const r of romaneios) {
      const mesKey = r.data.slice(0, 7); // "YYYY-MM"
      const lista = grupos.get(mesKey) ?? [];
      lista.push(r);
      grupos.set(mesKey, lista);
    }
    return Array.from(grupos.entries())
      .map(([mesKey, lista]) => {
        const romaneiosOrdenados = [...lista].sort((a, b) => b.data.localeCompare(a.data));
        const totalVendas = romaneiosOrdenados.reduce(
          (soma, r) => soma + r.itens.reduce((s, i) => s + i.valor, 0),
          0
        );
        return {
          mesKey,
          romaneios: romaneiosOrdenados,
          totalVendas,
          comissao: totalVendas * PERCENTUAL_COMISSAO,
        };
      })
      .sort((a, b) => b.mesKey.localeCompare(a.mesKey));
  }, [romaneios]);

  const totalGeralVendas = porMes.reduce((s, m) => s + m.totalVendas, 0);
  const totalGeralComissao = totalGeralVendas * PERCENTUAL_COMISSAO;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">
          Comissão — Ketlyn
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          5% sobre o valor total de tudo que vira romaneio, por mês.
        </p>
      </div>

      {loading && <p className="text-sm text-neutral-500">Carregando...</p>}

      {!loading && porMes.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nenhum romaneio registrado ainda — a comissão aparece aqui assim que tiver vendas.
        </p>
      )}

      {!loading && porMes.length > 0 && (
        <div className="sidebar-gradient rounded-2xl p-6 text-white shadow-lg shadow-black/10">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#a4898b]">
            Total geral vendido
          </p>
          <p className="mt-1 text-2xl font-extrabold">{currency.format(totalGeralVendas)}</p>
          <p className="mt-3 text-[10.5px] font-bold uppercase tracking-wider text-[#a4898b]">
            Comissão total (5%)
          </p>
          <p className="brand-gradient-text text-3xl font-extrabold">
            {currency.format(totalGeralComissao)}
          </p>
        </div>
      )}

      <div className="space-y-3">
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
    </div>
  );
}
