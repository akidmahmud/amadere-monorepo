import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "@/lib/auth-cookies";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// Every authenticated customer call (profile, orders, wishlist, addresses,
// reviews/mine) goes through here instead of straight to the backend —
// the access token lives in an httpOnly cookie, unreadable by client JS, so
// only a server-side handler can attach it as the Bearer header the backend
// actually checks. Silent-refreshes once on a 401 before giving up.
async function refreshAccessToken(): Promise<string | undefined> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return undefined;

  const res = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    await clearAuthCookies();
    return undefined;
  }
  await setAuthCookies(json.data.accessToken, json.data.refreshToken);
  return json.data.accessToken as string;
}

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const url = `${BACKEND_URL}/api/v1/${path.join("/")}${req.nextUrl.search}`;
  const body = req.method === "GET" || req.method === "DELETE" ? undefined : await req.text();

  const guestToken = req.headers.get("x-guest-token");
  // Forwarded so the backend's per-visitor throttling still works through this
  // hop. Without it every proxied request would arrive from the Next server's
  // single IP and share one throttle bucket — the exact CGNAT problem the
  // device id exists to avoid (see useSearch.ts).
  const deviceId = req.headers.get("x-device-id");

  // The real visitor's IP, forwarded so the backend does not record this
  // server's address for every proxied request.
  //
  // This hop is a plain server-to-server fetch(), so without an explicit
  // X-Forwarded-For the backend's `req.ip` resolves to the Next server's
  // outbound address. Observed live: orders were being stored with
  // ipAddress = 200.141.0.91 (the VPS itself). Order.ipAddress feeds Blocker
  // Manager's ip_tracker rules, so those were matching the server on every
  // web order — the same root cause the throttler works around with the
  // device id above.
  //
  // cf-connecting-ip first: Cloudflare sets it and overwrites any
  // client-supplied copy, so it is the one value here that cannot be spoofed.
  // x-forwarded-for's FIRST entry is the original client (later entries are
  // proxies appended en route).
  const clientIp =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  async function call(token: string | undefined) {
    return fetch(url, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        ...(guestToken ? { "X-Guest-Token": guestToken } : {}),
        ...(deviceId ? { "X-Device-Id": deviceId } : {}),
        // Standard header rather than a bespoke one, so Express's own
        // `trust proxy` handling resolves req.ip from it with no backend
        // change. NOTE: this only lands correctly while `trust proxy` in
        // main.ts matches the real hop count between here and Nest.
        ...(clientIp ? { "X-Forwarded-For": clientIp } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });
  }

  try {
    let accessToken = await getAccessToken();
    let res = await call(accessToken);

    if (res.status === 401) {
      accessToken = await refreshAccessToken();
      if (accessToken) res = await call(accessToken);
    }

    const json = await res.json();

    // GENERAL RULE, not a checkout special case: any backend response that
    // carries a token pair has it moved into httpOnly cookies here and
    // stripped from the body before it reaches the browser. This app's whole
    // auth design (see the comment at the top of lib/auth-proxy.ts) rests on
    // access/refresh tokens being unreadable by client JS — a token in a JSON
    // body defeats that no matter which endpoint produced it.
    //
    // POST /checkout is the first endpoint to hit this path: a digital-only
    // checkout by a logged-out buyer creates a passwordless account and
    // returns its session (CheckoutResultDto in checkout.service.ts). Written
    // as a blanket rule rather than matched on the path so any future
    // token-issuing endpoint reached through this proxy is safe by default.
    //
    // Everything else in the payload — order id, orderNumber,
    // `existingAccount` — passes through untouched: the client branches on it
    // to decide where to send the buyer, and none of it is a secret.
    if (res.ok && json?.data && typeof json.data === "object" && "tokens" in json.data) {
      const tokens = json.data.tokens;
      if (tokens?.accessToken) await setAuthCookies(tokens.accessToken, tokens.refreshToken);
      // Stripped whether or not it held a pair: `tokens: null` is how the
      // backend says "no session was issued" (an existing account was found),
      // and the client reads `existingAccount` for that, not this.
      const { tokens: _stripped, ...data } = json.data;
      return NextResponse.json({ ...json, data }, { status: res.status });
    }

    return NextResponse.json(json, { status: res.status });
  } catch {
    // Backend unreachable (down, restarting, wrong port) — a clean 503
    // instead of an unhandled fetch exception surfacing as a framework 500.
    return NextResponse.json(
      { success: false, error: { code: "backend_unreachable", message: "Backend is unreachable" } },
      { status: 503 },
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
