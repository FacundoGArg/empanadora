// src/lib/services/menu-service.ts

import { BeverageCategory, EmpanadaCategory, ProductType } from "@prisma/client";

import { findMenuWithItems } from "@/lib/repository/menus";

const MENU_ORDER: Record<
  ProductType,
  {
    label: string;
    suborder?: string[];
  }
> = {
  EMPANADA: {
    label: "Empanadas",
    suborder: ["CLASSIC", "SPECIAL"],
  },
  BEVERAGE: {
    label: "Bebidas",
    suborder: ["WATER", "SOFT_DRINK", "BEER"],
  },
  DESSERT: {
    label: "Postres",
  },
};

const FALLBACK_TYPE_ORDER = Object.keys(MENU_ORDER);

type MenuWithItems = NonNullable<Awaited<ReturnType<typeof findMenuWithItems>>>;
type MenuItemRecord = MenuWithItems["items"][number];

type SerializedMenuItem = {
  menuItemId: string;
  productId: string;
  name: string;
  type: ProductType;
  price: number;
  currency: string;
  description: string | null;
  image: string | null;
  empanada?: {
    category: EmpanadaCategory;
    ingredients: string[];
    isVegan: boolean;
    isVegetarian: boolean;
    isGlutenFree: boolean;
  };
  beverage?: {
    category: BeverageCategory;
    isAlcoholic: boolean;
  };
};

type MenuCategory = {
  category: string;
  items: SerializedMenuItem[];
};

type MenuSection = {
  type: string;
  label: string;
  categories: MenuCategory[];
};

type ActiveMenuDetails = {
  menu: {
    id: string;
    name: string;
    active: boolean;
    totalItems: number;
    sections: MenuSection[];
  } | null;
  notes?: string;
  message?: string;
};

function serializeMenuItem(item: MenuItemRecord): SerializedMenuItem {
  const { product } = item;
  const base = {
    menuItemId: item.id,
    productId: product.id,
    name: product.name,
    type: product.type,
    price: item.price,
    currency: item.currency,
    description: product.description ?? null,
    image: product.image ?? null,
  };

  if (product.type === "EMPANADA" && product.empanada) {
    return {
      ...base,
      empanada: {
        category: product.empanada.category,
        ingredients: product.empanada.ingredients,
        isVegan: product.empanada.isVegan,
        isVegetarian: product.empanada.isVegetarian,
        isGlutenFree: product.empanada.isGlutenFree,
      },
    };
  }

  if (product.type === "BEVERAGE" && product.beverage) {
    return {
      ...base,
      beverage: {
        category: product.beverage.category,
        isAlcoholic: product.beverage.isAlcoholic,
      },
    };
  }

  return base;
}

type GetActiveMenuOptions = {
  menuId?: string;
  includeInactive?: boolean;
};

export async function getActiveMenuDetails(
  options: GetActiveMenuOptions = {},
): Promise<ActiveMenuDetails> {
  const menu = await findMenuWithItems(options);

  if (!menu) {
    return {
      menu: null,
      message: "No se encontró un menú con los criterios solicitados.",
    };
  }

  const groupedItems = menu.items.reduce<
    Record<string, Record<string, SerializedMenuItem[]>>
  >(
    (acc, item) => {
      const type = item.product.type;

      let category = "GENERAL";
      if (type === "EMPANADA") {
        category = item.product.empanada?.category ?? "SIN_CATEGORIA";
      } else if (type === "BEVERAGE") {
        category = item.product.beverage?.category ?? "SIN_CATEGORIA";
      }

      if (!acc[type]) {
        acc[type] = {};
      }
      if (!acc[type][category]) {
        acc[type][category] = [];
      }

      acc[type][category].push(serializeMenuItem(item));
      return acc;
    },
    {},
  );

  const orderedTypes = FALLBACK_TYPE_ORDER.filter((type) => groupedItems[type])
    .concat(
      Object.keys(groupedItems).filter(
        (type) => !FALLBACK_TYPE_ORDER.includes(type),
      ),
    );

  const orderedMenu: MenuSection[] = orderedTypes.map((type) => {
    const sections = groupedItems[type];
    const config = MENU_ORDER[type as ProductType];
    const orderedCategories = config?.suborder
      ? config.suborder
          .filter((category) => sections[category])
          .concat(
            Object.keys(sections).filter(
              (category) => !config.suborder?.includes(category),
            ),
          )
      : Object.keys(sections);

    return {
      type,
      label: config?.label ?? type,
      categories: orderedCategories.map((category) => ({
        category,
        items: sections[category],
      })),
    };
  });

  return {
    menu: {
      id: menu.id,
      name: menu.name,
      active: menu.active,
      totalItems: menu.items.length,
      sections: orderedMenu,
    },
    notes:
      "Los precios están expresados en la moneda indicada por cada ítem (por defecto ARS).",
  };
}
