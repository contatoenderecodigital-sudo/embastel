"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PATH_WHATSAPP } from "./icones";
import { useCallback, useEffect, useState } from "react";

// O menu é dividido em duas áreas porque são duas equipes diferentes usando o
// mesmo painel: quem toca licitação (busca edital, monta preço, cuida de
// certidão e contrato) e quem toca a loja (WhatsApp, pedido, romaneio,
// estoque, fornecedor). Antes tudo aparecia numa lista só de 18 itens, e o
// resultado foi o dono procurar a tela de fornecedores dentro do bloco
// "Compras" achando que era coisa de licitação.
//
// Não é permissão — a senha do painel é uma só e todo mundo pode abrir tudo.
// É só recorte de tela: cada um vê primeiro o que usa todo dia.

type Area = "licitacao" | "loja";

type Link_ = {
  href: string;
  label: string;
  icon: React.ReactNode;
  preenchido?: boolean;
  badgeKey?: "whatsapp" | "licitacoes" | "documentos" | "contratos";
};

type Grupo = { label: string; links: Link_[] };

// Fica acima do seletor: é o que as duas equipes abrem.
const GERAL: Link_[] = [
  {
    href: "/painel",
    label: "Painel",
    icon: (
      <>
        <rect x="2.5" y="2.5" width="6.2" height="6.2" rx="1.2" />
        <rect x="11.3" y="2.5" width="6.2" height="6.2" rx="1.2" />
        <rect x="2.5" y="11.3" width="6.2" height="6.2" rx="1.2" />
        <rect x="11.3" y="11.3" width="6.2" height="6.2" rx="1.2" />
      </>
    ),
  },
  {
    href: "/painel/tarefas",
    label: "Tarefas",
    icon: <path d="M4 5.5h12M4 10h12M4 14.5h7" />,
  },
];

