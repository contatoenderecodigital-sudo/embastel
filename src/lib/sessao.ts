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

/**
 * Dois perfis, não um cadastro de usuários.
 *
 * "completo" é a senha da casa, que abre tudo e é o que sempre existiu.
 * "vendedora" é a senha da Ketlyn, que trabalha na rua com o celular na mão.
 *
 * POR QUE SEPARAR, se a comissão já é toda dela. Não é por causa da comissão —
 * é porque o celular dela é o aparelho de maior risco da casa: fica no carro, no
 * balcão do cliente, na rua. Com uma senha só, esse aparelho passaria a carregar
 * licitações, documentos de habilitação, custo dos 20 mil produtos, o botão de
 * publicar e, em breve, CPF e dívida de cliente. E se sumisse, a única saída
 * seria trocar a senha de todo mundo.
 *
 * Esconder o menu no celular NÃO resolveria: quem tem a senha mestra chega em
 * qualquer tela digitando o endereço. A separação tem que ser no porteiro.
 */
export type Perfil = "completo" | "vendedora";

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

export async function criarToken(perfil: Perfil = "completo"): Promise<string> {
  const expiraEm = Date.now() + VALIDADE_MS;
  // O perfil vai DENTRO do que é assinado: fora da assinatura, bastaria editar
  // o cookie no navegador pra virar "completo".
  const payload = `${expiraEm}:${perfil}`;
  const assinatura = await assinar(payload, segredoDeAssinatura());
  return `${payload}.${assinatura}`;
}

/**
 * Devolve o perfil do cookie, ou null se ele não presta.
 *
 * Um token só é aceito se a assinatura confere E o prazo não passou — a ordem
 * importa: conferir o prazo antes da assinatura deixaria alguém descobrir, pelo
 * tipo de recusa, se a assinatura estava certa.
 */
export async function perfilDoToken(token: string | undefined): Promise<Perfil | null> {
  if (!token) return null;
  const segredo = segredoDeAssinatura();
  if (!segredo) return null;

  const separador = token.lastIndexOf(".");
  if (separador <= 0) return null;

  const payload = token.slice(0, separador);
  const assinatura = token.slice(separador + 1);

  const esperada = await assinar(payload, segredo);
  if (!iguais(assinatura, esperada)) return null;

  // Formato antigo era só o prazo, sem perfil. Um cookie desses vale como
  // "completo" — é o que ele sempre foi — e some sozinho quando expirar.
  const [prazo, perfil] = payload.split(":");
  const expiraEm = Number(prazo);
  if (!Number.isFinite(expiraEm) || expiraEm <= Date.now()) return null;

  return perfil === "vendedora" ? "vendedora" : "completo";
}

export async function tokenValido(token: string | undefined): Promise<boolean> {
  return (await perfilDoToken(token)) !== null;
}

/**
 * O login só é exigido quando existe PAINEL_SENHA configurada. Rodando no seu
 * computador, sem a variável, o painel abre direto como sempre abriu.
 */
export function loginObrigatorio(): boolean {
  return Boolean(process.env.PAINEL_SENHA);
}

/**
 * Descobre de quem é a senha digitada.
 *
 * Compara com as duas em tempo constante, e SEMPRE com as duas: sair na
 * primeira que bate faria o tempo de resposta contar qual senha foi tentada.
 */
export function perfilDaSenha(senha: string): Perfil | null {
  const daCasa = process.env.PAINEL_SENHA ?? "";
  const daVendedora = process.env.PAINEL_SENHA_VENDEDORA ?? "";

  const ehDaCasa = Boolean(daCasa) && senhasIguais(senha, daCasa);
  const ehDaVendedora = Boolean(daVendedora) && senhasIguais(senha, daVendedora);

  if (ehDaCasa) return "completo";
  if (ehDaVendedora) return "vendedora";
  return null;
}

/** Comparação em tempo constante — ver o comentário de `iguais`. */
function senhasIguais(a: string, b: string): boolean {
  return iguais(a, b);
}

export const VALIDADE_SEGUNDOS = Math.floor(VALIDADE_MS / 1000);
