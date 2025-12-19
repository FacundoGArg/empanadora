// src/lib/services/order-service.ts

import type {
  Order,
  OrderItem,
  Payment,
  Prisma,
  Shipping,
} from "@prisma/client";
import {
  BeverageCategory,
  DiscountKind,
  EmpanadaCategory,
  OrderStatus,
  PaymentMethod,
  ProductType,
  PromotionType,
  ShippingType,
} from "@prisma/client";

import {
  createOrder,
  findActiveOrderByConversation,
  findOrderById,
  updateOrder,
  updateOrderTotals,
} from "@/lib/repository/orders";
import {
  findOrderItems,
  removeOrderItem,
  removeOrderItemsByOrder,
  upsertOrderItem,
} from "@/lib/repository/order-items";
import { findShippingByOrder, upsertShipping } from "@/lib/repository/shipping";
import { getPromotions } from "@/lib/services/promotion-service";
import {
  decrementInventory,
  findInventoryByProduct,
} from "@/lib/repository/inventory";
import {
  updatePaymentAmount,
  upsertPayment,
} from "@/lib/repository/payments";
import { prisma } from "@/lib/db/prisma/client";

type OrderItemWithProduct = OrderItem & {
  product?: {
    name?: string | null;
    image?: string | null;
    type: ProductType;
    empanada?: {
      category: EmpanadaCategory | null;
    } | null;
    beverage?: {
      category: BeverageCategory | null;
    } | null;
  } | null;
};

type OrderWithRelations = Order & {
  items: OrderItemWithProduct[];
  shipping?: Shipping | null;
  payment?: Payment | null;
};

type OrderSummary = {
  id: string;
  status: OrderStatus;
  currency: string;
  subtotalAmount: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  contactFirstName: string | null;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    productName: string;
    productImage: string | null;
    productSnapshot: OrderItem["productSnapshot"];
  }>;
  shipping?: {
    type: Shipping["type"];
    fee: number;
    addressDescription: string | null;
  } | null;
  payment?: {
    status: Payment["status"];
    amount: number;
    currency: string;
    method: Payment["method"];
  } | null;
};

const ORDER_INCLUDE = {
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
  shipping: true,
  payment: true,
} satisfies NonNullable<Parameters<typeof findOrderById>[1]>["include"];

type EnsureCartOptions = {
  menuId?: string;
  currency?: string;
};

type SetShippingMethodInput = {
  orderId: string;
  type: ShippingType;
  fee?: number;
  pickupLocation?: string | null;
  addressSnapshot?: Prisma.JsonValue | null;
  addressDescription?: string | null;
  eta?: Date | null;
};

type SetPaymentMethodInput = {
  orderId: string;
  method: PaymentMethod;
};

type SetContactFirstNameInput = {
  orderId: string;
  firstName: string;
};

export async function getOrCreateActiveCart(
  conversationId: string,
  options: EnsureCartOptions = {},
) {
  let existing = await findActiveOrderByConversation(conversationId, {
    include: ORDER_INCLUDE,
  });

  if (existing) {
    if (!existing.menuId) {
      const resolvedMenuId = await resolveMenuId(options.menuId);
      if (resolvedMenuId) {
        await prisma.order.update({
          where: { id: existing.id },
          data: {
            menu: { connect: { id: resolvedMenuId } },
          },
        });
        const updated = await findOrderById(existing.id, {
          include: ORDER_INCLUDE,
        });
        if (!updated) {
          throw new Error("Failed to reload cart after assigning menu.");
        }
        existing = updated;
      }
    }
    return buildOrderSummary(existing as OrderWithRelations);
  }

  const resolvedMenuId = await resolveMenuId(options.menuId);
  const created = await createOrder({
    status: OrderStatus.CART,
    currency: options.currency ?? "ARS",
    menu: resolvedMenuId ? { connect: { id: resolvedMenuId } } : undefined,
    conversation: { connect: { id: conversationId } },
  });

  const fresh = await findOrderById(created.id, { include: ORDER_INCLUDE });
  if (!fresh) {
    throw new Error("Failed to load cart after creation.");
  }
  return buildOrderSummary(fresh as OrderWithRelations);
}

type AddOrUpdateItemInput = {
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  productSnapshot?: OrderItem["productSnapshot"];
};

