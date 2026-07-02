import { readSessionToken } from "../../../../Backend/auth";
import { listOrders } from "../../../../Backend/orders";
import { subscribeToOrderChanges } from "../../../../Backend/order-events";
import { listPendingPaymentRequests } from "../../../../Backend/payment-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireTpvSession(request) {
  const token = request.cookies.get("tpv_session")?.value;
  const session = await readSessionToken(token);
  if (!session) throw new Error("No autorizado");
  return session;
}

function normalizeArea(value) {
  return value === "kitchen" || value === "bar" ? value : null;
}

function getHistoryAreaForRole(role, fallbackArea = null) {
  if (role === "cocina") return "kitchen";
  if (role === "barra") return "bar";
  return fallbackArea ?? null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tableNumber = searchParams.get("tableNumber");
  const requestedArea = normalizeArea(searchParams.get("area"));
  let session;

  try {
    session = await requireTpvSession(request);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 401 });
  }

  if (searchParams.get("area") && !requestedArea) {
    return Response.json({ error: "El histórico no es válido" }, { status: 400 });
  }

  const sessionHistoryArea = getHistoryAreaForRole(session.role, session.historyArea);

  if (requestedArea && sessionHistoryArea && sessionHistoryArea !== requestedArea) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let sending = false;
      let closed = false;

      async function sendOrders() {
        if (sending || closed) return;
        sending = true;

        try {
          const [orders, paymentRequests] = await Promise.all([
            listOrders({
              tableNumber,
              includeItems: true,
            }),
            listPendingPaymentRequests(),
          ]);

          if (closed) return;
          controller.enqueue(encoder.encode(`event: orders\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ orders, paymentRequests })}\n\n`));
        } catch (error) {
          if (!closed) {
            controller.enqueue(encoder.encode(`event: error\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
          }
        } finally {
          sending = false;
        }
      }

      sendOrders();
      const unsubscribe = subscribeToOrderChanges(sendOrders);
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
