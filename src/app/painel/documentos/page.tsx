"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Documento, Situacao } from "@/lib/documentosDb";
import type { CategoriaDocumento, TipoDocumento } from "@/lib/documentosTipos";

type DocumentoNaTela = Documento & {
  situacao: Situacao;
  diasParaVencer: number | null;
};

type Dados = {
  documentos: DocumentoNaTela[];
  tipos: TipoDocumento[];
  categorias: Array<{ id: CategoriaDocumento; nome: string; descricao: string }>;
  faltando: Array<{ id: string; nome: string; categoria: CategoriaDocumento }>;
  resumo: {
    total: number;
    vencidos: number;
    venceEmBreve: number;
    semArquivo: number;
    faltando: number;
  };
};

type Formulario = {
  id: string | null;
  tipoId: string;
  nome: string;
  numero: string;
  orgaoEmissor: string;
  dataEmissao: string;
  dataValidade: string;
  naoVence: boolean;
  observacao: string;
};

const VAZIO: Formulario = {
  id: null,
  tipoId: "cnd_federal",
  nome: "",
  numero: "",
  orgaoEmissor: "",
  dataEmissao: "",
  dataValidade: "",
  naoVence: false,
  observacao: "",
};

const APARENCIA: Record<
  Situacao,
  { rotulo: string; classe: string; ponto: string }
> = {
  vencido: {
    rotulo: "Vencido",
    classe: "border-red-200 bg-red-50 text-red-700",
    ponto: "bg-red-500",
  },
  sem_arquivo: {
    rotulo: "Sem arquivo",
    classe: "border-amber-200 bg-amber-50 text-amber-800",
    ponto: "bg-amber-500",
  },
  vence_em_breve: {
    rotulo: "Vence em breve",
    classe: "border-orange-200 bg-orange-50 text-orange-700",
    ponto: "bg-orange-500",
  },
  sem_validade: {
    rotulo: "Validade não informada",
    classe: "border-neutral-200 bg-neutral-50 text-neutral-600",
    ponto: "bg-neutral-400",
  },
  valido: {
    rotulo: "Válido",
    classe: "border-emerald-200 bg-emerald-50 text-emerald-700",
    ponto: "bg-emerald-500",
  },
  nao_vence: {
    rotulo: "Não vence",
    classe: "border-sky-200 bg-sky-50 text-sky-700",
    ponto: "bg-sky-500",
  },
};

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function textoDoPrazo(doc: DocumentoNaTela): string | null {
  if (doc.diasParaVencer === null) return null;
  const d = doc.diasParaVencer;
  if (d < 0) return `venceu há ${Math.abs(d)} dia(s)`;
  if (d === 0) return "vence hoje";
  if (d === 1) return "vence amanhã";
  return `faltam ${d} dias`;
}

/** Soma dias a uma data "YYYY-MM-DD" sem passar por fuso horário. */
function somarDias(iso: string, dias: number): string {
  const base = new Date(
    Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10))
    )
  );
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