export async function addOrUpdateItem(input: AddOrUpdateItemInput) {
  if (input.quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  await ensureStockAvailability(input.productId, input.quantity);
  console.log(
    "[order-service] addOrUpdateItem",
    JSON.stringify({
      orderId: input.orderId,
      productId: input.productId,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
    }),
  );

  let snapshot: OrderItem["productSnapshot"] = input.productSnapshot ?? null;
  const snapshotHasName =
    snapshot &&
    typeof snapshot === "object" &&
    snapshot !== null &&
    "name" in snapshot;
  const snapshotHasImage =
    snapshot &&
    typeof snapshot === "object" &&
    snapshot !== null &&
    "image" in snapshot;
  if (!snapshotHasName) {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { name: true, type: true, image: true },
    });
    if (product) {
      const baseSnapshot =
        snapshot &&
        typeof snapshot === "object" &&
        !Array.isArray(snapshot)
          ? (snapshot as Record<string, unknown>)
          : {};
      snapshot = {
        ...baseSnapshot,
        name: product.name,
        type: product.type,
        image: product.image,
      };
    }
  } else if (!snapshotHasImage) {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { image: true },
    });
    if (product) {
      const baseSnapshot =
        snapshot &&
        typeof snapshot === "object" &&
        !Array.isArray(snapshot)
          ? (snapshot as Record<string, unknown>)
          : {};
      snapshot = {
        ...baseSnapshot,
        image: product.image,
      };
    }
  }

  await upsertOrderItem({
    orderId: input.orderId,
    productId: input.productId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    totalPrice: input.unitPrice * input.quantity,
    productSnapshot: snapshot,
  });

  return recalculateOrderTotals(input.orderId);
}

export async function removeItem(orderId: string, orderItemId: string) {
  console.log(
    "[order-service] removeItem",
    JSON.stringify({ orderId, orderItemId }),
  );
  await removeOrderItem(orderItemId);
  return recalculateOrderTotals(orderId);
}

export async function clearOrder(orderId: string) {
  console.log("[order-service] clearOrder", JSON.stringify({ orderId }));
  await removeOrderItemsByOrder(orderId);
  return recalculateOrderTotals(orderId);
}

export async function setShippingMethod(input: SetShippingMethodInput) {
  console.log(
    "[order-service] setShippingMethod",
    JSON.stringify({ orderId: input.orderId, type: input.type }),
  );
  const addressDescription =
    input.type === ShippingType.DELIVERY
      ? input.addressDescription?.trim() ?? null
      : null;

  if (input.type === ShippingType.DELIVERY && !addressDescription) {
    console.warn(
      "[order-service] missingDeliveryAddress",
      JSON.stringify({ orderId: input.orderId }),
    );
  }

  await upsertShipping({
    orderId: input.orderId,
    type: input.type,
    fee: input.fee,
    pickupLocation: input.pickupLocation,
    addressSnapshot: input.addressSnapshot,
    addressDescription,
    eta: input.eta ?? null,
  });
  return recalculateOrderTotals(input.orderId);
}

export async function setPaymentMethod(input: SetPaymentMethodInput) {
  console.log(
    "[order-service] setPaymentMethod",
    JSON.stringify({ orderId: input.orderId, method: input.method }),
  );
  const summary = await recalculateOrderTotals(input.orderId);
  await upsertPayment({
    orderId: input.orderId,
    amount: summary.totalAmount,
    currency: summary.currency,
    method: input.method,
  });
  return getOrderSummary(input.orderId);
}

export async function setOrderContactFirstName(
  input: SetContactFirstNameInput,
) {
  const trimmed = input.firstName.trim();
  if (!trimmed) {
    throw new Error(
      "Necesitamos un nombre para asociarlo al pedido. Indica al menos un nombre.",
    );
  }

  console.log(
    "[order-service] setOrderContactFirstName",
    JSON.stringify({ orderId: input.orderId }),
  );

  await updateOrder(input.orderId, {
    contactFirstName: trimmed,
  });

  return getOrderSummary(input.orderId);
}

export async function markOrderAsConfirmed(orderId: string) {
  console.log("[order-service] markOrderAsConfirmed", { orderId });
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        shipping: true,
        payment: true,
      },
    });

    if (!order) {
      throw new Error("Order not found.");
    }

    if (!order.items.length) {
      throw new Error("No hay productos en la orden para confirmar.");
    }

    if (!order.contactFirstName) {
      throw new Error(
        "Necesitamos el primer nombre del cliente para asignarlo al pedido.",
      );
    }

    if (!order.shipping) {
      throw new Error(
        "Debes seleccionar un método de envío antes de confirmar la orden.",
      );
    }
    if (
      order.shipping.type === ShippingType.DELIVERY &&
      !order.shipping.addressDescription
    ) {
      throw new Error(
        "Para envíos a domicilio necesitamos la dirección de entrega.",
      );
    }

    if (!order.payment || !order.payment.method) {
      throw new Error(
        "Debes seleccionar un método de pago antes de confirmar la orden.",
      );
    }

    for (const item of order.items) {
      console.log(
        "[order-service] decrementInventory",
        JSON.stringify({ productId: item.productId, quantity: item.quantity }),
      );
      await decrementInventory(item.productId, item.quantity, tx);
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CONFIRMED,
      },
    });
  });

  return getOrderSummary(orderId);
}

