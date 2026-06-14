import { countUsers, createUser, listUsers, readSessionToken } from "../../../Backend/auth";

export const runtime = "nodejs";

async function requireAdmin(request) {
  const token = request.cookies.get("tpv_session")?.value;
  const session = await readSessionToken(token);
  if (!session || session.role !== "admin") {
    throw new Error("No autorizado");
  }
  return session;
}

export async function GET(request) {
  try {
    await requireAdmin(request);
    const users = await listUsers();
    return Response.json({ users });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 403 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const existingUsers = await countUsers();

    if (existingUsers > 0) {
      await requireAdmin(request);
    } else {
      payload.role = "admin";
    }

    const user = await createUser(payload);
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
