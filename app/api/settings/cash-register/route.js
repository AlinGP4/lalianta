import { readSessionToken } from "../../../../Backend/auth";
import { getCustomerOrderingState, setCashRegisterOpen } from "../../../../Backend/settings";

export const runtime = "nodejs";

async function requireAdmin(request) {
  const token = request.cookies.get("tpv_session")?.value;
  const session = await readSessionToken(token);
  if (!session || session.role !== "admin") {
    throw new Error("No autorizado");
  }
  return session;
}

export async function GET() {
  try {
    const state = await getCustomerOrderingState();
    return Response.json(state);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await requireAdmin(request);
    const payload = await request.json();
    await setCashRegisterOpen(Boolean(payload.open));
    const state = await getCustomerOrderingState();
    return Response.json(state);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 403 });
  }
}
