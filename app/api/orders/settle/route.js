import { listOrders, settleDeliveredItems } from "../../../../Backend/orders";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const payload = await request.json();
    await settleDeliveredItems(payload);
    const orders = await listOrders({
      tableNumber: payload.tableNumber,
      includeItems: true,
    });

    return Response.json({ orders }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
