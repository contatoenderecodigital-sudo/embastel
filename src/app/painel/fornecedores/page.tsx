"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Fornecedor } from "@/lib/fornecedoresDb";
import { PATH_WHATSAPP } from "@/components/icones";

type Dados = {
  fornecedores: Fornecedor[];
  categorias: string[];
  categoriasSugeridas: string[];
  resumo: { total: number; semCategoria: number; semTelefone: number };
};

type Form = {
  id: string | null;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  email: string;
  contato: string;
  categorias: string[];
  observacao: string;
};

const VAZIO: Form = {
  id: null,
  nome: "",
  razaoSocial: "",
  cnpj: "",
  telefone: "",
  email: "",
  contato: "",
  categorias: [],
  observacao: "",
};

function formatarTelefone(digitos: string): string {
  const d = digitos.startsWith("55") ? digitos.slice(2) : digitos;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

function formatarCnpj(d: string): string {
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Monta o link do WhatsApp, completando o 55 do Brasil quando falta. */
function linkWhatsapp(digitos: string): string {
  const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${numero}`;
}

export default function FornecedoresPage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novaCategoria, setNovaCategoria] = useState("");

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/fornecedores");
      if (!res.ok) throw new Error();
      setDados(await res.json());
    } catch {
      setErro("Não deu pra carregar os fornecedores.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    return dados.fornecedores.filter((f) => {
      if (filtroCategoria && !f.categorias.includes(filtroCategoria)) return false;
      if (!termo) return true;
      return [f.nome, f.razaoSocial, f.contato, f.cnpj, f.telefone, ...f.categorias]
        .filter(Boolean)
        .some((campo) => campo.toLowerCase().includes(termo));
    });
  }, [dados, busca, filtroCategoria]);

  function abrirEdicao(f: Fornecedor) {
    setErro(null);
    setForm({
      id: f.id,
      nome: f.nome,
      razaoSocial: f.razaoSocial,
      cnpj: f.cnpj,
      telefone: f.telefone,
      email: f.email,
      contato: f.contato,
      categorias: [...f.categorias],
      observacao: f.observacao,
    });
  }

  function alternarCategoria(categoria: string) {
    setForm((f) => {
      if (!f) return f;
      const tem = f.categorias.includes(categoria);
      return {
        ...f,
        categorias: tem
          ? f.categorias.filter((c) => c !== categoria)
          : [...f.categorias, categoria],
      };
    });
  }

  async function salvar() {
    if (!form) return;
    if (!form.nome.trim()) {
      setErro("O nome é obrigatório.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(
        form.id ? `/api/fornecedores/${form.id}` : "/api/fornecedores",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) throw new Error();
      setForm(null);
      setNovaCategoria("");
      await carregar();
    } catch {
      setErro("Não deu pra salvar o fornecedor.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(f: Fornecedor) {
    if (!confirm(`Apagar "${f.nome}" da lista de fornecedores?`)) return;
    await fetch(`/api/fornecedores/${f.id}`, { method: "DELETE" });
    await carregar();
  }

  if (!dados) {
    return <div className="p-8 text-sm text-neutral-500">Carregando fornecedores…</div>;
  }

  // As sugestões mais as que já estão em uso, sem repetir.
  const categoriasDoForm = [
    ...new Set([
      ...dados.categoriasSugeridas,
      ...dados.categorias,
      ...(form?.categorias ?? []),
    ]),
  ];

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-bold text-neutral-900">Fornecedores</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Quem cota o quê, com telefone à mão. Quando cai um edital de 40 lotes
          com prazo curto, a pergunta é sempre &quot;quem me cota isso?&quot; —
          é pra responder isso em um clique.
        </p>
      </header>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {(dados.resumo.semCategoria > 0 || dados.resumo.semTelefone > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
          {dados.resumo.semCategoria > 0 && (
            <>
              <b className="font-semibold">{dados.resumo.semCategoria}</b> sem
              categoria — esses nunca vão aparecer quando você procurar quem
              atende um edital.
            </>
          )}
          {dados.resumo.semCategoria > 0 && dados.resumo.semTelefone > 0 && " · "}
          {dados.resumo.semTelefone > 0 && (
            <>
              <b className="font-semibold">{dados.resumo.semTelefone}</b> sem
              telefone.
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => (form ? setForm(null) : setForm({ ...VAZIO }))}
          className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          {form ? "Fechar formulário" : "Cadastrar fornecedor"}
        </button>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, contato, CNPJ, telefone ou categoria"
          className="min-w-[260px] flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      {/* ------------------------------------------------ filtro por categoria */}
      {dados.categorias.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Atende
          </span>
          <button
            onClick={() => setFiltroCategoria("")}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              filtroCategoria === ""
                ? "brand-gradient text-white shadow-sm"
                : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            Tudo ({dados.resumo.total})
          </button>
          {dados.categorias.map((c) => {
            const quantos = dados.fornecedores.filter((f) =>
              f.categorias.includes(c)
            ).length;
            return (
              <button
                key={c}
                onClick={() => setFiltroCategoria(filtroCategoria === c ? "" : c)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  filtroCategoria === c
                    ? "brand-gradient text-white shadow-sm"
                    : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {c} ({quantos})
              </button>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------- formulário -- */}
      {form && (
        <div className="space-y-4 rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-neutral-900">
            {form.id ? `Editar ${form.nome}` : "Novo fornecedor"}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Nome (como vocês chamam)
              </span>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[12px] font-medium text-neutral-600">
                Razão social
              </span>
              <input
                value={form.razaoSocial}
                onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                placeholder="opcional"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">CNPJ</span>
              <input
                value={form.cnpj}
                inputMode="numeric"
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                placeholder="só números"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Telefone / WhatsApp
              </span>
              <input
                value={form.telefone}
                inputMode="tel"
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="49 99999-9999"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Quem atende
              </span>
              <input
                value={form.contato}
                onChange={(e) => setForm({ ...form, contato: e.target.value })}
                placeholder="nome do vendedor"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            <label className="flex flex-col gap-1 md:col-span-3">
              <span className="text-[12px] font-medium text-neutral-600">E-mail</span>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="pra mandar pedido de cotação"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
          </div>

          {/* --------------------------------------------------- categorias -- */}
          <div>
            <div className="mb-2 text-[12px] font-medium text-neutral-600">
              O que ele fornece{" "}
              <span className="text-neutral-400">
                — é isto que faz ele aparecer quando você procura quem atende um
                edital
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categoriasDoForm.map((c) => {
                const marcada = form.categorias.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => alternarCategoria(c)}
                    className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                      marcada
                        ? "brand-gradient text-white shadow-sm"
                        : "border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    {marcada ? "✓ " : "+ "}
                    {c}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !novaCategoria.trim()) return;
                  e.preventDefault();
                  alternarCategoria(novaCategoria.trim());
                  setNovaCategoria("");
                }}
                placeholder="Outra categoria (Enter pra adicionar)"
                className="w-64 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-neutral-600">Observação</span>
            <input
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="ex: pedido mínimo 20 caixas, entrega em 5 dias"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>

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
            Nenhum fornecedor bate com essa busca.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filtrados.map((f) => (
            <div
              key={f.id}
              className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[160px] flex-1">
                  <div className="text-[14px] font-semibold text-neutral-900">
                    {f.nome}
                  </div>
                  {f.razaoSocial && (
                    <div className="text-[11.5px] text-neutral-500">{f.razaoSocial}</div>
                  )}
                  <div className="mt-0.5 text-[11.5px] text-neutral-500">
                    {f.contato && `${f.contato} · `}
                    {f.telefone && formatarTelefone(f.telefone)}
                    {f.cnpj && ` · ${formatarCnpj(f.cnpj)}`}
                  </div>
                  {f.email && (
                    <div className="text-[11.5px] text-neutral-500">{f.email}</div>
                  )}
                  {f.observacao && (
                    <div className="mt-1 text-[11.5px] text-neutral-500">
                      {f.observacao}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {f.telefone && (
                    <a
                      href={linkWhatsapp(f.telefone)}
                      target="_blank"
                      rel="noreferrer"
                      title="Pedir cotação no WhatsApp"
                      className="flex items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-2.5 py-1.5 text-[12px] font-semibold text-[#128C7E] hover:bg-[#25D366]/20"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                        {PATH_WHATSAPP}
                      </svg>
                      Cotar
                    </a>
                  )}
                  <button
                    onClick={() => abrirEdicao(f)}
                    className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => excluir(f)}
                    className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50"
                  >
                    Apagar
                  </button>
                </div>
              </div>

              {f.categorias.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {f.categorias.map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2.5 text-[11.5px] text-amber-700">
                  Sem categoria — não vai aparecer na busca por edital.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
