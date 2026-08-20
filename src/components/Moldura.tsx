"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Notificacoes from "./Notificacoes";

// Decide se a página aparece dentro do painel (menu lateral + sino) ou
// sozinha. A tela de login é o único caso solto — mostrar o menu para quem
// ainda não entrou seria estranho e vazaria os nomes dos módulos.
const SEM_MOLDURA = ["/login"];

export default function Moldura({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (SEM_MOLDURA.includes(pathname)) {
    return <>{children}</>;
  }

  // A planilha de disputa tem coluna demais pra caber em 1152px: com o limite
  // padrão, Fatura e Lucro ficavam cortadas na direita e era preciso rolar a
  // tabela pro lado pra ver o número que importa. Aqui ela usa a tela toda.
  const larguraCheia = pathname.startsWith("/painel/disputa");

  return (
    <>
      <Sidebar />
      <Notificacoes />
      <main className="flex-1 min-w-0 px-10 py-9">
        <div className={`mx-auto w-full ${larguraCheia ? "" : "max-w-6xl"}`}>
          {children}
        </div>
      </main>
    </>
  );
}
