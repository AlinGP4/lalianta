import { notifyOrderChanged } from "../../../Backend/order-events";
import { listPendingPaymentRequests, requestTablePayment } from "../../../Backend/payment-requests";

export const runtime = "nodejs";

export async function GET() {
  try {
    const paymentRequests = await listPendingPaymentRequests();
    return Response.json({ paymentRequests });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const paymentRequest = await requestTablePayment(payload);
    notifyOrderChanged({
      type: "payment-request",
      tableNumber: paymentRequest.tableNumber,
      paymentMethod: paymentRequest.paymentMethod,
    });

    return Response.json({ paymentRequest }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
