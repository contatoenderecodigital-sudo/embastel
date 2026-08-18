import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";
import { normalizarTexto } from "./textoUtils";

// A agenda de quem fornece pra Embastel.
//
// Nasceu como uma lista de nomes soltos, que servia pra marcar de quem era
// cada produto no estoque. Virou agenda de verdade por causa da licitação:
// quando aparece um pregão de 40 lotes com prazo curto, a pergunta é sempre a
// mesma — "quem me cota isso, e qual o telefone?". Ter que caçar isso no
// WhatsApp de alguém é o que faz perder prazo.
//
// Daí os dois campos que mudam o jogo: o TELEFONE, pra pedir cotação sem sair
// da tela, e as CATEGORIAS, pra responder "quem atende saco de lixo" sem ler
// a lista inteira de 34 fornecedores.

export type Fornecedor = {
  id: string;
  nome: string;
  /** Razão social, quando diferente do nome pelo qual a loja o chama. */
  razaoSocial: string;
  cnpj: string;
  /** Só dígitos, no formato que o WhatsApp aceita (55 + DDD + número). */
  telefone: string;
  email: string;
  /** Nome do vendedor que atende a Embastel. */
  contato: string;
  /** O que ele fornece. É por aqui que se acha fornecedor pra um edital. */
  categorias: string[];
  observacao: string;
  criadoEm: string;
  atualizadoEm: string;
};

type FornecedoresData = {
  fornecedores: Fornecedor[];
};

// Lista inicial passada pelo usuário em 2026-08-10 — só entra no arquivo se
// ele ainda não existir (primeira vez que o app roda); depois disso quem
// manda é o que estiver salvo em disco.
const NOMES_INICIAIS = [
  "Pennacchi", "Galvanotek", "Copozan", "Hiperpack", "Fibraform",
  "Cia Canoinhas", "Orleplast", "Plast Lar", "Da Colônia", "Reval",
  "Cristalcopo", "Apti", "Bela Vista", "Bigfer", "Curifest",
  "Cotherpack", "Dispafilm", "Fracipel", "Jandira", "JF Pack",
  "Mirandinha", "Libreplast", "Pettit", "Prática Estampa", "Predilecta",
  "Inoven", "Prevemax", "Reiki", "Prodac", "Riberball",
  "Sanremo", "Softworks", "Tritec", "Wyda",
];

/**
 * Categorias sugeridas, tiradas do que a loja de fato vende (as mesmas
 * famílias que o filtro de licitação procura). Servem de atalho no cadastro —
 * a lista não é fechada, dá pra escrever qualquer outra.
 */
export const CATEGORIAS_SUGERIDAS = [
  "Saco de lixo",
  "Saco plástico",
  "Sacola",
  "Copo descartável",
  "Prato e talher descartável",
  "Marmitex e embalagem de comida",
  "Bandeja",
  "Papel toalha e higiênico",
  "Guardanapo",
  "Filme e alumínio",
  "Descartável de festa",
  "Forma de papel e confeitaria",
  "Copa e cozinha",
  "Utensílio",
  "Material de limpeza",
  "Higiene e EPI",
  "Papelaria e etiqueta",
];

