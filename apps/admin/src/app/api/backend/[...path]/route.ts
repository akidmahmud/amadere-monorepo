import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "@/lib/auth-cookies";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// Every admin API call goes through here instead of straight to the backend
// — the access token lives in an httpOnly cookie, unreadable by client JS,
// so only a server-side handler can attach it as the Bearer header the
// backend actually checks. Silent-refreshes once on a 401 before giving up.
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

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const url = `${BACKEND_URL}/api/v1/${path.join("/")}${req.nextUrl.search}`;
  const body = req.method === "GET" || req.method === "DELETE" ? undefined : await req.text();

  async function call(token: string | undefined) {
    return fetch(url, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
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

    // CSV/file exports (e.g. sales-report, inventory) return a non-JSON body
    // with Content-Disposition — pass those through raw instead of trying
    // to JSON.parse them (which would throw and fall into the catch below).
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return new NextResponse(res.body, {
        status: res.status,
        headers: {
          "Content-Type": contentType,
          ...(res.headers.get("content-disposition") ? { "Content-Disposition": res.headers.get("content-disposition")! } : {}),
        },
      });
    }

    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch {
    // Backend unreachable — a clean 503 instead of an unhandled fetch
    // exception surfacing as a framework 500 (same fix applied to the
    // storefront's equivalent proxy this session).
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
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
