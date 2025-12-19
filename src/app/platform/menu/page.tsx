import { unstable_noStore as noStore } from "next/cache";
import Image from "next/image";

import { getActiveMenuDetails } from "@/lib/services/menu-service";
import { getPromotions } from "@/lib/services/promotion-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PromotionSummary = Awaited<
  ReturnType<typeof getPromotions>
>["promotions"][number];
type PromotionRequirement = PromotionSummary["requirements"][number];

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  CLASSIC: "Clásicas",
  SPECIAL: "Especiales",
  WATER: "Agua",
  SOFT_DRINK: "Gaseosa",
  BEER: "Cerveza",
  Vegetariana: "Vegetariana",
};

export default async function ProductsPage() {
  noStore();

  const menuData = await getActiveMenuDetails();
  const menu = menuData.menu;

  const promotionsData =
    menu?.id && menu.active
      ? await getPromotions({ menuId: menu.id })
      : { promotions: [] };
  const promotions = promotionsData.promotions ?? [];

  return (
    <div className="min-h-screen bg-[#fffaf0]/60 p-8 space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
          Productos y catálogo
        </p>
        <h1 className="text-3xl font-bold text-gray-900">Menú e inventario</h1>
        <p className="text-sm text-gray-600">
          Consulta los productos disponibles, su stock actual y las promociones vigentes.
        </p>
      </header>

      {menu ? (
        <section className="space-y-6">
          {menu.sections.map((section) => (
            <Card key={section.type} className="border-amber-100 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900">
                  {section.label}
                  <Badge variant="secondary">
                    {section.categories.reduce(
                      (sum, category) => sum + category.items.length,
                      0,
                    )}{" "}
                    ítems
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {section.categories.map((category) => (
                  <div key={`${section.type}-${category.category}`} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {CATEGORY_TRANSLATIONS[category.category] ?? category.category}
                      </h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {category.items.map((item) => {
                        const notes = [
                          item.beverage?.isAlcoholic ? "Alcohol" : null,
                          item.empanada?.isGlutenFree ? "Sin gluten" : null,
                          item.empanada?.isVegan ? "Vegana" : null,
                          item.empanada?.isVegetarian ? "Vegetariana" : null,
                        ].filter(Boolean);

                        return (
                          <div
                            key={item.productId}
                            className="flex gap-3 rounded-2xl border border-amber-50 bg-white/80 p-4 shadow-sm"
                          >
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-amber-50">
                              {item.image ? (
                                <Image
                                  src={item.image}
                                  alt={item.name}
                                  fill
                                  className="object-cover"
                                  sizes="80px"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-amber-400">
                                  Sin foto
                                </div>
                              )}
                            </div>
                            <div className="flex w-full flex-col">
                              <div className="flex flex-col items-start justify-start">
                                <div>
                                  <p className="text-base font-semibold text-gray-900 line-clamp-1">
                                    {item.name}
                                  </p>
                                  {item.description && (
                                    <p className="text-xs text-gray-500">{item.description}</p>
                                  )}
                                </div>
                                <span className="text-sm font-semibold text-amber-700">
                                  {item.price} {item.currency}
                                </span>
                              </div>
                              {notes.length > 0 && (
                                <div className="mt-auto flex flex-wrap gap-1 pt-2">
                                  {notes.map((note) => {
                                    const badgeLabel =
                                      CATEGORY_TRANSLATIONS[note ?? ""] ?? note;
                                    return (
                                      <Badge
                                        key={`${item.productId}-${badgeLabel}`}
                                        variant="outline"
                                      >
                                        {badgeLabel}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="border border-dashed border-amber-200 bg-white/70">
          <CardContent className="py-8 text-center text-sm text-gray-500">
            No hay un menú activo configurado. Crea uno para comenzar.
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Promociones activas
          </p>
          <h2 className="text-2xl font-semibold text-gray-900">Condiciones vigentes</h2>
        </div>

        {promotions.length === 0 ? (
          <Card className="border border-dashed border-amber-200 bg-white/70">
            <CardContent className="py-6 text-center text-sm text-gray-500">
              No tienes promociones activas para este menú.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {promotions.map((promo: PromotionSummary) => (
              <Card key={promo.id} className="border-amber-100 bg-white/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-gray-900">
                    <span>{promo.name}</span>
                    <Badge variant={promo.active ? "default" : "secondary"}>
                      {promo.active ? "Activa" : "Inactiva"}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    {describePromotionPricing(promo)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Requisitos
                  </p>
                  <ul className="space-y-2 text-sm text-gray-800">
                    {promo.requirements.map((req: PromotionRequirement) => (
                      <li key={req.id} className="rounded-lg bg-amber-50/70 px-3 py-2">
                        {describeRequirement(req)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500">
                    {promo.stackable
                      ? "Acumulable con otras promociones."
                      : "No acumulable con otras promociones."}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function describeRequirement(requirement: PromotionRequirement) {
  const base = `${requirement.qty}×`;
  if (requirement.productType === "EMPANADA") {
    const categoryLabel =
      CATEGORY_TRANSLATIONS[requirement.empanadaCategory ?? ""] ??
      requirement.empanadaCategory ??
      "cualquier categoría";
    return `${base} Empanadas (${categoryLabel})`;
  }
  if (requirement.productType === "BEVERAGE") {
    const categories = requirement.beverageCategories?.length
      ? requirement.beverageCategories
          .map(
            (
              category: NonNullable<PromotionRequirement["beverageCategories"]>[number],
            ) =>
              CATEGORY_TRANSLATIONS[category] ??
              category,
          )
          .join(", ")
      : "cualquier bebida";
    return `${base} Bebidas (${categories})`;
  }
  return `${base} Productos de tipo ${requirement.productType ?? "libre"}`;
}

function describePromotionPricing(promotion: PromotionSummary) {
  if (promotion.type === "FIXED_BUNDLE_PRICE") {
    const price =
      promotion.pricing?.fixedPrice !== undefined
        ? `${promotion.pricing.fixedPrice} ${promotion.pricing.currency ?? "ARS"}`
        : "Precio fijo";
    return `Bundle a ${price}.`;
  }

  if (promotion.pricing?.discountKind === "PERCENT") {
    return `Descuento del ${(promotion.pricing.discountValue ?? 0) * 100}% (mínimo ${
      promotion.pricing.minQty ?? 0
    } unidades).`;
  }

  return `Descuento de ${promotion.pricing?.discountValue ?? 0} ${
    promotion.pricing?.currency ?? "ARS"
  } (mínimo ${promotion.pricing?.minQty ?? 0} unidades).`;
}
