import { PrismaClient, ProductType, EmpanadaCategory, BeverageCategory, PromotionType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {

  // ------------------------------------------------------------------
  // 1) Menú único
  // ------------------------------------------------------------------
  const menu = await prisma.menu.create({
    data: {
      name: "Menú Principal",
      active: true,
    },
  });

  const ARS = "ARS";

  // Precios
  const PRICE_CLASSIC = 2500;
  const PRICE_SPECIAL = 3200;

  const PRICE_WATER = 1200;
  const PRICE_SOFT = 1800;
  const PRICE_BEER = 2500;

  const PRICE_FLAN = 2500;
  const PRICE_PANQUEQUE = 3000;

  const EMPANADA_CLASSIC_DEFAULT_STOCK = 300;
  const EMPANADA_SPECIAL_DEFAULT_STOCK = 200;
  const BEVERAGE_DEFAULT_STOCK = 200;
  const DESSERT_DEFAULT_STOCK = 100;

  const EMPANADA_MIN_STOCK = 50;
  const BEVERAGE_MIN_STOCK = 30;
  const DESSERT_MIN_STOCK = 20;

  // ------------------------------------------------------------------
  // 2) Productos
  // ------------------------------------------------------------------
  const imagePath = (filename: string) => `/images/menu/${filename}`;

  const classicEmpanadas = [
    {
      name: "Carne suave",
      image: imagePath("empanada-carne-suave.png"),
      ingredients: ["carne vacuna", "cebolla", "pimiento", "huevo", "aceitunas", "condimentos"],
      isVegan: false,
      isVegetarian: false,
      isGlutenFree: false,
    },
    {
      name: "Jamón y queso",
      image: imagePath("empanada-jamon-queso.png"),
      ingredients: ["jamon", "queso mozzarella"],
      isVegan: false,
      isVegetarian: false,
      isGlutenFree: false,
    },
    {
      name: "Pollo",
      image: imagePath("empanada-pollo.png"),
      ingredients: ["pollo", "cebolla", "pimiento", "huevo", "condimentos"],
      isVegan: false,
      isVegetarian: false,
      isGlutenFree: false,
    },
    {
      name: "Capresse",
      image: imagePath("empanada-caprese.png"),
      ingredients: ["tomate", "mozzarella", "albahaca", "aceite de oliva"],
      isVegan: false,
      isVegetarian: true,
      isGlutenFree: false,
    },
    {
      name: "Humita",
      image: imagePath("empanada-humita.png"),
      ingredients: ["maiz", "cebolla", "queso", "crema"],
      isVegan: false,
      isVegetarian: true,
      isGlutenFree: false,
    },
    {
      name: "Roquefort",
      image: imagePath("empanada-roquefort.png"),
      ingredients: ["queso roquefort", "cebolla", "crema"],
      isVegan: false,
      isVegetarian: true,
      isGlutenFree: false,
    },
  ];

  const specialEmpanadas = [
    {
      name: "Vacío al malbec",
      image: imagePath("empanada-vacio-malbec.png"),
      ingredients: ["vacio", "malbec", "cebolla", "pimiento"],
      isVegan: false,
      isVegetarian: false,
      isGlutenFree: false,
    },
    {
      name: "Bondiola a la pizza",
      image: imagePath("empanada-bondiola-pizza.png"),
      ingredients: ["bondiola", "tomate", "mozzarella", "oregano"],
      isVegan: false,
      isVegetarian: false,
      isGlutenFree: false,
    },
    {
      name: "Cuatro quesos",
      image: imagePath("empanada-cuatro-quesos.png"),
      ingredients: ["mozzarella", "roquefort", "parmesano", "provolone"],
      isVegan: false,
      isVegetarian: true,
      isGlutenFree: false,
    },
    {
      name: "Hongos del bosque",
      image: imagePath("empanada-hongos.png"),
      ingredients: ["hongos", "cebolla", "ajo", "crema"],
      isVegan: false,
      isVegetarian: true,
      isGlutenFree: false,
    },
  ];

  const waters = [
    { name: "Agua sin gas", category: BeverageCategory.WATER, isAlcoholic: false, price: PRICE_WATER, image: imagePath("bebida-agua-sin-gas.png") },
    { name: "Agua con gas", category: BeverageCategory.WATER, isAlcoholic: false, price: PRICE_WATER, image: imagePath("bebida-agua-con-gas.png") },
  ];

  const softDrinks = [
    { name: "Coca Cola Regular", category: BeverageCategory.SOFT_DRINK, isAlcoholic: false, price: PRICE_SOFT, image: imagePath("bebida-coca-cola-regular.png") },
    { name: "Coca Cola Zero", category: BeverageCategory.SOFT_DRINK, isAlcoholic: false, price: PRICE_SOFT, image: imagePath("bebida-coca-cola-zero.png") },
    { name: "Sprite", category: BeverageCategory.SOFT_DRINK, isAlcoholic: false, price: PRICE_SOFT, image: imagePath("bebida-sprite.png") },
    { name: "Fanta", category: BeverageCategory.SOFT_DRINK, isAlcoholic: false, price: PRICE_SOFT, image: imagePath("bebida-fanta.png") },
  ];

  const beers = [
    { name: "Quilmes", category: BeverageCategory.BEER, isAlcoholic: true, price: PRICE_BEER, image: imagePath("bebida-quilmes.png") },
    { name: "Heineken", category: BeverageCategory.BEER, isAlcoholic: true, price: PRICE_BEER, image: imagePath("bebida-heineken.png") },
  ];

  const desserts = [
    { name: "Flan con dulce de leche", price: PRICE_FLAN, image: imagePath("postre-flan.png") },
    { name: "Panqueque de dulce de leche", price: PRICE_PANQUEQUE, image: imagePath("postre-panqueques.png") },
  ];

  // Helper: crea producto + (submodelo) y devuelve productId
  const createdProducts: { name: string; id: string; type: ProductType }[] = [];

  // Empanadas clásicas
  for (const empanada of classicEmpanadas) {
    const p = await prisma.product.create({
      data: {
        name: empanada.name,
        type: ProductType.EMPANADA,
        image: empanada.image,
        empanada: {
          create: {
            category: EmpanadaCategory.CLASSIC,
            ingredients: empanada.ingredients,
            isVegan: empanada.isVegan,
            isVegetarian: empanada.isVegetarian,
            isGlutenFree: empanada.isGlutenFree,
          },
        },
      },
    });
    createdProducts.push({ name: empanada.name, id: p.id, type: p.type });
    await prisma.inventory.create({
      data: {
        productId: p.id,
        quantity: EMPANADA_CLASSIC_DEFAULT_STOCK,
        safetyStock: EMPANADA_MIN_STOCK,
      },
    });
    await prisma.menuItem.create({
      data: { menuId: menu.id, productId: p.id, price: PRICE_CLASSIC, currency: ARS },
    });
  }

  // Empanadas especiales
  for (const empanada of specialEmpanadas) {
    const p = await prisma.product.create({
      data: {
        name: empanada.name,
        type: ProductType.EMPANADA,
        image: empanada.image,
        empanada: {
          create: {
            category: EmpanadaCategory.SPECIAL,
            ingredients: empanada.ingredients,
            isVegan: empanada.isVegan,
            isVegetarian: empanada.isVegetarian,
            isGlutenFree: empanada.isGlutenFree,
          },
        },
      },
    });
    createdProducts.push({ name: empanada.name, id: p.id, type: p.type });
    await prisma.inventory.create({
      data: {
        productId: p.id,
        quantity: EMPANADA_SPECIAL_DEFAULT_STOCK,
        safetyStock: EMPANADA_MIN_STOCK,
      },
    });
    await prisma.menuItem.create({
      data: { menuId: menu.id, productId: p.id, price: PRICE_SPECIAL, currency: ARS },
    });
  }

  // Bebidas (agua / gaseosas / cervezas)
  for (const b of [...waters, ...softDrinks, ...beers]) {
    const p = await prisma.product.create({
      data: {
        name: b.name,
        type: ProductType.BEVERAGE,
        image: b.image,
        beverage: {
          create: {
            category: b.category,
            isAlcoholic: b.isAlcoholic,
          },
        },
      },
    });
    createdProducts.push({ name: b.name, id: p.id, type: p.type });
    await prisma.inventory.create({
      data: {
        productId: p.id,
        quantity: BEVERAGE_DEFAULT_STOCK,
        safetyStock: BEVERAGE_MIN_STOCK,
      },
    });
    await prisma.menuItem.create({
      data: { menuId: menu.id, productId: p.id, price: b.price, currency: ARS },
    });
  }

  // Postres (no hay submodelo Dessert en tu schema, así que van directo en Product)
  for (const d of desserts) {
    const p = await prisma.product.create({
      data: {
        name: d.name,
        type: ProductType.DESSERT,
        image: d.image,
      },
    });
    createdProducts.push({ name: d.name, id: p.id, type: p.type });
    await prisma.inventory.create({
      data: {
        productId: p.id,
        quantity: DESSERT_DEFAULT_STOCK,
        safetyStock: DESSERT_MIN_STOCK,
      },
    });
    await prisma.menuItem.create({
      data: { menuId: menu.id, productId: p.id, price: d.price, currency: ARS },
    });
  }

  // ------------------------------------------------------------------
  // 3) Promociones
  // ------------------------------------------------------------------

  const beverageAllowed = [BeverageCategory.WATER, BeverageCategory.SOFT_DRINK];

  await prisma.promotion.create({
    data: {
      name: "Promo: 3 Empanadas Clásicas + 1 Bebida (Agua/Gaseosa)",
      type: PromotionType.FIXED_BUNDLE_PRICE,
      active: true,
      fixedPrice: 8200,
      currency: ARS,
      menuId: menu.id,
      stackable: false,
      requirements: {
        create: [
          {
            qty: 3,
            productType: ProductType.EMPANADA,
            empanadaCategory: EmpanadaCategory.CLASSIC,
            beverageCategories: [],
          },
          {
            qty: 1,
            productType: ProductType.BEVERAGE,
            beverageCategories: beverageAllowed,
          },
        ],
      },
    },
  });

  await prisma.promotion.create({
    data: {
      name: "Promo: 6 Empanadas Clásicas + 2 Bebidas (Agua/Gaseosa)",
      type: PromotionType.FIXED_BUNDLE_PRICE,
      active: true,
      fixedPrice: 16500,
      currency: ARS,
      menuId: menu.id,
      stackable: false,
      requirements: {
        create: [
          {
            qty: 6,
            productType: ProductType.EMPANADA,
            empanadaCategory: EmpanadaCategory.CLASSIC,
            beverageCategories: [],
          },
          {
            qty: 2,
            productType: ProductType.BEVERAGE,
            beverageCategories: beverageAllowed,
          },
        ],
      },
    },
  });

  await prisma.promotion.create({
    data: {
      name: "Promo: 12 Empanadas Clásicas",
      type: PromotionType.FIXED_BUNDLE_PRICE,
      active: true,
      fixedPrice: 27000,
      currency: ARS,
      menuId: menu.id,
      stackable: true, // Si, y se podría aplicar 2x con 24 empanadas
      requirements: {
        create: [
          {
            qty: 12,
            productType: ProductType.EMPANADA,
            empanadaCategory: EmpanadaCategory.CLASSIC,
            beverageCategories: [],
          },
        ],
      },
    },
  });

  // ------------------------------------------------------------------
  // Listo
  console.log("Seed OK:", {
    menuId: menu.id,
    products: createdProducts.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
