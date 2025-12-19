"use client";

import type { UIMessage } from "ai";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { MessageResponse } from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ReaderConversation = {
  id: string;
  updatedAt: string;
  status: string;
  customerName: string | null;
  sentimentLabel: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
  sentimentSummary: string | null;
  sentimentScore: number | null;
  sentimentUpdatedAt: string | null;
  messages: UIMessage[];
};

type ChatReaderProps = {
  conversations: ReaderConversation[];
};

type CloseConversationResponse = {
  id: string;
  status: string;
  sentimentLabel?: ReaderConversation["sentimentLabel"];
  sentimentSummary?: ReaderConversation["sentimentSummary"];
  sentimentScore?: ReaderConversation["sentimentScore"];
  sentimentUpdatedAt?: ReaderConversation["sentimentUpdatedAt"];
};

type ReaderMessagePart = {
  type?: string;
  text?: unknown;
  toolName?: unknown;
  data?: unknown;
};

const SENTIMENT_DISPLAY: Record<
  NonNullable<ReaderConversation["sentimentLabel"]>,
  { label: string; className: string }
> = {
  POSITIVE: {
    label: "Salió bien",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  NEUTRAL: {
    label: "Regular",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  NEGATIVE: {
    label: "Salió mal",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

export function ChatReader({ conversations }: ChatReaderProps) {
  const [conversationList, setConversationList] =
    useState<ReaderConversation[]>(conversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversations[0]?.id ?? null,
  );
  const [closingConversationId, setClosingConversationId] = useState<string | null>(null);
  const [batchClosing, setBatchClosing] = useState(false);
  const [actionError, setActionError] = useState<{
    conversationId: string;
    message: string;
  } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  useEffect(() => {
    setConversationList(conversations);
  }, [conversations]);

  useEffect(() => {
    if (
      conversationList.length > 0 &&
      (!activeConversationId ||
        !conversationList.some((conversation) => conversation.id === activeConversationId))
    ) {
      setActiveConversationId(conversationList[0]?.id ?? null);
    }
  }, [conversationList, activeConversationId]);

  const activeConversation = useMemo(
    () =>
      conversationList.find(
        (conversation) => conversation.id === activeConversationId,
      ) ?? null,
    [conversationList, activeConversationId],
  );

  const openConversations = useMemo(
    () => conversationList.filter((conversation) => conversation.status !== "CLOSED"),
    [conversationList],
  );
  const hasOpenConversations = openConversations.length > 0;

  const readableMessages = activeConversation
    ? activeConversation.messages.filter(
        (message) => message.role === "user" || message.role === "assistant",
      )
    : [];

  const applyCloseResult = useCallback(
    (conversationId: string, data: CloseConversationResponse) => {
      setConversationList((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                status: data.status,
                sentimentLabel: data.sentimentLabel ?? null,
                sentimentSummary: data.sentimentSummary ?? null,
                sentimentScore: data.sentimentScore ?? null,
                sentimentUpdatedAt: data.sentimentUpdatedAt ?? null,
              }
            : conversation,
        ),
      );
    },
    [],
  );

  const closeConversationRequest = useCallback(async (conversationId: string) => {
    const response = await fetch(`/api/conversations/${conversationId}/close`, {
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as
      | CloseConversationResponse
      | { error?: string | null }
      | null;
    if (!response.ok) {
      const message =
        (payload as { error?: string | null } | null)?.error ??
        "No pudimos cerrar la conversación. Intenta nuevamente.";
      throw new Error(message);
    }
    return payload as CloseConversationResponse;
  }, []);

  const handleCloseConversation = useCallback(
    async (conversationId: string) => {
      setBatchError(null);
      setActionError(null);
      setClosingConversationId(conversationId);
      try {
        const data = await closeConversationRequest(conversationId);
        applyCloseResult(conversationId, data);
      } catch (error) {
        setActionError({
          conversationId,
          message:
            error instanceof Error
              ? error.message
              : "No pudimos cerrar la conversación. Intenta nuevamente.",
        });
      } finally {
        setClosingConversationId(null);
      }
    },
    [applyCloseResult, closeConversationRequest],
  );

  const handleBatchClose = useCallback(async () => {
    if (!openConversations.length) {
      return;
    }
    setBatchError(null);
    setActionError(null);
    setBatchClosing(true);
    const failures: string[] = [];
    for (const conversation of openConversations) {
      try {
        const data = await closeConversationRequest(conversation.id);
        applyCloseResult(conversation.id, data);
      } catch (error) {
        const label = conversation.customerName ?? conversation.id;
        const message =
          error instanceof Error
            ? error.message
            : "No pudimos cerrar la conversación. Intenta nuevamente.";
        failures.push(`${label}: ${message}`);
      }
    }

    if (failures.length) {
      setBatchError(
        failures.length === 1
          ? failures[0]
          : `${failures.length} conversaciones no pudieron clasificarse. Intenta nuevamente.`,
      );
    }
    setBatchClosing(false);
  }, [applyCloseResult, closeConversationRequest, openConversations]);

  const activeSentiment = getSentimentDisplay(
    activeConversation?.sentimentLabel ?? null,
  );
  const isClosingActiveConversation =
    activeConversation &&
    closingConversationId === activeConversation.id;
  const closeErrorMessage =
    actionError &&
    activeConversation &&
    actionError.conversationId === activeConversation.id
      ? actionError.message
      : null;
  const sentimentTimestamp =
    activeConversation?.sentimentUpdatedAt
      ? formatDistanceToNow(new Date(activeConversation.sentimentUpdatedAt), {
          addSuffix: true,
          locale: es,
        })
      : null;

  return (
    <div className="flex h-[calc(100vh-64px)] border-t border-amber-100 bg-[#fffaf0]/40">
      <aside className="hidden w-80 shrink-0 flex-col border-r border-amber-100 bg-white/80 md:flex">
        <div className="px-4 py-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                  Conversaciones
                </p>
                <p className="text-xs text-gray-500">
                  Selecciona un chat para revisar el historial.
                </p>
              </div>
              {hasOpenConversations ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBatchClose}
                  disabled={batchClosing}
                >
                  {batchClosing && <Loader2 className="mr-2 size-3 animate-spin" />}
                  Clasificar abiertas
                </Button>
              ) : null}
            </div>
            {batchError ? (
              <p className="text-[11px] text-red-600">{batchError}</p>
            ) : null}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {conversationList.length === 0 ? (
            <p className="px-1 text-sm text-gray-500">
              Todavía no hay conversaciones almacenadas.
            </p>
          ) : (
            <div className="space-y-2">
              {conversationList.map((conversation) => {
                const preview = getLastMessagePreview(conversation.messages);
                const timestamp = formatDistanceToNow(
                  new Date(conversation.updatedAt),
                  {
                    addSuffix: true,
                    locale: es,
                  },
                );
                const isActive = conversation.id === activeConversationId;
                const sentimentPresentation = getSentimentDisplay(
                  conversation.sentimentLabel,
                );

                return (
                  <button
                    key={conversation.id}
                    onClick={() => setActiveConversationId(conversation.id)}
                    className={cn(
                      "cursor-pointer w-full rounded-xl border px-3 py-2 text-left text-sm shadow-sm transition",
                      isActive
                        ? "border-amber-500 bg-amber-50/80"
                        : "border-transparent bg-white hover:border-amber-200",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">{timestamp}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px]",
                          conversation.status === "CLOSED"
                            ? "border-amber-300 text-amber-700"
                            : "border-lime-300 text-lime-700",
                        )}
                      >
                        {conversation.status === "CLOSED" ? "Cerrado" : "Abierto"}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {sentimentPresentation ? (
                        <Badge
                          className={cn(
                            "text-[11px]",
                            sentimentPresentation.className,
                          )}
                        >
                          {sentimentPresentation.label}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[11px] border-dashed border-gray-200 text-gray-500"
                        >
                          Sin análisis
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                      {preview}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1">
        {activeConversation ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-amber-100 bg-white/70 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      activeConversation.status === "CLOSED"
                        ? "border-amber-300 text-amber-700"
                        : "border-lime-300 text-lime-700",
                    )}
                  >
                    {activeConversation.status === "CLOSED"
                      ? "Conversación cerrada"
                      : "Conversación abierta"}
                  </Badge>
                  {activeSentiment ? (
                    <Badge
                      className={cn(
                        "text-xs",
                        activeSentiment.className,
                      )}
                    >
                      {activeSentiment.label}
                    </Badge>
                  ) : null}
                </div>
                {activeConversation.status === "CLOSED" ? (
                  <p className="text-xs text-gray-500">
                    {sentimentTimestamp
                      ? `Último análisis ${sentimentTimestamp}.`
                      : "Cerrado sin análisis disponible."}
                  </p>
                ) : (
                  <Button
                    type="button"
                    onClick={() => handleCloseConversation(activeConversation.id)}
                    disabled={Boolean(closingConversationId)}
                  >
                    {isClosingActiveConversation && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Cerrar y clasificar
                  </Button>
                )}
              </div>
              {closeErrorMessage ? (
                <p className="mt-2 text-xs text-red-600">{closeErrorMessage}</p>
              ) : null}
              {activeConversation.sentimentSummary ? (
                <p className="mt-3 text-sm text-gray-700">
                  {activeConversation.sentimentSummary}
                </p>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  {activeConversation.status === "CLOSED"
                    ? "Esta conversación ya se cerró pero aún no tiene una clasificación disponible."
                    : "Cierra la conversación para que el agente de calidad la analice y la clasifique como bien, regular o mal."}
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {readableMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  Aún no hay mensajes para esta conversación.
                </div>
              ) : (
                <div className="space-y-4">
                  {readableMessages.map((message) => {
                    const isAssistant = message.role === "assistant";
                    const text = getMessageText(message);
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex w-full",
                          isAssistant ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-xl rounded-2xl border px-4 py-3 text-sm shadow-sm",
                            isAssistant
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : "border-gray-200 bg-white text-gray-900",
                          )}
                        >
                          <MessageResponse className="text-sm">
                            {text}
                          </MessageResponse>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center bg-white/60 text-sm text-gray-500">
            Selecciona una conversación para comenzar.
          </div>
        )}
      </main>
    </div>
  );
}

function getSentimentDisplay(
  sentiment: ReaderConversation["sentimentLabel"],
) {
  if (!sentiment) {
    return null;
  }
  return SENTIMENT_DISPLAY[sentiment] ?? null;
}

function getLastMessagePreview(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user" || message.role === "assistant") {
      const text = getMessageText(message);
      if (text) {
        return text;
      }
    }
  }
  return "Sin mensajes todavía.";
}

function getMessageText(message: UIMessage) {
  const parts = Array.isArray(message.parts)
    ? (message.parts as ReaderMessagePart[])
    : [];
  const lines = parts
    .map((part) => {
      if (part?.type === "text" && typeof part.text === "string") {
        return part.text;
      }
      if (part?.type === "tool-invocation" && typeof part.toolName === "string") {
        return `[Tool: ${part.toolName}]`;
      }
      if (part?.type === "data" && typeof part.data !== "undefined") {
        try {
          return JSON.stringify(part.data);
        } catch {
          return "";
        }
      }
      return "";
    })
    .filter(Boolean);

  return lines.join("\n") || "";
}
