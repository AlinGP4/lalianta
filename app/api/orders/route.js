import { createOrder, listOrders } from "../../../Backend/orders";

export const runtime = "nodejs";

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
    const order = await createOrder(payload);

    return Response.json({ order }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
