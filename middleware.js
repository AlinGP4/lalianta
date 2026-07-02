import { NextResponse } from "next/server";
import { verifyAuthToken } from "./Backend/auth-token";

const allowedCorsOrigin = "https://lalianta.hostinghubcenter.com";

function landingUnavailable() {
  return new NextResponse(
    `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>La Lianta no disponible</title>
    <style>
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        background: #111;
        color: #f6f0e7;
        font-family: Arial, sans-serif;
      }
      main {
        width: min(520px, calc(100% - 32px));
        text-align: center;
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(32px, 7vw, 56px);
      }
      p {
        margin: 0;
        color: rgba(246, 240, 231, 0.72);
        font-size: 17px;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>No disponible</h1>
      <p>La web publica de La Lianta no esta disponible en este momento.</p>
    </main>
  </body>
</html>`,
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": "3600",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

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
    if (pathname === "/") {
      return landingUnavailable();
    }

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
  matcher: ["/", "/tpv/:path*", "/api/:path*"],
};
