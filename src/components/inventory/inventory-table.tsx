"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type InventoryRow = {
  id: string;
  productId: string;
  productName: string;
  productImage?: string | null;
  category: string;
  quantity: number;
  safetyStock: number;
  updatedAt: string;
  status: "low" | "high" | "normal";
};

type SortKey = "product" | "category" | "quantity";

type InventoryTableProps = {
  rows: InventoryRow[];
  categoryLabels?: Record<string, string>;
};

export function InventoryTable({
  rows,
  categoryLabels = {},
}: InventoryTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("product");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortKey === "product") {
        comparison = a.productName.localeCompare(b.productName, "es");
      } else if (sortKey === "category") {
        const aLabel = categoryLabels[a.category] ?? a.category;
        const bLabel = categoryLabels[b.category] ?? b.category;
        comparison = aLabel.localeCompare(bLabel, "es");
      } else {
        comparison = a.quantity - b.quantity;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [rows, sortKey, sortDirection, categoryLabels]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <Card className="border border-amber-100 bg-white/90 shadow-sm">
      <CardHeader className="gap-2">
        <CardTitle className="text-xl font-semibold text-gray-900">
          Detalle por producto
        </CardTitle>
        <p className="text-sm text-gray-500">
          Haz click en cualquier columna para ordenar ascendente o descendente.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full divide-y divide-amber-100 text-sm">
          <thead className="bg-amber-50/60 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <SortableHeader
                label="Producto"
                onClick={() => handleSort("product")}
                active={sortKey === "product"}
                direction={sortDirection}
              />
              <SortableHeader
                label="Categoría"
                onClick={() => handleSort("category")}
                active={sortKey === "category"}
                direction={sortDirection}
              />
              <SortableHeader
                label="Stock actual"
                onClick={() => handleSort("quantity")}
                active={sortKey === "quantity"}
                direction={sortDirection}
                className="text-right"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-50 bg-white/80">
            {sortedRows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 align-top">
                  <div className="flex items-start gap-3">
                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-amber-100 bg-amber-50">
                      {row.productImage ? (
                        <Image
                          src={row.productImage}
                          alt={row.productName}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-amber-500">
                          Sin foto
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">{row.productName}</p>
                      <p className="text-xs text-gray-500">
                        ID: {row.productId} · Actualizado{" "}
                        {new Date(row.updatedAt).toLocaleString("es-AR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-gray-900">
                  <Badge variant="outline">
                    {categoryLabels[row.category] ?? row.category}
                  </Badge>
                </td>
                <td className="px-4 py-3 align-top text-right text-gray-900">
                  <div className="font-semibold">{row.quantity}</div>
                  <p className="text-xs text-gray-500">
                    Mínimo sugerido: {row.safetyStock}
                  </p>
                  {row.status === "low" && (
                    <p className="text-xs text-rose-600">Necesita reposición</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function SortableHeader({
  label,
  onClick,
  className,
  active,
  direction,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  active: boolean;
  direction: "asc" | "desc";
}) {
  return (
    <th className={`px-4 py-2 text-left font-semibold ${className ?? ""}`}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`inline-flex items-center gap-2 px-0 text-xs font-semibold ${
          active ? "text-amber-600" : "text-gray-700"
        }`}
        onClick={onClick}
      >
        {label}
        {active ? (
          direction === "asc" ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUp className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </Button>
    </th>
  );
}

function labelForSortKey(key: SortKey) {
  switch (key) {
    case "category":
      return "Categoría";
    case "quantity":
      return "Stock actual";
    default:
      return "Producto";
  }
}
