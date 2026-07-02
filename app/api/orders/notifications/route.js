import { listPendingOrderNotifications } from "../../../../Backend/orders";
import { subscribeToOrderChanges } from "../../../../Backend/order-events";
import { listPendingPaymentRequests } from "../../../../Backend/payment-requests";
import { listPendingWaiterCalls } from "../../../../Backend/waiter-calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let sending = false;
      let closed = false;

      async function sendNotifications() {
        if (sending || closed) return;
        sending = true;

        try {
          const [notifications, paymentRequests, waiterCalls] = await Promise.all([
            listPendingOrderNotifications(),
            listPendingPaymentRequests(),
            listPendingWaiterCalls(),
          ]);

          if (closed) return;
          controller.enqueue(encoder.encode("event: pending-orders\n"));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...notifications, paymentRequests, waiterCalls })}\n\n`));
        } catch (error) {
          if (!closed) {
            controller.enqueue(encoder.encode("event: error\n"));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
          }
        } finally {
          sending = false;
        }
      }

      sendNotifications();
      const unsubscribe = subscribeToOrderChanges(sendNotifications);
      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 25000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // The client can close while a write is in flight.
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}
