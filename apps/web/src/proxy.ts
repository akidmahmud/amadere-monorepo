import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const intlProxy = createMiddleware(routing);

// IndexNow domain-ownership verification files (e.g. /d2656506-....txt) must
// be served literal at the domain root, but Next's file-system router can't
// express a dynamic single-segment-with-suffix route alongside the existing
// app/[locale] dynamic segment (two differently-named dynamic segments at
// the same directory level isn't allowed). Handled here, ahead of
// next-intl's own locale proxy below — its matcher already excludes any
// path containing a dot, so this doesn't fight it, it just needs its own
// entry in config.matcher too.
export default async function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/([a-f0-9-]+)\.txt$/);
  if (match) {
    try {
      const res = await fetch(`${BACKEND_URL}/${match[1]}.txt`);
      const text = await res.text();
      return new NextResponse(text, { status: res.status, headers: { "Content-Type": "text/plain" } });
    } catch {
      return new NextResponse("Not found", { status: 404 });
    }
  }
  return intlProxy(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)", "/:key([a-f0-9-]+).txt"],
};
