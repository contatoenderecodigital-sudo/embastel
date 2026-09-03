import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";
import type { CategoriaDocumento } from "./documentosTipos";
import { tipoPorId } from "./documentosTipos";

// Pasta de documentos de habilitação da Embastel.
//
// O ARQUIVO VAI PRO DISCO, NÃO PRO JSON — mesmo motivo do papel de arroz: um
// balanço patrimonial escaneado passa fácil dos 5 MB, e guardar em base64
// dentro do JSON faria o arquivo inteiro ser reescrito a cada upload.
// No JSON fica a ficha; o PDF fica em data/documentos/<id>/<versão>.
//
// O histórico é a parte que a Licitar Digital acertou e vale copiar: quando
// você troca a certidão, a antiga não some — vira versão anterior, com a data
// em que foi substituída. Serve pra provar depois qual documento estava
// válido no dia da sessão.

export type ArquivoDocumento = {
  id: string;
  nomeOriginal: string;
  extensao: string;
  bytes: number;
  enviadoEm: string;
  /** Preenchido quando uma versão nova toma o lugar desta. */
  substituidoEm: string | null;
  /** A validade que valia na época — o histórico precisa se explicar sozinho. */
  dataValidade: string | null;
};

export type Documento = {
  id: string;
  tipoId: string;
  nome: string;
  categoria: CategoriaDocumento;
  numero: string | null;
  orgaoEmissor: string | null;
  /** "YYYY-MM-DD" */
  dataEmissao: string | null;
  /** "YYYY-MM-DD". null com naoVence=false significa "validade não informada". */
  dataValidade: string | null;
  naoVence: boolean;
  observacao: string | null;
  arquivo: ArquivoDocumento | null;
  historico: ArquivoDocumento[];
  criadoEm: string;
  atualizadoEm: string;
};

type DocumentosData = {
  documentos: Documento[];
};

const store = jsonStore<DocumentosData>("documentos.json", { documentos: [] });

const PASTA = path.join(process.cwd(), "data", "documentos");

// Os mesmos formatos que os portais aceitam, mais nada. Bloquear aqui evita
// que alguém suba um .exe ou um .html — o painel serve esses arquivos de
// volta, e HTML servido do próprio domínio executa script.
// .p12 e .pfx SAÍRAM da lista em 03/09/2026, e é de propósito.
//
// São certificados COM CHAVE PRIVADA — é com ela que se assina proposta, nota
// e contrato em nome da empresa. Guardá-los aqui significaria que qualquer
// pessoa com a senha do painel baixa a assinatura da empresa inteira, e a
// senha é uma só, compartilhada. O painel avisa em vez de recusar calado,
// porque quem tentou subir precisa entender o motivo, não achar que quebrou.
const EXTENSOES_ACEITAS = new Set([
  "pdf", "png", "jpg", "jpeg", "doc", "docx", "xls", "xlsx", "zip", "rar",
]);

const EXTENSOES_DE_CHAVE_PRIVADA = new Set(["p12", "pfx", "pem", "key", "jks"]);

export const TAMANHO_MAXIMO_BYTES = 30 * 1024 * 1024;

function caminhoArquivo(documentoId: string, arquivoId: string, extensao: string) {
  return path.join(PASTA, documentoId, `${arquivoId}.${extensao}`);
}

// ---------------------------------------------------------------- vencimento

export type Situacao =
  | "sem_arquivo"
  | "sem_validade"
  | "vencido"
  | "vence_em_breve"
  | "valido"
  | "nao_vence";

/**
 * Marcos de aviso, em dias. Quatro toques dão tempo de reagir a cada tipo de
 * documento: 60 dias serve pro balanço (depende do contador), 30 e 15 pras
 * certidões de emissão imediata, 7 é o grito.
 *
 * A Licitar Digital manda um aviso genérico por e-mail e não deixa escolher
 * quantos dias antes — foi a reclamação registrada no mapeamento do portal.
 */
export const MARCOS_AVISO = [60, 30, 15, 7] as const;

