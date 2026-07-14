import { cookies } from "next/headers";

// Matches the backend's own JWT expiry (token.service.ts: 15m access / 30d
// refresh) so the cookie never outlives the token it holds.
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const store = await cookies();
  store.set("access_token", accessToken, { ...COOKIE_OPTS, maxAge: ACCESS_MAX_AGE });
  store.set("refresh_token", refreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_MAX_AGE });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete("access_token");
  store.delete("refresh_token");
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get("access_token")?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get("refresh_token")?.value;
}
