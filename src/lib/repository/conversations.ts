// src/lib/repository/conversations.ts

import type { UIMessage } from "ai";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";

export async function createConversationRecord(
  data: Prisma.ConversationCreateInput = {},
) {
  return prisma.conversation.create({ data });
}

export async function updateConversationMessages(
  conversationId: string,
  messages: UIMessage[],
) {
  const sanitizedMessages = JSON.parse(
    JSON.stringify(messages),
  ) as Prisma.InputJsonValue[];

  return prisma.conversation.update({
    where: { id: conversationId },
    data: {
      messages: sanitizedMessages,
    },
  });
}
