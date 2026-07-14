import { NextRequest, NextResponse } from "next/server";

// Every admin route requires a session, unlike the storefront where most
// pages are public — so this is a blanket gate rather than a per-page check.
// Checks for the refresh cookie (30d) rather than the access cookie (15m):
// an expired access token still silently refreshes via the /api/backend
// proxy's own 401-retry, so gating on it here would force a redirect to
// /login on every access-token expiry even though the session is still
// good.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has("admin_refresh_token");
  if (!hasSession) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
