import { NextRequest, NextResponse } from "next/server";

import { addOrUpdateItem, removeItem } from "@/lib/services/order-service";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  const { orderId } = await context.params;

  try {
    const body = await req.json();
    const { productId, quantity, unitPrice, productSnapshot } = body ?? {};

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 },
      );
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "quantity must be a positive integer" },
        { status: 400 },
      );
    }

    if (typeof unitPrice !== "number" || unitPrice <= 0) {
      return NextResponse.json(
        { error: "unitPrice must be a positive number" },
        { status: 400 },
      );
    }

    const order = await addOrUpdateItem({
      orderId,
      productId,
      quantity,
      unitPrice,
      productSnapshot,
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to add/update item", error);
    return NextResponse.json(
      { error: "Unable to add or update item" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { orderId } = await context.params;

  try {
    const body = await req.json();
    const { orderItemId } = body ?? {};

    if (!orderItemId || typeof orderItemId !== "string") {
      return NextResponse.json(
        { error: "orderItemId is required" },
        { status: 400 },
      );
    }

    const order = await removeItem(orderId, orderItemId);

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to remove item", error);
    return NextResponse.json(
      { error: "Unable to remove item" },
      { status: 500 },
    );
  }
}
