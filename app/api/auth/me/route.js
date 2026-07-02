import { readSessionToken } from "../../../../Backend/auth";

export const runtime = "nodejs";

function getHistoryAreaForRole(role, fallbackArea = null) {
  if (role === "cocina") return "kitchen";
  if (role === "barra") return "bar";
  return fallbackArea ?? null;
}

export async function GET(request) {
  const token = request.cookies.get("tpv_session")?.value;
  const session = await readSessionToken(token);

  if (!session) {
    return Response.json({ user: null }, { status: 401 });
  }

  return Response.json({
    user: {
      id: session.sub,
      name: session.name,
      role: session.role,
      historyArea: getHistoryAreaForRole(session.role, session.historyArea),
    },
  });
}
