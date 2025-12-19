// src/lib/repository/promotions.ts

import { prisma } from "@/lib/db/prisma/client";

type FindPromotionsOptions = {
  menuId?: string;
  includeInactive?: boolean;
};

export async function findPromotions(options: FindPromotionsOptions = {}) {
  return prisma.promotion.findMany({
    where: {
      ...(options.menuId ? { menuId: options.menuId } : {}),
      ...(options.includeInactive ? {} : { active: true }),
    },
    include: {
      requirements: true,
      menu: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });
}
