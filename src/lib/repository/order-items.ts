// src/lib/repository/order-items.ts

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";

type UpsertOrderItemInput = {
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productSnapshot?: Prisma.JsonValue | null;
};

export async function findOrderItems(orderId: string) {
  return prisma.orderItem.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        include: {
          empanada: true,
          beverage: true,
        },
      },
    },
  });
}

export async function upsertOrderItem(input: UpsertOrderItemInput) {
  const existing = await prisma.orderItem.findFirst({
    where: {
      orderId: input.orderId,
      productId: input.productId,
    },
  });

  if (existing) {
    return prisma.orderItem.update({
      where: { id: existing.id },
      data: {
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        totalPrice: input.totalPrice,
        productSnapshot: input.productSnapshot ?? existing.productSnapshot,
      },
    });
  }

  return prisma.orderItem.create({
    data: {
      orderId: input.orderId,
      productId: input.productId,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      totalPrice: input.totalPrice,
      productSnapshot: input.productSnapshot,
    },
  });
}

export async function removeOrderItem(orderItemId: string) {
  return prisma.orderItem.delete({
    where: { id: orderItemId },
  });
}

export async function removeOrderItemsByOrder(orderId: string) {
  return prisma.orderItem.deleteMany({
    where: { orderId },
  });
}
