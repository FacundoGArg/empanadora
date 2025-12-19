// src/lib/repository/payments.ts

import { PaymentMethod, PaymentStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";

type PaymentUpsertInput = {
  orderId: string;
  amount: number;
  currency?: string;
  status?: PaymentStatus;
  method: PaymentMethod;
};

export async function findPaymentByOrder(orderId: string) {
  return prisma.payment.findUnique({
    where: { orderId },
  });
}

export async function upsertPayment(input: PaymentUpsertInput) {
  return prisma.payment.upsert({
    where: { orderId: input.orderId },
    update: {
      amount: input.amount,
      currency: input.currency,
      status: input.status,
      method: input.method,
    },
    create: {
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency ?? "ARS",
      status: input.status ?? PaymentStatus.PENDING,
      method: input.method,
    },
  });
}

export async function updatePaymentStatus(
  orderId: string,
  status: PaymentStatus,
) {
  return prisma.payment.update({
    where: { orderId },
    data: { status },
  });
}

export async function updatePaymentAmount(
  orderId: string,
  amount: number,
  currency?: string,
) {
  return prisma.payment.update({
    where: { orderId },
    data: {
      amount,
      currency,
    },
  });
}
