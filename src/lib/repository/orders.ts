// src/lib/repository/orders.ts

import type { Prisma } from "@prisma/client";
import { OrderStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";

type OrderFetchOptions = {
  include?: Prisma.OrderInclude;
};

export async function findOrderById(
  id: string,
  options: OrderFetchOptions = {},
) {
  return prisma.order.findUnique({
    where: { id },
    include: options.include,
  });
}

export async function findActiveOrderByConversation(
  conversationId: string,
  options: OrderFetchOptions = {},
) {
  return prisma.order.findFirst({
    where: {
      conversationId,
      status: OrderStatus.CART,
    },
    orderBy: { createdAt: "desc" },
    include: options.include,
  });
}

export async function createOrder(data: Prisma.OrderCreateInput) {
  return prisma.order.create({ data });
}

export async function updateOrder(
  orderId: string,
  data: Prisma.OrderUpdateInput,
) {
  return prisma.order.update({
    where: { id: orderId },
    data,
  });
}

type OrderTotalsUpdate = {
  currency?: string;
  subtotalAmount?: number;
  discountAmount?: number;
  deliveryFee?: number;
  totalAmount?: number;
};

export async function updateOrderTotals(
  orderId: string,
  totals: OrderTotalsUpdate,
) {
  return prisma.order.update({
    where: { id: orderId },
    data: totals,
  });
}

export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
) {
  return prisma.order.update({
    where: { id: orderId },
    data: { status },
  });
}
