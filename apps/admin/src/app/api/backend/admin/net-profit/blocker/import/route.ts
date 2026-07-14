import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "@/lib/auth-cookies";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// A dedicated route, not routed through the [...path] catch-all — same
// reason as apps/admin/src/app/api/backend/admin/media/route.ts: the
// catch-all reads the body via `req.text()`, which corrupts a multipart
// CSV upload. FormData needs to stay FormData all the way through.
async function refreshAccessToken(): Promise<string | undefined> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return undefined;

  const res = await fetch(`${BACKEND_URL}/api/v1/admin/auth/refresh`, {
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

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  async function call(token: string | undefined) {
    return fetch(`${BACKEND_URL}/api/v1/admin/net-profit/blocker/import`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
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
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "backend_unreachable", message: "Backend is unreachable" } },
      { status: 503 },
    );
  }
}
