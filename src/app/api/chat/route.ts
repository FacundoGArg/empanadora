// src/app/api/chat/route.ts

import {
  streamText,
  generateObject,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
  hasToolCall,
  isTextUIPart,
} from 'ai';
import { openai } from "@ai-sdk/openai";
import { z } from 'zod';

import { saveConversationMessages } from '@/lib/services/conversation-service';
import { getActiveMenu } from '@/lib/ai/tools/menu';
import { considerApplyingPromo, getActivePromotions } from '@/lib/ai/tools/promotions';
import { addOrderItem, confirmOrder, getActiveOrder as getActiveOrderTool, setOrderContactFirstName as setOrderContactFirstNameTool, setOrderItemQuantity, setOrderPaymentMethod, setOrderShippingMethod } from '@/lib/ai/tools/orders';
import { getOrCreateActiveCart } from '@/lib/services/order-service';
import { getActiveMenuDetails } from '@/lib/services/menu-service';
import { getPromotions } from '@/lib/services/promotion-service';

const availableIntents = [
  "menu",
  "promotions",
  "restaurant-info",
  "order-management",
  "order-confirmation",
  "out-of-domain",
];

import { docsSearch as docsSearchTool } from '@/lib/ai/tools/agentic-docs-search';


// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  
  const {
    messages,
    conversationId,
  }: { 
    messages: UIMessage[]; 
    conversationId?: string;
  } = await req.json();

  console.log('New message recieved:', messages.slice(-1)[0].parts);
  const modelMessages = convertToModelMessages(messages);

  // Add a reusable context system prompt
  const baseContext = `
  Sos Dora.
  Eres un chatbot especializado en recibir pedidos de empanadas para un local gastronómico en Buenos Aires.
  Sé servicial y amable.
  `;

  function withBaseContext(systemPrompt: string = "", conversationHint?: string) {
    const context = conversationHint ? `\nDatos útiles:\n${conversationHint}\n` : "";
    return `${baseContext}${context}\n\n${systemPrompt}`;
  }


  // 1) Classify intent
  const classifierSchema = z.object({
    type: z.enum(availableIntents),
    intentClear: z.boolean(),
    score: z.number().min(0).max(1),
    reason: z.string().optional(),
  });

  const classifierPrompt = `
      Eres un agente virtual de un restaurante de empanadas.
      Tu tarea es clasificar la intención del usuario.
      Ten en cuenta que solo podrás responder preguntas relacionadas a alguno de estos tópicos: ${availableIntents.join(", ")}.

      - Determina la última intención del usuario considerando toda la conversación.
      - Clasifica en uno de los siguientes valores:
        • "menu" → preguntas sobre el menú y sabores disponibles
        • "promotions" → preguntas sobre promociones y descuentos vigentes
        • "restaurant-info" → información del local (horarios, ubicación, etc.)
        • "order-management" → gestión de pedidos (inicio, actualización de ítems). La finalización y confirmación de un pedido NO es parte de esta categoría.
        • "order-confirmation" → Solicitudes relacionadas con la finalización y confirmación de un pedido para su procesamiento.
        • "out-of-domain" → cualquier otro tema no relacionado

      - Define "intentClear" como true si el mensaje claramente expresa alguna intención (incluso si es "out-of-domain").
      - Define "intentClear" como false si el pedido es ambiguo y necesita aclaración; sugiere la repregunta en "reason".
      Devuelve ÚNICAMENTE un objeto JSON con los campos: type, intentClear, score, reason (opcional).
  `;

  let classification;
  let classificationError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const reminder =
        attempt === 0
          ? ""
          : `
      IMPORTANTE: El resultado previo no coincidió con el esquema esperado. Devuelve exclusivamente un JSON válido que cumpla con el esquema solicitado.`;
      const classificationObject = await generateObject({
        model: openai("gpt-4o-mini"), // Modelo económico para clasificación
        system: withBaseContext(`${classifierPrompt}${reminder}`),
        schema: classifierSchema,
        messages: modelMessages,
      });

      classification = classificationObject.object;
      classificationError = undefined;
      break;
    } catch (err) {
      classificationError = err;
      console.error(`Classification attempt ${attempt + 1} failed`, err);
    }
  }

  if (!classification) {
    console.error("Classification failed after retries, falling back:", classificationError);
    classification = {
      type: 'out-of-domain',
      intentClear: true,
      score: 0,
      reason: 'No se pudo clasificar la intención.',
    };
  }


  // 2) Route based on classification
  let result: any;

  if (!classification.intentClear) {
    // 2.a) No esta claro el pedido → pedir aclaración
    result = streamText({
      model: openai("gpt-4o-mini"),
      messages: modelMessages,
      system: classification.reason
        ? withBaseContext(`El pedido del usuario no está claro. Pide una aclaración: ${classification.reason}`)
        : withBaseContext(`El pedido del usuario no está claro. Solicita amablemente que lo reformule.`),
    });
  } else {
    
    // 2.b) Hay una intención clara → enrutar según tipo
    switch (classification.type) {
      case 'out-of-domain':
        console.log("Derived to: ", classification.type)
        result = streamText({
        model: openai("gpt-4o-mini"),
        messages: modelMessages,
        system: classification.reason
              ? withBaseContext(`El pedido del usuario no está claro. Pide una aclaración: ${classification.reason}`)
              : withBaseContext(`El pedido del usuario no está claro. Solicita amablemente que lo reformule.`),
          });
      break;

      case 'order-management':
      console.log("Derived to: ", classification.type);

      try {
        const orderContextHint = await buildOrderConversationHint(
          conversationId,
        );

        const systemPrompt = withBaseContext(
          `
            Estas gestionando una conversación con un cliente que quiere ordenar. Sigue estos pasos:
            1. Siempre llama primero al tool "getActiveOrder" con el conversationId para crear o revisar el carrito antes de hablar de ítems.
            2. Las promociones no son productos en sí mismas: describen combinaciones de productos reales. Usa el contexto provisto (carrito + menú + promos) para identificar sabores, cantidades y precios exactos. Confirma con el cliente qué productos específicos integrarán cualquier promoción solicitada.
            3. Si necesitas confirmar si una promo aplica con lo que el cliente quiere (incluyendo lo que ya está en el carrito), llama al tool "considerApplyingPromo" pasando los ítems solicitados.
            4. Para agregar o actualizar ítems usa "addOrderItem" o "setOrderItemQuantity" con los productId reales del menú.
            5. No asumas intenciones del cliente que no hayan sido expresadas explícitamente. Pregunta cuando falte información.
            6. Ingresa siempre el precio real del menú en unitPrice. Las promociones y descuentos se aplican automáticamente al recalcular el carrito, no los ajustes manualmente.
            7. Después de cada llamada relevante, resume lo que cambió citando los datos del tool.
            8. Si vas a ofrecerle al usuario productos adicionales, puedes hacerlo teniendo en cuenta lo que le faltaría para completar alguna promoción vigente, o bien sugiriendo productos complementarios a su carrito (ej. bebidas o postres)
            9. Pregunta (y registra mediante los tools correspondientes) el método de envío (delivery o retiro), el método de pago (efectivo o tarjeta) y el primer nombre del cliente tan pronto como esa información sea relevante para continuar el pedido. Si eligen delivery, recuerda pedir la dirección de entrega y guardarla junto al método.
            10. Si ya tienes todos los datos necesarios para completar el pedido, pasa en limpio toda la información con el cliente y sugiere avanzar a la confirmación del pedido.
            
            Conversation ID actual: ${conversationId ?? "no disponible (solicita al usuario volver a iniciar la conversación si es necesario)"}
          `,
          orderContextHint,
        );
          
        const tools = {
            getActiveOrder: getActiveOrderTool,
            considerApplyingPromo,
            addOrderItem,
            setOrderItemQuantity,
            setOrderShippingMethod,
            setOrderPaymentMethod,
            setOrderContactFirstName: setOrderContactFirstNameTool,
          }

        result = streamText({
          model: openai("gpt-4o"), // Mejor modelo para responder
          system: systemPrompt,
          messages: modelMessages,
          stopWhen: [stepCountIs(10)],
          tools,
        });
      } catch {
        // Fallback si falla el uso de tools
      }
      break;


      case 'order-confirmation':
      console.log("Derived to: ", classification.type);

      try {

        const systemPrompt = withBaseContext(
          `
            Estas gestionando una conversación con un cliente que quiere confirmar su pedido. Sigue estos pasos:
            1. Siempre llama primero al tool "getActiveOrder" con el conversationId para revisar el carrito antes de hablar de ítems.
            2. Intenta realizar un upsell o cross-sell relevante antes de la confirmación, sugiriendo ítems adicionales basados en el carrito actual.
            Si vas a ofrecerle al usuario productos adicionales, puedes hacerlo teniendo en cuenta lo que le faltaría para completar alguna promoción vigente, o bien sugiriendo productos complementarios a su carrito (ej. bebidas o postres)
            3. Verifica que la orden tenga un método de envío (delivery o retiro), un método de pago (efectivo o tarjeta) y el primer nombre del cliente. Si falta alguno, pregúntalo explícitamente y usa los tools "setOrderShippingMethod", "setOrderPaymentMethod" o "setOrderContactFirstName" para guardarlos. Si la opción es delivery, asegura que también se haya proporcionado la dirección de entrega. Recuerda que la plataforma no procesa pagos, solo registra la preferencia.
            4. Haz un repaso de todo el carrito con el cliente, incluyendo ítems, cantidades, precios, subtotal, descuentos y total; pide una confirmación final antes de avanzar.
            5. Si el cliente vuelve a ratificar la elección luego de que hayamos repasado el carrito y los datos anteriores estén completos, llama a "confirmOrder" para finalizar la orden.
            
            Conversation ID actual: ${conversationId ?? "no disponible (solicita al usuario volver a iniciar la conversación si es necesario)"}
          `,
        );
          
        const tools = {
            getActiveOrder: getActiveOrderTool,
            setOrderShippingMethod,
            setOrderPaymentMethod,
            setOrderContactFirstName: setOrderContactFirstNameTool,
            confirmOrder,
          }

        result = streamText({
          model: openai("gpt-4o"), // Mejor modelo para responder
          system: systemPrompt,
          messages: modelMessages,
          stopWhen: [stepCountIs(5)],
          tools,
        });
      } catch {
        // Fallback si falla el uso de tools
      }
      break;


      case 'menu':
      case 'promotions':
      case 'restaurant-info':
        console.log("Derived to: ", classification.type);

      
      try {
        const latestUserText = getLastUserText(messages);
        let docsSearchHint = "";

        if (classification.type === "promotions" && latestUserText) {
          try {
            const { promotions } = await getPromotions();
            const matchedPromo = findMatchingPromotion(
              latestUserText,
              promotions ?? [],
            );
            const shouldRetryDocs =
              looksLikeSpecificPromoQuestion(latestUserText) && !matchedPromo;

            if (shouldRetryDocs && docsSearchTool?.execute) {
              const docsResult = await docsSearchTool.execute(
                {
                  prompt: `Promocion específica: ${latestUserText}. Condiciones, requisitos, precio.`,
                  userQuery: latestUserText,
                },
                {
                  toolCallId: "docsSearch-fallback",
                  messages: modelMessages,
                },
              );
              docsSearchHint = formatDocsSearchHint(docsResult);
            }
          } catch (error) {
            console.error("Failed to run docsSearch fallback", error);
          }
        }

        const docsSearchContext = docsSearchHint
          ? `\nDocumentos relevantes (docsSearch):\n${docsSearchHint}\n`
          : "";

        const systemPrompt = withBaseContext(
              `
              Estas gestionando una conversación con un cliente interesado en empanadas. Ten en cuenta estos puntos:
              - Si el usuario pregunta por el menú, usa "getMenu" para obtener los sabores y opciones disponibles.
              - Si el usuario pregunta por promociones, usa "getPromotions" para obtener las promociones actuales.
              - Si te preguntan por las condiciones de una promoción específica que no encuentras en las promociones activas, puedes hacer un intento usando "docsSearch" para buscar información complementaria sobre el restaurante y validar si se encuentra allí.
              - Si el usuario pregunta por su orden activa, usa "getActiveOrder" para obtener los detalles de su orden actual.
              - Si el usuario pregunta por otra cosa, usa "docsSearch" para buscar información complementaria sobre el restaurante.
              - Si ya se incluyen resultados de docsSearch en el contexto, NO llames nuevamente al tool "docsSearch".
              - Si no hay coincidencias en promociones activas ni en documentos, indícalo de forma clara.
              - Responde siempre de manera amable y servicial, proporcionando la información solicitada.
              - Ten en cuenta únicamente los datos obtenidos mediante los tools para responder.
            
            Conversation ID actual: ${conversationId ?? "no disponible (solicita al usuario volver a iniciar la conversación si es necesario)"}
          ${docsSearchContext}
          `
          )
          
        const tools = {
              docsSearch: docsSearchTool,
              getMenu: getActiveMenu,
              getPromotions: getActivePromotions,
              getActiveOrder: getActiveOrderTool,
            }

        result = streamText({
          model: openai("gpt-4o"), // Mejor modelo para responder
          system: systemPrompt,
          messages: modelMessages,
          stopWhen: [stepCountIs(5)],
          tools,
        });
      } catch {
        // Fallback si falla el uso de tools
      }
      break;
      


      default:
        console.log("Derived to: ", classification.type)
        result = streamText({
        model: openai("gpt-4o-mini"),
        messages: modelMessages,
        system: withBaseContext("Indica al usuario que no puedes ayudar con ese pedido."),
        });
        break;
    }
  }


  // 3) Return the result stream with sources and reasoning if available
  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
    originalMessages: messages,
    onFinish: async ({
      messages: completedMessages,
    }: {
      messages: UIMessage[];
    }) => {
      if (!conversationId) {
        console.warn('Conversation ID missing; messages will not be persisted.');
        return;
      }
      try {
        await saveConversationMessages(conversationId, completedMessages);
      } catch (error) {
        console.error('Failed to store conversation messages', error);
      }
    },
  });

}

