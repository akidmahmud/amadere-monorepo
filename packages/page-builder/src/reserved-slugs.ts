/**
 * Routes the app owns. A builder page may never claim one (plan §6.2.2) —
 * doing so would shadow a real route with a CMS page and take out checkout,
 * login, or the sitemap.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "checkout", "cart", "account", "orders", "order",
  "login", "register", "logout", "search", "track",
  "products", "product", "categories", "category",
  "brands", "brand", "collections", "collection",
  "blog", "tags", "tag", "faq", "api", "admin",
  "sitemap.xml", "robots.txt",
]);

/** Prefixes no slug may start with, whatever follows them. */
const RESERVED_PREFIXES = ["api/", "_next"];

/**
 * Returns null when the slug is allowed, or the reason it is not.
 *
 * Compares on the normalised form (lowercased, surrounding slashes stripped)
 * so `/Checkout/` cannot slip past a list written in lowercase — the route
 * matcher does not care about either.
 */
export function checkReservedSlug(slug: string): string | null {
  const normalised = slug.trim().toLowerCase().replace(/^\/+|\/+$/g, "");

  if (!normalised) return "Slug cannot be empty.";
  if (RESERVED_SLUGS.has(normalised)) {
    return `"${normalised}" is a reserved route and cannot be used as a page slug.`;
  }
  // Also block a reserved word used as the FIRST segment ("account/settings"
  // would otherwise sail through while shadowing the account area).
  const firstSegment = normalised.split("/")[0];
  if (RESERVED_SLUGS.has(firstSegment)) {
    return `"${firstSegment}" is a reserved route prefix and cannot start a page slug.`;
  }
  for (const prefix of RESERVED_PREFIXES) {
    if (normalised.startsWith(prefix)) {
      return `Page slugs cannot start with "${prefix}".`;
    }
  }
  return null;
}
