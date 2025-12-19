import { unstable_noStore as noStore } from "next/cache";
import type { UIMessage } from "ai";

import { prisma } from "@/lib/db/prisma/client";
import { ChatReader } from "@/components/chat/chat-reader";

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

export default async function ChatPage() {
  noStore();

  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      customer: true,
    },
  });

  const serialized = conversations.map(
    (conversation: typeof conversations[number]) => ({
    id: conversation.id,
    status: conversation.status,
    updatedAt: conversation.updatedAt.toISOString(),
    sentimentLabel: conversation.sentimentLabel,
    sentimentSummary: conversation.sentimentSummary,
    sentimentScore: conversation.sentimentScore,
    sentimentUpdatedAt:
      conversation.sentimentUpdatedAt?.toISOString() ?? null,
    customerName:
      conversation.customer?.firstName ??
      conversation.customer?.lastName ??
      null,
    messages: parseUIMessages(conversation.messages),
    }),
  );

  return (
    <div className="bg-[#fffaf0]/60">
      <ChatReader conversations={serialized} />
    </div>
  );
}
