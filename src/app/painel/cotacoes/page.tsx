"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cotacao } from "@/lib/cotacoesDb";
import type { DisputaCalculada } from "@/lib/disputaDb";
import { PATH_WHATSAPP } from "@/components/icones";

type Linha = Cotacao & { telefone: string; contato: string; naAgenda: boolean };

type Dados = {
  cotacoes: Linha[];
  fornecedoresConhecidos: string[];
  resumo: { total: number; fornecedores: number; produtos: number };
};

type LicitacaoOpcao = {
  numeroControlePNCP: string;
  objeto: string;
  municipio: string;
  uf: string;
  dataEncerramentoProposta: string | null;
  lotes: number;
  cotados: number;
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

  // Recorte por licitação. Vazio = a lista corrida de sempre, que é a memória
  // de preços da casa e serve pra "quanto o fulano cobrou de saponáceo?".
  // Com uma licitação escolhida a tela vira planilha daquele edital: só os
  // lotes dele, com o teto do órgão do lado e o piso saindo na hora.
  //
  // Existe porque montar pregão a partir da lista corrida já custou caro: ela
  // junta editais diferentes, e cotação de um acabou virando custo no outro.
  const [licitacoes, setLicitacoes] = useState<LicitacaoOpcao[]>([]);
  const [licEscolhida, setLicEscolhida] = useState("");
  const [disputa, setDisputa] = useState<DisputaCalculada | null>(null);
  const [carregandoLotes, setCarregandoLotes] = useState(false);
  const [importando, setImportando] = useState(false);

  const dadosDaLicitacao = licitacoes.find(
    (l) => l.numeroControlePNCP === licEscolhida
  );

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

  // As licitações do funil, pra montar o seletor. Falhar aqui não pode quebrar
  // a tela: sem a lista o seletor some e a lista corrida continua servindo.
  useEffect(() => {
    fetch("/api/disputa")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setLicitacoes(d.licitacoes ?? []))
      .catch(() => {});
  }, []);

  const carregarLotes = useCallback(async (numero: string) => {
    if (!numero) {
      setDisputa(null);
      return;
    }
    setCarregandoLotes(true);
    try {
      const res = await fetch(`/api/disputa/${encodeURIComponent(numero)}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setDisputa(d.disputa);
    } catch {
      setErro("Não deu pra carregar os lotes dessa licitação.");
      setDisputa(null);
    } finally {
      setCarregandoLotes(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarLotes(licEscolhida);
  }, [licEscolhida, carregarLotes]);

  /**
   * Grava um campo do lote e recebe a disputa recalculada de volta.
   *
   * O piso vem do servidor, nunca recalculado aqui: a conta
   * `custo / (1 - imposto - margem)` mora em catalogoDb.calcularPrecos e
   * duplicá-la na tela é como ela sai errada em um dos dois lugares.
   */
  async function gravarLote(loteId: string, campos: Record<string, unknown>) {
    if (!licEscolhida) return;
    try {
      const res = await fetch(`/api/disputa/${encodeURIComponent(licEscolhida)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loteId, ...campos }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setDisputa(d.disputa);
      // O custo lançado aqui vira cotação lá na lista corrida — recarregar
      // mantém os dois lados contando a mesma história.
      carregar();
    } catch {
      setErro("Não deu pra salvar esse lote.");
    }
  }

  async function importarDoPncp() {
    if (!licEscolhida) return;
    setImportando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/disputa/${encodeURIComponent(licEscolhida)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "importar-do-pncp" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "");
      setDisputa(d.disputa);
    } catch (e) {
      setErro(
        e instanceof Error && e.message
          ? e.message
          : "O PNCP não respondeu agora. Tente de novo em um minuto."
      );
    } finally {
      setImportando(false);
    }
  }

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

      <header className="nao-imprimir">
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

      <div className="nao-imprimir grid gap-2 sm:grid-cols-3">
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
      <div className="nao-imprimir rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
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

      {/* ---------------------------------------------- recorte por edital -- */}
      {licitacoes.length > 0 && (
        <div className="nao-imprimir flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
          <label className="flex min-w-[280px] flex-1 flex-col gap-1">
            <span className="text-[11.5px] font-medium text-neutral-600">
              Trabalhar em cima de uma licitação
            </span>
            <select
              value={licEscolhida}
              onChange={(e) => setLicEscolhida(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="">Todas — a lista corrida de preços</option>
              {licitacoes.map((l) => (
                <option key={l.numeroControlePNCP} value={l.numeroControlePNCP}>
                  {l.municipio}/{l.uf} — {l.objeto.slice(0, 70)}
                  {l.lotes > 0 ? ` (${l.cotados}/${l.lotes} cotados)` : ""}
                </option>
              ))}
            </select>
          </label>
          {licEscolhida && (
            <button
              onClick={() => window.print()}
              title="Imprime só a lista de lotes, sem os menus"
              className="rounded-xl border border-neutral-300 px-3.5 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Imprimir lista
            </button>
          )}
        </div>
      )}

      {/* Cabeçalho que só existe no papel: quem imprime a lista precisa saber
          de que edital ela é e de quando, senão vira folha solta na mesa. */}
      {licEscolhida && dadosDaLicitacao && (
        <div className="hidden print:block">
          <h1 className="text-[17px] font-bold">
            {dadosDaLicitacao.municipio}/{dadosDaLicitacao.uf} — lotes do edital
          </h1>
          <p className="mt-0.5 text-[11px] text-neutral-600">
            {dadosDaLicitacao.objeto}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {licEscolhida} · impresso em{" "}
            {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
      )}

      {licEscolhida ? (
        /* ------------------------------------------------ lotes do edital -- */
        carregandoLotes ? (
          <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center text-sm text-neutral-500 shadow-sm">
            Carregando os lotes…
          </div>
        ) : !disputa || disputa.lotes.filter((l) => !l.descartado).length === 0 ? (
          <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-neutral-700">
              Esta licitação ainda não tem lotes.
            </p>
            <p className="mt-1 text-[13px] text-neutral-500">
              Dá pra puxar a lista do PNCP em vez de digitar item por item.
            </p>
            <button
              onClick={importarDoPncp}
              disabled={importando}
              className="brand-gradient mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            >
              {importando ? "Puxando do PNCP…" : "Puxar itens do PNCP"}
            </button>
          </div>
        ) : (
          <div className="folha-lotes overflow-x-auto rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
            <table className="w-full min-w-[900px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  <th className="px-3 py-2.5 text-left">Lote</th>
                  <th className="px-3 py-2.5 text-right">Qtd</th>
                  <th className="px-3 py-2.5 text-right">Teto do órgão</th>
                  <th className="px-3 py-2.5 text-left">Fornecedor</th>
                  <th className="px-3 py-2.5 text-left">Marca</th>
                  <th className="px-3 py-2.5 text-right">Custo</th>
                  <th className="px-3 py-2.5 text-right">Piso</th>
                  <th className="px-3 py-2.5 text-right">Empate</th>
                </tr>
              </thead>
              <tbody>
                {disputa.lotes
                  .filter((l) => !l.descartado)
                  .map((l) => {
                    const semCusto = l.custoUnitario <= 0;
                    // Custo acima do que o órgão aceita pagar: disputar esse
                    // lote é vender no prejuízo, e a linha precisa gritar isso
                    // antes da sessão começar.
                    const acimaDoTeto =
                      !semCusto &&
                      l.referenciaUnitaria != null &&
                      l.empateUnitario > l.referenciaUnitaria;

                    return (
                      <tr
                        key={l.id}
                        className={`border-b border-neutral-100 last:border-0 ${
                          acimaDoTeto ? "bg-red-50/60" : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium text-neutral-800">
                            <span className="mr-1.5 text-[11px] text-neutral-400">
                              {l.numero}
                            </span>
                            {l.descricao}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-neutral-600">
                          {l.quantidade.toLocaleString("pt-BR")}
                          <span className="ml-1 text-[11px] text-neutral-400">{l.unidade}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-neutral-800">
                          {l.referenciaUnitaria != null ? brl(l.referenciaUnitaria) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            defaultValue={l.fornecedor}
                            list="fornecedores-conhecidos"
                            placeholder="quem cotou"
                            onBlur={(e) =>
                              e.target.value !== l.fornecedor &&
                              gravarLote(l.id, { fornecedor: e.target.value })
                            }
                            className="w-32 rounded border border-neutral-200 px-2 py-1 text-[12.5px] outline-none focus:border-brand"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            defaultValue={l.marca}
                            placeholder="marca ofertada"
                            onBlur={(e) =>
                              e.target.value !== l.marca &&
                              gravarLote(l.id, { marca: e.target.value })
                            }
                            className="w-28 rounded border border-neutral-200 px-2 py-1 text-[12.5px] outline-none focus:border-brand"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            defaultValue={l.custoUnitario || ""}
                            placeholder="0,00"
                            inputMode="decimal"
                            onBlur={(e) => {
                              const v = paraNumero(e.target.value);
                              if (v !== l.custoUnitario) {
                                gravarLote(l.id, { custoUnitario: v });
                              }
                            }}
                            className="w-20 rounded border border-neutral-200 px-2 py-1 text-right text-[12.5px] tabular-nums outline-none focus:border-brand"
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-brand">
                          {semCusto ? (
                            <span className="text-neutral-300">—</span>
                          ) : (
                            brl(l.pisoUnitario)
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-neutral-600">
                          {semCusto ? (
                            <span className="text-neutral-300">—</span>
                          ) : acimaDoTeto ? (
                            <span className="font-semibold text-red-700">
                              {brl(l.empateUnitario)} · acima do teto
                            </span>
                          ) : (
                            brl(l.empateUnitario)
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
