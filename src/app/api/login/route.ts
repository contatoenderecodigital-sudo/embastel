import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, criarToken, VALIDADE_SEGUNDOS } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// Atraso fixo em toda tentativa. Não impede um ataque determinado, mas torna
// inviável testar milhares de senhas por minuto contra uma senha só.
const ATRASO_MS = 600;

// Trava por origem, além do atraso.
//
// O atraso sozinho não basta: ele é por requisição, e quem ataca dispara em
// paralelo. Com uma senha só protegendo CNPJ, endereço e telefone de 74
// clientes — e, em breve, CPF e dívida —, força bruta é o caminho óbvio.
//
// Fica na memória do processo de propósito: sem banco, sem dependência nova, e
// o custo de reiniciar é aceitável (quem estava travado ganha uma chance a
// mais). Uma tabela no disco daria persistência que não vale a complexidade.
const MAX_TENTATIVAS = 8;
const JANELA_MS = 15 * 60 * 1000;
const tentativas = new Map<string, { erros: number; primeiraEm: number }>();

function origem(request: NextRequest): string {
  // Atrás do nginx o IP real vem no cabeçalho; sem ele, todo mundo pareceria
  // a mesma origem e uma pessoa travaria o painel para as demais.
  const encaminhado = request.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "desconhecida";
}

function bloqueada(chave: string): boolean {
  const registro = tentativas.get(chave);
  if (!registro) return false;
  if (Date.now() - registro.primeiraEm > JANELA_MS) {
    tentativas.delete(chave);
    return false;
  }
  return registro.erros >= MAX_TENTATIVAS;
}

function registrarErro(chave: string): void {
  const agora = Date.now();
  const registro = tentativas.get(chave);
  if (!registro || agora - registro.primeiraEm > JANELA_MS) {
    tentativas.set(chave, { erros: 1, primeiraEm: agora });
    return;
  }
  registro.erros += 1;
}

/**
 * Comparação em tempo constante da senha.
 *
 * `a !== b` para em cima da primeira letra diferente, e o tempo dessa parada
 * conta quantas letras estavam certas. É o mesmo cuidado que a assinatura do
 * cookie já tinha em sessao.ts, e faltava justamente onde mora o segredo.
 */
function senhasIguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

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

  const chave = origem(request);
  if (bloqueada(chave)) {
    return NextResponse.json(
      {
        error:
          "Muitas tentativas seguidas. Espere 15 minutos e tente de novo.",
      },
      { status: 429 }
    );
  }

  if (!senha || !senhasIguais(senha, esperada)) {
    registrarErro(chave);
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  // Acertou: a contagem daquela origem zera, pra quem erra e corrige não ficar
  // com o crédito consumido pelo resto da janela.
  tentativas.delete(chave);

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
