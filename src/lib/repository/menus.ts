// src/lib/repository/menus.ts

import { prisma } from "@/lib/db/prisma/client";

type FindMenuOptions = {
  menuId?: string;
  includeInactive?: boolean;
};

export async function findMenuWithItems(options: FindMenuOptions = {}) {
  return prisma.menu.findFirst({
    where: {
      ...(options.menuId ? { id: options.menuId } : {}),
      ...(options.menuId && options.includeInactive ? {} : { active: true }),
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        include: {
          product: {
            include: {
              empanada: true,
              beverage: true,
            },
          },
        },
        orderBy: {
          product: {
            name: "asc",
          },
        },
      },
    },
  });
}
