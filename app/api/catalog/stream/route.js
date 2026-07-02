import { subscribeToCatalogChanges } from "../../../../Backend/catalog-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function sendCatalogChange(payload = {}) {
        if (closed) return;
        controller.enqueue(encoder.encode("event: catalog-change\n"));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...payload, updatedAt: new Date().toISOString() })}\n\n`));
      }

      const unsubscribe = subscribeToCatalogChanges(sendCatalogChange);
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
