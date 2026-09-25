import { cookies } from "next/headers";

// Matches the backend's admin JWT expiry (15m access / 30d refresh, separate
// secrets from the customer-facing tokens) so the cookie never outlives the
// token it holds.
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  // ".amadere.com" in production so admin. and pos. share one login.
  // Unset in dev → host-only cookies, as before.
  ...(process.env.ADMIN_COOKIE_DOMAIN
    ? { domain: process.env.ADMIN_COOKIE_DOMAIN }
    : {}),
};

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const store = await cookies();
  store.set("admin_access_token", accessToken, {
    ...COOKIE_OPTS,
    maxAge: ACCESS_MAX_AGE,
  });
  store.set("admin_refresh_token", refreshToken, {
    ...COOKIE_OPTS,
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  // Expire with the same domain/path they were set with — a bare delete()
  // would miss the parent-domain cookie and leave the user logged in.
  for (const name of ["admin_access_token", "admin_refresh_token"]) {
    store.set(name, "", { ...COOKIE_OPTS, maxAge: 0 });
  }
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get("admin_access_token")?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get("admin_refresh_token")?.value;
}
