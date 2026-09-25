/**
 * Raw Set-Cookie lines that expire the host-only admin cookies issued before
 * ADMIN_COOKIE_DOMAIN was set. A cookie is keyed by name+domain, so the
 * parent-domain copies we now write never replace these; without expiring
 * them explicitly, logout leaves a working 30-day refresh token behind.
 * Raw headers because next/headers cookies() holds one entry per name.
 */
export function hostOnlyExpiry(
  sharedDomain: string | undefined,
  secure: boolean,
): string[] {
  if (!sharedDomain) return [];
  return ["admin_access_token", "admin_refresh_token"].map(
    (name) =>
      `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
}

/** Appends the expiry lines to a response (login, refresh, logout). */
export function expireHostOnlyCookies<T extends { headers: Headers }>(
  res: T,
): T {
  for (const line of hostOnlyExpiry(
    process.env.ADMIN_COOKIE_DOMAIN,
    process.env.NODE_ENV === "production",
  )) {
    res.headers.append("Set-Cookie", line);
  }
  return res;
}
