"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Task } from "@/lib/tasksDb";
import type { Conversation } from "@/lib/whatsappDb";
import type { ProdutoEstoque } from "@/lib/estoqueDb";
import type { Pedido } from "@/lib/pedidosDb";
import type { Romaneio } from "@/lib/romaneiosDb";
import { COR_WHATSAPP, IconeWhatsApp, PATH_WHATSAPP } from "@/components/icones";
import AvisoPublicar from "@/components/AvisoPublicar";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

type ResumoLicitacoes = {
  abertasNoPerfil: number;
  novas24h: number;
  fechandoEmSeteDias: number;
  valorNoFunil: number;
  quantidadeNoFunil: number;
  funilUrgente: number;
  valorGanho: number;
  quantidadeGanha: number;
  indiceAtualizadoEm: number | null;
  totalNoIndice: number;
  coletaRodando: boolean;
  proximas: Array<{
    numeroControlePNCP: string;
    orgao: string;
    municipio: string;
    uf: string;
    objeto: string;
    valorEstimado: number | null;
    dataEncerramentoProposta: string | null;
    distanceKm?: number;
  }>;
};

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Mesmo cuidado do módulo de licitações: prazo vencido devolve -1, porque
// Math.ceil de fração negativa devolve -0 e faria um prazo de ontem aparecer
// como "hoje".
function diasAte(dataISO: string | null): number | null {
  if (!dataISO) return null;
  const restante = new Date(dataISO).getTime() - Date.now();
  if (Number.isNaN(restante)) return null;
  if (restante < 0) return -1;
  return Math.ceil(restante / 86400000);
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [romaneios, setRomaneios] = useState<Romaneio[]>([]);
  const [licitacoes, setLicitacoes] = useState<ResumoLicitacoes | null>(null);
  const [comissoes, setComissoes] = useState<{ aPagar: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [tasksRes, convRes, licRes, estoqueRes, pedidosRes, romaneiosRes, comRes] =
        await Promise.all([
          fetch("/api/tarefas"),
          fetch("/api/whatsapp/conversations"),
          fetch("/api/licitacoes/resumo"),
          fetch("/api/estoque"),
          fetch("/api/pedidos"),
          fetch("/api/romaneios"),
          fetch("/api/comissoes"),
        ]);
      setTasks((await tasksRes.json()).tasks ?? []);
      setConversations((await convRes.json()).conversations ?? []);
      setLicitacoes(await licRes.json());
      setProdutos((await estoqueRes.json()).produtos ?? []);
      setPedidos((await pedidosRes.json()).pedidos ?? []);
      setRomaneios((await romaneiosRes.json()).romaneios ?? []);
      setComissoes(await comRes.json());
    } catch {
      // silencioso: próxima atualização tenta de novo
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const pendingTasks = tasks.filter((t) => !t.done);
  const highCount = pendingTasks.filter((t) => t.priority === "alta").length;
  const needsAttention = conversations.filter((c) => c.needsAttention);
  const emFalta = produtos.filter((p) => p.situacao === "falta").length;
  const estoqueBaixo = produtos.filter((p) => p.situacao === "baixo").length;
  const pendentesEstoque = emFalta + estoqueBaixo;

  const pedidosPendentes = pedidos.filter((p) => p.status === "pendente");
  const totalPedidosPendentes = pedidosPendentes.reduce((s, p) => s + p.valorTotal, 0);

  const romaneioHoje = romaneios.find((r) => r.data === hojeISO());
  const totalRomaneioHoje = romaneioHoje?.itens.reduce((s, i) => s + i.valor, 0) ?? 0;
  const entreguesHoje = romaneioHoje?.itens.filter((i) => i.entregue).length ?? 0;

  const comissaoAPagar = comissoes?.aPagar ?? 0;

  const modules = [
    {
      href: "/painel/tarefas",
      title: "Tarefas",
      description: "O que fazer, organizado por prioridade.",
      stat: `${pendingTasks.length} pendente(s)`,
      icon: <path d="M4 5.5h12M4 10h12M4 14.5h7" />,
    },
    {
      href: "/painel/whatsapp",
      title: "WhatsApp",
      description: "Conversas da loja, com IA respondendo o básico sozinha.",
      stat:
        needsAttention.length > 0
          ? `${needsAttention.length} precisando de você`
          : "tudo em dia",
      icon: PATH_WHATSAPP,
      preenchido: true,
    },
    {
      href: "/painel/estoque",
      title: "Estoque",
      description: "O que está em falta ou baixo, por fornecedor.",
      stat: pendentesEstoque > 0 ? `${pendentesEstoque} pra pedir` : "tudo em estoque",
      icon: <path d="M3 6.5l7-3.5 7 3.5v7L10 17l-7-3.5v-7zM3 6.5L10 10m0 0l7-3.5M10 10v7" />,
    },
    {
      href: "/painel/pedidos",
      title: "Pedidos",
      description:
        pedidosPendentes.length > 0
          ? `Somando ${currency.format(totalPedidosPendentes)} em aberto.`
          : "Pedidos anotados na rota, com itens e valor.",
      stat:
        pedidosPendentes.length > 0
          ? `${pedidosPendentes.length} em aberto`
          : "tudo entregue",
      icon: <path d="M6 3h8l2 3v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6l2-3zM4 6h12M8 9v1a2 2 0 0 0 4 0V9" />,
    },
    {
      href: "/painel/romaneio",
      title: "Romaneio",
      description: romaneioHoje
        ? `Hoje: ${entreguesHoje}/${romaneioHoje.itens.length} entregue(s).`
        : "Nenhum romaneio criado pra hoje ainda.",
      stat: romaneioHoje ? currency.format(totalRomaneioHoje) : "criar hoje",
      icon: <path d="M5 3h10a1 1 0 0 1 1 1v13l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zM7 7h6M7 10h6M7 13h3" />,
    },
    {
      href: "/painel/comissoes",
      title: "Comissões",
      description:
        comissaoAPagar > 0
          ? "Valor acumulado que ainda falta acertar com a Ketlyn."
          : "5% da Ketlyn sobre o vendido — tudo quitado por enquanto.",
      stat: currency.format(comissaoAPagar),
      icon: <path d="M10 2v16M14 5.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5S7.8 8 10 8s4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5" />,
    },
  ];

  const alerts = [
    (licitacoes?.funilUrgente ?? 0) > 0 && {
      href: "/painel/licitacoes",
      iconBg: "bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600",
      icon: "⏱",
      title: `${licitacoes!.funilUrgente} proposta(s) fechando em até 3 dias`,
      desc: "Está no seu funil e o prazo está em cima.",
    },
    (licitacoes?.novas24h ?? 0) > 0 && {
      href: "/painel/licitacoes",
      iconBg: "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600",
      icon: "★",
      title: `${licitacoes!.novas24h} licitação(ões) nova(s) pro seu perfil`,
      desc: "Apareceram no PNCP nas últimas 24 horas.",
    },
    needsAttention.length > 0 && {
      href: "/painel/whatsapp",
      // Verde do WhatsApp: quem bate o olho já sabe de onde vem o aviso.
      iconBg: COR_WHATSAPP,
      icon: <IconeWhatsApp className="h-[17px] w-[17px]" />,
      title: `${needsAttention.length} conversa(s) esperando você`,
      desc: "A IA não teve certeza — dê uma olhada quando puder.",
    },
    emFalta > 0 && {
      href: "/painel/estoque",
      iconBg: "bg-gradient-to-br from-rose-50 to-rose-100 text-rose-600",
      icon: "!",
      title: `${emFalta} produto(s) em falta`,
      desc: "Confira antes de fechar o próximo pedido.",
    },
    highCount > 0 && {
      href: "/painel/tarefas",
      iconBg: "bg-gradient-to-br from-neutral-100 to-neutral-200 text-neutral-600",
      icon: "✓",
      title: `${highCount} tarefa(s) de alta prioridade`,
      desc: "Confira o que está no topo da lista.",
    },
  ].filter(Boolean) as Array<{
    href: string;
    iconBg: string;
    icon: React.ReactNode;
    title: string;
    desc: string;
  }>;

  return (
    <div className="space-y-7">
      <AvisoPublicar />

      <div>
        <h1 className="brand-gradient-text text-[28px] font-extrabold tracking-tight">
          Painel Embastel Embalagens
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          {licitacoes
            ? `${licitacoes.totalNoIndice.toLocaleString("pt-BR")} licitações vigiadas no PNCP · ${pendingTasks.length} tarefa(s) pendente(s)`
            : "Carregando..."}
        </p>
      </div>

      {/* --------------------------------------------------- bloco licitações */}
      <div className="sidebar-gradient overflow-hidden rounded-2xl p-6 text-white shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#a4898b]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                licitacoes?.coletaRodando
                  ? "animate-pulse bg-amber-400 shadow-[0_0_6px_2px] shadow-amber-400/50"
                  : "bg-emerald-400 shadow-[0_0_6px_2px] shadow-emerald-400/50"
              }`}
            />
            Licitações — o motor do negócio
          </div>
          <Link
            href="/painel/licitacoes"
            className="rounded-lg bg-white/10 px-3 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-white/20"
          >
            Abrir módulo →
          </Link>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              valor: licitacoes ? String(licitacoes.abertasNoPerfil) : "—",
              rotulo: "abertas no seu perfil",
              destaque:
                (licitacoes?.novas24h ?? 0) > 0
                  ? `${licitacoes!.novas24h} nova(s) hoje`
                  : null,
            },
            {
              valor: licitacoes ? String(licitacoes.fechandoEmSeteDias) : "—",
              rotulo: "fecham em até 7 dias",
              destaque: null,
            },
            {
              valor: licitacoes ? compact.format(licitacoes.valorNoFunil) : "—",
              rotulo: "em jogo no seu funil",
              destaque: licitacoes
                ? `${licitacoes.quantidadeNoFunil} acompanhada(s)`
                : null,
            },
            {
              valor: licitacoes ? compact.format(licitacoes.valorGanho) : "—",
              rotulo: "já ganho",
              destaque: licitacoes
                ? `${licitacoes.quantidadeGanha} vitória(s)`
                : null,
            },
          ].map((stat) => (
            <div key={stat.rotulo}>
              <div className="text-[30px] font-extrabold leading-none tracking-tight text-white">
                {stat.valor}
              </div>
              <div className="mt-1.5 text-[12px] text-[#cbb9ba]">{stat.rotulo}</div>
              {stat.destaque && (
                <div className="mt-1 text-[11px] font-semibold text-emerald-300">
                  {stat.destaque}
                </div>
              )}
            </div>
          ))}
        </div>

        {licitacoes && licitacoes.proximas.length > 0 && (
          <div className="mt-6 border-t border-white/[0.08] pt-4">
            <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#8a7778]">
              Fechando primeiro
            </div>
            <div className="space-y-1.5">
              {licitacoes.proximas.map((item) => {
                const dias = diasAte(item.dataEncerramentoProposta);
                return (
                  <Link
                    key={item.numeroControlePNCP}
                    href="/painel/licitacoes"
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.06]"
                  >
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-bold ${
                        dias !== null && dias <= 2
                          ? "bg-red-500/20 text-red-300"
                          : "bg-white/10 text-[#cbb9ba]"
                      }`}
                    >
                      {dias === 0 ? "hoje" : `${dias}d`}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-white">
                        {item.orgao}
                      </span>
                      <span className="block truncate text-[11px] text-[#a4898b]">
                        {item.municipio}/{item.uf}
                        {item.distanceKm != null && ` · ${item.distanceKm} km`} ·{" "}
                        {item.objeto}
                      </span>
                    </span>
                    {item.valorEstimado != null && item.valorEstimado > 0 && (
                      <span className="shrink-0 text-[11.5px] font-semibold text-emerald-300">
                        {compact.format(item.valorEstimado)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {licitacoes && licitacoes.totalNoIndice === 0 && (
          <p className="mt-5 rounded-lg bg-white/[0.06] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#cbb9ba]">
            O índice do PNCP ainda não foi montado.{" "}
            <Link href="/painel/licitacoes" className="font-semibold text-white underline">
              Abra as licitações
            </Link>{" "}
            e clique em &quot;Atualizar agora&quot; pra rodar a primeira coleta.
          </p>
        )}
      </div>

      {/* --------------------------------------------------------- alertas */}
      {alerts.length > 0 ? (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {alerts.map((alert) => (
            <Link
              key={alert.href + alert.title}
              href={alert.href}
              className="flex gap-3.5 rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-neutral-200/60"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold ${alert.iconBg}`}
              >
                {alert.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold text-neutral-900">
                  {alert.title}
                </span>
                <span className="mt-0.5 block text-xs text-neutral-500">{alert.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-neutral-700">
            Tudo em dia — nenhum prazo apertado, conversa esperando, produto em falta
            ou tarefa urgente.
          </p>
        </div>
      )}

      {/* --------------------------------------------------------- módulos */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="group rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/[0.08]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md shadow-brand/20">
                <svg
                  className="h-[18px] w-[18px]"
                  viewBox={mod.preenchido ? "0 0 24 24" : "0 0 20 20"}
                  fill={mod.preenchido ? "currentColor" : "none"}
                  stroke={mod.preenchido ? "none" : "currentColor"}
                  strokeWidth="1.6"
                >
                  {mod.icon}
                </svg>
              </span>
              <span className="whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600 transition-colors group-hover:bg-brand-soft group-hover:text-brand-dark">
                {mod.stat}
              </span>
            </div>
            <h2 className="mt-3 text-[15px] font-semibold text-neutral-900">{mod.title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">
              {mod.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