/** Quantos dias faltam, contando dia cheio. Negativo = já venceu. */
export function diasAteVencer(dataValidade: string, hoje = hojeISO()): number {
  // Comparação por data pura, sem hora. Uma conta em milissegundos aqui
  // devolveria fração, e Math.ceil de fração negativa devolve -0 — que não é
  // menor que zero. Esse bug já apareceu três vezes neste projeto.
  const a = Date.UTC(
    Number(hoje.slice(0, 4)),
    Number(hoje.slice(5, 7)) - 1,
    Number(hoje.slice(8, 10))
  );
  const b = Date.UTC(
    Number(dataValidade.slice(0, 4)),
    Number(dataValidade.slice(5, 7)) - 1,
    Number(dataValidade.slice(8, 10))
  );
  return Math.round((b - a) / 86400000);
}

export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function situacaoDe(doc: Documento, hoje = hojeISO()): Situacao {
  if (doc.naoVence) return doc.arquivo ? "nao_vence" : "sem_arquivo";
  if (!doc.arquivo) return "sem_arquivo";
  if (!doc.dataValidade) return "sem_validade";
  const dias = diasAteVencer(doc.dataValidade, hoje);
  if (dias < 0) return "vencido";
  if (dias <= MARCOS_AVISO[0]) return "vence_em_breve";
  return "valido";
}

/** Documento que não serve pra entregar hoje: sem arquivo ou vencido. */
export function estaImpedido(doc: Documento, hoje = hojeISO()): boolean {
  const s = situacaoDe(doc, hoje);
  return s === "sem_arquivo" || s === "vencido";
}

/** Data sugerida a partir da emissão, quando o tipo tem prazo conhecido. */
export function sugerirValidade(tipoId: string, dataEmissao: string): string | null {
  const tipo = tipoPorId(tipoId);
  if (!tipo?.validadeDias) return null;
  const base = new Date(
    Date.UTC(
      Number(dataEmissao.slice(0, 4)),
      Number(dataEmissao.slice(5, 7)) - 1,
      Number(dataEmissao.slice(8, 10))
    )
  );
  base.setUTCDate(base.getUTCDate() + tipo.validadeDias);
  return base.toISOString().slice(0, 10);
}

// --------------------------------------------------------------------- CRUD