const AREAS: Record<Area, { titulo: string; legenda: string; grupos: Grupo[] }> = {
  licitacao: {
    titulo: "Licitação",
    legenda: "Vender pra prefeitura",
    grupos: [
      {
        label: "Achar",
        links: [
          {
            href: "/painel/licitacoes",
            label: "Licitações",
            icon: (
              <path d="M4 8h12M4 8l-1.5 4a2 2 0 0 0 4 0L5 8m10 0l1.5 4a2 2 0 0 1-4 0L14 8M10 4v14M7 18h6" />
            ),
            badgeKey: "licitacoes",
          },
          {
            href: "/painel/precos",
            label: "Preços praticados",
            icon: (
              <>
                <path d="M3 12.5 10 3l7 9.5M4.5 12.5h11M6.5 16.5h7" />
                <circle cx="10" cy="8" r="1.6" />
              </>
            ),
          },
        ],
      },
      {
        label: "Disputar",
        links: [
          {
            // Agenda própria, separada da lista da loja: aqui só entra quem dá
            // pra colocar numa proposta (ver fornecedoresLicitacaoDb.ts).
            href: "/painel/cotacao",
            label: "Fornecedores",
            icon: (
              <path d="M4 17V8l6-4 6 4v9M4 17h12M4 17H2.5M16 17h1.5M8 17v-4h4v4" />
            ),
          },
          {
            href: "/painel/catalogo",
            label: "Catálogo e margem",
            icon: (
              <>
                <rect x="3" y="3.5" width="14" height="13" rx="1.5" />
                <path d="M3 7.5h14M7 3.5v13" />
              </>
            ),
          },
          {
            href: "/painel/documentos",
            label: "Documentos",
            icon: (
              <>
                <path d="M5 2.5h6l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" />
                <path d="M11 2.5v4h4M7 11h6M7 14h4" />
              </>
            ),
            badgeKey: "documentos",
          },
        ],
      },
      {
        label: "Depois de ganhar",
        links: [
          {
            href: "/painel/contratos",
            label: "Contratos e atas",
            icon: (
              <>
                <path d="M4 4.5h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" />
                <path d="M6 8h5M6 11h5M14 7.5h2a1 1 0 0 1 1 1v6a2 2 0 0 1-4 0" />
              </>
            ),
            badgeKey: "contratos",
          },
          {
            href: "/painel/relatorios",
            label: "Relatórios",
            icon: (
              <>
                <path d="M3 16.5h14" />
                <rect x="4.5" y="9" width="3" height="6" rx="0.8" />
                <rect x="9" y="5.5" width="3" height="9.5" rx="0.8" />
                <rect x="13.5" y="11.5" width="3" height="3.5" rx="0.8" />
              </>
            ),
          },
        ],
      },
    ],
  },
  loja: {
    titulo: "Loja",
    legenda: "Balcão e entrega",
    grupos: [
      {
        label: "Atendimento",
        links: [
          {
            href: "/painel/whatsapp",
            label: "WhatsApp",
            icon: PATH_WHATSAPP,
            preenchido: true,
            badgeKey: "whatsapp",
          },
          {
            href: "/painel/clientes",
            label: "Clientes",
            icon: (
              <>
                <circle cx="10" cy="6.5" r="3" />
                <path d="M3.5 17c0-3 3-5 6.5-5s6.5 2 6.5 5" />
              </>
            ),
          },
        ],
      },
      {
        label: "Vendas",
        links: [
          {
            href: "/painel/pedidos",
            label: "Pedidos",
            icon: (
              <path d="M6 3h8l2 3v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6l2-3zM4 6h12M8 9v1a2 2 0 0 0 4 0V9" />
            ),
          },
          {
            href: "/painel/romaneio",
            label: "Romaneio",
            icon: (
              <path d="M5 3h10a1 1 0 0 1 1 1v13l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zM7 7h6M7 10h6M7 13h3" />
            ),
          },
          {
            href: "/painel/comissoes",
            label: "Comissões",
            icon: (
              <path d="M10 2v16M14 5.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5S7.8 8 10 8s4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5" />
            ),
          },
        ],
      },
      {
        label: "Estoque",
        links: [
          {
            href: "/painel/conferencia",
            label: "Conferência",
            icon: (
              <>
                <path d="M6 3h8a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                <path d="M8 7.5l1.3 1.3L12 6.2M8 12.5l1.3 1.3L12 11.2" />
              </>
            ),
          },
          {
            href: "/painel/estoque",
            label: "Estoque",
            icon: (
              <path d="M3 6.5l7-3.5 7 3.5v7L10 17l-7-3.5v-7zM3 6.5L10 10m0 0l7-3.5M10 10v7" />
            ),
          },
          {
            href: "/painel/fornecedores",
            label: "Fornecedores",
            icon: (
              <path d="M4 17V8l6-4 6 4v9M4 17h12M4 17H2.5M16 17h1.5M8 17v-4h4v4" />
            ),
          },
        ],
      },
      {
        label: "Marketing",
        links: [
          {
            href: "/painel/marketing/fichas",
            label: "Fichas de produto",
            icon: (
              <path d="M4 3h9l3 3v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM13 3v3h3M6.5 10h7M6.5 13h7M6.5 16h4" />
            ),
          },
          {
            href: "/painel/marketing/papel-arroz",
            label: "Papel de arroz",
            icon: (
              <>
                <circle cx="10" cy="10" r="7" />
                <path d="M10 3v14M3 10h14" strokeDasharray="1.5 2.5" />
              </>
            ),
          },
          {
            href: "/painel/marketing/promocoes",
            label: "Promoções",
            icon: <path d="M3 10.5 9.5 4H16v6.5L9.5 17 3 10.5zM12.5 7.5h.01" />,
          },
        ],
      },
    ],
  },
};

const ORDEM: Area[] = ["licitacao", "loja"];

