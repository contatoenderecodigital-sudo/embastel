import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { jsonStore } from "./jsonStore";
import type { Formato, TamanhoQuadrado } from "./papelArroz";

// Artes de papel de arroz já usadas, pra reimprimir sem refazer.
//
// A IMAGEM VAI PRO DISCO, NÃO PRO JSON — diferente das fichas de produto.
// Motivo: arte de papel de arroz precisa ser de alta resolução (um círculo de
// 20cm a 300dpi tem mais de 2000px de lado), o que dá 1 a 3 MB por arquivo.
// Guardar isso em base64 dentro do JSON faria o arquivo inteiro ser reescrito
// a cada salvamento — com 20 artes seriam dezenas de MB regravados por clique.
// No JSON fica só a ficha técnica; a imagem fica em data/papel-arroz/<id>.
//
// Consequência a saber: isso depende de disco gravável, que é o caso do
// servidor onde o painel roda. Numa hospedagem serverless (disco só leitura)
// as imagens precisariam ir pra um serviço de arquivos.

export type ArtePapelArroz = {
  id: string;
  titulo: string;
  modo: "topo" | "tags";
  // Ficha técnica da impressão, pra reimprimir igualzinho.
  formato: Formato;
  diametroCm: number;
  tamanhoQuadrado: TamanhoQuadrado;
  tagDiametroCm: number;
  tema: string | null;
  nome: string | null;
  idade: string | null;
  descricao: string | null;
  // Extensão do arquivo guardado (png, jpg...).
  extensao: string;
  bytes: number;
  criadoEm: string;
  usadoEm: string;
};

type ArtesData = {
  artes: ArtePapelArroz[];
};

const store = jsonStore<ArtesData>("papel-arroz.json", { artes: [] });

const PASTA_IMAGENS = path.join(process.cwd(), "data", "papel-arroz");

function caminhoImagem(id: string, extensao: string) {
  return path.join(PASTA_IMAGENS, `${id}.${extensao}`);
}

export async function listArtes(): Promise<ArtePapelArroz[]> {
  const data = await store.read();
  return [...data.artes].sort((a, b) => b.usadoEm.localeCompare(a.usadoEm));
}

/** Lê o arquivo da imagem. Null se a arte não existe ou o arquivo sumiu. */
export async function lerImagem(
  id: string
): Promise<{ buffer: Buffer; tipo: string } | null> {
  const data = await store.read();
  const arte = data.artes.find((a) => a.id === id);
  if (!arte) return null;
  try {
    const buffer = await fsp.readFile(caminhoImagem(id, arte.extensao));
    const tipo = arte.extensao === "png" ? "image/png" : `image/${arte.extensao}`;
    return { buffer, tipo };
  } catch {
    return null;
  }
}

export async function salvarArte(input: {
  titulo: string;
  modo: "topo" | "tags";
  formato: Formato;
  diametroCm: number;
  tamanhoQuadrado: TamanhoQuadrado;
  tagDiametroCm: number;
  tema?: string | null;
  nome?: string | null;
  idade?: string | null;
  descricao?: string | null;
  // Data URL vinda da tela ("data:image/png;base64,....").
  imagemDataUrl: string;
}): Promise<ArtePapelArroz> {
  // [\s\S] no lugar da flag /s: o alvo do TypeScript aqui é anterior ao
  // es2018, onde dotAll ainda não existe.
  const casa = /^data:image\/([a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(
    input.imagemDataUrl
  );
  if (!casa) throw new Error("A imagem não veio num formato que dê pra salvar.");

  const extensao = casa[1].toLowerCase() === "jpeg" ? "jpg" : casa[1].toLowerCase();
  const buffer = Buffer.from(casa[2], "base64");

  const id = randomUUID();
  fs.mkdirSync(PASTA_IMAGENS, { recursive: true });
  await fsp.writeFile(caminhoImagem(id, extensao), buffer);

  const agora = new Date().toISOString();
  return store.update((data) => {
    const arte: ArtePapelArroz = {
      id,
      titulo: input.titulo,
      modo: input.modo,
      formato: input.formato,
      diametroCm: input.diametroCm,
      tamanhoQuadrado: input.tamanhoQuadrado,
      tagDiametroCm: input.tagDiametroCm,
      tema: input.tema ?? null,
      nome: input.nome ?? null,
      idade: input.idade ?? null,
      descricao: input.descricao ?? null,
      extensao,
      bytes: buffer.length,
      criadoEm: agora,
      usadoEm: agora,
    };
    data.artes.push(arte);
    return arte;
  });
}

/** Marca que a arte foi usada de novo — ela sobe pro topo da lista. */
export async function marcarUso(id: string): Promise<void> {
  await store.update((data) => {
    const arte = data.artes.find((a) => a.id === id);
    if (arte) arte.usadoEm = new Date().toISOString();
  });
}

export async function excluirArte(id: string): Promise<void> {
  const removida = await store.update((data) => {
    const arte = data.artes.find((a) => a.id === id);
    data.artes = data.artes.filter((a) => a.id !== id);
    return arte ?? null;
  });
  if (removida) {
    // Apagar o arquivo é secundário: se falhar, o que importa (a ficha) já
    // saiu da lista e o arquivo vira só um órfão ocupando espaço.
    await fsp.rm(caminhoImagem(removida.id, removida.extensao), { force: true }).catch(() => {});
  }
}
