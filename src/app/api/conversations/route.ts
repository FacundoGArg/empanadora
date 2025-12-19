import { NextResponse } from "next/server";

import { createConversation } from "@/lib/services/conversation-service";

export async function POST() {
  try {
    const conversation = await createConversation();

    return NextResponse.json({ id: conversation.id });
  } catch (error) {
    console.error("Failed to create conversation", error);
    return NextResponse.json(
      { error: "Unable to create conversation" },
      { status: 500 },
    );
  }
}
