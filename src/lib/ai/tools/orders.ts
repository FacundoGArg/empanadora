import { tool } from "ai";
import { z } from "zod";

import {
  addOrUpdateItem,
  getOrCreateActiveCart,
  markOrderAsConfirmed,
  setOrderContactFirstName as setOrderContactFirstNameService,
  setPaymentMethod as setPaymentMethodService,
  setShippingMethod as setShippingMethodService,
} from "@/lib/services/order-service";

const baseItemSchema = {
  orderId: z.string(),
  productId: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().positive(),
  productSnapshot: z.any().optional(),
};

export const getActiveOrder = tool({
  description:
    "Obtiene (o crea si no existe) el carrito activo asociado a una conversación.",
  inputSchema: z.object({
    conversationId: z.string().describe("Identificador de la conversación."),
    menuId: z.string().optional().describe("Menú a asociar al pedido. Opcional."),
    currency: z
      .string()
      .optional()
      .describe("Moneda deseada. Por defecto ARS."),
  }),
  execute: ({ conversationId, menuId, currency }) =>
    getOrCreateActiveCart(conversationId, { menuId, currency }),
});

export const addOrderItem = tool({
  description:
    "Agrega un nuevo ítem al carrito actual.",
  inputSchema: z.object(baseItemSchema),
  execute: ({ orderId, productId, quantity, unitPrice, productSnapshot }) =>
    addOrUpdateItem({
      orderId,
      productId,
      quantity,
      unitPrice,
      productSnapshot,
    }),
});

export const setOrderItemQuantity = tool({
  description:
    "Actualiza la cantidad de un ítem existente del carrito (sobrescribe la cantidad actual).",
  inputSchema: z.object(baseItemSchema),
  execute: ({ orderId, productId, quantity, unitPrice, productSnapshot }) =>
    addOrUpdateItem({
      orderId,
      productId,
      quantity,
      unitPrice,
      productSnapshot,
    }),
});

export const setOrderShippingMethod = tool({
  description:
    "Define el método de envío del carrito actual (delivery o retiro en local).",
  inputSchema: z.object({
    orderId: z.string(),
    type: z.enum(["DELIVERY", "PICKUP"]),
    fee: z.number().min(0).optional(),
    addressDescription: z
      .string()
      .min(3, "Describe la dirección del delivery.")
      .optional(),
  }),
  execute: ({ orderId, type, fee, addressDescription }) =>
    setShippingMethodService({
      orderId,
      type,
      fee,
      addressDescription,
    }),
});

export const setOrderPaymentMethod = tool({
  description:
    "Registra el método de pago elegido para el carrito (efectivo o tarjeta).",
  inputSchema: z.object({
    orderId: z.string(),
    method: z.enum(["CASH", "CARD"]),
  }),
  execute: ({ orderId, method }) =>
    setPaymentMethodService({
      orderId,
      method,
    }),
});

export const setOrderContactFirstName = tool({
  description: "Guarda el primer nombre del cliente asociado al pedido.",
  inputSchema: z.object({
    orderId: z.string(),
    firstName: z.string().min(1),
  }),
  execute: ({ orderId, firstName }) =>
    setOrderContactFirstNameService({
      orderId,
      firstName,
    }),
});

export const confirmOrder = tool({
  description: "Marca el pedido actual como confirmado.",
  inputSchema: z.object({
    orderId: z.string(),
  }),
  execute: ({ orderId }) => markOrderAsConfirmed(orderId),
});
