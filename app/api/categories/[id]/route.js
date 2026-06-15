import { deleteCategory, updateCategory } from "../../../../Backend/categories";

export const runtime = "nodejs";

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const category = await updateCategory(id, payload);
    if (!category) return Response.json({ error: "Categoria no encontrada" }, { status: 404 });

    return Response.json({ category });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteCategory(id);
    if (!deleted) return Response.json({ error: "Categoria no encontrada" }, { status: 404 });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
