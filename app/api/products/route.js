import { notifyCatalogChanged } from "../../../Backend/catalog-events";
import { createProduct, listProducts, reorderProducts } from "../../../Backend/products";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") !== "false";
    const products = await listProducts({ includeInactive });

    return Response.json({ products });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const product = await createProduct(payload);
    notifyCatalogChanged({ productId: product.id, type: "product-created" });

    return Response.json({ product }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const payload = await request.json();
    const products = await reorderProducts(payload.productIds);
    notifyCatalogChanged({ type: "products-reordered" });

    return Response.json({ products });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
