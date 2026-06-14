import { deleteTable, setTableActive } from "../../../../Backend/tables";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const table = await setTableActive(id, payload.active);

    if (!table) {
      return Response.json({ error: "Mesa no encontrada" }, { status: 404 });
    }

    return Response.json({ table });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteTable(id);

    if (!deleted) {
      return Response.json({ error: "Mesa no encontrada" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