/**
 * De que área é a tela aberta. `null` quando é uma tela das duas (o painel, as
 * tarefas) — aí a área continua sendo a que a pessoa escolheu.
 */
function areaDaRota(pathname: string): Area | null {
  for (const area of ORDEM) {
    for (const grupo of AREAS[area].grupos) {
      if (grupo.links.some((l) => pathname.startsWith(l.href))) return area;
    }
  }
  return null;
}

const CHAVE_PREFERENCIA = "painel:area";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [needsAttentionCount, setNeedsAttentionCount] = useState(0);
  const [licitacoesNovas, setLicitacoesNovas] = useState(0);
  const [documentosProblema, setDocumentosProblema] = useState(0);
  const [contratosProblema, setContratosProblema] = useState(0);

  // Começa pela rota, que o servidor e o navegador enxergam igual — ler o
  // localStorage aqui daria hidratação divergente. A preferência salva entra
  // depois, no efeito, e só quando a rota não decide sozinha.
  const [area, setArea] = useState<Area>(() => areaDaRota(pathname) ?? "licitacao");

  useEffect(() => {
    const daRota = areaDaRota(pathname);
    if (daRota) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setArea(daRota);
      window.localStorage.setItem(CHAVE_PREFERENCIA, daRota);
      return;
    }
    const salva = window.localStorage.getItem(CHAVE_PREFERENCIA);
    if (salva === "licitacao" || salva === "loja") {
      setArea(salva);
    }
  }, [pathname]);

  function escolherArea(nova: Area) {
    setArea(nova);
    window.localStorage.setItem(CHAVE_PREFERENCIA, nova);
  }

  const loadBadge = useCallback(async () => {
    try {
      const [convRes, licRes, docRes, contRes] = await Promise.all([
        fetch("/api/whatsapp/conversations"),
        fetch("/api/licitacoes/resumo"),
        fetch("/api/documentos"),
        fetch("/api/contratos"),
      ]);

      const convData = await convRes.json();
      type ConversationLike = { needsAttention?: boolean };
      setNeedsAttentionCount(
        (convData.conversations ?? []).filter(
          (c: ConversationLike) => c.needsAttention
        ).length
      );

      const licData = await licRes.json();
      setLicitacoesNovas(licData.novas24h ?? 0);

      // O contador do menu junta o que impede de participar hoje (vencido ou
      // sem arquivo) com o que está para vencer — os três exigem ação.
      const docData = await docRes.json();
      const r = docData.resumo ?? {};
      setDocumentosProblema(
        (r.vencidos ?? 0) + (r.semArquivo ?? 0) + (r.venceEmBreve ?? 0)
      );

      // No contrato o badge conta ocorrência, não valor: vigência acabando e
      // pagamento atrasado são as duas coisas que exigem alguém ligar pro
      // órgão hoje.
      const contData = await contRes.json();
      const rc = contData.resumo ?? {};
      setContratosProblema(
        (rc.vencendo ?? 0) + ((rc.emAtraso ?? 0) > 0 ? 1 : 0)
      );
    } catch {
      // silencioso: próxima atualização tenta de novo
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBadge();
    const interval = setInterval(loadBadge, 15000);
    return () => clearInterval(interval);
  }, [loadBadge]);

  function badgeDe(link: Link_) {
    if (link.badgeKey === "whatsapp") return needsAttentionCount || null;
    if (link.badgeKey === "licitacoes") return licitacoesNovas || null;
    if (link.badgeKey === "documentos") return documentosProblema || null;
    if (link.badgeKey === "contratos") return contratosProblema || null;
    return null;
  }

  // Quanto a outra área tem esperando, pra ninguém perder um WhatsApp parado
  // só porque estava com o menu de licitação aberto.
  function pendenciasDaArea(a: Area) {
    let total = 0;
    for (const grupo of AREAS[a].grupos) {
      for (const link of grupo.links) total += badgeDe(link) ?? 0;
    }
    return total;
  }

  function renderLink(link: Link_) {
    // "/painel" é prefixo de todos os outros, então só conta como ativo na
    // correspondência exata.
    const active =
      link.href === "/painel"
        ? pathname === "/painel"
        : pathname.startsWith(link.href);
    const badge = badgeDe(link);
    // Licitação nova é oportunidade, não problema — verde. Conversa parada
    // esperando resposta continua sendo vermelho.
    const badgeCor =
      link.badgeKey === "licitacoes"
        ? "bg-emerald-500 shadow-emerald-900/50"
        : "bg-red-500 shadow-red-900/50";
    return (
      <Link
        key={link.href}
        href={link.href}
        className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-all ${
          active
            ? "brand-gradient text-white shadow-lg shadow-black/30"
            : "text-[#cbb9ba] hover:bg-white/[0.06] hover:text-white"
        }`}
      >
        <svg
          className={`h-[17px] w-[17px] shrink-0 transition-opacity ${
            active ? "opacity-100" : "opacity-70 group-hover:opacity-100"
          }`}
          viewBox={link.preenchido ? "0 0 24 24" : "0 0 20 20"}
          fill={link.preenchido ? "currentColor" : "none"}
          stroke={link.preenchido ? "none" : "currentColor"}
          strokeWidth="1.6"
        >
          {link.icon}
        </svg>
        {link.label}
        {badge !== null && (
          <span
            className={`ml-auto flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-white shadow-sm ${badgeCor}`}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside className="sidebar-gradient flex w-64 shrink-0 flex-col text-[#cbb9ba] shadow-[4px_0_24px_rgba(0,0,0,0.25)]">
      <div className="flex flex-col items-center gap-3 border-b border-white/[0.06] px-6 pb-6 pt-8">
        <div className="rounded-xl bg-white/95 px-4 py-3 shadow-lg shadow-black/30">
          <Image
            src="/logo-embastel.png"
            alt="Embastel Embalagens"
            width={263}
            height={72}
            className="h-auto w-[190px]"
            priority
            unoptimized
          />
        </div>
        <div className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#a4898b]">
          Painel interno
        </div>
      </div>

      <nav className="flex flex-col gap-4 px-3.5 py-4">
        <div className="flex flex-col gap-1">{GERAL.map(renderLink)}</div>

        <div className="flex gap-1.5 rounded-xl bg-black/25 p-1">
          {ORDEM.map((a) => {
            const ativa = a === area;
            const pendentes = pendenciasDaArea(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => escolherArea(a)}
                className={`relative flex-1 rounded-lg px-2 py-1.5 text-[12.5px] font-bold transition-all ${
                  ativa
                    ? "brand-gradient text-white shadow-md shadow-black/30"
                    : "text-[#a4898b] hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {AREAS[a].titulo}
                {!ativa && pendentes > 0 && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                )}
              </button>
            );
          })}
        </div>

        <div className="-mt-2 px-2.5 text-[10.5px] font-medium text-[#8a7778]">
          {AREAS[area].legenda}
        </div>

        {AREAS[area].grupos.map((grupo) => (
          <div key={grupo.label} className="flex flex-col gap-1">
            <div className="px-2.5 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#8a7778]">
              {grupo.label}
            </div>
            {grupo.links.map(renderLink)}
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-white/[0.06] px-6 py-4 text-[11px] leading-relaxed text-[#8a7778]">
        <span className="font-semibold text-[#a4898b]">Embastel Embalagens</span>
        <br />
        Xanxerê/SC · desde 2005
        <button
          onClick={async () => {
            await fetch("/api/login", { method: "DELETE" });
            router.replace("/login");
            // Descarta o que já estava em cache no cliente — sem isso os dados
            // da sessão anterior continuariam na tela até algo recarregar.
            router.refresh();
          }}
          className="mt-2 block text-[11px] font-medium text-[#8a7778] transition-colors hover:text-white"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
