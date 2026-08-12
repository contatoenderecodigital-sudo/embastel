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

  return (
    <>
      <Sidebar />
      <Notificacoes />
      <main className="flex-1 min-w-0 px-10 py-9">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </>
  );
}
