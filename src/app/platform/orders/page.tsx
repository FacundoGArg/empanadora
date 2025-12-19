import { unstable_noStore as noStore } from "next/cache";
import { OrderStatus } from "@prisma/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Image from "next/image";

import { prisma } from "@/lib/db/prisma/client";
import { Badge } from "@/components/ui/badge";

function getCurrencyFormatter(currency: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  });
}

export default async function OrdersPage() {
  noStore();
  const orders = await prisma.order.findMany({
    where: { status: OrderStatus.CONFIRMED },
    include: {
      items: {
        include: {
          product: {
            select: {
              name: true,
              image: true,
            },
          },
        },
      },
      shipping: true,
      payment: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-[#fffaf0]/60 p-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
          Pedidos confirmados
        </p>
        <h1 className="text-3xl font-bold text-gray-900">Órdenes</h1>
        <p className="text-sm text-gray-600">
          Monitorea las órdenes confirmadas junto con su detalle operativo.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-amber-200 bg-white/70 p-6 text-center text-sm text-gray-600">
          Todavía no hay pedidos confirmados. Cuando cierres el primero lo verás acá.
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => {
            const formatter = getCurrencyFormatter(order.currency);
            const totalItems = order.items.reduce(
              (sum, item) => sum + item.quantity,
              0,
            );
            const placedAt = format(order.updatedAt, "PPPp", { locale: es });

            return (
              <div
                key={order.id}
                className="rounded-xl border border-amber-100 bg-white/90 p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-semibold text-gray-900">
                        Pedido #{order.id.slice(-6)}
                      </h2>
                      <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                        Confirmado
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">Actualizado {placedAt}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Total
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatter.format(order.totalAmount)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Subtotal {formatter.format(order.subtotalAmount)} · Descuentos{" "}
                      {formatter.format(order.discountAmount)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex gap-12">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Cliente
                    </p>
                    <p className="text-sm text-gray-900">
                      {order.contactFirstName ?? "No informado"}
                    </p>
                    <p className="text-xs text-gray-500">{totalItems} ítems</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Envío
                    </p>
                    <p className="text-sm text-gray-900">
                      {order.shipping?.type === "DELIVERY"
                        ? "Delivery"
                        : order.shipping?.type === "PICKUP"
                          ? "Retiro en local"
                          : "Sin definir"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {order.shipping?.addressDescription ??
                        order.shipping?.pickupLocation ??
                        "Sin detalles"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Pago
                    </p>
                    <p className="text-sm text-gray-900">
                      {order.payment?.method === "CARD"
                        ? "Tarjeta"
                        : order.payment?.method === "CASH"
                          ? "Efectivo"
                          : "Pendiente"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Estado: {order.payment?.status ?? "PENDIENTE"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-lg bg-amber-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-3">
                    Ítems
                  </p>
                  <div className="grid gap-3 sm:grid-cols-4">
                    {order.items.map((item) => {
                      const snapshot = item.productSnapshot as {
                        name?: string;
                        image?: string | null;
                      } | null;
                      const name =
                        snapshot?.name ?? item.product?.name ?? item.productId;
                      const image =
                        snapshot?.image ?? item.product?.image ?? null;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-xl border border-amber-100 bg-white/80 p-3 shadow-sm"
                        >
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-amber-100">
                            {image ? (
                              <Image
                                src={image}
                                alt={name}
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-amber-400">
                                Sin foto
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                              {item.quantity}× {name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatter.format(item.totalPrice)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
