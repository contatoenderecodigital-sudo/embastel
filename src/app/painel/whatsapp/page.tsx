"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { Conversation } from "@/lib/whatsappDb";
import type { Notice } from "@/lib/noticesDb";

export default function WhatsAppPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedWaId, setSelectedWaId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newNumber, setNewNumber] = useState("");

  const [aiAutoReplyEnabled, setAiAutoReplyEnabled] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [newNotice, setNewNotice] = useState("");
  const [showNotices, setShowNotices] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/conversations");
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      // silencioso: próxima atualização tenta de novo
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/settings");
      const data = await res.json();
      setAiAutoReplyEnabled(Boolean(data.aiAutoReplyEnabled));
    } catch {
      // silencioso
    }
  }, []);

  const loadNotices = useCallback(async () => {
    try {
      const res = await fetch("/api/avisos");
      const data = await res.json();
      setNotices(data.notices ?? []);
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    // Polling simples de uma API externa (não é dado derivado de props/estado),
    // então o padrão "fetch no mount + intervalo" é intencional aqui.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConversations();
    loadSettings();
    loadNotices();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [loadConversations, loadSettings, loadNotices]);

  const selected = useMemo(
    () => conversations.find((c) => c.waId === selectedWaId) ?? null,
    [conversations, selectedWaId]
  );

  async function handleSend() {
    const to = selected?.waId ?? newNumber.replace(/\D/g, "");
    if (!to || !draft.trim()) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, text: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar");
      setDraft("");
      setSelectedWaId(to);
      setNewNumber("");
      await loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  async function toggleGlobalAi(enabled: boolean) {
    setAiAutoReplyEnabled(enabled);
    await fetch("/api/whatsapp/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiAutoReplyEnabled: enabled }),
    });
  }

  async function toggleConversationAi(waId: string, enabled: boolean) {
    await fetch(`/api/whatsapp/conversations/${waId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiEnabled: enabled }),
    });
    await loadConversations();
  }

  async function handleAddNotice() {
    if (!newNotice.trim()) return;
    await fetch("/api/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newNotice }),
    });
    setNewNotice("");
    await loadNotices();
  }

  async function handleRemoveNotice(id: string) {
    await fetch(`/api/avisos/${id}`, { method: "DELETE" });
    await loadNotices();
  }

  const needsAttentionCount = conversations.filter((c) => c.needsAttention).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">WhatsApp</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Conversas recebidas pela API oficial do WhatsApp (Meta Cloud API).
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium text-neutral-900">
              IA responde automaticamente
            </p>
            <p className="text-xs text-neutral-500">
              Quando ligada, tenta responder sozinha usando os avisos abaixo; se
              não tiver certeza, marca a conversa como &quot;precisa de você&quot;
              em vez de arriscar.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {needsAttentionCount > 0 && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                {needsAttentionCount} precisando de você
              </span>
            )}
            <button
              onClick={() => toggleGlobalAi(!aiAutoReplyEnabled)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                aiAutoReplyEnabled
                  ? "bg-emerald-600 text-white"
                  : "bg-neutral-200 text-neutral-700"
              }`}
            >
              {aiAutoReplyEnabled ? "Ligada" : "Desligada"}
            </button>
            <button
              onClick={() => setShowNotices((v) => !v)}
              className="text-sm font-medium text-brand hover:underline"
            >
              {showNotices ? "Ocultar avisos" : "Avisos de hoje"}
            </button>
          </div>
        </div>

        {showNotices && (
          <div className="space-y-2 border-t border-neutral-200 p-4">
            <div className="flex gap-2">
              <input
                value={newNotice}
                onChange={(e) => setNewNotice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddNotice();
                }}
                placeholder="Ex: hoje sem estoque de guardanapo, fechamos às 17h..."
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={handleAddNotice}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Adicionar
              </button>
            </div>
            <ul className="space-y-1">
              {notices.length === 0 && (
                <li className="text-xs text-neutral-500">
                  Nenhum aviso cadastrado — a IA vai responder só com o básico
                  (horário, endereço, contato).
                </li>
              )}
              {notices.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-1.5 text-sm text-neutral-700"
                >
                  <span>{n.text}</span>
                  <button
                    onClick={() => handleRemoveNotice(n.id)}
                    className="text-xs text-neutral-400 hover:text-red-600"
                  >
                    remover
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid gap-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm md:grid-cols-[280px_1fr]">
        <div className="border-b border-neutral-200 md:border-b-0 md:border-r">
          <div className="border-b border-neutral-200 p-3">
            <input
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="Novo número (com DDI+DDD)"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <ul className="max-h-[60vh] divide-y divide-neutral-100 overflow-y-auto">
            {conversations.length === 0 && (
              <li className="p-4 text-sm text-neutral-500">
                Nenhuma conversa ainda. Assim que alguém escrever no WhatsApp da
                Embastel, ela aparece aqui.
              </li>
            )}
            {conversations.map((c) => {
              const last = c.messages[c.messages.length - 1];
              return (
                <li key={c.waId}>
                  <button
                    onClick={() => setSelectedWaId(c.waId)}
                    className={`block w-full px-4 py-3 text-left transition-colors ${
                      selectedWaId === c.waId
                        ? "bg-brand-soft"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-neutral-900">
                        {c.name || c.waId}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-400">
                        {new Date(c.lastMessageAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {last && (
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {last.direction === "out" ? "Você: " : ""}
                        {last.text}
                      </p>
                    )}
                    {c.needsAttention && (
                      <span className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                        Precisa de você
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex min-h-[60vh] flex-col">
          {selected?.needsAttention && (
            <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
              A IA não respondeu essa: {selected.needsAttentionReason}
            </div>
          )}
          {selected && (
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 text-xs text-neutral-500">
              <span>
                IA nesta conversa:{" "}
                <strong>
                  {selected.aiEnabled === false ? "pausada" : "ativa"}
                </strong>
              </span>
              <button
                onClick={() =>
                  toggleConversationAi(selected.waId, selected.aiEnabled === false)
                }
                className="font-medium text-brand hover:underline"
              >
                {selected.aiEnabled === false ? "Reativar IA" : "Pausar IA aqui"}
              </button>
            </div>
          )}
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {!selected && !newNumber && (
              <p className="text-sm text-neutral-500">
                Selecione uma conversa ou digite um número novo para começar.
              </p>
            )}
            {selected?.messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.direction === "out" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    m.direction === "out"
                      ? "bg-brand text-white"
                      : "bg-neutral-100 text-neutral-900"
                  }`}
                >
                  {m.origin === "ai" && (
                    <span className="mb-1 inline-block rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-medium">
                      IA
                    </span>
                  )}
                  {m.text}
                  <div
                    className={`mt-1 text-[10px] ${
                      m.direction === "out" ? "text-white/75" : "text-neutral-400"
                    }`}
                  >
                    {new Date(m.timestamp).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 border-t border-neutral-200 p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder="Digite uma mensagem..."
              className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              onClick={handleSend}
              disabled={sending || (!selected && !newNumber)}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
