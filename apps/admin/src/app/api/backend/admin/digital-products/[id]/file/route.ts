import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "@/lib/auth-cookies";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// A dedicated route, not routed through the [...path] catch-all: that proxy
// reads the body via `req.text()`, which decodes as UTF-8 and corrupts
// binary file data (a PDF here, same reasoning as admin/media/route.ts's own
// copy of this comment). FormData needs to stay FormData all the way
// through — Node's fetch computes the correct multipart boundary/headers
// itself when given a FormData body. DELETE (removeFile) and PATCH
// (preview-range) for this same resource have no such body and go through
// the generic catch-all proxy instead — see useDigitalProducts.ts.
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await req.formData();

  async function call(token: string | undefined) {
    return fetch(`${BACKEND_URL}/api/v1/admin/digital-products/${id}/file`, {
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
