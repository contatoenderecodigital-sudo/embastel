// Sessão do painel.
//
// É proposital que seja simples: uma senha só, compartilhada pelas poucas
// pessoas da loja que usam o painel. Não há cadastro de usuários porque não há
// necessidade de saber "quem" fez o quê — a necessidade real é impedir que o
// painel fique aberto na internet, expondo CNPJ, endereço e telefone dos 74
// clientes cadastrados.
//
// Usa Web Crypto (e não node:crypto) porque o proxy.ts roda no runtime Edge,
// onde os módulos do Node não existem.

export const COOKIE_SESSAO = "embastel_sessao";

// 30 dias: é um painel de uso diário, e pedir senha toda hora só faria a
// pessoa deixar anotada num papel colado no monitor.
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of view) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function assinar(payload: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    new TextEncoder().encode(payload)
  );
  return base64url(assinatura);
}

/** Comparação em tempo constante, pra não vazar a assinatura por timing. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function segredoDeAssinatura(): string {
  // Assina com o SESSION_SECRET; sem ele, cai na própria senha do painel, que
  // já é um segredo do servidor. Assim funciona mesmo se a pessoa esquecer de
  // configurar a variável extra.
  return process.env.SESSION_SECRET || process.env.PAINEL_SENHA || "";
}

export async function criarToken(): Promise<string> {
  const expiraEm = Date.now() + VALIDADE_MS;
  const payload = String(expiraEm);
  const assinatura = await assinar(payload, segredoDeAssinatura());
  return `${payload}.${assinatura}`;
}

export async function tokenValido(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const segredo = segredoDeAssinatura();
  if (!segredo) return false;

  const separador = token.lastIndexOf(".");
  if (separador <= 0) return false;

  const payload = token.slice(0, separador);
  const assinatura = token.slice(separador + 1);

  const esperada = await assinar(payload, segredo);
  if (!iguais(assinatura, esperada)) return false;

  const expiraEm = Number(payload);
  return Number.isFinite(expiraEm) && expiraEm > Date.now();
}

/**
 * O login só é exigido quando existe PAINEL_SENHA configurada. Rodando no seu
 * computador, sem a variável, o painel abre direto como sempre abriu.
 */
export function loginObrigatorio(): boolean {
  return Boolean(process.env.PAINEL_SENHA);
}

export const VALIDADE_SEGUNDOS = Math.floor(VALIDADE_MS / 1000);
