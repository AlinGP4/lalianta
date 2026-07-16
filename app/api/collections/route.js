import { readSessionToken } from "../../../Backend/auth";
import { notifyCatalogChanged } from "../../../Backend/catalog-events";
import { listCollections, setCollectionProducts } from "../../../Backend/collections";

export const runtime = "nodejs";

async function requireAdmin(request) {
  const token = request.cookies.get("tpv_session")?.value;
  const session = await readSessionToken(token);
  if (!session || session.role !== "admin") {
    throw new Error("No autorizado");
  }
}

export async function GET() {
  try {
    const collections = await listCollections();
    return Response.json({ collections });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await requireAdmin(request);
    const payload = await request.json();
    const collections = await setCollectionProducts(payload.categoryId, payload.productIds);
    notifyCatalogChanged({ categoryId: payload.categoryId, type: "collection-updated" });

    return Response.json({ collections });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
