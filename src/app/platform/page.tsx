import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { MessageSquare, ShoppingBag, Boxes, Package, ArrowRight } from "lucide-react";

import { prisma } from "@/lib/db/prisma/client";
import { OrderStatus } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardMetrics = {
  conversations: number;
  orders: number;
  menuItems: number;
  promotions: number;
  inventoryRecords: number;
  stockUnits: number;
};

async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [conversations, orders, menuItems, promotions, inventoryRecords, inventorySum] = await Promise.all([
    prisma.conversation.count(),
    prisma.order.count({
      where: { status: OrderStatus.CONFIRMED },
    }),
    prisma.product.count(),
    prisma.promotion.count(),
    prisma.inventory.count(),
    prisma.inventory.aggregate({
      _sum: { quantity: true },
    }),
  ]);

  return {
    conversations,
    orders,
    menuItems,
    promotions,
    inventoryRecords,
    stockUnits: inventorySum._sum.quantity ?? 0,
  };
}

export default async function DashboardPage() {
  noStore();
  const metrics = await getDashboardMetrics();

  const metricCards = [
    {
      label: "Conversaciones",
      value: metrics.conversations,
      description: "Chats totales con clientes",
      icon: MessageSquare,
      accent: "bg-amber-100 text-amber-600",
      cta: { href: "/platform/chats", label: "Ver conversaciones" },
    },
    {
      label: "Órdenes",
      value: metrics.orders,
      description: "Pedidos generados en la plataforma",
      icon: ShoppingBag,
      accent: "bg-amber-100 text-amber-600",
      cta: { href: "/platform/orders", label: "Ir a órdenes" },
    },
    {
      label: "Menú",
      value: metrics.menuItems,
      description: `Productos en menú (${metrics.promotions} promociones)`,
      icon: Boxes,
      accent: "bg-amber-100 text-amber-600",
      cta: { href: "/platform/menu", label: "Ver catálogo" },
    },
    {
      label: "Inventario",
      value: metrics.stockUnits,
      description: "Unidades totales en stock",
      icon: Package,
      accent: "bg-amber-100 text-amber-600",
      cta: { href: "/platform/inventory", label: "Auditar stock" },
    },
  ];

  return (
    <div className="min-h-screen bg-[#fffaf0]/60 p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Panel general
          </p>
          <h1 className="text-3xl font-bold text-gray-900">Estado del negocio</h1>
          <p className="text-sm text-gray-600">
            Mira los indicadores principales y accede rápidamente a los pedidos confirmados.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="border-amber-100 bg-white/90 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  {metric.label}
                </CardTitle>
                <span className={`rounded-full p-2 text-sm ${metric.accent}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-bold text-gray-900">{metric.value}</div>
                <p className="text-sm text-gray-500">{metric.description}</p>
                <Link
                  href={metric.cta.href}
                  className="inline-flex items-center text-sm font-semibold text-amber-600 transition hover:text-amber-700"
                >
                  {metric.cta.label}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
