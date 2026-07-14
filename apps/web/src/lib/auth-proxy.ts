import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth-cookies";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// Shared by every Route Handler that exchanges credentials for a token pair
// (login, register, otp/verify, social-login, refresh) — calls the backend,
// and on success stores the tokens as httpOnly cookies instead of ever
// putting them in a client-readable response body.
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
  await setAuthCookies(json.data.accessToken, json.data.refreshToken);
  return NextResponse.json({ success: true });
}
