// src/lib/repository/shipping.ts

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";

type ShippingUpsertInput = {
  orderId: string;
  type: "DELIVERY" | "PICKUP";
  addressSnapshot?: Prisma.JsonValue | null;
  addressDescription?: string | null;
  pickupLocation?: string | null;
  fee?: number;
  eta?: Date | null;
};

export async function findShippingByOrder(orderId: string) {
  return prisma.shipping.findUnique({
    where: { orderId },
  });
}

export async function upsertShipping(input: ShippingUpsertInput) {
  return prisma.shipping.upsert({
    where: { orderId: input.orderId },
    update: {
      type: input.type,
      addressSnapshot: input.addressSnapshot ?? undefined,
      addressDescription: input.addressDescription ?? undefined,
      pickupLocation: input.pickupLocation ?? undefined,
      fee: typeof input.fee === "number" ? input.fee : undefined,
      eta: input.eta ?? undefined,
    },
    create: {
      orderId: input.orderId,
      type: input.type,
      addressSnapshot: input.addressSnapshot,
      addressDescription: input.addressDescription,
      pickupLocation: input.pickupLocation,
      fee: input.fee ?? 0,
      eta: input.eta,
    },
  });
}

export async function deleteShipping(orderId: string) {
  return prisma.shipping.delete({
    where: { orderId },
  });
}
