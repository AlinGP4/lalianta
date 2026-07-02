import { notifyCatalogChanged } from "../../../Backend/catalog-events";
import { createCategory, listCategories, reorderCategories } from "../../../Backend/categories";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") !== "false";
    const categories = await listCategories({ includeInactive });

    return Response.json({ categories });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const category = await createCategory(payload);
    notifyCatalogChanged({ categoryId: category.id, type: "category-created" });

    return Response.json({ category }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const payload = await request.json();
    const categories = await reorderCategories(payload.categoryIds);
    notifyCatalogChanged({ type: "categories-reordered" });

    return Response.json({ categories });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
