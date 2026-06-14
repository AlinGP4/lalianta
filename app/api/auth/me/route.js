import { readSessionToken } from "../../../../Backend/auth";

export const runtime = "nodejs";

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
      email: session.email,
      role: session.role,
    },
  });
}
