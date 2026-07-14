import { NextResponse } from "next/server";
import { getRefreshToken } from "@/lib/auth-cookies";
import { proxyTokenIssuingCall } from "@/lib/auth-proxy";

export async function POST() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not logged in" } }, { status: 401 });
  }
  return proxyTokenIssuingCall("/auth/refresh", { refreshToken });
}
