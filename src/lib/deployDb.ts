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

const STATUS = path.join(PASTA_APP, "data", "deploy-status.json");

type Status = {
  rodando: boolean;
  iniciadoEm: number | null;
  ultimoOk: boolean | null;
};

const PARADO: Status = { rodando: false, iniciadoEm: null, ultimoOk: null };

// O estado vai pro DISCO, não pra uma variável.
//
// No caminho de sucesso o deploy reinicia o pm2 no meio — o processo que
// registrou "estou publicando" morre, e o que sobe no lugar nasce sem memória
// nenhuma. Com o estado em variável, a tela nunca chegava a dizer se deu certo:
// o aviso simplesmente sumia. Em arquivo, o processo novo continua a história
// de onde o antigo parou.
async function lerStatus(): Promise<Status> {
  try {
    return { ...PARADO, ...JSON.parse(await fsp.readFile(STATUS, "utf8")) };
  } catch {
    return { ...PARADO };
  }
}

async function gravarStatus(s: Status): Promise<void> {
  await fsp.mkdir(path.dirname(STATUS), { recursive: true });
  await fsp.writeFile(STATUS, JSON.stringify(s), "utf8");
}

export async function lerEstado(): Promise<EstadoDeploy> {
  const ehServidor = fs.existsSync(SCRIPT) && fs.existsSync("/www/wwwroot");

  // Um deploy em andamento termina escrevendo o código de saída num arquivo.
  // É assim que se descobre o fim mesmo depois do pm2 ter reiniciado este
  // processo no meio do caminho: o estado mora no disco, não na memória.
  const status = await lerStatus();
  if (status.rodando) {
    if (fs.existsSync(SAIDA)) {
      const codigo = (await fsp.readFile(SAIDA, "utf8")).trim();
      status.rodando = false;
      status.ultimoOk = codigo === "0";
      await gravarStatus(status);
    } else if (status.iniciadoEm && Date.now() - status.iniciadoEm > LIMITE_MS) {
      status.rodando = false;
      status.ultimoOk = false;
      await gravarStatus(status);
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
    rodando: status.rodando,
    iniciadoEm: status.iniciadoEm,
    ultimoOk: status.ultimoOk,
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
  // NODE_ENV sai do ambiente do filho de propósito: o pm2 roda o painel com
  // NODE_ENV=production, e nesse modo o `npm ci` pula as devDependencies — o
  // build morria sem o @tailwindcss/postcss. O script já pede --include=dev,
  // mas herdar o ambiente de produção num processo de build é armadilha em
  // geral, não só nesse caso.
  const ambiente = { ...process.env } as Record<string, string | undefined>;
  delete ambiente.NODE_ENV;

  const filho = spawn(
    "sh",
    ["-c", `bash ${SCRIPT} >> ${LOG} 2>&1; echo $? > ${SAIDA}`],
    {
      cwd: PASTA_APP,
      detached: true,
      stdio: "ignore",
      env: ambiente as NodeJS.ProcessEnv,
    }
  );
  filho.unref();

  await gravarStatus({ rodando: true, iniciadoEm: Date.now(), ultimoOk: null });
  return { ok: true };
}
