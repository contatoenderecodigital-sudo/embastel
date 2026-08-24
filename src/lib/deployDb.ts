import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Publicar o painel pelo próprio painel.
//
// POR QUE EXISTE. O deploy roda no servidor, por SSH, e só o Eliezer tem a
// chave. Em 24/08/2026 um trabalho da Kemilly ficou QUATRO DIAS no GitHub sem
// ir pro ar — não por decisão, mas porque ninguém foi avisado e ela não tinha
// como publicar. O botão resolve os dois lados: mostra que tem coisa parada, e
// deixa publicar sem distribuir chave de root pra ninguém. Quem entra no
// painel já provou que tem a senha; é a mesma porta.
//
// O TRABALHO NÃO PODE SER FILHO DESTA REQUISIÇÃO. O deploy reinicia o pm2, ou
// seja, mata o processo que está atendendo o clique. Por isso o script é
// lançado DESANEXADO (detached + unref): ele ganha o próprio grupo de
// processos e sobrevive à morte de quem o chamou. O progresso vai pra um
// arquivo, e a tela pergunta de tempos em tempos — inclusive depois que o
// processo novo subiu, porque o arquivo continua lá.

const PASTA_APP = process.cwd();
const LOG = path.join(PASTA_APP, "data", "deploy.log");
const SAIDA = path.join(PASTA_APP, "data", "deploy.exit");
const SCRIPT = path.join(PASTA_APP, "scripts", "deploy-vps.sh");

/** Deploy que passa disso sem escrever o código de saída travou. */
const LIMITE_MS = 15 * 60 * 1000;

export type Commit = {
  hash: string;
  autor: string;
  quando: string;
  assunto: string;
};

export type EstadoDeploy = {
  /** Onde o servidor está agora. */
  noAr: Commit | null;
  /** O que está no GitHub e ainda não subiu, do mais novo pro mais antigo. */
  pendentes: Commit[];
  rodando: boolean;
  iniciadoEm: number | null;
  /** Resultado da última publicação: null enquanto nunca rodou por aqui. */
  ultimoOk: boolean | null;
  log: string;
  /**
   * Se dá pra publicar desta máquina.
   *
   * O painel também roda no computador de quem desenvolve, e lá o script não
   * faz sentido: ele mexe em pm2 e em caminho absoluto do servidor. Sem esta
   * checagem, o botão apareceria em desenvolvimento e falharia feio.
   */
  podePublicar: boolean;
  motivo: string;
};

async function git(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: PASTA_APP,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

const FORMATO = "%h\x1f%an\x1f%ad\x1f%s";

function lerCommits(saida: string): Commit[] {
  if (!saida) return [];
  return saida.split("\n").map((linha) => {
    const [hash, autor, quando, assunto] = linha.split("\x1f");
    return { hash, autor, quando, assunto };
  });
}

// Buscar no GitHub a cada leitura seria uma chamada de rede a cada 5 segundos
// de tela aberta. Guarda o instante do último fetch e repete no máximo a cada
// meio minuto — o suficiente pra ninguém ficar olhando dado velho.
let ultimoFetch = 0;
const INTERVALO_FETCH_MS = 30_000;

async function buscarDoGithub(): Promise<void> {
  if (Date.now() - ultimoFetch < INTERVALO_FETCH_MS) return;
  ultimoFetch = Date.now();
  await git(["fetch", "--quiet", "origin"]).catch(() => {
    // Sem internet o painel continua funcionando: mostra o que está no ar e
    // simplesmente não sabe se há novidade.
  });
}

async function lerLog(): Promise<string> {
  try {
    const texto = await fsp.readFile(LOG, "utf8");
    // Só o fim interessa: é onde está o erro ou o "Pronto".
    return texto.split("\n").slice(-40).join("\n");
  } catch {
    return "";
  }
}

const statusEmMemoria = {
  rodando: false,
  iniciadoEm: null as number | null,
  ultimoOk: null as boolean | null,
};

export async function lerEstado(): Promise<EstadoDeploy> {
  const ehServidor = fs.existsSync(SCRIPT) && fs.existsSync("/www/wwwroot");

  // Um deploy em andamento termina escrevendo o código de saída num arquivo.
  // É assim que se descobre o fim mesmo depois do pm2 ter reiniciado este
  // processo no meio do caminho: o estado mora no disco, não na memória.
  if (statusEmMemoria.rodando) {
    if (fs.existsSync(SAIDA)) {
      const codigo = (await fsp.readFile(SAIDA, "utf8")).trim();
      statusEmMemoria.rodando = false;
      statusEmMemoria.ultimoOk = codigo === "0";
    } else if (
      statusEmMemoria.iniciadoEm &&
      Date.now() - statusEmMemoria.iniciadoEm > LIMITE_MS
    ) {
      statusEmMemoria.rodando = false;
      statusEmMemoria.ultimoOk = false;
    }
  }

  await buscarDoGithub();

  const [noArBruto, pendentesBruto, log] = await Promise.all([
    git(["log", "-1", `--format=${FORMATO}`, "--date=iso"]).catch(() => ""),
    git([
      "log",
      "HEAD..origin/master",
      `--format=${FORMATO}`,
      "--date=iso",
    ]).catch(() => ""),
    lerLog(),
  ]);

  return {
    noAr: lerCommits(noArBruto)[0] ?? null,
    pendentes: lerCommits(pendentesBruto),
    rodando: statusEmMemoria.rodando,
    iniciadoEm: statusEmMemoria.iniciadoEm,
    ultimoOk: statusEmMemoria.ultimoOk,
    log,
    podePublicar: ehServidor,
    motivo: ehServidor
      ? ""
      : "Publicar só funciona no servidor — aqui é a cópia de desenvolvimento.",
  };
}

export async function publicar(): Promise<{ ok: boolean; erro?: string }> {
  const estado = await lerEstado();
  if (!estado.podePublicar) return { ok: false, erro: estado.motivo };
  if (estado.rodando) return { ok: false, erro: "Já tem uma publicação em andamento." };

  await fsp.mkdir(path.dirname(LOG), { recursive: true });
  await fsp.rm(SAIDA, { force: true });
  await fsp.writeFile(LOG, "==> Publicando…\n", "utf8");

  // `sh -c` porque precisamos de redirecionamento e do código de saída no fim.
  // detached + unref é o que faz o processo sobreviver ao pm2 restart que ele
  // mesmo dispara lá no meio.
  const filho = spawn(
    "sh",
    ["-c", `bash ${SCRIPT} >> ${LOG} 2>&1; echo $? > ${SAIDA}`],
    { cwd: PASTA_APP, detached: true, stdio: "ignore" }
  );
  filho.unref();

  statusEmMemoria.rodando = true;
  statusEmMemoria.iniciadoEm = Date.now();
  statusEmMemoria.ultimoOk = null;
  return { ok: true };
}