function novoRegistro(nome: string): Fornecedor {
  const agora = new Date().toISOString();
  return {
    id: randomUUID(),
    nome,
    razaoSocial: "",
    cnpj: "",
    telefone: "",
    email: "",
    contato: "",
    categorias: [],
    observacao: "",
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

const store = jsonStore<FornecedoresData>("fornecedores.json", {
  fornecedores: NOMES_INICIAIS.map(novoRegistro),
});

/** Deixa só os dígitos — é o formato que o link do WhatsApp precisa. */
export function apenasDigitos(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * Completa os campos que não existiam quando o fornecedor foi cadastrado.
 * Sem isso a tela receberia `undefined` e quebraria ao filtrar por categoria.
 */
function completar(f: Fornecedor): Fornecedor {
  return {
    ...f,
    razaoSocial: f.razaoSocial ?? "",
    cnpj: f.cnpj ?? "",
    telefone: f.telefone ?? "",
    email: f.email ?? "",
    contato: f.contato ?? "",
    categorias: f.categorias ?? [],
    observacao: f.observacao ?? "",
    atualizadoEm: f.atualizadoEm ?? f.criadoEm,
  };
}

export async function listFornecedores(): Promise<Fornecedor[]> {
  const data = await store.read();
  return data.fornecedores
    .map(completar)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Todas as categorias em uso, pra virarem sugestão e filtro. */
export async function listCategorias(): Promise<string[]> {
  const data = await store.read();
  const todas = new Set<string>();
  for (const f of data.fornecedores) {
    for (const c of f.categorias ?? []) todas.add(c);
  }
  return [...todas].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Radical da palavra, pra aguentar o plural do português.
 *
 * Buscar a palavra inteira não funciona, e o motivo é menos óbvio do que
 * parece: "descartavel" NÃO está dentro de "descartaveis" — o plural de
 * "-ável" é "-áveis", e a última letra muda. O mesmo vale pra "papel/papeis".
 * (É por isso que a lista de palavras-chave das licitações guarda
 * "descartáve", truncado, em vez de "descartável".)
 *
 * Cortar a última letra resolve esse caso e ainda pega o plural simples
 * ("bandeja" → "bandej", que está em "bandejas"). O piso de 5 letras evita o
 * outro extremo: com piso 4, "prato" virava "prat" e casava com
 * "prateleiras" — testado, aparecia mesmo.
 */
function radical(palavra: string): string {
  return palavra.slice(0, Math.max(5, palavra.length - 1));
}

/**
 * Fornecedores que atendem um texto qualquer — o objeto de uma licitação, por
 * exemplo.
 *
 * Basta UMA palavra da categoria aparecer. Exigir todas deixaria de fora o
 * caso mais comum: a categoria "Prato e talher descartável" não apareceria num
 * edital que pede só "pratos descartáveis". E o custo de errar é assimétrico —
 * um nome a mais na lista é um telefonema desnecessário; um nome a menos é uma
 * cotação que não foi pedida e um lote que ficou sem preço.
 */
export async function fornecedoresParaTexto(texto: string): Promise<
  Array<{ fornecedor: Fornecedor; categoriasQueBatem: string[]; forca: number }>
> {
  const alvo = normalizarTexto(texto);
  if (!alvo) return [];

  const encontrados: Array<{
    fornecedor: Fornecedor;
    categoriasQueBatem: string[];
    forca: number;
  }> = [];

  for (const bruto of await listFornecedores()) {
    const batem: string[] = [];
    let forca = 0;

    for (const categoria of bruto.categorias) {
      const c = normalizarTexto(categoria);
      if (!c) continue;
      const palavras = c.split(" ").filter((p) => p.length >= 4);
      const acertos = palavras.filter((p) => alvo.includes(radical(p))).length;
      if (acertos > 0) {
        batem.push(categoria);
        // Categoria inteira escrita no edital vale mais que uma palavra solta.
        forca += alvo.includes(c) ? acertos + 2 : acertos;
      }
    }

    if (batem.length) encontrados.push({ fornecedor: bruto, categoriasQueBatem: batem, forca });
  }

  // Quem cobre mais do edital aparece primeiro — é pra quem se liga antes.
  return encontrados.sort((a, b) => b.forca - a.forca);
}

type Entrada = Partial<Omit<Fornecedor, "id" | "criadoEm" | "atualizadoEm">>;

export async function addFornecedor(entrada: Entrada | string): Promise<Fornecedor> {
  // Aceita só o nome, que é como a tela antiga chamava.
  const dados: Entrada = typeof entrada === "string" ? { nome: entrada } : entrada;
  return store.update((data) => {
    const fornecedor = {
      ...novoRegistro(dados.nome?.trim() || "Sem nome"),
      razaoSocial: dados.razaoSocial?.trim() ?? "",
      cnpj: apenasDigitos(dados.cnpj ?? ""),
      telefone: apenasDigitos(dados.telefone ?? ""),
      email: dados.email?.trim() ?? "",
      contato: dados.contato?.trim() ?? "",
      categorias: (dados.categorias ?? []).map((c) => c.trim()).filter(Boolean),
      observacao: dados.observacao?.trim() ?? "",
    };
    data.fornecedores.push(fornecedor);
    return fornecedor;
  });
}

export async function updateFornecedor(
  id: string,
  entrada: Entrada
): Promise<Fornecedor | null> {
  return store.update((data) => {
    const f = data.fornecedores.find((x) => x.id === id);
    if (!f) return null;
    const atual = completar(f);
    Object.assign(f, atual);

    if (entrada.nome !== undefined) f.nome = entrada.nome.trim() || f.nome;
    if (entrada.razaoSocial !== undefined) f.razaoSocial = entrada.razaoSocial.trim();
    if (entrada.cnpj !== undefined) f.cnpj = apenasDigitos(entrada.cnpj);
    if (entrada.telefone !== undefined) f.telefone = apenasDigitos(entrada.telefone);
    if (entrada.email !== undefined) f.email = entrada.email.trim();
    if (entrada.contato !== undefined) f.contato = entrada.contato.trim();
    if (entrada.categorias !== undefined) {
      f.categorias = entrada.categorias.map((c) => c.trim()).filter(Boolean);
    }
    if (entrada.observacao !== undefined) f.observacao = entrada.observacao.trim();
    f.atualizadoEm = new Date().toISOString();
    return f;
  });
}

export async function deleteFornecedor(id: string): Promise<void> {
  await store.update((data) => {
    data.fornecedores = data.fornecedores.filter((f) => f.id !== id);
  });
}
