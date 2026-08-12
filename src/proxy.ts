import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESSAO, loginObrigatorio, tokenValido } from "@/lib/sessao";

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
  // As rotas de cron são chamadas pelo Vercel e se protegem com CRON_SECRET.
  "/api/cron",
];

export async function proxy(request: NextRequest) {
  if (!loginObrigatorio()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (LIVRES.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_SESSAO)?.value;
  if (await tokenValido(token)) return NextResponse.next();

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
