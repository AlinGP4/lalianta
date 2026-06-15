import { listPendingOrderNotifications } from "../../../../Backend/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let sending = false;

      async function sendNotifications() {
        if (sending) return;
        sending = true;

        try {
          const notifications = await listPendingOrderNotifications();

          controller.enqueue(encoder.encode("event: pending-orders\n"));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(notifications)}\n\n`));
        } catch (error) {
          controller.enqueue(encoder.encode("event: error\n"));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
        } finally {
          sending = false;
        }
      }

      sendNotifications();
      const interval = setInterval(sendNotifications, 2000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
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