async function buildOrderConversationHint(conversationId?: string) {
  const contextParts: string[] = [];

  if (conversationId) {
    try {
      const activeOrder = await getOrCreateActiveCart(conversationId);
      if (activeOrder) {
        const itemsText = activeOrder.items.length
          ? activeOrder.items
              .map((item) => {
                const name =
                  (item.productSnapshot as { name?: string } | undefined)
                    ?.name ?? item.productId;
                return `${item.quantity}x ${name}`;
              })
              .join(", ")
          : "sin ítems";

        const shippingText = activeOrder.shipping
          ? ` Método de envío: ${activeOrder.shipping.type}${
              activeOrder.shipping.addressDescription
                ? ` (${activeOrder.shipping.addressDescription})`
                : ""
            }.`
          : "";
        const paymentText = activeOrder.payment
          ? ` Pago: ${activeOrder.payment.method ?? activeOrder.payment.status}.`
          : "";
        const contactText = activeOrder.contactFirstName
          ? ` Nombre informado: ${activeOrder.contactFirstName}.`
          : "";

        contextParts.push(
          `Carrito actual (${activeOrder.currency}): subtotal ${activeOrder.subtotalAmount}, descuento ${activeOrder.discountAmount}, total ${activeOrder.totalAmount}. Ítems: ${itemsText}.${shippingText}${paymentText}${contactText}`,
        );
      }
    } catch (error) {
      console.error("Failed to load active order context", error);
    }
  }

  try {
    const menuData = await getActiveMenuDetails();
    if (menuData?.menu) {
      const menuLines: string[] = [];
      menuData.menu.sections.forEach((section) => {
        section.categories.forEach((category) => {
          category.items.forEach(
            (item: {
              name: string;
              price: number;
              currency: string;
              productId: string;
            }) => {
            const labelParts = [section.label, category.category]
              .filter(Boolean)
              .join(" / ");
            menuLines.push(
              `• ${item.name} (${labelParts}) - ${item.price} ${item.currency} | ID: ${item.productId}`,
            );
          },
          );
        });
      });

      contextParts.push(
        `Menú activo "${menuData.menu.name}" (${menuData.menu.totalItems} productos):\n${menuLines.join("\n")}`,
      );

      const promotionsData = await getPromotions({
        menuId: menuData.menu.id,
      });

      if (promotionsData.promotions.length) {
        const promoDescriptions = promotionsData.promotions
          .map((promo: PromotionHint) => describePromotionForHint(promo))
          .join("\n");
        contextParts.push(
          `Promociones activas:\n${promoDescriptions}`,
        );
      } else {
        contextParts.push("No hay promociones activas actualmente.");
      }
    }
  } catch (error) {
    console.error("Failed to load menu/promotions context", error);
  }

  return contextParts.length ? contextParts.join("\n") : undefined;
}

