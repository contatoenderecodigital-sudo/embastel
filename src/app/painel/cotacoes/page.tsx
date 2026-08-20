"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cotacao } from "@/lib/cotacoesDb";
import { PATH_WHATSAPP } from "@/components/icones";

type Linha = Cotacao & { telefone: string; contato: string; naAgenda: boolean };

type Dados = {
  cotacoes: Linha[];
  fornecedoresConhecidos: string[];
  resumo: { total: number; fornecedores: number; produtos: number };
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function paraNumero(texto: string): number {
  const t = (texto ?? "").trim();
  if (!t) return 0;
  const limpo = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : t.replace(/,/g, "");
  const n = Number(limpo.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatarTelefone(d: string): string {
  const n = d.startsWith("55") ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return d;
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** Agrupa pelo nome do produto, pra ver os fornecedores lado a lado. */
function chaveProduto(p: string): string {
  return p.toLowerCase().replace(/\s+/g, " ").trim();
}

export default function CotacoesPage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [produto, setProduto] = useState("");
  const [marca, setMarca] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [preco, setPreco] = useState("");
  const [quantidade, setQuantidade] = useState("");

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/cotacoes");
      if (!res.ok) throw new Error();
      setDados(await res.json());
    } catch {
      setErro("Não deu pra carregar as cotações.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  async function salvar() {
    if (!produto.trim() || !fornecedor.trim() || paraNumero(preco) <= 0) {
      setErro("Precisa do produto, do fornecedor e do preço.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/cotacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produto,
          marca,
          fornecedor,
          precoUnitario: paraNumero(preco),
          quantidadeCotada: paraNumero(quantidade),
        }),
      });
      if (!res.ok) throw new Error();
      setProduto("");
      setMarca("");
      setPreco("");
      setQuantidade("");
      // O fornecedor fica: o normal é lançar vários produtos do mesmo de uma vez.
      await carregar();
    } catch {
      setErro("Não deu pra salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(c: Linha) {
    if (!confirm(`Apagar a cotação de "${c.produto}" do ${c.fornecedor}?`)) return;
    await fetch(`/api/cotacoes?id=${encodeURIComponent(c.id)}`, { method: "DELETE" });
    await carregar();
  }

  // Um grupo por produto, com os fornecedores dentro do mais barato pro mais
  // caro — é assim que se decide com quem fechar.
  const grupos = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    const filtradas = dados.cotacoes.filter(
      (c) =>
        !termo ||
        c.produto.toLowerCase().includes(termo) ||
        c.marca.toLowerCase().includes(termo) ||
        c.fornecedor.toLowerCase().includes(termo)
    );

    const mapa = new Map<string, Linha[]>();
    for (const c of filtradas) {
      const k = chaveProduto(c.produto);
      const atual = mapa.get(k);
      if (atual) atual.push(c);
      else mapa.set(k, [c]);
    }

    return [...mapa.values()]
      .map((linhas) => linhas.sort((a, b) => a.precoUnitario - b.precoUnitario))
      .sort((a, b) => a[0].produto.localeCompare(b[0].produto, "pt-BR"));
  }, [dados, busca]);

  if (!dados) {
    return <div className="p-8 text-sm text-neutral-500">Carregando cotações…</div>;
  }

  const campo =
    "rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="space-y-5 p-6 md:p-8">
      <datalist id="fornecedores-conhecidos">
        {dados.fornecedoresConhecidos.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <header>
        <h1 className="text-2xl font-bold text-neutral-900">Preços dos fornecedores</h1>
        <p className="mt-1 text-sm text-neutral-600">
          O que cada um cobra em cada produto, com o telefone do lado. Cotou com
          três? Os três ficam aqui, do mais barato pro mais caro. Tudo que você
          preenche na planilha de disputa cai aqui sozinho.
        </p>
      </header>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { r: "Cotações", v: dados.resumo.total },
          { r: "Produtos", v: dados.resumo.produtos },
          { r: "Fornecedores", v: dados.resumo.fornecedores },
        ].map((c) => (
          <div
            key={c.r}
            className="rounded-2xl border border-neutral-200/70 bg-white px-4 py-3 shadow-sm"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {c.r}
            </div>
            <div className="text-2xl font-bold text-neutral-900">{c.v}</div>
          </div>
        ))}
      </div>

      {/* -------------------------------------------------------- lançar -- */}
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
        <div className="mb-2.5 text-[12.5px] font-semibold text-neutral-800">
          Lançar preço
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="text-[11.5px] font-medium text-neutral-600">Produto</span>
            <input
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
              placeholder="ex: Saponáceo cremoso 300ml"
              className={campo}
            />
          </label>
          <label className="flex w-32 flex-col gap-1">
            <span className="text-[11.5px] font-medium text-neutral-600">Marca</span>
            <input
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
              placeholder="Gota Limpa"
              className={campo}
            />
          </label>
          <label className="flex w-40 flex-col gap-1">
            <span className="text-[11.5px] font-medium text-neutral-600">
              Fornecedor
            </span>
            <input
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
              list="fornecedores-conhecidos"
              placeholder="quem cotou"
              className={campo}
            />
          </label>
          <label className="flex w-28 flex-col gap-1">
            <span className="text-[11.5px] font-medium text-neutral-600">
              Preço un.
            </span>
            <input
              value={preco}
              inputMode="decimal"
              onChange={(e) => setPreco(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
              placeholder="5,03"
              className={`${campo} text-right tabular-nums`}
            />
          </label>
          <label className="flex w-28 flex-col gap-1">
            <span className="text-[11.5px] font-medium text-neutral-600">
              P/ quantas
            </span>
            <input
              value={quantidade}
              inputMode="numeric"
              onChange={(e) => setQuantidade(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
              placeholder="843"
              title="O preço muda com a quantidade — guarde pra qual ele vale"
              className={`${campo} text-right tabular-nums`}
            />
          </label>
          <button
            onClick={salvar}
            disabled={salvando}
            className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por produto, marca ou fornecedor"
        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
      />

      {/* --------------------------------------------------------- lista -- */}
      {grupos.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-neutral-700">
            {dados.cotacoes.length === 0
              ? "Nenhum preço lançado ainda."
              : "Nada bate com essa busca."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {grupos.map((linhas) => (
            <div
              key={chaveProduto(linhas[0].produto)}
              className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-baseline gap-2 border-b border-neutral-100 px-4 py-2.5">
                <span className="text-[13.5px] font-semibold text-neutral-900">
                  {linhas[0].produto}
                </span>
                {linhas.length > 1 && (
                  <span className="text-[11.5px] text-neutral-500">
                    {linhas.length} fornecedores — o mais barato está em cima
                  </span>
                )}
              </div>

              {linhas.map((c, i) => (
                <div
                  key={c.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 ${
                    i > 0 ? "border-t border-neutral-100" : ""
                  } ${i === 0 && linhas.length > 1 ? "bg-emerald-50/50" : ""}`}
                >
                  <div className="w-24 shrink-0 text-right">
                    <span
                      className={`text-[15px] font-bold tabular-nums ${
                        i === 0 && linhas.length > 1
                          ? "text-emerald-700"
                          : "text-neutral-900"
                      }`}
                    >
                      {brl(c.precoUnitario)}
                    </span>
                  </div>

                  <div className="min-w-[150px] flex-1">
                    <div className="text-[13px] font-medium text-neutral-800">
                      {c.fornecedor}
                      {c.marca && (
                        <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10.5px] font-medium text-neutral-600">
                          {c.marca}
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-neutral-500">
                      {c.contato && `${c.contato} · `}
                      {c.telefone ? formatarTelefone(c.telefone) : "sem telefone"}
                      {c.quantidadeCotada > 0 &&
                        ` · preço p/ ${c.quantidadeCotada.toLocaleString("pt-BR")} ${c.unidade}`}
                      {` · ${dataCurta(c.atualizadaEm)}`}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {c.telefone && (
                      <a
                        href={`https://wa.me/${c.telefone.startsWith("55") ? c.telefone : `55${c.telefone}`}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Falar no WhatsApp"
                        className="flex items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-2.5 py-1.5 text-[12px] font-semibold text-[#128C7E] hover:bg-[#25D366]/20"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                          {PATH_WHATSAPP}
                        </svg>
                        Falar
                      </a>
                    )}
                    <button
                      onClick={() => excluir(c)}
                      className="rounded px-2 py-1 text-[14px] leading-none text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      title="Apagar"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
