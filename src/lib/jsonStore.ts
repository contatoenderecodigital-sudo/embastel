import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

// Armazenamento em arquivo JSON para o painel inteiro.
//
// POR QUE ISSO EXISTE (não é otimização — é correção de bug de perda de dados):
//
// Antes cada lib de dados chamava JSONFilePreset() a cada requisição. O lowdb
// grava através do `steno`, que serializa as gravações e faz escrita atômica
// (escreve num .tmp e renomeia) — mas o trinco é POR INSTÂNCIA do Writer, e o
// nome do .tmp é derivado só do nome do arquivo. Criando um Writer novo a cada
// requisição, duas requisições simultâneas viravam dois Writers sem trava
// entre si escrevendo NO MESMO arquivo .tmp. Resultado observado em teste: dois
// DELETE com 700ms de diferença deixaram o data/licitacoes-acompanhadas.json
// sintaticamente inválido (o conteúdo curto de uma gravação seguido da sobra da
// outra), e a partir daí toda rota do módulo respondia 500.
//
// Aqui o problema é atacado em quatro camadas:
//  1. Uma instância por arquivo (Map abaixo), compartilhada por todas as rotas.
//  2. Fila por arquivo: ler-alterar-gravar roda inteiro sob trava, então duas
//     alterações simultâneas não se sobrescrevem (não é só "não corrompe" — a
//     segunda enxerga o resultado da primeira).
//  3. .tmp com nome único por processo/gravação: mesmo que o Next crie
//     instâncias de módulo separadas (acontece em dev com HMR), duas gravações
//     nunca disputam o mesmo arquivo temporário. O pior caso vira "a última
//     gravação vence", nunca "o arquivo quebrou".
//  4. Backup da última versão válida antes de cada gravação + recuperação
//     automática na leitura se o arquivo principal estiver ilegível.

const DATA_DIR = path.join(process.cwd(), "data");
const BACKUP_DIR = path.join(DATA_DIR, ".backup");

let writeCounter = 0;

// No Windows o rename falha com EPERM/EBUSY/EACCES quando alguém tem o
// arquivo de destino aberto naquele instante — antivírus, indexador do
// sistema, ou o próprio painel lendo o arquivo. Não é corrupção nem falta de
// permissão de verdade: é momentâneo, e tentar de novo resolve. (O `steno`,
// que o lowdb usava, faz exatamente isso pelo mesmo motivo.) Sem esse retry,
// uma coleta de 10 minutos morria na metade por causa de uma gravação de
// contador de progresso.
async function renomearComRetry(origem: string, destino: string): Promise<void> {
  const ERROS_TEMPORARIOS = ["EPERM", "EBUSY", "EACCES"];
  const MAX_TENTATIVAS = 10;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      await fsp.rename(origem, destino);
      return;
    } catch (error) {
      const codigo = (error as NodeJS.ErrnoException).code ?? "";
      if (!ERROS_TEMPORARIOS.includes(codigo) || tentativa === MAX_TENTATIVAS) {
        // Não deixa o .tmp acumulando lixo na pasta data/.
        await fsp.rm(origem, { force: true }).catch(() => {});
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 50 * tentativa));
    }
  }
}

export class JsonStore<T> {
  readonly #file: string;
  readonly #backupFile: string;
  readonly #defaultData: T;
  // Fila de operações deste arquivo. Toda leitura/gravação entra aqui, então
  // nunca há duas operações no mesmo arquivo ao mesmo tempo dentro do processo.
  #queue: Promise<unknown> = Promise.resolve();

  constructor(fileName: string, defaultData: T) {
    this.#file = path.join(DATA_DIR, fileName);
    this.#backupFile = path.join(BACKUP_DIR, fileName);
    this.#defaultData = defaultData;
  }

  #enqueue<R>(operation: () => Promise<R>): Promise<R> {
    // Encadeia na fila tanto no sucesso quanto no erro, pra uma operação que
    // falhou não travar todas as seguintes.
    const result = this.#queue.then(operation, operation);
    this.#queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  #clone(): T {
    return structuredClone(this.#defaultData);
  }

