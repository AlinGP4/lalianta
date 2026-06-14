import { deleteProduct, getProduct, updateProduct } from "../../../../Backend/products";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const product = await getProduct(id);

    if (!product) {
      return Response.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    return Response.json({ product });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const product = await updateProduct(id, payload);

    if (!product) {
      return Response.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    return Response.json({ product });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteProduct(id);

    if (!deleted) {
      return Response.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
