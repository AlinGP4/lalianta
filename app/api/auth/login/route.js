import { NextResponse } from "next/server";
import { authenticateUser, createSessionToken } from "../../../../Backend/auth";

export const runtime = "nodejs";

function getRoleHome(role) {
  if (role === "admin") return "/tpv";
  if (role === "camarero") return "/tpv/pedidos";
  if (role === "cocina" || role === "barra") return "/tpv/historico";
  return "/tpv/login";
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const user = await authenticateUser(payload.name ?? payload.username ?? payload.email, payload.password);
    const token = await createSessionToken(user);

    const response = NextResponse.json({
      user,
      redirectTo: getRoleHome(user.role),
    });

    response.cookies.set("tpv_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
