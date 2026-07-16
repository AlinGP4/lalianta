export const ALL_CATEGORY = "Todo";

function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-ES");
}

function collectionProductsFor(category, collections, products) {
  const productIds = collections.find((collection) => collection.categoryId === category.id)?.productIds ?? [];

  return productIds
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean);
}

function findCategoryByName(categories, name) {
  return categories.find((category) => normalizeName(category.name) === normalizeName(name));
}

/**
 * Tabs del panel de pedir, en el orden manual de la pestaña Categorías.
 * Cae al orden implícito de los productos si aún no hay categorías cargadas.
 * Solo el panel del camarero muestra "Todo" (includeAll).
 */
export function buildCategoryTabs({ categories = [], collections = [], products = [], includeAll = true } = {}) {
  const categoriesWithProducts = new Set(products.map((product) => normalizeName(product.category)));
  const tabs = categories.length === 0
    ? Array.from(new Set(products.map((product) => product.category).filter(Boolean)))
    : categories
      .filter((category) => (
        category.kind === "collection"
          ? collectionProductsFor(category, collections, products).length > 0
          : categoriesWithProducts.has(normalizeName(category.name))
      ))
      .map((category) => category.name);

  return includeAll ? [ALL_CATEGORY, ...tabs] : tabs;
}

export function filterProductsByCategory({ category, categories = [], collections = [], products = [] } = {}) {
  if (category === ALL_CATEGORY) return products;
  if (!category) return [];

  const selected = findCategoryByName(categories, category);
  if (selected?.kind === "collection") {
    return collectionProductsFor(selected, collections, products);
  }

  return products.filter((product) => normalizeName(product.category) === normalizeName(category));
}
