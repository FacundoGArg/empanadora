import { NextResponse } from "next/server";

import { getOrCreateActiveCart } from "@/lib/services/order-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { conversationId, menuId, currency } = body ?? {};

    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 },
      );
    }

    const order = await getOrCreateActiveCart(conversationId, {
      menuId,
      currency,
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to retrieve active order", error);
    return NextResponse.json(
      { error: "Unable to retrieve active order" },
      { status: 500 },
    );
  }
}
