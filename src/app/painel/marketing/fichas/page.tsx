"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Ficha } from "@/lib/fichasDb";
import { buildFotoProdutoPrompt } from "@/lib/promptTemplates";

export default function FichasPage() {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [variantes, setVariantes] = useState<string[]>([""]);
  const [imagemDataUrl, setImagemDataUrl] = useState<string | null>(null);
  const [descricaoFoto, setDescricaoFoto] = useState("");
  const [promptFoto, setPromptFoto] = useState("");
  const [copiadoPromptFoto, setCopiadoPromptFoto] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fichas");
      const data = await res.json();
      setFichas(data.fichas ?? []);
    } catch {
      setError("Erro ao carregar fichas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function handleImagemUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagemDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleGerarPromptFoto() {
    if (!descricaoFoto.trim()) return;
    setPromptFoto(buildFotoProdutoPrompt(descricaoFoto));
  }

  async function handleCopiarPromptFoto() {
    try {
      await navigator.clipboard.writeText(promptFoto);
      setCopiadoPromptFoto(true);
      setTimeout(() => setCopiadoPromptFoto(false), 2000);
    } catch {
      setError("Não deu pra copiar automaticamente — seleciona e copia manualmente.");
    }
  }

  function limparForm() {
    setTitulo("");
    setCategoria("");
    setVariantes([""]);
    setImagemDataUrl(null);
    setObservacao("");
    setEditandoId(null);
  }

  async function handleSalvar() {
    const variantesValidas = variantes.map((v) => v.trim()).filter(Boolean);
    if (!titulo.trim()) {
      setError("Coloca um título pra ficha.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editandoId ? `/api/fichas/${editandoId}` : "/api/fichas";
      const res = await fetch(url, {
        method: editandoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          categoria,
          variantes: variantesValidas,
          imagemDataUrl,
          observacao,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar");
      limparForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar ficha");
    } finally {
      setSaving(false);
    }
  }

  function handleEditar(ficha: Ficha) {
    setEditandoId(ficha.id);
    setTitulo(ficha.titulo);
    setCategoria(ficha.categoria ?? "");
    setVariantes(ficha.variantes.length ? ficha.variantes : [""]);
    setImagemDataUrl(ficha.imagemDataUrl);
    setObservacao(ficha.observacao ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleExcluir(id: string) {
    await fetch(`/api/fichas/${id}`, { method: "DELETE" });
    if (editandoId === id) limparForm();
    await load();
  }

  async function handleBaixarImagem() {
    if (!previewRef.current) return;
    setBaixando(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `${titulo.trim() || "ficha"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">
          Fichas de produto
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Modelo fixo pra responder perguntas repetidas tipo &quot;quais temperos vocês
          têm?&quot; — sem preço, porque preço muda. Monta aqui e baixa a imagem prontinha
          pra mandar no WhatsApp.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4 rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Título (ex: BASE DE BOLO ISOPOR)
            </label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Categoria (opcional, só pra organizar aqui)
            </label>
            <input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Confeitaria"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Foto do produto
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImagemUpload}
              className="w-full text-sm"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Não tem uma foto pronta? Descreve o produto e gera um prompt pra criar uma:
            </p>
            <div className="mt-1.5 flex gap-2">
              <input
                value={descricaoFoto}
                onChange={(e) => setDescricaoFoto(e.target.value)}
                placeholder="Ex: cakeboard de MDF redonda pra bolo"
                className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={handleGerarPromptFoto}
                disabled={!descricaoFoto.trim()}
                className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
              >
                Gerar prompt
              </button>
            </div>
            {promptFoto && (
              <div className="mt-2 space-y-1.5 rounded-lg bg-neutral-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Prompt pra colar no Gemini/Flow
                  </p>
                  <button
                    type="button"
                    onClick={handleCopiarPromptFoto}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    {copiadoPromptFoto ? "✓ Copiado!" : "Copiar"}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={promptFoto}
                  rows={6}
                  className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-700 outline-none"
                />
                <p className="text-[11px] text-neutral-500">
                  Depois de gerar a imagem lá, baixa e sobe ela aqui em cima em &quot;Foto do
                  produto&quot;.
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Variações (uma por linha, sem preço)
            </label>
            <div className="space-y-2">
              {variantes.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={v}
                    onChange={(e) =>
                      setVariantes(variantes.map((x, idx) => (idx === i ? e.target.value : x)))
                    }
                    placeholder="Ex: Base 10cm"
                    className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => setVariantes(variantes.filter((_, idx) => idx !== i))}
                    disabled={variantes.length === 1}
                    className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setVariantes([...variantes, ""])}
                className="text-xs font-medium text-brand hover:underline"
              >
                + Linha
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Observação interna (opcional, não aparece na imagem)
            </label>
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="brand-gradient rounded-md px-5 py-2 text-sm font-medium text-white shadow-md shadow-brand/20 disabled:opacity-50"
            >
              {saving ? "Salvando..." : editandoId ? "Salvar alterações" : "Salvar ficha"}
            </button>
            {editandoId && (
              <button
                onClick={limparForm}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-600"
              >
                Cancelar edição
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {/* Cores aqui dentro são todas em hex literal via style inline
              (não classes Tailwind de cor) de propósito: o html2canvas não
              sabe interpretar oklch()/lab(), que é o que o Tailwind v4 usa
              internamente pras cores nomeadas (neutral-900 etc). Só bg-[#hex]
              já viria literal, mas pra garantir 100% ficou tudo em style. */}
          <div
            ref={previewRef}
            className="relative aspect-square w-full overflow-hidden"
            style={{ backgroundColor: "#ffffff" }}
          >
            <div
              className="absolute inset-x-0 top-0 h-3"
              style={{ backgroundColor: "#7a1f2b" }}
            />
            <div className="flex h-full flex-col px-8 pb-6 pt-8">
              <div className="flex items-start justify-between">
                <h2
                  className="max-w-[75%] text-[34px] font-extrabold uppercase leading-[1.05]"
                  style={{ color: "#171717" }}
                >
                  {titulo || "TÍTULO DO PRODUTO"}
                </h2>
                {imagemDataUrl && (
                  <span
                    className="whitespace-nowrap text-[9px] font-bold"
                    style={{ color: "#737373" }}
                  >
                    IMAGEM MERAMENTE ILUSTRATIVA
                  </span>
                )}
              </div>

              <div className="mt-6 flex flex-1 gap-4">
                <div className="flex w-[42%] flex-col justify-center gap-2.5">
                  {variantes.filter((v) => v.trim()).length === 0 && (
                    <div
                      className="rounded-xl px-4 py-2.5 text-center text-sm font-extrabold uppercase"
                      style={{ backgroundColor: "#ffe600", color: "#171717" }}
                    >
                      Variação 1
                    </div>
                  )}
                  {variantes
                    .filter((v) => v.trim())
                    .map((v, i) => (
                      <div
                        key={i}
                        className="rounded-xl px-4 py-2.5 text-center text-sm font-extrabold uppercase"
                        style={{ backgroundColor: "#ffe600", color: "#171717" }}
                      >
                        {v}
                      </div>
                    ))}
                </div>
                <div className="flex w-[58%] items-center justify-center">
                  {imagemDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagemDataUrl}
                      alt={titulo}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed text-xs"
                      style={{ borderColor: "#e5e5e5", color: "#a3a3a3" }}
                    >
                      Foto do produto
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center">
                <Image
                  src="/logo-embastel.png"
                  alt="Embastel Embalagens"
                  width={263}
                  height={72}
                  className="h-auto w-[160px]"
                  unoptimized
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleBaixarImagem}
            disabled={baixando}
            className="brand-gradient w-full rounded-md px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-brand/20 disabled:opacity-50"
          >
            {baixando ? "Gerando..." : "Baixar imagem (PNG)"}
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-neutral-500">Carregando...</p>}

      {!loading && fichas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[14px] font-semibold text-neutral-900">
            Fichas salvas ({fichas.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fichas.map((ficha) => (
              <div
                key={ficha.id}
                className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {ficha.imagemDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ficha.imagemDataUrl}
                      alt={ficha.titulo}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-neutral-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {ficha.titulo}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {ficha.variantes.length} variação(ões)
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => handleEditar(ficha)}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleExcluir(ficha.id)}
                    className="text-xs text-neutral-400 hover:text-red-600"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
