import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, criarToken, VALIDADE_SEGUNDOS } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// Atraso fixo em toda tentativa. Não impede um ataque determinado, mas torna
// inviável testar milhares de senhas por minuto contra uma senha só.
const ATRASO_MS = 600;

export async function POST(request: NextRequest) {
  const { senha } = (await request.json()) as { senha?: string };
  const esperada = process.env.PAINEL_SENHA;

  await new Promise((resolve) => setTimeout(resolve, ATRASO_MS));

  if (!esperada) {
    return NextResponse.json(
      { error: "O painel está sem senha configurada." },
      { status: 500 }
    );
  }

  if (!senha || senha !== esperada) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(COOKIE_SESSAO, await criarToken(), {
    httpOnly: true,
    sameSite: "lax",
    // Em produção só trafega por HTTPS; local (http://localhost) precisa
    // continuar funcionando.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VALIDADE_SEGUNDOS,
  });
  return resposta;
}

export async function DELETE() {
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(COOKIE_SESSAO, "", { path: "/", maxAge: 0 });
  return resposta;
}
