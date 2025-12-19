// src/lib/services/promotion-service.ts

import { findPromotions } from "@/lib/repository/promotions";

type GetPromotionsOptions = {
  menuId?: string;
  includeInactive?: boolean;
};

export async function getPromotions(options: GetPromotionsOptions = {}) {
  const promotions = await findPromotions(options);

  if (!promotions.length) {
    return {
      promotions: [],
      message: "No se encontraron promociones con los filtros solicitados.",
    };
  }

  return {
    promotions: promotions.map((promo) => ({
      id: promo.id,
      name: promo.name,
      type: promo.type,
      menu: promo.menu ? { id: promo.menu.id, name: promo.menu.name } : null,
      active: promo.active,
      pricing:
        promo.type === "FIXED_BUNDLE_PRICE"
          ? { fixedPrice: promo.fixedPrice, currency: promo.currency }
          : {
              discountKind: promo.discountKind,
              discountValue: promo.discountValue,
              minQty: promo.minQty,
              currency: promo.currency,
            },
      stackable: promo.stackable,
      requirements: promo.requirements.map((req) => ({
        id: req.id,
        qty: req.qty,
        productType: req.productType,
        empanadaCategory: req.empanadaCategory,
        beverageCategories: req.beverageCategories,
      })),
    })),
  };
}
