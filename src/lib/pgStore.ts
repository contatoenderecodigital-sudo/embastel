import { Pool } from "pg";

// Armazenamento em Postgres — usado quando DATABASE_URL existe (produção).
//
// POR QUE O MESMO FORMATO DE "DOCUMENTO": o painel inteiro já acessa dados
// através de read()/update() sobre um objeto JSON (ver jsonStore.ts). Manter
// essa interface aqui significa que nenhuma das 14 libs de dados precisou ser
// reescrita pra ir pro banco — cada arquivo virou uma linha, e a trava que
// antes era uma fila em memória virou SELECT ... FOR UPDATE, que é mais forte:
// funciona entre processos e entre instâncias serverless, coisa que trava em
// arquivo nunca conseguiu.

const TABELA = "painel_docs";

let pool: Pool | null = null;
let schemaPronto: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Serverless: cada instância da função abre pouquíssimas conexões, e o
      // pooler do provedor (Neon/Supabase) cuida do resto.
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      // Provedores gerenciados exigem TLS, mas usam certificado de uma CA que
      // o Node não traz — o mesmo ajuste que as bibliotecas oficiais fazem.
      ssl: process.env.DATABASE_URL?.includes("localhost")
        ? undefined
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function garantirSchema(): Promise<void> {
  if (!schemaPronto) {
    schemaPronto = (async () => {
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS ${TABELA} (
          chave TEXT PRIMARY KEY,
          dados JSONB NOT NULL,
          atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
    })().catch((erro) => {
      // Não deixa uma falha momentânea marcar o schema como "pronto" pra
      // sempre — a próxima chamada tenta de novo.
      schemaPronto = null;
      throw erro;
    });
  }
  return schemaPronto;
}

export class PgStore<T> {
  constructor(
    private readonly chave: string,
    private readonly padrao: T
  ) {}

  async read(): Promise<T> {
    await garantirSchema();
    const { rows } = await getPool().query<{ dados: T }>(
      `SELECT dados FROM ${TABELA} WHERE chave = $1`,
      [this.chave]
    );
    if (!rows.length) return structuredClone(this.padrao);
    return rows[0].dados;
  }

  async update<R>(mutate: (data: T) => R | Promise<R>): Promise<R> {
    await garantirSchema();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      // Cria a linha se ainda não existir, pra ter o que travar. ON CONFLICT
      // DO NOTHING deixa intacto o que já estiver salvo.
      await client.query(
        `INSERT INTO ${TABELA} (chave, dados) VALUES ($1, $2) ON CONFLICT (chave) DO NOTHING`,
        [this.chave, JSON.stringify(this.padrao)]
      );

      // FOR UPDATE segura a linha até o COMMIT: duas alterações simultâneas
      // no mesmo documento viram uma fila de verdade, e a segunda enxerga o
      // resultado da primeira em vez de sobrescrevê-lo.
      const { rows } = await client.query<{ dados: T }>(
        `SELECT dados FROM ${TABELA} WHERE chave = $1 FOR UPDATE`,
        [this.chave]
      );

      const dados = rows.length ? rows[0].dados : structuredClone(this.padrao);
      const resultado = await mutate(dados);

      await client.query(
        `UPDATE ${TABELA} SET dados = $2, atualizado_em = now() WHERE chave = $1`,
        [this.chave, JSON.stringify(dados)]
      );

      await client.query("COMMIT");
      return resultado;
    } catch (erro) {
      await client.query("ROLLBACK").catch(() => {});
      throw erro;
    } finally {
      client.release();
    }
  }
}

/** Grava um documento inteiro de uma vez — usado pela migração. */
export async function gravarDocumento(chave: string, dados: unknown): Promise<void> {
  await garantirSchema();
  await getPool().query(
    `INSERT INTO ${TABELA} (chave, dados) VALUES ($1, $2)
     ON CONFLICT (chave) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = now()`,
    [chave, JSON.stringify(dados)]
  );
}

export async function listarDocumentos(): Promise<
  Array<{ chave: string; atualizado_em: Date }>
> {
  await garantirSchema();
  const { rows } = await getPool().query<{ chave: string; atualizado_em: Date }>(
    `SELECT chave, atualizado_em FROM ${TABELA} ORDER BY chave`
  );
  return rows;
}

export async function fecharPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    schemaPronto = null;
  }
}
