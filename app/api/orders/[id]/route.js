import { updateOrderStatus } from "../../../../Backend/orders";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const order = await updateOrderStatus(id, payload.status);

    if (!order) {
      return Response.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    return Response.json({ order });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
