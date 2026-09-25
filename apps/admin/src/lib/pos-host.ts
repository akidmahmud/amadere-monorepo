/** pos.amadere.com (or pos.localhost in dev) is this same app, showing only /pos. */
export function isPosHost(host: string | null): boolean {
  return !!host && host.split(":")[0].startsWith("pos.");
}

/** On the pos. host, only the POS, login and API exist. */
export function posRoute(
  pathname: string,
): { rewrite?: string; redirect?: string } | null {
  if (pathname === "/") return { rewrite: "/pos" };
  if (
    pathname === "/pos" ||
    pathname.startsWith("/pos/") ||
    pathname === "/login" ||
    pathname.startsWith("/api/")
  ) {
    return null;
  }
  return { redirect: "/pos" };
}

/** Login's `?next=` may only send the user to a path on this site. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/";
  // Let the URL parser normalise the tricks a prefix check misses ("/\host",
  // tabs/newlines, "//host"); anything that lands off this origin is refused.
  const base = "http://same.invalid";
  try {
    const u = new URL(raw, base);
    return u.origin === base ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}