export async function listDocumentos(): Promise<Documento[]> {
  const data = await store.read();
  const hoje = hojeISO();
  // Ordem por urgência: o que já venceu ou está sem arquivo vem primeiro,
  // depois o que vence mais cedo. Quem abre a tela quer ver problema, não
  // ordem alfabética.
  const peso: Record<Situacao, number> = {
    vencido: 0,
    sem_arquivo: 1,
    vence_em_breve: 2,
    sem_validade: 3,
    valido: 4,
    nao_vence: 5,
  };
  return [...data.documentos].sort((a, b) => {
    const pa = peso[situacaoDe(a, hoje)];
    const pb = peso[situacaoDe(b, hoje)];
    if (pa !== pb) return pa - pb;
    if (a.dataValidade && b.dataValidade) {
      return a.dataValidade.localeCompare(b.dataValidade);
    }
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export async function obterDocumento(id: string): Promise<Documento | null> {
  const data = await store.read();
  return data.documentos.find((d) => d.id === id) ?? null;
}

type CamposEditaveis = {
  tipoId?: string;
  nome?: string;
  numero?: string | null;
  orgaoEmissor?: string | null;
  dataEmissao?: string | null;
  dataValidade?: string | null;
  naoVence?: boolean;
  observacao?: string | null;
};

export async function criarDocumento(input: CamposEditaveis): Promise<Documento> {
  const tipo = tipoPorId(input.tipoId ?? "outro");
  const agora = new Date().toISOString();
  return store.update((data) => {
    const doc: Documento = {
      id: randomUUID(),
      tipoId: tipo?.id ?? "outro",
      nome: input.nome?.trim() || tipo?.nome || "Documento sem nome",
      categoria: tipo?.categoria ?? "interno",
      numero: input.numero?.trim() || null,
      orgaoEmissor: input.orgaoEmissor?.trim() || null,
      dataEmissao: input.dataEmissao || null,
      dataValidade: input.dataValidade || null,
      naoVence: input.naoVence ?? false,
      observacao: input.observacao?.trim() || null,
      arquivo: null,
      historico: [],
      criadoEm: agora,
      atualizadoEm: agora,
    };
    data.documentos.push(doc);
    return doc;
  });
}

export async function atualizarDocumento(
  id: string,
  patch: CamposEditaveis
): Promise<Documento | null> {
  return store.update((data) => {
    const doc = data.documentos.find((d) => d.id === id);
    if (!doc) return null;
    if (patch.tipoId !== undefined) {
      const tipo = tipoPorId(patch.tipoId);
      doc.tipoId = tipo?.id ?? "outro";
      doc.categoria = tipo?.categoria ?? "interno";
    }
    if (patch.nome !== undefined) doc.nome = patch.nome.trim() || doc.nome;
    if (patch.numero !== undefined) doc.numero = patch.numero?.trim() || null;
    if (patch.orgaoEmissor !== undefined) {
      doc.orgaoEmissor = patch.orgaoEmissor?.trim() || null;
    }
    if (patch.dataEmissao !== undefined) doc.dataEmissao = patch.dataEmissao || null;
    if (patch.dataValidade !== undefined) doc.dataValidade = patch.dataValidade || null;
    if (patch.naoVence !== undefined) doc.naoVence = patch.naoVence;
    if (patch.observacao !== undefined) {
      doc.observacao = patch.observacao?.trim() || null;
    }
    doc.atualizadoEm = new Date().toISOString();
    return doc;
  });
}

export async function excluirDocumento(id: string): Promise<void> {
  const removido = await store.update((data) => {
    const doc = data.documentos.find((d) => d.id === id);
    data.documentos = data.documentos.filter((d) => d.id !== id);
    return doc ?? null;
  });
  if (!removido) return;
  // Apagar os arquivos é secundário: a ficha já saiu da lista, e um PDF órfão
  // só ocupa espaço.
  await fsp.rm(path.join(PASTA, removido.id), { recursive: true, force: true }).catch(() => {});
}

// ------------------------------------------------------------------ arquivos

export async function anexarArquivo(
  documentoId: string,
  arquivo: { nome: string; buffer: Buffer }
): Promise<Documento | null> {
  const extensao = (arquivo.nome.split(".").pop() ?? "").toLowerCase();
  if (EXTENSOES_DE_CHAVE_PRIVADA.has(extensao)) {
    throw new Error(
      "Certificado com chave privada (.p12/.pfx) não pode ser guardado aqui — " +
        "quem tem a senha do painel passaria a poder assinar pela empresa. " +
        "Cadastre só a ficha, com a data de validade, para ser avisada antes de vencer."
    );
  }

  if (!EXTENSOES_ACEITAS.has(extensao)) {
    throw new Error(
      `Formato .${extensao || "?"} não aceito. Use PDF, imagem, Word, Excel ou ZIP.`
    );
  }
  if (arquivo.buffer.length > TAMANHO_MAXIMO_BYTES) {
    throw new Error("Arquivo maior que 30 MB.");
  }

  const existente = await obterDocumento(documentoId);
  if (!existente) return null;

  const arquivoId = randomUUID();
  // Grava antes de mexer no JSON: se o disco falhar, a ficha continua
  // apontando pro arquivo antigo, que ainda existe.
  await fsp.mkdir(path.join(PASTA, documentoId), { recursive: true });
  await fsp.writeFile(caminhoArquivo(documentoId, arquivoId, extensao), arquivo.buffer);

  const agora = new Date().toISOString();
  return store.update((data) => {
    const doc = data.documentos.find((d) => d.id === documentoId);
    if (!doc) return null;
    if (doc.arquivo) {
      doc.historico.unshift({ ...doc.arquivo, substituidoEm: agora });
    }
    doc.arquivo = {
      id: arquivoId,
      nomeOriginal: arquivo.nome,
      extensao,
      bytes: arquivo.buffer.length,
      enviadoEm: agora,
      substituidoEm: null,
      dataValidade: doc.dataValidade,
    };
    doc.atualizadoEm = agora;
    return doc;
  });
}

const TIPOS_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
  rar: "application/vnd.rar",
};

export async function lerArquivo(
  documentoId: string,
  arquivoId?: string
): Promise<{ buffer: Buffer; tipo: string; nome: string } | null> {
  const doc = await obterDocumento(documentoId);
  if (!doc) return null;
  const alvo = arquivoId
    ? [doc.arquivo, ...doc.historico].find((a) => a?.id === arquivoId)
    : doc.arquivo;
  if (!alvo) return null;
  try {
    const buffer = await fsp.readFile(
      caminhoArquivo(documentoId, alvo.id, alvo.extensao)
    );
    return {
      buffer,
      tipo: TIPOS_MIME[alvo.extensao] ?? "application/octet-stream",
      nome: alvo.nomeOriginal,
    };
  } catch {
    return null;
  }
}
