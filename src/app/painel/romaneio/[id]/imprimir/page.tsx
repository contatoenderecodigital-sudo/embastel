"use client";

import { use, useEffect, useState } from "react";
import type { FormaPagamentoRomaneio, Romaneio } from "@/lib/romaneiosDb";

const FORMA_LABEL: Record<FormaPagamentoRomaneio, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cheque: "Cheque",
  boleto: "Boleto",
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function ImprimirRomaneioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [romaneio, setRomaneio] = useState<Romaneio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/romaneios/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Romaneio não encontrado");
        setRomaneio(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar romaneio");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <p className="p-8 text-sm text-neutral-500">Carregando...</p>;
  if (error || !romaneio) return <p className="p-8 text-sm text-red-600">{error}</p>;

  const porCidade = romaneio.itens.reduce<Record<string, typeof romaneio.itens>>((acc, item) => {
    (acc[item.cidade] ??= []).push(item);
    return acc;
  }, {});
  const cidades = Object.keys(porCidade).sort();
  const total = romaneio.itens.reduce((s, i) => s + i.valor, 0);

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-10 text-neutral-900 print:p-0">
      <div className="mb-6 flex gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="brand-gradient rounded-md px-4 py-2 text-sm font-medium text-white shadow-md"
        >
          Imprimir
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-600"
        >
          Fechar
        </button>
      </div>

      <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-4">
        <div>
          <h1 className="text-xl font-extrabold">EMBASTEL EMBALAGENS</h1>
          <p className="text-xs text-neutral-600">Av. Brasil, 1372, Xanxerê/SC</p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold">ROMANEIO — {formatarData(romaneio.data)}</h2>
          <p className="text-xs text-neutral-600">{romaneio.itens.length} entrega(s)</p>
        </div>
      </div>

      {romaneio.observacao && (
        <p className="mt-3 text-sm text-neutral-600">{romaneio.observacao}</p>
      )}

      {cidades.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">Nenhum cliente nesse romaneio.</p>
      )}

      {cidades.map((cidade) => (
        <div key={cidade} className="mt-6 break-inside-avoid">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-neutral-700">
            {cidade}
          </h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-neutral-900 text-left">
                <th className="py-1.5">Cliente</th>
                <th className="py-1.5">Pagamento</th>
                <th className="py-1.5 text-right">Valor</th>
                <th className="py-1.5 text-center">Recebido</th>
              </tr>
            </thead>
            <tbody>
              {porCidade[cidade].map((item) => (
                <tr key={item.id} className="border-b border-neutral-200">
                  <td className="py-2">
                    {item.clienteNome}
                    {item.observacao && (
                      <span className="block text-[11px] text-neutral-500">
                        {item.observacao}
                      </span>
                    )}
                  </td>
                  <td className="py-2">{FORMA_LABEL[item.formaPagamento]}</td>
                  <td className="py-2 text-right">{currency.format(item.valor)}</td>
                  <td className="py-2 text-center">
                    <span className="inline-block h-4 w-4 border border-neutral-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {romaneio.itens.length > 0 && (
        <div className="mt-6 flex justify-end border-t-2 border-neutral-900 pt-2">
          <p className="text-lg font-extrabold">Total: {currency.format(total)}</p>
        </div>
      )}
    </div>
  );
}
