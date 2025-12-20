"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Menu, RefreshCcw, Loader2 } from "lucide-react";

import { useConversation } from "@/components/chat/conversation-context";

type OrderItemSummary = {
  id: string;
  productId: string;
  productImage: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productSnapshot: Record<string, unknown> | null;
};

type OrderSummary = {
  id: string;
  status: string;
  currency: string;
  subtotalAmount: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  items: OrderItemSummary[];
};

export const OrderTracker = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { conversationId, orderRefreshToken } = useConversation();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = order?.currency ?? "ARS";
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
      }),
    [currency],
  );

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  const fetchOrder = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/orders/active", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversationId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo obtener el pedido.");
      }

      setOrder(payload as OrderSummary);
    } catch (err) {
      console.error("Failed to fetch order", err);
      setError(
        err instanceof Error
          ? err.message
          : "Hubo un problema al recuperar el pedido.",
      );
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setOrder(null);
      setError(null);
      return;
    }
    fetchOrder();
  }, [conversationId, fetchOrder, orderRefreshToken]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSidebarOpen(event.matches);
    };

    setSidebarOpen(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const renderItems = () => {
    if (!order) {
      return null;
    }

    if (order.items.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          Aún no agregaste productos. Pídele algo a Dora para comenzar.
        </p>
      );
    }

    return (
      <ul className="space-y-3">
        {order.items.map((item) => {
          const productName =
            item.productName ||
            (item.productSnapshot as { name?: string })?.name ||
            `Producto ${item.productId.slice(-4)}`;
          const image =
            item.productImage ||
            (item.productSnapshot as { image?: string | null })?.image ||
            null;
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-sm border border-border bg-white/70 px-3 py-2 shadow-sm"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-amber-50">
                {image ? (
                  <Image
                    src={image}
                    alt={productName}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-amber-400">
                    
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col text-sm">
                <div className="flex items-center justify-between font-medium">
                  <span className="truncate pr-2">{productName}</span>
                  <span>{currencyFormatter.format(item.totalPrice)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {currencyFormatter.format(item.unitPrice)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderContent = () => {
    if (!conversationId) {
      return (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Envía tu primer mensaje para iniciar una conversación y comenzar el
          pedido.
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <section>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Estado</span>
            <span className="font-semibold">
              {order?.status === "CONFIRMED" ? "Confirmado" : "En curso"}
            </span>
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ítems del pedido
          </h3>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Actualizando pedido...
            </div>
          ) : (
            renderItems()
          )}
        </section>
        {order && (
          <section className="rounded-lg border border-border bg-white/70 p-3 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Totales
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{currencyFormatter.format(order.subtotalAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Descuentos</dt>
                <dd>-{currencyFormatter.format(order.discountAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd>{currencyFormatter.format(order.deliveryFee)}</dd>
              </div>
              <div className="flex justify-between border-t border-dashed pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{currencyFormatter.format(order.totalAmount)}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    );
  };

  const panelClasses = sidebarOpen
    ? "fixed inset-0 z-40 h-[100svh] w-[100svw] bg-[#fffaf0] transition-all duration-300 ease-in-out sm:static sm:h-auto sm:w-80 sm:border-r sm:border-gray-200"
    : "hidden bg-[#fffaf0] transition-all duration-300 ease-in-out sm:flex sm:w-16 sm:border-r sm:border-gray-200";

  return (
    <>
      <div className={`${panelClasses} flex flex-col`}>
        <div className="flex h-full min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:border-b-0">
            {sidebarOpen && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Seguimiento
                </p>
                <h2 className="text-lg font-semibold leading-tight">
                  Tu pedido
                </h2>
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              {sidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  onClick={() => fetchOrder()}
                  disabled={loading || !conversationId}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                onClick={toggleSidebar}
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {sidebarOpen && (
            <div className="flex-1 overflow-y-auto px-4 pt-2 pb-6">
              {renderContent()}
            </div>
          )}
          {!sidebarOpen && (
            <div className="flex-1 items-center justify-center p-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Orden
            </div>
          )}
        </div>
      </div>
      {!sidebarOpen && (
        <Button
          type="button"
          variant="secondary"
          onClick={toggleSidebar}
          className="fixed top-3 right-4 z-50 gap-2 rounded-full shadow-lg sm:hidden"
        >
          <Menu className="h-4 w-4" />
          Ver pedido
        </Button>
      )}
    </>
  );
};
