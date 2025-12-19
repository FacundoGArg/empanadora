import { tool } from "ai";
import { z } from "zod";
import {
  BeverageCategory,
  EmpanadaCategory,
  OrderStatus,
  ProductType,
  PromotionType,
} from "@prisma/client";

import { getPromotions } from "@/lib/services/promotion-service";
import { prisma } from "@/lib/db/prisma/client";

export const getActivePromotions = tool({
  description:
    "Devuelve las promociones disponibles, incluyendo tipo, precios y requisitos.",
  inputSchema: z.object({
    menuId: z
      .string()
      .optional()
      .describe(
        "Filtra las promos por un menú específico. Si se omite, se devuelven todas.",
      ),
    includeInactive: z
      .boolean()
      .optional()
      .describe("Incluir o no promociones inactivas. Por defecto solo activas."),
  }),
  execute: ({ menuId, includeInactive }) =>
    getPromotions({ menuId, includeInactive }),
});

const requestedItemSchema = z
  .object({
    productId: z.string().optional(),
    label: z.string().optional(),
    productType: z.nativeEnum(ProductType).optional(),
    quantity: z.number().int().min(1),
    empanadaCategory: z.nativeEnum(EmpanadaCategory).optional(),
    beverageCategory: z.nativeEnum(BeverageCategory).optional(),
  })
  .refine(
    (item) => Boolean(item.productId || item.productType),
    "Debes proveer un productId o un productType para cada ítem solicitado.",
  );

export const considerApplyingPromo = tool({
  description:
    "Evalúa si hay promociones aplicables considerando el carrito actual y los productos que el cliente está solicitando.",
  inputSchema: z.object({
    conversationId: z
      .string()
      .optional()
      .describe(
        "Identificador de la conversación para tomar el carrito activo como referencia.",
      ),
    menuId: z
      .string()
      .optional()
      .describe("Menú de referencia si no existe un carrito activo."),
    requestedItems: z
      .array(requestedItemSchema)
      .default([])
      .describe(
        "Lista de ítems que el cliente quiere agregar (cantidad + tipo/categoría).",
      ),
  }),
  async execute({ conversationId, menuId, requestedItems }) {
    const { cartItems, menuId: resolvedMenuId } = await loadCartContext(
      conversationId,
      menuId,
    );
    const normalizedRequested = await normalizeRequestedItems(requestedItems);
    const itemsForEvaluation = [...cartItems, ...normalizedRequested];

    const { promotions } = await getPromotions({
      menuId: resolvedMenuId,
    });

    if (!promotions.length) {
      return {
        menuId: resolvedMenuId ?? null,
        analyzedItems: itemsForEvaluation,
        promotions: [],
        summary:
          "No se encontraron promociones activas para el menú seleccionado.",
      };
    }

    const evaluations = promotions.map((promo) =>
      evaluatePromotionApplicability(promo, itemsForEvaluation),
    );

    const applicable = evaluations.filter((entry) => entry.appliesNow);
    const summary = applicable.length
      ? `Se pueden aplicar ${applicable.length} promoción(es): ${applicable
          .map((promo) => promo.name)
          .join(", ")}.`
      : "Todavía no se cumplen los requisitos para aplicar una promoción; revisa los faltantes indicados.";

    return {
      menuId: resolvedMenuId ?? null,
      analyzedItems: itemsForEvaluation,
      promotions: evaluations,
      summary,
    };
  },
});

type PromotionForEvaluation = Awaited<
  ReturnType<typeof getPromotions>
>["promotions"][number];

type PromotionRequirementSummary = NonNullable<
  PromotionForEvaluation["requirements"]
>[number];

type NormalizedItem = {
  source: "cart" | "requested";
  quantity: number;
  productId?: string;
  productType?: ProductType;
  empanadaCategory?: EmpanadaCategory | null;
  beverageCategory?: BeverageCategory | null;
  label?: string | null;
};

