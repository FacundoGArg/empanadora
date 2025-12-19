// src/lib/services/conversation-service.ts

import type { UIMessage } from "ai";
import { generateObject } from "ai";
import { z } from "zod";
import { Prisma, ConversationSentiment, ConversationStatus } from "@prisma/client";
import { openai } from "@ai-sdk/openai";

import {
  createConversationRecord,
  updateConversationMessages,
} from "@/lib/repository/conversations";
import { prisma } from "@/lib/db/prisma/client";

type CreateConversationOptions = {
  customerId?: string;
  activeOrderId?: string;
  metadata?: Prisma.JsonValue;
};

export async function createConversation(
  options: CreateConversationOptions = {},
) {
  const data: Prisma.ConversationCreateInput = {};

  if (options.customerId) {
    data.customer = {
      connect: { id: options.customerId },
    };
  }

  if (options.activeOrderId) {
    data.activeOrder = {
      connect: { id: options.activeOrderId },
    };
  }

  if (typeof options.metadata !== "undefined") {
    data.metadata = options.metadata;
  }

  const conversation = await createConversationRecord(data);

  return {
    id: conversation.id,
  };
}

export async function saveConversationMessages(
  conversationId: string,
  messages: UIMessage[],
) {
  await updateConversationMessages(conversationId, messages);
}

const sentimentSchema = z.object({
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
  summary: z
    .string()
    .min(4)
    .max(500)
    .describe("Resumen breve de qué ocurrió en el chat."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Confianza del modelo entre 0 y 1."),
});

type SentimentResult = {
  sentiment: ConversationSentiment;
  summary: string;
  confidence: number | null;
};

type SerializableMessagePart = {
  type?: string;
  text?: unknown;
  toolName?: unknown;
  data?: unknown;
};

function isUIMessage(value: unknown): value is UIMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.role === "string" &&
    Array.isArray(record.parts)
  );
}

function parseUIMessages(value: unknown): UIMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isUIMessage);
}

export async function closeConversation(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      messages: true,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  let sentiment: SentimentResult | null = null;
  const messages = parseUIMessages(conversation.messages);
  if (messages.length) {
    try {
      sentiment = await classifyConversationSentiment(messages);
    } catch (error) {
      console.error(
        "[conversation-service] Failed to classify conversation sentiment",
        { conversationId, error },
      );
    }
  }

  const updateData: Prisma.ConversationUpdateInput = {
    status: ConversationStatus.CLOSED,
  };

  if (sentiment) {
    updateData.sentimentLabel = sentiment.sentiment;
    updateData.sentimentScore = sentiment.confidence ?? null;
    updateData.sentimentSummary = sentiment.summary;
    updateData.sentimentUpdatedAt = new Date();
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: updateData,
    select: {
      id: true,
      status: true,
      sentimentLabel: true,
      sentimentScore: true,
      sentimentSummary: true,
      sentimentUpdatedAt: true,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    sentimentLabel: updated.sentimentLabel,
    sentimentScore: updated.sentimentScore,
    sentimentSummary: updated.sentimentSummary,
    sentimentUpdatedAt: updated.sentimentUpdatedAt?.toISOString() ?? null,
  };
}

async function classifyConversationSentiment(messages: UIMessage[]) {
  const transcript = buildConversationTranscript(messages);
  if (!transcript) {
    return null;
  }

  const response = await generateObject({
    model: openai("gpt-4o-mini"),
    system: `
Eres un supervisor de calidad.
Analiza la conversación entre un asistente virtual y un cliente de un local de empanadas y clasifícala según el sentimiento general del cliente.

- Usa POSITIVE si el cliente quedó conforme o logró su objetivo sin fricciones.
- Usa NEUTRAL si la experiencia fue regular, sin señales claras de satisfacción o insatisfacción.
- Usa NEGATIVE si el cliente quedó insatisfecho, frustrado o no logró resolver lo que necesitaba.

Devuelve únicamente los campos solicitados en el esquema.`,
    prompt: `Transcripción de la conversación (orden cronológico):

${transcript}
`,
    schema: sentimentSchema,
  });

  const result = response.object;
  return {
    sentiment: mapSentimentLabel(result.sentiment),
    summary: result.summary.trim(),
    confidence:
      typeof result.confidence === "number" ? result.confidence : null,
  };
}

function buildConversationTranscript(messages: UIMessage[]) {
  const readable = messages.filter(
    (message) => message.role === "user" || message.role === "assistant",
  );

  if (!readable.length) {
    return "";
  }

  const limited = readable.slice(-30);
  const lines = limited
    .map((message) => {
      const speaker = message.role === "user" ? "Cliente" : "Asistente";
      const text = extractMessageText(message).trim();
      return text ? `[${speaker}] ${text}` : "";
    })
    .filter(Boolean);

  const transcript = lines.join("\n").trim();
  if (transcript.length > 8000) {
    return transcript.slice(transcript.length - 8000);
  }
  return transcript;
}

function extractMessageText(message: UIMessage) {
  const parts = Array.isArray(message.parts)
    ? (message.parts as SerializableMessagePart[])
    : [];
  return parts
    .map((part) => {
      if (part?.type === "text" && typeof part.text === "string") {
        return part.text;
      }
      if (
        part?.type === "tool-invocation" &&
        typeof part.toolName === "string"
      ) {
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
    .filter(Boolean)
    .join("\n");
}

function mapSentimentLabel(label: z.infer<typeof sentimentSchema>["sentiment"]) {
  switch (label) {
    case "POSITIVE":
      return ConversationSentiment.POSITIVE;
    case "NEGATIVE":
      return ConversationSentiment.NEGATIVE;
    default:
      return ConversationSentiment.NEUTRAL;
  }
}
