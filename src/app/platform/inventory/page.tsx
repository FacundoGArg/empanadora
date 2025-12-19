import { unstable_noStore as noStore } from "next/cache";

import { prisma } from "@/lib/db/prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InventoryTable, type InventoryRow } from "@/components/inventory/inventory-table";

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  CLASSIC: "Clásicas",
  SPECIAL: "Especiales",
  WATER: "Agua",
  SOFT_DRINK: "Gaseosa",
  BEER: "Cerveza",
  DESSERT: "Postres",
};

export default async function InventoryPage() {
  noStore();

  const inventories = await prisma.inventory.findMany({
    include: {
      product: {
        include: {
          empanada: true,
          beverage: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const rows: InventoryRow[] = inventories.map(
    (record: typeof inventories[number]) => {
    const category =
      record.product?.empanada?.category ??
      record.product?.beverage?.category ??
      record.product?.type ??
      "N/A";

    const status: InventoryRow["status"] =
      record.quantity <= record.safetyStock
        ? "low"
        : record.quantity > record.safetyStock * 2 && record.safetyStock > 0
          ? "high"
          : "normal";

    return {
      id: record.id,
      productId: record.product?.id ?? record.productId,
      productName: record.product?.name ?? "Producto desconocido",
      productImage: record.product?.image ?? null,
      category,
      quantity: record.quantity,
      safetyStock: record.safetyStock,
      updatedAt: record.updatedAt.toISOString(),
      status,
    };
    },
  );

  const lowStockItems = rows.filter(
    (item) => item.quantity <= item.safetyStock && item.safetyStock > 0,
  );
  const totalStockUnits = rows.reduce(
    (sum, item) => sum + (item.quantity ?? 0),
    0,
  );

  return (
    <div className="min-h-screen bg-[#fffaf0]/60 p-4 sm:p-6 lg:p-8 space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
          Inventario
        </p>
        <h1 className="text-3xl font-bold text-gray-900">Control de stock</h1>
        <p className="text-sm text-gray-600">
          Monitorea el stock disponible por producto y detecta rápidamente los faltantes.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-amber-100 bg-white/90 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              SKU monitoreados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{rows.length}</p>
            <p className="text-sm text-gray-500">Productos con inventario registrado.</p>
          </CardContent>
        </Card>
        <Card className="border-amber-100 bg-white/90 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Necesitan reposición
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-rose-600">{lowStockItems.length}</p>
            <p className="text-sm text-gray-500">
              Cantidad de productos en o por debajo del stock mínimo.
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-100 bg-white/90 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Stock total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{totalStockUnits}</p>
            <p className="text-sm text-gray-500">Unidades totales disponibles.</p>
          </CardContent>
        </Card>
      </div>

      <InventoryTable rows={rows} categoryLabels={CATEGORY_TRANSLATIONS} />
    </div>
  );
}