export async function getOrderSummary(orderId: string) {
  const order = await findOrderById(orderId, { include: ORDER_INCLUDE });
  if (!order) {
    throw new Error("Order not found.");
  }
  return buildOrderSummary(order as OrderWithRelations);
}

async function recalculateOrderTotals(orderId: string) {
  const order = await findOrderById(orderId, { include: ORDER_INCLUDE });
  if (!order) {
    throw new Error("Order not found.");
  }

  const orderWithRelations = order as OrderWithRelations;
  const items = orderWithRelations.items.length
    ? orderWithRelations.items
    : await findOrderItems(orderId);

  const shipping =
    orderWithRelations.shipping ?? (await findShippingByOrder(orderId));

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const discount = await calculateDiscountAmount(
    orderWithRelations,
    items,
  );
  const deliveryFee = shipping?.fee ?? 0;
  const total = Math.max(subtotal - discount + deliveryFee, 0);

  await updateOrderTotals(orderId, {
    subtotalAmount: subtotal,
    discountAmount: discount,
    deliveryFee,
    totalAmount: total,
  });

  if (orderWithRelations.payment) {
    await updatePaymentAmount(orderId, total, orderWithRelations.currency);
  }

  const updated = await findOrderById(orderId, { include: ORDER_INCLUDE });
  if (!updated) {
    throw new Error("Failed to reload order after totals update.");
  }
  return buildOrderSummary(updated as OrderWithRelations);
}

function buildOrderSummary(order: OrderWithRelations): OrderSummary {
  return {
    id: order.id,
    status: order.status,
    currency: order.currency,
    subtotalAmount: order.subtotalAmount,
    discountAmount: order.discountAmount,
    deliveryFee: order.deliveryFee,
    totalAmount: order.totalAmount,
    contactFirstName: order.contactFirstName ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      productName: resolveProductName(item),
      productImage: resolveProductImage(item),
      productSnapshot: item.productSnapshot,
    })),
    shipping: order.shipping
      ? {
          type: order.shipping.type,
          fee: order.shipping.fee,
          addressDescription: order.shipping.addressDescription ?? null,
        }
      : null,
    payment: order.payment
      ? {
          status: order.payment.status,
          amount: order.payment.amount,
          currency: order.payment.currency,
          method: order.payment.method,
        }
      : null,
  };
}

function resolveProductName(item: OrderItemWithProduct) {
  const snapshotName =
    item.productSnapshot &&
    typeof item.productSnapshot === "object" &&
    !Array.isArray(item.productSnapshot)
      ? (item.productSnapshot as { name?: string }).name
      : undefined;
  if (snapshotName) {
    return snapshotName;
  }
  if (item.product?.name) {
    return item.product.name;
  }
  return `Producto ${item.productId.slice(-4)}`;
}

function resolveProductImage(item: OrderItemWithProduct) {
  const snapshotImage =
    item.productSnapshot &&
    typeof item.productSnapshot === "object" &&
    !Array.isArray(item.productSnapshot)
      ? (item.productSnapshot as { image?: string | null }).image
      : undefined;
  if (snapshotImage) {
    return snapshotImage;
  }
  return item.product?.image ?? null;
}

async function calculateDiscountAmount(
  order: OrderWithRelations,
  items: OrderItemWithProduct[],
) {
  if (!order.menuId) {
    return 0;
  }

  const { promotions } = await getPromotions({
    menuId: order.menuId,
  });

  if (!promotions.length) {
    return 0;
  }

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  let discount = 0;

  promotions.forEach((promo) => {
    if (promo.type === PromotionType.QUANTITY_DISCOUNT) {
      const candidate = computeQuantityDiscount(
        subtotal,
        totalQuantity,
        promo,
      );
      discount = Math.max(discount, candidate);
      return;
    }

    if (promo.type === PromotionType.FIXED_BUNDLE_PRICE) {
      const candidate = computeFixedBundleDiscount(items, promo);
      discount = Math.max(discount, candidate);
    }
  });

  return discount;
}