async function loadCartContext(
  conversationId?: string,
  menuId?: string,
) {
  if (!conversationId) {
    const fallbackMenu = menuId
      ? { id: menuId }
      : await prisma.menu.findFirst({
          where: { active: true },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });

    return {
      cartItems: [] as NormalizedItem[],
      menuId: fallbackMenu?.id,
    };
  }

  const order = await prisma.order.findFirst({
    where: {
      conversationId,
      status: OrderStatus.CART,
    },
    orderBy: { createdAt: "desc" },
    include: {
      menu: {
        select: { id: true },
      },
      items: {
        include: {
          product: {
            include: {
              empanada: true,
              beverage: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    return {
      cartItems: [] as NormalizedItem[],
      menuId,
    };
  }

  const normalizedItems: NormalizedItem[] = order.items.map((item) => ({
    source: "cart",
    quantity: item.quantity,
    productId: item.productId,
    productType: item.product?.type ?? undefined,
    empanadaCategory: item.product?.empanada?.category ?? undefined,
    beverageCategory: item.product?.beverage?.category ?? undefined,
    label:
      (item.productSnapshot as { name?: string } | undefined)?.name ??
      item.product?.name ??
      null,
  }));

  return {
    cartItems: normalizedItems,
    menuId: menuId ?? order.menuId ?? order.menu?.id ?? undefined,
  };
}

async function normalizeRequestedItems(items: z.infer<typeof requestedItemSchema>[]) {
  if (!items.length) {
    return [] as NormalizedItem[];
  }

  const productIds = Array.from(
    new Set(items.map((item) => item.productId).filter(Boolean) as string[]),
  );

  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: {
          empanada: true,
          beverage: true,
        },
      })
    : [];

  const productMap = new Map(products.map((product) => [product.id, product]));

  return items
    .map<NormalizedItem>((item) => {
      const product = item.productId
        ? productMap.get(item.productId)
        : undefined;

      return {
        source: "requested",
        quantity: item.quantity,
        productId: item.productId,
        productType: product?.type ?? item.productType,
        empanadaCategory:
          product?.empanada?.category ?? item.empanadaCategory ?? null,
        beverageCategory:
          product?.beverage?.category ?? item.beverageCategory ?? null,
        label: product?.name ?? item.label ?? null,
      };
    })
    .filter((item) => Boolean(item.productType));
}

function evaluatePromotionApplicability(
  promotion: PromotionForEvaluation,
  items: NormalizedItem[],
) {
  if (promotion.type === PromotionType.FIXED_BUNDLE_PRICE) {
    return evaluateFixedBundlePromotion(promotion, items);
  }

  if (promotion.type === PromotionType.QUANTITY_DISCOUNT) {
    return evaluateQuantityDiscountPromotion(promotion, items);
  }

  return {
    id: promotion.id,
    name: promotion.name,
    appliesNow: false,
    notes: "Tipo de promoción no soportado para evaluación automática.",
  };
}

function evaluateFixedBundlePromotion(
  promotion: PromotionForEvaluation,
  items: NormalizedItem[],
) {
  if (!promotion.requirements?.length) {
    return {
      id: promotion.id,
      name: promotion.name,
      appliesNow: false,
      notes: "La promoción no tiene requisitos definidos.",
    };
  }

  const evaluations = promotion.requirements.map((requirement) => {
    const availableQty = countMatchingQuantity(items, requirement);
    const bundles = Math.floor(availableQty / requirement.qty);
    const missingForFirstBundle = Math.max(requirement.qty - availableQty, 0);

    return {
      requirement,
      availableQty,
      bundles,
      missingForFirstBundle,
    };
  });

  const bundlesPossible = Math.min(...evaluations.map((e) => e.bundles));
  const cappedBundles = promotion.stackable
    ? bundlesPossible
    : Math.min(bundlesPossible, 1);

  const appliesNow = cappedBundles >= 1;

  const missingRequirements = evaluations
    .filter((evaluation) => evaluation.missingForFirstBundle > 0)
    .map((evaluation) => ({
      requirement: describeRequirement(evaluation.requirement),
      missingQuantity: evaluation.missingForFirstBundle,
    }));

  return {
    id: promotion.id,
    name: promotion.name,
    appliesNow,
    bundlesPossible: cappedBundles,
    missingRequirements,
    notes: appliesNow
      ? `Puedes aplicar ${
          promotion.stackable ? cappedBundles : 1
        } vez/veces esta promo con los productos actuales.`
      : "Aún faltan productos para completar los requisitos indicados.",
  };
}

function evaluateQuantityDiscountPromotion(
  promotion: PromotionForEvaluation,
  items: NormalizedItem[],
) {
  const minQty = promotion.pricing?.minQty ?? 0;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const appliesNow = totalQuantity >= minQty;
  const missingQuantity = Math.max(minQty - totalQuantity, 0);

  return {
    id: promotion.id,
    name: promotion.name,
    appliesNow,
    requirements: `Mínimo ${minQty} unidades.`,
    missingQuantity: appliesNow ? 0 : missingQuantity,
    notes: appliesNow
      ? "La cantidad combinada alcanza el mínimo requerido."
      : `Necesitas ${missingQuantity} unidad(es) más para activar esta promo.`,
  };
}

function countMatchingQuantity(
  items: NormalizedItem[],
  requirement: PromotionRequirementSummary,
) {
  return items.reduce((sum, item) => {
    if (!item.productType || item.productType !== requirement.productType) {
      return sum;
    }

    if (
      requirement.productType === ProductType.EMPANADA &&
      requirement.empanadaCategory &&
      item.empanadaCategory !== requirement.empanadaCategory
    ) {
      return sum;
    }

    if (requirement.productType === ProductType.BEVERAGE) {
      const requirementCategories = requirement.beverageCategories ?? [];
      if (
        requirementCategories.length &&
        (!item.beverageCategory ||
          !requirementCategories.includes(item.beverageCategory))
      ) {
        return sum;
      }
    }

    return sum + item.quantity;
  }, 0);
}

function describeRequirement(requirement: PromotionRequirementSummary) {
  const baseQty = `${requirement.qty}x`;

  if (requirement.productType === ProductType.EMPANADA) {
    if (requirement.empanadaCategory) {
      return `${baseQty} empanadas ${requirement.empanadaCategory?.toLowerCase()}`;
    }
    return `${baseQty} empanadas`;
  }

  if (requirement.productType === ProductType.BEVERAGE) {
    if (requirement.beverageCategories?.length) {
      const categories = requirement.beverageCategories.join(", ");
      return `${baseQty} bebidas (${categories})`;
    }
    return `${baseQty} bebidas`;
  }

  return `${baseQty} ${requirement.productType.toLowerCase()}`;
}
