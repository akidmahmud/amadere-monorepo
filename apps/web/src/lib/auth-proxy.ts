import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth-cookies";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// Shared by every Route Handler that exchanges credentials for a token pair
// (login, otp/verify, social-login, refresh) — calls the backend, and on
// success stores the tokens as httpOnly cookies instead of ever putting
// them in a client-readable response body.
//
// register() is also routed through here even though it doesn't issue a
// session anymore (it only sends an OTP — see customer-auth.service.ts) —
// its response is `{ pending: true }`, no accessToken/refreshToken, so
// cookie-setting is skipped for it. The real session starts at the
// subsequent otp/verify call.
export async function proxyTokenIssuingCall(backendPath: string, body: unknown): Promise<NextResponse> {
  const res = await fetch(`${BACKEND_URL}/api/v1${backendPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    return NextResponse.json(json, { status: res.status });
  }
  // A token-bearing response is stripped to a bare {success} — the whole
  // point of routing these through the server is that access/refresh tokens
  // land in httpOnly cookies and are never readable by client JS.
  if (json.data?.accessToken) {
    await setAuthCookies(json.data.accessToken, json.data.refreshToken);
    return NextResponse.json({ success: true });
  }
  // Everything else keeps its payload. /auth/register is the case that
  // matters: it issues no tokens, it returns {pending, otpChannel,
  // otpIdentifier}, and the verify step MUST echo back that exact
  // otpIdentifier because OtpService keys the stored code on it. Blanket-
  // stripping it left the client with `undefined` and threw in onSuccess,
  // breaking every signup — nothing to do with tokens.
  return NextResponse.json(json);
}