type PromotionHint = Awaited<
  ReturnType<typeof getPromotions>
>["promotions"][number];

function describePromotionForHint(promotion: PromotionHint) {
  if (promotion.type === "FIXED_BUNDLE_PRICE") {
    const pricing =
      promotion.pricing?.fixedPrice !== undefined
        ? `${promotion.pricing.fixedPrice} ${promotion.pricing.currency ?? "ARS"}`
        : "Precio fijo";
    const requirementText = (promotion.requirements ?? [])
      .map((req: PromotionRequirementHint) => describeRequirement(req))
      .join(" + ");

    return `• ${promotion.name}: ${pricing}. Requisitos: ${requirementText}.`;
  }

  if (promotion.type === "QUANTITY_DISCOUNT") {
    const discount =
      promotion.pricing?.discountKind === "PERCENT"
        ? `Desc. ${(promotion.pricing?.discountValue ?? 0) * 100}%`
        : `Desc. ${promotion.pricing?.discountValue ?? 0} ${
            promotion.pricing?.currency ?? "ARS"
          }`;
    const minQty =
      promotion.pricing?.minQty !== undefined
        ? `Mínimo ${promotion.pricing.minQty} unidades`
        : "Sin mínimo declarado";
    return `• ${promotion.name}: ${discount}. ${minQty}.`;
  }

  return `• ${promotion.name}: Detalles no disponibles.`;
}