async function ensureStockAvailability(productId: string, quantity: number) {
  const inventory = await findInventoryByProduct(productId);

  if (!inventory) {
    console.warn(
      "[order-service] inventoryMissing",
      JSON.stringify({ productId, quantityRequested: quantity }),
    );
    throw new Error(
      "No se encontró inventario para el producto solicitado. Intenta con otro.",
    );
  }

  if (inventory.quantity < quantity) {
    console.warn(
      "[order-service] inventoryInsufficient",
      JSON.stringify({
        productId,
        quantityRequested: quantity,
        quantityAvailable: inventory.quantity,
      }),
    );
    throw new Error(
      "No contamos con suficiente stock para esa cantidad. Por favor elige una cifra menor o cambia de producto.",
    );
  }

  console.log(
    "[order-service] inventoryCheckOk",
    JSON.stringify({
      productId,
      quantityRequested: quantity,
      quantityAvailable: inventory.quantity,
    }),
  );
}

function computeQuantityDiscount(
  subtotal: number,
  totalQuantity: number,
  promotion: PromotionSummary,
) {
  if (
    !promotion.pricing ||
    typeof promotion.pricing.minQty !== "number" ||
    totalQuantity < promotion.pricing.minQty
  ) {
    return 0;
  }

  const { discountKind, discountValue } = promotion.pricing;
  if (!discountKind || typeof discountValue !== "number") {
    return 0;
  }

  if (discountKind === DiscountKind.PERCENT) {
    return subtotal * discountValue;
  }

  if (discountKind === DiscountKind.AMOUNT) {
    return discountValue;
  }

  return 0;
}

function computeFixedBundleDiscount(
  items: OrderItemWithProduct[],
  promotion: PromotionSummary,
) {
  if (
    !promotion.pricing?.fixedPrice ||
    !promotion.requirements?.length
  ) {
    return 0;
  }

  const bundlesPerRequirement = promotion.requirements.map((requirement) => {
    const availableQuantity = items.reduce((sum, item) => {
      if (!itemMatchesRequirement(item, requirement)) {
        return sum;
      }
      return sum + item.quantity;
    }, 0);

    if (availableQuantity < requirement.qty) {
      return 0;
    }

    return Math.floor(availableQuantity / requirement.qty);
  });

  if (!bundlesPerRequirement.length) {
    return 0;
  }

  const maxBundles = Math.min(...bundlesPerRequirement);
  if (maxBundles <= 0) {
    return 0;
  }

  const bundlesToApply = promotion.stackable ? maxBundles : 1;
  const bundleValue = promotion.requirements.reduce((sum, requirement) => {
    const eligibleItems = items.filter((item) =>
      itemMatchesRequirement(item, requirement),
    );
    if (!eligibleItems.length) {
      return sum;
    }

    const totalEligibleQty = eligibleItems.reduce(
      (acc, item) => acc + item.quantity,
      0,
    );
    if (!totalEligibleQty) {
      return sum;
    }

    const totalEligibleValue = eligibleItems.reduce(
      (acc, item) => acc + item.unitPrice * item.quantity,
      0,
    );

    const qtyNeeded = bundlesToApply * requirement.qty;
    const proportion = Math.min(qtyNeeded / totalEligibleQty, 1);
    return sum + totalEligibleValue * proportion;
  }, 0);

  const promoPrice = bundlesToApply * promotion.pricing.fixedPrice;
  return Math.max(bundleValue - promoPrice, 0);
}

function itemMatchesRequirement(
  item: OrderItemWithProduct,
  requirement: PromotionRequirementSummary,
) {
  const product = item.product;
  if (!product) {
    return false;
  }

  if (product.type !== requirement.productType) {
    return false;
  }

  if (
    requirement.productType === ProductType.EMPANADA &&
    requirement.empanadaCategory &&
    product.empanada?.category !== requirement.empanadaCategory
  ) {
    return false;
  }

  if (requirement.productType === ProductType.BEVERAGE) {
    if (
      requirement.beverageCategories &&
      requirement.beverageCategories.length > 0
    ) {
      const category = product.beverage?.category;
      if (!category) {
        return false;
      }
      if (!requirement.beverageCategories.includes(category)) {
        return false;
      }
    }
  }

  return true;
}

type PromotionSummary = {
  id: string;
  type: PromotionType;
  pricing?: {
    discountKind?: DiscountKind | null;
    discountValue?: number | null;
    minQty?: number | null;
    fixedPrice?: number | null;
    currency?: string;
  };
  stackable?: boolean;
  requirements?: PromotionRequirementSummary[];
};

type PromotionRequirementSummary = {
  qty: number;
  productType: ProductType;
  empanadaCategory?: EmpanadaCategory | null;
  beverageCategories?: BeverageCategory[];
};

async function resolveMenuId(preferredMenuId?: string) {
  if (preferredMenuId) {
    return preferredMenuId;
  }

  const activeMenu = await prisma.menu.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return activeMenu?.id ?? null;
}
