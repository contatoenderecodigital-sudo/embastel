"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setEntrando(true);
    setErro(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (!res.ok) {
        const dados = await res.json();
        throw new Error(dados.error ?? "Não foi possível entrar.");
      }
      router.replace(params.get("de") || "/");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
      setSenha("");
    } finally {
      setEntrando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="w-full max-w-[340px]">
      <div className="mb-7 flex flex-col items-center gap-3">
        <div className="rounded-xl bg-white px-5 py-4 shadow-lg shadow-black/20">
          <Image
            src="/logo-embastel.png"
            alt="Embastel Embalagens"
            width={263}
            height={72}
            className="h-auto w-[200px]"
            priority
            unoptimized
          />
        </div>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#a4898b]">
          Painel interno
        </p>
      </div>

      <label className="mb-1.5 block text-[12.5px] font-medium text-[#cbb9ba]">
        Senha
      </label>
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        autoFocus
        autoComplete="current-password"
        className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-[#8a7778] focus:border-white/30"
        placeholder="••••••••"
      />

      {erro && (
        <p className="mt-2.5 rounded-lg bg-red-500/15 px-3 py-2 text-[12px] text-red-300">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={entrando || !senha}
        className="brand-gradient mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white shadow-lg shadow-black/30 transition-transform hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0"
      >
        {entrando ? "Entrando..." : "Entrar"}
      </button>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-[#8a7778]">
        Embastel Embalagens · Xanxerê/SC
        <br />
        Acesso restrito à equipe da loja.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="sidebar-gradient flex min-h-screen w-full items-center justify-center px-6">
      <Suspense fallback={null}>
        <Formulario />
      </Suspense>
    </div>
  );
}