type PromotionRequirementHint = NonNullable<
  PromotionHint["requirements"]
>[number];

function describeRequirement(requirement: PromotionRequirementHint) {
  const base = `${requirement.qty}x ${requirement.productType}`;

  if (requirement.productType === "EMPANADA" && requirement.empanadaCategory) {
    return `${base} (${requirement.empanadaCategory})`;
  }

  if (
    requirement.productType === "BEVERAGE" &&
    requirement.beverageCategories?.length
  ) {
    return `${base} (${requirement.beverageCategories.join(", ")})`;
  }

  return base;
}

function getLastUserText(messages: UIMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const parts = Array.isArray(message.parts) ? message.parts : [];
    const text = parts
      .filter(isTextUIPart)
      .map((part) => part.text)
      .join(" ")
      .trim();
    if (text) return text;
  }
  return "";
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeSpecificPromoQuestion(text: string) {
  const normalized = normalizeText(text);
  if (!/(promo|promocion|promociones|descuento|oferta|combo)/.test(normalized)) {
    return false;
  }
  const isGeneral = /(promos|promociones)\s+(hay|tenes|tienen|vigentes|disponibles|hoy|ahora)/.test(
    normalized,
  );
  if (isGeneral) return false;
  const hasSpecificMarker =
    /\d/.test(normalized) ||
    /["'“”‘’]/.test(text) ||
    /(promo|promocion|promoción)\s*[:\-]/i.test(text);
  const asksConditions = /(condicion|condiciones|requisitos|incluye|incluyen|que trae|que lleva|aplica|precio|costo|valor)/.test(
    normalized,
  );
  return hasSpecificMarker || asksConditions;
}

type PromotionSummary = Awaited<
  ReturnType<typeof getPromotions>
>["promotions"][number];

function findMatchingPromotion(
  userText: string,
  promotions: PromotionSummary[],
) {
  const normalizedUser = normalizeText(userText);
  return promotions.find((promo: PromotionSummary) => {
    const normalizedName = normalizeText(promo.name ?? "");
    if (!normalizedName) return false;
    if (normalizedUser.includes(normalizedName)) return true;
    const tokens = normalizedName.split(" ").filter((token) => token.length > 2);
    if (tokens.length < 2) return false;
    const matches = tokens.filter((token) => normalizedUser.includes(token));
    return matches.length >= Math.min(2, tokens.length);
  });
}

function formatDocsSearchHint(result: any) {
  const items = Array.isArray(result?.results) ? result.results : [];
  if (!items.length) {
    return "No se encontraron coincidencias relevantes en documentos.";
  }
  return items
    .slice(0, 3)
    .map((item: any) => {
      const path = item?.path ?? "documento";
      const page =
        typeof item?.pageNumber === "number" ? ` p.${item.pageNumber}` : "";
      const snippet = String(item?.text ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 240);
      return `- ${path}${page}: ${snippet}`;
    })
    .join("\n");
}
