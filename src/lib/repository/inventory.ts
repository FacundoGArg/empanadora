// src/lib/repository/inventory.ts

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";

type TxClient = Prisma.TransactionClient;

function getClient(tx?: TxClient) {
  return tx ?? prisma;
}

export async function findInventoryByProduct(
  productId: string,
  tx?: TxClient,
) {
  return getClient(tx).inventory.findUnique({
    where: { productId },
  });
}

export async function incrementInventory(
  productId: string,
  quantity: number,
  tx?: TxClient,
) {
  if (quantity <= 0) {
    throw new Error("Quantity to increment must be positive.");
  }
  return getClient(tx).inventory.update({
    where: { productId },
    data: {
      quantity: {
        increment: quantity,
      },
    },
  });
}

export async function decrementInventory(
  productId: string,
  quantity: number,
  tx?: TxClient,
) {
  if (quantity <= 0) {
    throw new Error("Quantity to decrement must be positive.");
  }

  const client = getClient(tx);

  const inventory = await client.inventory.findUnique({
    where: { productId },
  });

  if (!inventory) {
    throw new Error("No existe inventario para el producto solicitado.");
  }

  if (inventory.quantity < quantity) {
    throw new Error("Stock insuficiente para el producto solicitado.");
  }

  return client.inventory.update({
    where: { productId },
    data: {
      quantity: {
        decrement: quantity,
      },
    },
  });
}
