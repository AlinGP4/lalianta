import { notifyOrderChanged } from "../../../Backend/order-events";
import { listPendingWaiterCalls, requestWaiterCall, resolveWaiterCallsByTable } from "../../../Backend/waiter-calls";

export const runtime = "nodejs";

export async function GET() {
  try {
    const waiterCalls = await listPendingWaiterCalls();
    return Response.json({ waiterCalls });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const waiterCall = await requestWaiterCall(payload);
    notifyOrderChanged({ type: "waiter-call", tableNumber: waiterCall.tableNumber });

    return Response.json({ waiterCall }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tableNumber = searchParams.get("tableNumber");
    const resolvedCount = await resolveWaiterCallsByTable(tableNumber);
    notifyOrderChanged({ type: "waiter-call-resolved", tableNumber });

    return Response.json({ ok: true, resolvedCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
