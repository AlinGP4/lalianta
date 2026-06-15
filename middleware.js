import { NextResponse } from "next/server";
import { verifyAuthToken } from "./Backend/auth-token";

const allowedCorsOrigin = "https://lalianta.hostinghubcenter.com";

function redirectToLogin(request) {
  const loginUrl = new URL("/tpv/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

function applyCorsHeaders(request, response) {
  const origin = request.headers.get("origin");
  if (origin !== allowedCorsOrigin) return response;

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Vary", "Origin");
  return response;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  try {
    if (pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") {
        return applyCorsHeaders(request, new NextResponse(null, { status: 204 }));
      }

      return applyCorsHeaders(request, NextResponse.next());
    }

    if (pathname === "/tpv/login" || pathname === "/tpv/setup") {
      return NextResponse.next();
    }

    if (!pathname.startsWith("/tpv")) {
      return NextResponse.next();
    }

    const token = request.cookies.get("tpv_session")?.value;
    const session = await verifyAuthToken(token);

    if (!session) {
      return redirectToLogin(request);
    }

    if (pathname.startsWith("/tpv/admin") && session.role !== "admin") {
      return NextResponse.redirect(new URL("/tpv/pedidos", request.url));
    }

    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Middleware error" }, { status: 500 });
    }

    if (pathname.startsWith("/tpv")) {
      return redirectToLogin(request);
    }

    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/tpv/:path*", "/api/:path*"],
};
