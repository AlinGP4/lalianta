import { readSessionToken } from "../../../../Backend/auth";
import { notifyOrderChanged } from "../../../../Backend/order-events";
import { updateOrderAreaStatus, updateOrderItems, updateOrderStatus } from "../../../../Backend/orders";
import { resolvePaymentRequestsByTable } from "../../../../Backend/payment-requests";

export const runtime = "nodejs";

async function requireTpvSession(request) {
  const token = request.cookies.get("tpv_session")?.value;
  const session = await readSessionToken(token);
  if (!session) throw new Error("No autorizado");
  return session;
}

function getHistoryAreaForRole(role, fallbackArea = null) {
  if (role === "cocina") return "kitchen";
  if (role === "barra") return "bar";
  return fallbackArea ?? null;
}

export async function PATCH(request, { params }) {
  try {
    const session = await requireTpvSession(request);
    const { id } = await params;
    const payload = await request.json();
    const sessionHistoryArea = getHistoryAreaForRole(session.role, session.historyArea);

    if (payload.area && sessionHistoryArea && sessionHistoryArea !== payload.area) {
      throw new Error("No autorizado");
    }

    if (Array.isArray(payload.items)) {
      if (!["admin", "camarero"].includes(session.role)) throw new Error("No autorizado");

      const order = await updateOrderItems(id, payload.items);
      if (!order) {
        return Response.json({ error: "Pedido no encontrado" }, { status: 404 });
      }

      notifyOrderChanged({ type: "updated", orderId: order.id, tableNumber: order.tableNumber });
      return Response.json({ order });
    }

    const order = payload.area
      ? await updateOrderAreaStatus(id, payload.area, payload.areaStatus)
      : await updateOrderStatus(id, payload.status);

    if (!order) {
      return Response.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (!payload.area && payload.status === "paid" && order.tableNumber) {
      await resolvePaymentRequestsByTable(order.tableNumber);
    }

    notifyOrderChanged({ type: "updated", orderId: order.id, tableNumber: order.tableNumber });

    return Response.json({ order });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
