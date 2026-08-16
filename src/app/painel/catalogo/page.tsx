"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PrecosCalculados, ProdutoCatalogo } from "@/lib/catalogoDb";

type ProdutoNaTela = ProdutoCatalogo & { precos: PrecosCalculados };

type Form = {
  id: string | null;
  codigo: string;
  descricao: string;
  unidade: string;
  marca: string;
  fabricante: string;
  codigoFabricante: string;
  fornecedor: string;
  custo: string;
  freteUnitario: string;
  percentualImpostos: string;
  margemAlvo: string;
  observacao: string;
};

const VAZIO: Form = {
  id: null,
  codigo: "",
  descricao: "",
  unidade: "un",
  marca: "",
  fabricante: "",
  codigoFabricante: "",
  fornecedor: "",
  custo: "",
  freteUnitario: "0",
  percentualImpostos: "10",
  margemAlvo: "15",
  observacao: "",
};

function n(texto: string): number {
  return Number(texto.replace(/\./g, "").replace(",", ".")) || 0;
}

function dinheiro(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Mesma conta do servidor — a tela precisa dela antes de salvar. */
function calcular(p: {
  custo: number;
  freteUnitario: number;
  percentualImpostos: number;
  margemAlvo: number;
}) {
  const custoTotal = p.custo + p.freteUnitario;
  const restanteAlvo = Math.max(0.05, 1 - p.percentualImpostos / 100 - p.margemAlvo / 100);
  const restanteEmpate = Math.max(0.05, 1 - p.percentualImpostos / 100);
  return {
    custoTotal,
    precoMinimo: custoTotal / restanteAlvo,
    precoEmpate: custoTotal / restanteEmpate,
  };
}

function margemNoPreco(
  p: { custo: number; freteUnitario: number; percentualImpostos: number },
  preco: number
): number {
  if (!preco) return 0;
  const liquido = preco * (1 - p.percentualImpostos / 100);
  return (liquido - (p.custo + p.freteUnitario)) / preco;
}

export default function CatalogoPage() {
  const [produtos, setProdutos] = useState<ProdutoNaTela[] | null>(null);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  // Simulador: preço digitado por produto, pra ver a margem naquele lance.
  const [lance, setLance] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/catalogo");
      if (!res.ok) throw new Error();
      setProdutos((await res.json()).produtos);
    } catch {
      setErro("Não deu pra carregar o catálogo.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    if (!produtos) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((p) =>
      [p.descricao, p.codigo, p.marca, p.fabricante, p.codigoFabricante, p.fornecedor]
        .filter(Boolean)
        .some((campo) => campo!.toLowerCase().includes(termo))
    );
  }, [produtos, busca]);

  const previa = useMemo(() => {
    if (!form) return null;
    return calcular({
      custo: n(form.custo),
      freteUnitario: n(form.freteUnitario),
      percentualImpostos: n(form.percentualImpostos),
      margemAlvo: n(form.margemAlvo),
    });
  }, [form]);

  async function salvar() {
    if (!form) return;
    if (!form.descricao.trim()) {
      setErro("A descrição é obrigatória.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const corpo = {
        codigo: form.codigo,
        descricao: form.descricao,
        unidade: form.unidade,
        marca: form.marca,
        fabricante: form.fabricante,
        codigoFabricante: form.codigoFabricante,
        fornecedor: form.fornecedor,
        custo: n(form.custo),
        freteUnitario: n(form.freteUnitario),
        percentualImpostos: n(form.percentualImpostos),
        margemAlvo: n(form.margemAlvo),
        observacao: form.observacao,
      };
      const res = await fetch(form.id ? `/api/catalogo/${form.id}` : "/api/catalogo", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!res.ok) throw new Error();
      setForm(null);
      await carregar();
      setSucesso(form.id ? "Produto atualizado." : "Produto cadastrado.");
    } catch {
      setErro("Não deu pra salvar o produto.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(p: ProdutoNaTela) {
    if (!confirm(`Apagar "${p.descricao}" do catálogo?`)) return;
    await fetch(`/api/catalogo/${p.id}`, { method: "DELETE" });
    await carregar();
  }

  function copiarParaProposta(p: ProdutoNaTela) {
    const texto = [
      `Marca: ${p.marca ?? "—"}`,
      `Fabricante: ${p.fabricante ?? "—"}`,
      p.codigoFabricante ? `Código: ${p.codigoFabricante}` : null,
      `Descrição: ${p.descricao}`,
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(texto);
    setSucesso("Marca, fabricante e código copiados — cole na proposta do portal.");
  }

  if (!produtos) {
    return <div className="p-8 text-sm text-neutral-500">Carregando catálogo…</div>;
  }

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-bold text-neutral-900">Catálogo de produtos</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Custo, imposto e margem de cada item — pra saber até onde dá pra baixar
          o lance sem sair no prejuízo. Marca e fabricante ficam salvos pra não
          redigitar em cada pregão.
        </p>
      </header>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sucesso}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => (form ? setForm(null) : setForm({ ...VAZIO }))}
          className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          {form ? "Fechar formulário" : "Cadastrar produto"}
        </button>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por descrição, código, marca, fabricante…"
          className="min-w-[240px] flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      {/* ------------------------------------------------------ formulário -- */}
      {form && (
        <div className="space-y-4 rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-neutral-900">
            {form.id ? "Editar produto" : "Novo produto"}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Código interno
              </span>
              <input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[12px] font-medium text-neutral-600">
                Descrição
              </span>
              <input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="ex: Saco de lixo 100L reforçado, preto, pacote com 100"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">Unidade</span>
              <input
                value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">Marca</span>
              <input
                value={form.marca}
                onChange={(e) => setForm({ ...form, marca: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Fabricante
              </span>
              <input
                value={form.fabricante}
                onChange={(e) => setForm({ ...form, fabricante: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Código do fabricante / EAN
              </span>
              <input
                value={form.codigoFabricante}
                onChange={(e) =>
                  setForm({ ...form, codigoFabricante: e.target.value })
                }
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Fornecedor
              </span>
              <input
                value={form.fornecedor}
                onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Custo de compra (R$)
              </span>
              <input
                value={form.custo}
                inputMode="decimal"
                onChange={(e) => setForm({ ...form, custo: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Frete por unidade (R$)
              </span>
              <input
                value={form.freteUnitario}
                inputMode="decimal"
                onChange={(e) => setForm({ ...form, freteUnitario: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Impostos (% da venda)
              </span>
              <input
                value={form.percentualImpostos}
                inputMode="decimal"
                onChange={(e) =>
                  setForm({ ...form, percentualImpostos: e.target.value })
                }
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Margem alvo (%)
              </span>
              <input
                value={form.margemAlvo}
                inputMode="decimal"
                onChange={(e) => setForm({ ...form, margemAlvo: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            <label className="flex flex-col gap-1 md:col-span-4">
              <span className="text-[12px] font-medium text-neutral-600">
                Observação
              </span>
              <input
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder="ex: só entrega acima de 50 caixas"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
          </div>

          {previa && n(form.custo) > 0 && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900">
              Custo total <b>{dinheiro(previa.custoTotal)}</b> · piso pra margem de{" "}
              {n(form.margemAlvo)}%: <b>{dinheiro(previa.precoMinimo)}</b> · abaixo de{" "}
              <b>{dinheiro(previa.precoEmpate)}</b> é prejuízo.
              <div className="mt-1 text-[11.5px] text-sky-800">
                Imposto e margem incidem sobre o preço de venda, não sobre o
                custo — por isso o piso não é custo + 25%.
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={salvar}
              disabled={salvando}
              className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <button
              onClick={() => setForm(null)}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- lista -- */}
      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-neutral-700">
            {produtos.length === 0
              ? "Nenhum produto no catálogo ainda."
              : "Nenhum produto bate com essa busca."}
          </p>
          {produtos.length === 0 && (
            <p className="mt-1.5 text-[12.5px] text-neutral-500">
              Comece pelos itens que mais aparecem nos editais: saco de lixo,
              copo descartável, papel toalha.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((p) => {
            const digitado = lance[p.id] ?? "";
            const precoLance = n(digitado);
            const margem = precoLance ? margemNoPreco(p, precoLance) : null;
            const abaixoDoPiso = precoLance > 0 && precoLance < p.precos.precoMinimo;
            const prejuizo = precoLance > 0 && precoLance < p.precos.precoEmpate;
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[220px] flex-1">
                    <div className="text-[13.5px] font-semibold text-neutral-900">
                      {p.descricao}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-neutral-500">
                      {p.codigo && `cód. ${p.codigo} · `}
                      {p.unidade}
                      {p.marca && ` · ${p.marca}`}
                      {p.fabricante && ` · ${p.fabricante}`}
                      {p.codigoFabricante && ` · ref. ${p.codigoFabricante}`}
                      {p.fornecedor && ` · compra de ${p.fornecedor}`}
                    </div>
                    {p.observacao && (
                      <div className="mt-1 text-[11.5px] text-neutral-500">
                        {p.observacao}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => copiarParaProposta(p)}
                      className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Copiar p/ proposta
                    </button>
                    <button
                      onClick={() =>
                        setForm({
                          id: p.id,
                          codigo: p.codigo,
                          descricao: p.descricao,
                          unidade: p.unidade,
                          marca: p.marca ?? "",
                          fabricante: p.fabricante ?? "",
                          codigoFabricante: p.codigoFabricante ?? "",
                          fornecedor: p.fornecedor ?? "",
                          custo: String(p.custo),
                          freteUnitario: String(p.freteUnitario),
                          percentualImpostos: String(p.percentualImpostos),
                          margemAlvo: String(p.margemAlvo),
                          observacao: p.observacao ?? "",
                        })
                      }
                      className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => excluir(p)}
                      className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50"
                    >
                      Apagar
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-neutral-100 pt-3">
                  <span className="text-[12px] text-neutral-500">
                    Custo{" "}
                    <b className="font-semibold text-neutral-800">
                      {dinheiro(p.precos.custoTotal)}
                    </b>
                  </span>
                  <span className="text-[12px] text-neutral-500">
                    Piso ({p.margemAlvo}%){" "}
                    <b className="font-semibold text-emerald-700">
                      {dinheiro(p.precos.precoMinimo)}
                    </b>
                  </span>
                  <span className="text-[12px] text-neutral-500">
                    Prejuízo abaixo de{" "}
                    <b className="font-semibold text-red-600">
                      {dinheiro(p.precos.precoEmpate)}
                    </b>
                  </span>

                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[11.5px] text-neutral-500">
                      Simular lance:
                    </span>
                    <input
                      value={digitado}
                      inputMode="decimal"
                      placeholder="R$"
                      onChange={(e) =>
                        setLance({ ...lance, [p.id]: e.target.value })
                      }
                      className={`w-24 rounded-lg border px-2 py-1.5 text-right text-sm outline-none ${
                        prejuizo
                          ? "border-red-400 bg-red-50 text-red-700"
                          : abaixoDoPiso
                            ? "border-amber-400 bg-amber-50 text-amber-800"
                            : "border-neutral-300 focus:border-brand"
                      }`}
                    />
                    {margem !== null && (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          prejuizo
                            ? "border-red-200 bg-red-50 text-red-700"
                            : abaixoDoPiso
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {prejuizo
                          ? `Prejuízo · margem ${(margem * 100).toFixed(1)}%`
                          : `Margem ${(margem * 100).toFixed(1)}%`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
