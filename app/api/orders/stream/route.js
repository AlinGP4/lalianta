import { listOrders } from "../../../../Backend/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tableNumber = searchParams.get("tableNumber");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let sending = false;

      async function sendOrders() {
        if (sending) return;
        sending = true;

        try {
          const orders = await listOrders({
            tableNumber,
            includeItems: true,
          });

          controller.enqueue(encoder.encode(`event: orders\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ orders })}\n\n`));
        } catch (error) {
          controller.enqueue(encoder.encode(`event: error\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
        } finally {
          sending = false;
        }
      }

      sendOrders();
      const interval = setInterval(sendOrders, 2000);

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
