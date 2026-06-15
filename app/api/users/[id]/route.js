import { deleteUser, getUser, readSessionToken, updateUser } from "../../../../Backend/auth";

export const runtime = "nodejs";

async function requireAdmin(request) {
  const token = request.cookies.get("tpv_session")?.value;
  const session = await readSessionToken(token);
  if (!session || session.role !== "admin") {
    throw new Error("No autorizado");
  }
  return session;
}

export async function GET(request, { params }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const user = await getUser(id);

    if (!user) {
      return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return Response.json({ user });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 403 });
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await requireAdmin(request);
    const { id } = await params;
    const payload = await request.json();

    if (id === session.sub && ((payload.role && payload.role !== "admin") || payload.active === false)) {
      throw new Error("No puedes quitar tus propios permisos de administrador");
    }

    const user = await updateUser(id, payload);

    if (!user) {
      return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return Response.json({ user });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requireAdmin(request);
    const { id } = await params;

    if (id === session.sub) {
      throw new Error("No puedes borrar tu propio usuario");
    }

    const deleted = await deleteUser(id);

    if (!deleted) {
      return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
