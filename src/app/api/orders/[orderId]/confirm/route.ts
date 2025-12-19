import { NextRequest, NextResponse } from "next/server";

import { markOrderAsConfirmed } from "@/lib/services/order-service";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function POST(_: NextRequest, context: RouteContext) {
  const { orderId } = await context.params;

  try {
    const order = await markOrderAsConfirmed(orderId);
    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to confirm order", error);
    const message =
      error instanceof Error ? error.message : "Unable to confirm order";
    const isValidationError =
      error instanceof Error &&
      /No hay productos|Necesitamos|Debes/i.test(error.message);
    const status =
      error instanceof Error && error.message === "Order not found."
        ? 404
        : isValidationError
          ? 400
          : 500;
    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
