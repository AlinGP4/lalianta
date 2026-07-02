import { notifyOrderChanged } from "../../../../Backend/order-events";
import { listOrders, settleDeliveredItems } from "../../../../Backend/orders";
import { resolvePaymentRequestsByTable } from "../../../../Backend/payment-requests";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const payload = await request.json();
    await settleDeliveredItems(payload);
    await resolvePaymentRequestsByTable(payload.tableNumber);
    const orders = await listOrders({
      tableNumber: payload.tableNumber,
      includeItems: true,
    });
    notifyOrderChanged({ type: "settled", tableNumber: payload.tableNumber });

    return Response.json({ orders }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
