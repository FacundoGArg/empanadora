import { NextResponse } from "next/server";

import { closeConversation } from "@/lib/services/conversation-service";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 },
    );
  }

  try {
    const result = await closeConversation(conversationId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to close conversation", error);
    const message =
      error instanceof Error ? error.message : "Unable to close conversation";
    const status = message === "Conversation not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
