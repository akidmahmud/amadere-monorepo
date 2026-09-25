import { NextRequest, NextResponse } from "next/server";
import { isPosHost, posRoute } from "@/lib/pos-host";

// Every admin route requires a session, unlike the storefront where most
// pages are public — so this is a blanket gate rather than a per-page check.
// Checks for the refresh cookie (30d) rather than the access cookie (15m):
// an expired access token still silently refreshes via the /api/backend
// proxy's own 401-retry, so gating on it here would force a redirect to
// /login on every access-token expiry even though the session is still
// good.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next/")) return NextResponse.next();

  // pos.amadere.com is this same app showing only /pos (POS spec D1).
  if (isPosHost(req.headers.get("host"))) {
    const route = posRoute(pathname);
    if (route?.redirect)
      return NextResponse.redirect(new URL(route.redirect, req.url));
    if (route?.rewrite) {
      if (!req.cookies.has("admin_refresh_token"))
        return toLogin(req, route.rewrite);
      return NextResponse.rewrite(new URL(route.rewrite, req.url));
    }
  }

  if (pathname === "/login" || pathname.startsWith("/api/"))
    return NextResponse.next();
  if (!req.cookies.has("admin_refresh_token")) return toLogin(req, pathname);
  return NextResponse.next();
}

function toLogin(req: NextRequest, next: string) {
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