  async #readFrom(file: string): Promise<T | null> {
    try {
      const text = await fsp.readFile(file, "utf8");
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  // Leitura sem passar pela fila — uso interno, já chamado de dentro dela.
  async #readUnlocked(): Promise<T> {
    if (!fs.existsSync(this.#file)) {
      // Arquivo nunca criado: começa do zero, sem alarde.
      return this.#clone();
    }

    const data = await this.#readFrom(this.#file);
    if (data !== null) return data;

    // Arquivo existe mas não é JSON válido. Antes de desistir, tenta o backup —
    // é exatamente o cenário que derrubou o módulo de licitações.
    const backup = await this.#readFrom(this.#backupFile);
    const quarantine = `${this.#file}.corrompido-${Date.now()}`;
    try {
      await fsp.rename(this.#file, quarantine);
    } catch {
      // Se não deu nem pra mover, seguimos assim mesmo: a gravação seguinte
      // sobrescreve o arquivo quebrado.
    }

    if (backup !== null) {
      console.error(
        `[jsonStore] ${path.basename(this.#file)} estava corrompido — restaurado do backup. Cópia do arquivo quebrado em ${path.basename(quarantine)}.`
      );
      await this.#writeUnlocked(backup);
      return backup;
    }

    console.error(
      `[jsonStore] ${path.basename(this.#file)} estava corrompido e não havia backup — recomeçando vazio. Cópia do arquivo quebrado em ${path.basename(quarantine)}.`
    );
    return this.#clone();
  }

  async #writeUnlocked(data: T): Promise<void> {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    await fsp.mkdir(BACKUP_DIR, { recursive: true });

    // Guarda a versão atual (se for legível) antes de sobrescrever.
    const current = await this.#readFrom(this.#file);
    if (current !== null) {
      try {
        await fsp.copyFile(this.#file, this.#backupFile);
      } catch {
        // Backup é rede de segurança, não pode impedir a gravação.
      }
    }

    // Nome único: pid + contador + aleatório. Duas gravações concorrentes
    // (mesmo vindas de instâncias de módulo diferentes) usam arquivos
    // temporários distintos, então o rename final é sempre de um JSON íntegro.
    const tmp = `${this.#file}.${process.pid}-${writeCounter++}-${Math.random()
      .toString(36)
      .slice(2, 8)}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await renomearComRetry(tmp, this.#file);
  }

  /** Lê o conteúdo atual do arquivo. */
  read(): Promise<T> {
    return this.#enqueue(() => this.#readUnlocked());
  }

  /**
   * Lê, deixa você alterar e grava — tudo sob trava, então nenhuma outra
   * alteração no mesmo arquivo acontece no meio. O valor retornado pelo
   * callback é devolvido por aqui (útil pra retornar o item criado/alterado).
   */
  update<R>(mutate: (data: T) => R | Promise<R>): Promise<R> {
    return this.#enqueue(async () => {
      const data = await this.#readUnlocked();
      const result = await mutate(data);
      await this.#writeUnlocked(data);
      return result;
    });
  }
}

// A interface que o resto do painel enxerga. Tanto o armazenamento em arquivo
// quanto o em Postgres implementam exatamente isto — por isso trocar de um pro
// outro não exigiu mexer em nenhuma das 14 libs de dados.
export type Store<T> = {
  read(): Promise<T>;
  update<R>(mutate: (data: T) => R | Promise<R>): Promise<R>;
};

// Uma instância por arquivo, compartilhada por todas as rotas deste processo —
// é o que faz a fila do item 2 acima valer pro painel inteiro.
const stores = new Map<string, Store<unknown>>();

/**
 * Escolhe onde os dados moram:
 *
 * - **Com DATABASE_URL** (produção/Vercel): Postgres. Obrigatório lá, porque o
 *   disco do Vercel é somente leitura e efêmero — gravar em arquivo falha, e o
 *   que por acaso desse certo sumiria na requisição seguinte.
 * - **Sem DATABASE_URL** (seu computador): arquivos em `data/`, que é como o
 *   painel sempre funcionou e continua funcionando sem depender de internet.
 */
export function jsonStore<T>(fileName: string, defaultData: T): Store<T> {
  const existing = stores.get(fileName);
  if (existing) return existing as Store<T>;

  let store: Store<T>;
  if (process.env.DATABASE_URL) {
    // Import tardio: o driver do Postgres não é carregado em quem roda local.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PgStore } = require("./pgStore") as typeof import("./pgStore");
    store = new PgStore<T>(fileName, defaultData);
  } else {
    store = new JsonStore<T>(fileName, defaultData);
  }

  stores.set(fileName, store as Store<unknown>);
  return store;
}
