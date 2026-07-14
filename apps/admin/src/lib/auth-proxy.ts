import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth-cookies";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// Shared by every Route Handler that exchanges credentials for a token pair
// (login, 2fa/verify, refresh) — calls the backend, and on success stores
// the tokens as httpOnly cookies instead of ever putting them in a
// client-readable response body.
//
// Admin login is one call that can resolve two different ways: a normal
// login returns a token pair; an account with 2FA enabled returns
// `{ requiresTwoFactor: true, twoFactorToken }` instead — no tokens yet, and
// the client genuinely needs that `twoFactorToken` back to complete
// `/2fa/verify`, so (unlike a plain token response) this shape is passed
// through rather than stripped.
export async function proxyTokenIssuingCall(backendPath: string, body: unknown): Promise<NextResponse> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1${backendPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return NextResponse.json(json, { status: res.status });
    }
    if ("requiresTwoFactor" in json.data) {
      return NextResponse.json(json);
    }
    await setAuthCookies(json.data.accessToken, json.data.refreshToken);
    return NextResponse.json({ success: true });
  } catch {
    // Backend unreachable (down, restarting, wrong port) — a clean 503
    // instead of an unhandled fetch/JSON-parse exception. Without this, a
    // down backend surfaced as a raw 500 from this route, which the login
    // page's client-side error handling then flattened into a misleading
    // "Invalid email or password" — the real cause (backend down) was never
    // visible to the user.
    return NextResponse.json(
      { success: false, error: { code: "backend_unreachable", message: "Backend is unreachable" } },
      { status: 503 },
    );
  }
}
