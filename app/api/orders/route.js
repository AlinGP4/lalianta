import { readSessionToken } from "../../../Backend/auth";
import { notifyOrderChanged } from "../../../Backend/order-events";
import { createOrder, deleteOrdersByScope, deleteOrdersByTable, listOrders } from "../../../Backend/orders";
import { getCustomerOrderingState } from "../../../Backend/settings";

export const runtime = "nodejs";

async function requireTpvSession(request) {
  const token = request.cookies.get("tpv_session")?.value;
  const session = await readSessionToken(token);
  if (!session) throw new Error("No autorizado");
  return session;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orders = await listOrders({
      status: searchParams.get("status"),
      source: searchParams.get("source"),
      tableNumber: searchParams.get("tableNumber"),
      includeItems: searchParams.get("includeItems") === "true",
    });

    return Response.json({ orders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();

    if (payload.source === "customer" || payload.source === "bar") {
      const customerOrderingState = await getCustomerOrderingState();
      if (payload.source === "customer" && !customerOrderingState.enabled) {
        return Response.json(
          {
            error: customerOrderingState.blockedReason === "cash_closed"
              ? "Caja cerrada. Actualmente no está permitido realizar pedidos desde esta mesa."
              : "Actualmente no está permitido realizar pedidos desde esta mesa.",
          },
          { status: 403 },
        );
      }

      if (payload.source === "bar" && !customerOrderingState.cashOpen) {
        return Response.json(
          { error: "Caja cerrada. Abre caja para realizar ventas en barra." },
          { status: 403 },
        );
      }
    }

    const order = await createOrder(payload);
    notifyOrderChanged({ type: "created", orderId: order.id, tableNumber: order.tableNumber });

    return Response.json({ order }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    const session = await requireTpvSession(request);
    const { searchParams } = new URL(request.url);
    const tableNumber = searchParams.get("tableNumber");
    const scope = searchParams.get("scope");
    if (!tableNumber && session.role !== "admin") {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }

    const deletedCount = tableNumber
      ? await deleteOrdersByTable(tableNumber)
      : await deleteOrdersByScope(scope);
    notifyOrderChanged({ type: "deleted", scope, tableNumber });

    return Response.json({ ok: true, deletedCount, orders: [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