export default function DocumentosPage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);
  const inputsArquivo = useRef<Record<string, HTMLInputElement | null>>({});

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/documentos");
      if (!res.ok) throw new Error();
      setDados(await res.json());
    } catch {
      setErro("Não deu pra carregar os documentos.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const tipoSelecionado = useMemo(
    () => dados?.tipos.find((t) => t.id === form?.tipoId) ?? null,
    [dados, form?.tipoId]
  );

  const porCategoria = useMemo(() => {
    if (!dados) return [];
    return dados.categorias
      .map((cat) => ({
        ...cat,
        itens: dados.documentos.filter((d) => d.categoria === cat.id),
      }))
      .filter((c) => c.itens.length > 0);
  }, [dados]);

  function abrirNovo(tipoId?: string) {
    const tipo = dados?.tipos.find((t) => t.id === tipoId);
    setSucesso(null);
    setErro(null);
    setForm({
      ...VAZIO,
      tipoId: tipo?.id ?? VAZIO.tipoId,
      nome: tipo?.nome ?? "",
    });
  }

  function abrirEdicao(doc: DocumentoNaTela) {
    setSucesso(null);
    setErro(null);
    setForm({
      id: doc.id,
      tipoId: doc.tipoId,
      nome: doc.nome,
      numero: doc.numero ?? "",
      orgaoEmissor: doc.orgaoEmissor ?? "",
      dataEmissao: doc.dataEmissao ?? "",
      dataValidade: doc.dataValidade ?? "",
      naoVence: doc.naoVence,
      observacao: doc.observacao ?? "",
    });
  }

  // Trocar o tipo troca o nome sugerido — mas só quando o nome ainda é o
  // sugerido pelo tipo anterior. Se a pessoa escreveu um nome próprio
  // ("CND Federal da filial"), ele fica.
  function trocarTipo(novoTipoId: string) {
    setForm((f) => {
      if (!f) return f;
      const anterior = dados?.tipos.find((t) => t.id === f.tipoId);
      const novo = dados?.tipos.find((t) => t.id === novoTipoId);
      const nomeEraPadrao = !f.nome.trim() || f.nome === anterior?.nome;
      return {
        ...f,
        tipoId: novoTipoId,
        nome: nomeEraPadrao ? (novo?.nome ?? f.nome) : f.nome,
      };
    });
  }

  // Ao preencher a emissão, sugere o vencimento pelo prazo típico do tipo.
  // Só sugere: o número que vale é o impresso na certidão, e o campo continua
  // editável.
  function trocarEmissao(valor: string) {
    setForm((f) => {
      if (!f) return f;
      const tipo = dados?.tipos.find((t) => t.id === f.tipoId);
      const sugerida =
        valor && tipo?.validadeDias && !f.dataValidade
          ? somarDias(valor, tipo.validadeDias)
          : f.dataValidade;
      return { ...f, dataEmissao: valor, dataValidade: sugerida };
    });
  }

  async function salvar() {
    if (!form) return;
    setSalvando(true);
    setErro(null);
    try {
      const corpo = {
        tipoId: form.tipoId,
        nome: form.nome,
        numero: form.numero,
        orgaoEmissor: form.orgaoEmissor,
        dataEmissao: form.dataEmissao || null,
        dataValidade: form.naoVence ? null : form.dataValidade || null,
        naoVence: form.naoVence,
        observacao: form.observacao,
      };
      const res = await fetch(
        form.id ? `/api/documentos/${form.id}` : "/api/documentos",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        }
      );
      if (!res.ok) throw new Error();
      const salvo = (await res.json()).documento as Documento;
      setForm(null);
      await carregar();
      setSucesso(
        form.id
          ? "Documento atualizado."
          : "Documento cadastrado. Agora anexe o arquivo."
      );
      if (!form.id) {
        // Abre o seletor de arquivo já no documento recém-criado: cadastrar
        // sem anexar é o erro fácil de cometer aqui.
        setTimeout(() => inputsArquivo.current[salvo.id]?.click(), 150);
      }
    } catch {
      setErro("Não deu pra salvar o documento.");
    } finally {
      setSalvando(false);
    }
  }

  async function enviarArquivo(documentoId: string, arquivo: File) {
    setEnviando(documentoId);
    setErro(null);
    try {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);
      const res = await fetch(`/api/documentos/${documentoId}/arquivo`, {
        method: "POST",
        body: corpo,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "");
      }
      await carregar();
      setSucesso("Arquivo anexado. A versão anterior ficou guardada no histórico.");
    } catch (e) {
      setErro(
        e instanceof Error && e.message ? e.message : "Não deu pra enviar o arquivo."
      );
    } finally {
      setEnviando(null);
    }
  }

  async function excluir(doc: DocumentoNaTela) {
    if (
      !confirm(
        `Apagar "${doc.nome}"? O arquivo e todo o histórico de versões vão junto.`
      )
    ) {
      return;
    }
    await fetch(`/api/documentos/${doc.id}`, { method: "DELETE" });
    await carregar();
    setSucesso("Documento apagado.");
  }

  if (!dados) {
    return (
      <div className="p-8 text-sm text-neutral-500">Carregando documentos…</div>
    );
  }

  const { resumo } = dados;
  const temProblema = resumo.vencidos + resumo.semArquivo + resumo.faltando > 0;

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-bold text-neutral-900">
          Documentos de habilitação
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          As certidões que o edital pede. Cadastre uma vez, com a validade, e o
          painel avisa antes de vencer — 60, 30, 15 e 7 dias antes.
        </p>
      </header>

      {/* ---------------------------------------------------------- resumo -- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Vencidos", resumo.vencidos, "text-red-600"],
            ["Vencendo", resumo.venceEmBreve, "text-orange-600"],
            ["Sem arquivo", resumo.semArquivo, "text-amber-600"],
            ["Nunca cadastrados", resumo.faltando, "text-neutral-700"],
          ] as Array<[string, number, string]>
        ).map(([rotulo, valor, cor]) => (
          <div
            key={rotulo}
            className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-4 shadow-sm"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {rotulo}
            </div>
            <div className={`mt-1 text-2xl font-bold ${valor > 0 ? cor : "text-neutral-300"}`}>
              {valor}
            </div>
          </div>
        ))}
      </div>

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

      {!temProblema && resumo.total > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Documentação em dia. Nenhuma certidão vencida e nada faltando.
        </div>
      )}

      {/* ------------------------------------------------ falta cadastrar -- */}
      {dados.faltando.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="text-sm font-semibold text-amber-900">
            Documentos que quase todo edital pede e ainda não estão aqui
          </div>
          <p className="mt-1 text-[12.5px] text-amber-800">
            Clique pra cadastrar. É esta lista que a biblioteca do Licitar
            Digital não consegue montar, porque lá o documento não tem tipo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {dados.faltando.map((t) => (
              <button
                key={t.id}
                onClick={() => abrirNovo(t.id)}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-amber-900 transition-colors hover:bg-amber-100"
              >
                + {t.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <button
          onClick={() => (form ? setForm(null) : abrirNovo())}
          className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          {form ? "Fechar formulário" : "Cadastrar documento"}
        </button>
      </div>

      {/* ------------------------------------------------------ formulário -- */}
      {form && (
        <div className="space-y-4 rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-neutral-900">
            {form.id ? "Editar documento" : "Novo documento"}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[12px] font-medium text-neutral-600">Tipo</span>
              <select
                value={form.tipoId}
                onChange={(e) => trocarTipo(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                {dados.categorias.map((cat) => (
                  <optgroup key={cat.id} label={cat.nome}>
                    {dados.tipos
                      .filter((t) => t.categoria === cat.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>

            {tipoSelecionado?.observacao && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[12.5px] text-sky-900 md:col-span-2">
                {tipoSelecionado.observacao}
                {tipoSelecionado.ondeEmitir && (
                  <>
                    {" "}
                    <a
                      href={tipoSelecionado.ondeEmitir}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline"
                    >
                      Emitir agora
                    </a>
                  </>
                )}
              </div>
            )}

            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[12px] font-medium text-neutral-600">
                Nome (como você quer ver na lista)
              </span>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Número / código de autenticidade
              </span>
              <input
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                placeholder="opcional"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Órgão emissor
              </span>
              <input
                value={form.orgaoEmissor}
                onChange={(e) => setForm({ ...form, orgaoEmissor: e.target.value })}
                placeholder="opcional"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">Emissão</span>
              <input
                type="date"
                value={form.dataEmissao}
                onChange={(e) => trocarEmissao(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-neutral-600">
                Vence em
                {tipoSelecionado?.validadeDias
                  ? ` (costuma valer ${tipoSelecionado.validadeDias} dias)`
                  : ""}
              </span>
              <input
                type="date"
                value={form.dataValidade}
                disabled={form.naoVence}
                onChange={(e) => setForm({ ...form, dataValidade: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand disabled:bg-neutral-100 disabled:text-neutral-400"
              />
            </label>

            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={form.naoVence}
                onChange={(e) => setForm({ ...form, naoVence: e.target.checked })}
              />
              <span className="text-[12.5px] text-neutral-700">
                Este documento não vence (contrato social, RG, atestado…)
              </span>
            </label>

            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[12px] font-medium text-neutral-600">
                Observação
              </span>
              <textarea
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                rows={2}
                placeholder="opcional — ex: senha do certificado está com o contador"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
          </div>

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
      {dados.documentos.length === 0 && !form && (
        <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-neutral-700">
            Nenhum documento cadastrado ainda.
          </p>
          <p className="mt-1.5 text-[12.5px] text-neutral-500">
            Comece pelos botões amarelos aí em cima — são os que todo edital pede.
          </p>
        </div>
      )}

      {porCategoria.map((cat) => (
        <section key={cat.id} className="space-y-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-bold text-neutral-900">{cat.nome}</h2>
            <span className="text-[11.5px] text-neutral-500">{cat.descricao}</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
            {cat.itens.map((doc) => {
              const aparencia = APARENCIA[doc.situacao];
              const prazo = textoDoPrazo(doc);
              return (
                <div
                  key={doc.id}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${aparencia.ponto}`}
                    />

                    <div className="min-w-[220px] flex-1">
                      <div className="text-[13.5px] font-semibold text-neutral-900">
                        {doc.nome}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-neutral-500">
                        {doc.naoVence
                          ? "não vence"
                          : `vence em ${formatarData(doc.dataValidade)}`}
                        {prazo && ` · ${prazo}`}
                        {doc.orgaoEmissor && ` · ${doc.orgaoEmissor}`}
                        {doc.numero && ` · nº ${doc.numero}`}
                      </div>
                      {doc.observacao && (
                        <div className="mt-1 text-[11.5px] text-neutral-500">
                          {doc.observacao}
                        </div>
                      )}
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${aparencia.classe}`}
                    >
                      {aparencia.rotulo}
                    </span>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {doc.arquivo && (
                        <a
                          href={`/api/documentos/${doc.id}/arquivo`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          Ver arquivo
                        </a>
                      )}

                      <input
                        type="file"
                        hidden
                        ref={(el) => {
                          inputsArquivo.current[doc.id] = el;
                        }}
                        onChange={(e) => {
                          const arquivo = e.target.files?.[0];
                          e.target.value = "";
                          if (arquivo) enviarArquivo(doc.id, arquivo);
                        }}
                      />
                      <button
                        onClick={() => inputsArquivo.current[doc.id]?.click()}
                        disabled={enviando === doc.id}
                        className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                      >
                        {enviando === doc.id
                          ? "Enviando…"
                          : doc.arquivo
                            ? "Substituir"
                            : "Anexar"}
                      </button>

                      {doc.historico.length > 0 && (
                        <button
                          onClick={() =>
                            setHistoricoAberto(
                              historicoAberto === doc.id ? null : doc.id
                            )
                          }
                          className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          Histórico ({doc.historico.length})
                        </button>
                      )}

                      <button
                        onClick={() => abrirEdicao(doc)}
                        className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => excluir(doc)}
                        className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50"
                      >
                        Apagar
                      </button>
                    </div>
                  </div>

                  {doc.arquivo && (
                    <div className="px-4 pb-3 pl-[34px] text-[11px] text-neutral-400">
                      {doc.arquivo.nomeOriginal} ·{" "}
                      {formatarTamanho(doc.arquivo.bytes)} · enviado em{" "}
                      {formatarDataHora(doc.arquivo.enviadoEm)}
                    </div>
                  )}

                  {historicoAberto === doc.id && (
                    <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3 pl-[34px]">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                        Versões anteriores
                      </div>
                      <div className="space-y-1.5">
                        {doc.historico.map((v) => (
                          <div
                            key={v.id}
                            className="flex flex-wrap items-center gap-2 text-[12px] text-neutral-600"
                          >
                            <a
                              href={`/api/documentos/${doc.id}/arquivo?versao=${v.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-neutral-800 underline"
                            >
                              {v.nomeOriginal}
                            </a>
                            <span>
                              valia até {formatarData(v.dataValidade)} · enviado{" "}
                              {formatarDataHora(v.enviadoEm)} · substituído{" "}
                              {v.substituidoEm
                                ? formatarDataHora(v.substituidoEm)
                                : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
