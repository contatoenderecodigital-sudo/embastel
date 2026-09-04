import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESSAO, loginObrigatorio, perfilDoToken } from "@/lib/sessao";

// Porteiro do painel. Roda antes de qualquer página ou rota de API.
// (No Next 16 este arquivo se chama proxy.ts — o antigo middleware.ts está
// descontinuado; ver node_modules/next/dist/docs/.../file-conventions/proxy.md)

// Rotas que precisam continuar abertas mesmo sem sessão.
const LIVRES = [
  "/login",
  "/api/login",
  // O webhook do WhatsApp é chamado pela Meta, que não tem como fazer login;
  // ele tem a própria verificação por token (WHATSAPP_VERIFY_TOKEN).
  "/api/whatsapp/webhook",
];

/**
 * O que a senha da vendedora abre. Tudo que não estiver aqui, ela não vê.
 *
 * Lista do que PODE, e não do que não pode: tela nova nasce fechada pra ela e
 * alguém decide abrir. Ao contrário, cada tela nova vazaria por esquecimento —
 * e a que vazaria hoje é a das fichas, com CPF e dívida de cliente.
 */
const ROTAS_DA_VENDEDORA = [
  "/painel/pedidos",
  "/painel/clientes",
  "/painel/comissoes",
  "/api/pedidos",
  "/api/clientes",
  "/api/comissoes",
  "/api/produtos-loja",
];

function podeVerComoVendedora(pathname: string): boolean {
  if (pathname === "/painel" || pathname === "/painel/") return true;
  return ROTAS_DA_VENDEDORA.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
}

/**
 * Impede o navegador de guardar a página do painel.
 *
 * O nome dos arquivos de estilo muda a cada publicação. Se o navegador
 * guardar o HTML de uma versão, na publicação seguinte ele fica pedindo
 * arquivos que não existem mais e o painel abre completamente sem
 * formatação — sem a pessoa ter o que fazer além de descobrir sozinha o
 * atalho de limpar cache. Aconteceu em 13/08/2026 com o dono da loja.
 *
 * Precisa ser feito aqui, e não no next.config: para páginas
 * pré-renderizadas o Next define o Cache-Control dele e ignora o do config
 * (ver node_modules/next/dist/docs/.../01-next-config-js/headers.md).
 */
function semCache(resposta: NextResponse): NextResponse {
  resposta.headers.set("Cache-Control", "no-store, must-revalidate");
  return resposta;
}

export async function proxy(request: NextRequest) {
  const ehPainel =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/painel");

  if (!loginObrigatorio()) {
    return ehPainel ? semCache(NextResponse.next()) : NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (LIVRES.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))) {
    return ehPainel ? semCache(NextResponse.next()) : NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_SESSAO)?.value;
  const perfil = await perfilDoToken(token);

  if (perfil === "vendedora" && !podeVerComoVendedora(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Esta parte do painel não faz parte do seu acesso." },
        { status: 403 }
      );
    }
    // Manda pros pedidos, não pro login: ela ESTÁ logada, e uma tela de login
    // aqui faria parecer que a senha dela parou de funcionar.
    return NextResponse.redirect(new URL("/painel/pedidos", request.url));
  }

  if (perfil) {
    return ehPainel ? semCache(NextResponse.next()) : NextResponse.next();
  }

  // Chamada de API responde 401 em vez de redirecionar — a tela trata melhor
  // um erro do que receber o HTML da página de login no lugar de JSON.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  // Guarda pra onde a pessoa queria ir, pra voltar lá depois de entrar.
  if (pathname !== "/") login.searchParams.set("de", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Só o painel e a API passam por aqui. O site da loja (a raiz do domínio e
  // seus arquivos estáticos) fica de fora de propósito: ele é público, é o
  // que o cliente da loja vê.
  matcher: ["/painel/:path*", "/api/:path*"],
};
