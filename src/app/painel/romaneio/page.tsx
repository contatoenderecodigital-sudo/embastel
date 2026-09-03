"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cliente } from "@/lib/clientesDb";
import type { FormaPagamentoRomaneio, Romaneio } from "@/lib/romaneiosDb";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function RomaneioPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [romaneios, setRomaneios] = useState<Romaneio[]>([]);
  const [dataEscolhida, setDataEscolhida] = useState(hojeISO());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [cidade, setCidade] = useState("");

  /**
   * O campo é de texto livre, mas reconhece quem já está cadastrado.
   *
   * Bateu com um cliente da lista, o item fica amarrado a ele e a cidade vem
   * junto — que é o caminho bom. Não bateu, entra como nome digitado. Assim
   * cliente novo não trava a carga, e quem está cadastrado continua sendo
   * lançado com o vínculo certo, sem ninguém precisar escolher entre as duas
   * coisas.
   */
  function escolherCliente(texto: string) {
    setClienteNome(texto);
    const achado = clientes.find(
      (c) => `${c.nome} — ${c.cidade}` === texto || c.nome === texto
    );
    setClienteId(achado?.id ?? "");
    if (achado) setCidade(achado.cidade);
  }
  const [valor, setValor] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoRomaneio>("dinheiro");
  const [itemObs, setItemObs] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const load = useCallback(async () => {
    try {
      const [clientesRes, romaneiosRes] = await Promise.all([
        fetch("/api/clientes"),
        fetch("/api/romaneios"),
      ]);
      const clientesData = await clientesRes.json();
      const romaneiosData = await romaneiosRes.json();
      setClientes(clientesData.clientes ?? []);
      setRomaneios(romaneiosData.romaneios ?? []);
    } catch {
      setError("Erro ao carregar romaneios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const romaneioAtual = useMemo(
    () => romaneios.find((r) => r.data === dataEscolhida) ?? null,
    [romaneios, dataEscolhida]
  );

  const outrosRomaneios = useMemo(
    () =>
      romaneios
        .filter((r) => r.data !== dataEscolhida)
        .sort((a, b) => b.data.localeCompare(a.data))
        .slice(0, 15),
    [romaneios, dataEscolhida]
  );

  async function handleCriarRomaneio() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/romaneios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: dataEscolhida }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar romaneio");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar romaneio");
    } finally {
      setCreating(false);
    }
  }

  async function handleExcluirRomaneio() {
    if (!romaneioAtual) return;
    await fetch(`/api/romaneios/${romaneioAtual.id}`, { method: "DELETE" });
    await load();
  }

  async function handleAddItem() {
    if (!romaneioAtual || !clienteNome.trim()) {
      setError("Escolha o cliente ou digite o nome.");
      return;
    }
    setAddingItem(true);
    setError(null);
    try {
      const res = await fetch(`/api/romaneios/${romaneioAtual.id}/itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          clienteNome: clienteNome.trim(),
          cidade: cidade.trim(),
          valor: valor || 0,
          formaPagamento,
          observacao: itemObs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao adicionar cliente");
      setClienteId("");
      setClienteNome("");
      setCidade("");
      setValor("");
      setItemObs("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar cliente");
    } finally {
      setAddingItem(false);
    }
  }

  async function handlePatchItem(itemId: string, patch: Record<string, unknown>) {
    if (!romaneioAtual) return;
    await fetch(`/api/romaneios/${romaneioAtual.id}/itens/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function handleRemoveItem(itemId: string) {
    if (!romaneioAtual) return;
    await fetch(`/api/romaneios/${romaneioAtual.id}/itens/${itemId}`, { method: "DELETE" });
    await load();
  }

  const totalRomaneio = romaneioAtual?.itens.reduce((s, i) => s + i.valor, 0) ?? 0;

  return (
    <div className="space-y-6">
      <datalist id="clientes-romaneio">
        {clientes.map((c) => (
          <option key={c.id} value={`${c.nome} — ${c.cidade}`} />
        ))}
      </datalist>

      <div>
        <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">Romaneio</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Um romaneio por data de saída da carga — adiciona os clientes que vão nessa entrega,
          com valor e forma de pagamento.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
        <label className="text-sm font-medium text-neutral-700">Data do romaneio</label>
        <input
          type="date"
          value={dataEscolhida}
          onChange={(e) => setDataEscolhida(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        {!loading && !romaneioAtual && (
          <button
            onClick={handleCriarRomaneio}
            disabled={creating}
            className="brand-gradient rounded-md px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand/20 disabled:opacity-50"
          >
            {creating ? "Criando..." : `Criar romaneio de ${formatarData(dataEscolhida)}`}
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-neutral-500">Carregando...</p>}

      {romaneioAtual && (
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-4">
            <div>
              <p className="text-lg font-semibold text-neutral-900">
                Romaneio de {formatarData(romaneioAtual.data)}
              </p>
              <p className="text-xs text-neutral-500">
                {romaneioAtual.itens.length} cliente(s) · Total: {currency.format(totalRomaneio)}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/romaneio/${romaneioAtual.id}/imprimir`}
                target="_blank"
                className={`brand-gradient rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-brand/20 ${
                  romaneioAtual.itens.length === 0 ? "pointer-events-none opacity-40" : ""
                }`}
              >
                Imprimir romaneio (A4)
              </Link>
              <button
                onClick={handleExcluirRomaneio}
                className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Excluir romaneio
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs font-medium text-neutral-700">Cliente</label>
              <input
                value={clienteNome}
                list="clientes-romaneio"
                onChange={(e) => escolherCliente(e.target.value)}
                placeholder="Digite ou escolha da lista"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div className="min-w-[120px]">
              <label className="mb-1 block text-xs font-medium text-neutral-700">Cidade</label>
              <input
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Valor</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-[110px] rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Pagamento</label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value as FormaPagamentoRomaneio)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="cheque">Cheque</option>
                <option value="boleto">Boleto</option>
              </select>
            </div>
            <div className="min-w-[150px] flex-1">
              <label className="mb-1 block text-xs font-medium text-neutral-700">
                Observação
              </label>
              <input
                value={itemObs}
                onChange={(e) => setItemObs(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <button
              onClick={handleAddItem}
              disabled={addingItem || !clienteNome.trim()}
              className="brand-gradient rounded-md px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand/20 disabled:opacity-50"
            >
              Adicionar
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {romaneioAtual.itens.length === 0 && (
              <p className="text-sm text-neutral-500">Nenhum cliente nesse romaneio ainda.</p>
            )}
            {romaneioAtual.itens.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3"
              >
                <div className="min-w-[140px] flex-1">
                  <input
                    defaultValue={item.clienteNome}
                    onBlur={(e) => {
                      const nome = e.target.value.trim();
                      if (nome && nome !== item.clienteNome) {
                        handlePatchItem(item.id, { clienteNome: nome });
                      }
                    }}
                    className="w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-neutral-900 outline-none hover:border-neutral-200 focus:border-brand focus:bg-white"
                  />
                  <div className="flex items-center gap-1 text-xs text-neutral-500">
                    <input
                      defaultValue={item.cidade}
                      placeholder="cidade"
                      onBlur={(e) => {
                        if (e.target.value.trim() !== item.cidade) {
                          handlePatchItem(item.id, { cidade: e.target.value.trim() });
                        }
                      }}
                      className="w-[110px] rounded border border-transparent bg-transparent px-1.5 py-0.5 outline-none hover:border-neutral-200 focus:border-brand focus:bg-white"
                    />
                    {item.observacao && <span>· {item.observacao}</span>}
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={item.valor}
                  onBlur={(e) => {
                    const num = Number(e.target.value) || 0;
                    if (num !== item.valor) handlePatchItem(item.id, { valor: num });
                  }}
                  className="w-[100px] rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
                />
                <select
                  value={item.formaPagamento}
                  onChange={(e) => handlePatchItem(item.id, { formaPagamento: e.target.value })}
                  className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-brand"
                >
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">Pix</option>
                  <option value="cheque">Cheque</option>
                  <option value="boleto">Boleto</option>
                </select>
                <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                  <input
                    type="checkbox"
                    checked={item.entregue}
                    onChange={(e) => handlePatchItem(item.id, { entregue: e.target.checked })}
                    className="h-4 w-4 accent-brand"
                  />
                  Entregue
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                  <input
                    type="checkbox"
                    checked={item.pago}
                    onChange={(e) => handlePatchItem(item.id, { pago: e.target.checked })}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  Pago
                </label>
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="text-[11px] text-neutral-400 hover:text-red-600"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {outrosRomaneios.length > 0 && (
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-neutral-500">
            Outros romaneios
          </h2>
          <div className="flex flex-wrap gap-2">
            {outrosRomaneios.map((r) => (
              <button
                key={r.id}
                onClick={() => setDataEscolhida(r.data)}
                className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:border-brand hover:text-brand"
              >
                {formatarData(r.data)} · {r.itens.length} cliente(s)
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
