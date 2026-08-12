// Copia os dados de `data/*.json` para o Postgres.
//
// Use uma vez, antes do primeiro deploy, pra levar junto o que já existe no
// seu computador (os 74 clientes, os fornecedores, o funil de licitações...).
// Rodar de novo é seguro: sobrescreve o documento no banco pelo do arquivo.
//
//   node scripts/migrar-para-banco.mjs                (usa DATABASE_URL do ambiente)
//   DATABASE_URL="postgres://..." node scripts/migrar-para-banco.mjs
//
// Para conferir o que está lá sem gravar nada:
//   node scripts/migrar-para-banco.mjs --listar

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const TABELA = "painel_docs";
const DATA_DIR = path.join(process.cwd(), "data");

// O índice de licitações não vai junto de propósito: ele é grande, é
// descartável e o coletor remonta sozinho na primeira rodada em produção.
const IGNORAR = new Set(["licitacoes-indice.json", "licitacoes-coleta.json"]);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "Faltou DATABASE_URL.\n\n" +
      "  Windows (PowerShell):  $env:DATABASE_URL=\"postgres://...\"; node scripts/migrar-para-banco.mjs\n" +
      "  Git Bash / Linux:      DATABASE_URL=\"postgres://...\" node scripts/migrar-para-banco.mjs\n"
  );
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
});

async function garantirSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABELA} (
      chave TEXT PRIMARY KEY,
      dados JSONB NOT NULL,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function listar() {
  const { rows } = await pool.query(
    `SELECT chave, atualizado_em, pg_column_size(dados) AS bytes FROM ${TABELA} ORDER BY chave`
  );
  if (!rows.length) {
    console.log("O banco está vazio.");
    return;
  }
  console.log(`${rows.length} documento(s) no banco:\n`);
  for (const r of rows) {
    console.log(
      `  ${r.chave.padEnd(34)} ${String(r.bytes).padStart(8)} bytes   ${new Date(
        r.atualizado_em
      ).toLocaleString("pt-BR")}`
    );
  }
}

async function migrar() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Pasta ${DATA_DIR} não existe — nada pra migrar.`);
    process.exit(1);
  }

  const arquivos = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json") && !IGNORAR.has(f));

  if (!arquivos.length) {
    console.log("Nenhum arquivo pra migrar.");
    return;
  }

  console.log(`Migrando ${arquivos.length} arquivo(s) para o banco...\n`);
  let ok = 0;

  for (const arquivo of arquivos) {
    const caminho = path.join(DATA_DIR, arquivo);
    let dados;
    try {
      dados = JSON.parse(fs.readFileSync(caminho, "utf8"));
    } catch (erro) {
      console.log(`  ✗ ${arquivo} — não é JSON válido, pulado (${erro.message})`);
      continue;
    }

    await pool.query(
      `INSERT INTO ${TABELA} (chave, dados) VALUES ($1, $2)
       ON CONFLICT (chave) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = now()`,
      [arquivo, JSON.stringify(dados)]
    );

    // Contagem só pra dar confiança de que foi o volume certo.
    const primeiraLista = Object.values(dados).find((v) => Array.isArray(v));
    const qtd = Array.isArray(primeiraLista) ? ` (${primeiraLista.length} registro(s))` : "";
    console.log(`  ✓ ${arquivo}${qtd}`);
    ok += 1;
  }

  console.log(`\n${ok} de ${arquivos.length} migrado(s).`);
}

try {
  await garantirSchema();
  if (process.argv.includes("--listar")) {
    await listar();
  } else {
    await migrar();
    console.log("\nConferindo o que ficou no banco:\n");
    await listar();
  }
} catch (erro) {
  console.error("\nFalhou:", erro.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
