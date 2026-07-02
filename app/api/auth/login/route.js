import { NextResponse } from "next/server";
import { authenticateUser, createSessionToken } from "../../../../Backend/auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const payload = await request.json();
    const user = await authenticateUser(payload.name ?? payload.username ?? payload.email, payload.password);
    const token = await createSessionToken(user);

    const response = NextResponse.json({
      user,
      redirectTo: user.role === "admin"
        ? "/tpv/admin/productos"
        : user.role === "camarero"
        ? "/tpv/pedidos"
        : "/tpv/historico",
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
