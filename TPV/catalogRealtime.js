export function subscribeToCatalogChanges(onChange, onError) {
  if (typeof window === "undefined") return () => {};

  const eventSource = new EventSource("/api/catalog/stream");

  eventSource.addEventListener("catalog-change", (event) => {
    onChange(JSON.parse(event.data));
  });

  eventSource.addEventListener("error", () => {
    onError?.();
  });

  return () => eventSource.close();
}

export function pruneCartByVisibleProducts(cart, products) {
  const productsById = new Map(products.map((product) => [product.id, product]));

  return cart.filter((item) => {
    const productId = item.productId ?? item.id;
    const product = productsById.get(productId);
    return product?.active && !product.soldOut;
  });
}
