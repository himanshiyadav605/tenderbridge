import { NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "./lib/session";

export function proxy(request) {
  const session = readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session.state === "ok") {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const message =
      session.state === "expired"
        ? "Your session has expired. Please sign in again."
        : "Authentication required.";
    const response = NextResponse.json({ error: message }, { status: 401 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = session.state === "expired" ? "error=expired" : "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/account", "/account/:path*", "/api/account", "/api/account/:path*"],
};
