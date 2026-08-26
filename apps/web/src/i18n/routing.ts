import { defineRouting } from "next-intl/routing";

// EN stays unprefixed ("/products/x") to preserve the ~1,900 ranked URLs the
// backend carries over from the old site; BN opts in at "/bn/...".
export const routing = defineRouting({
  locales: ["en", "bn"],
  defaultLocale: "en",
  localePrefix: "as-needed",

  // Locale is decided by the URL alone: "/" is English, "/bn/..." is Bengali.
  // Nothing is negotiated per request.
  //
  // This is what makes the HTML edge-cacheable, and both flags are needed for
  // it. Measured on "/" before the change:
  //
  //   no cookie, no accept-language  ->  200, Set-Cookie: NEXT_LOCALE=en
  //   Cookie: NEXT_LOCALE=bn         ->  307 to /bn
  //   Accept-Language: bn            ->  307 to /bn
  //
  // Cloudflare refuses to cache any response carrying Set-Cookie, so
  // `localeCookie: false` removes that. But the cookie was never the only
  // negotiation — `accept-language` redirected on its own, and a redirect that
  // varies by request header cannot be cached as one document either, so
  // `localeDetection: false` is required alongside it. Setting only one leaves
  // "/" uncacheable.
  //
  // The trade-off, accepted deliberately: a visitor whose browser prefers
  // Bengali and who types the bare domain now lands on English rather than
  // being redirected to /bn. They reach Bengali via the header switcher
  // (SiteHeader's `router.replace(pathname, { locale })`), and Bengali pages
  // remain directly linkable and separately indexed. Ad traffic is unaffected
  // — those links already carry a full URL.
  localeCookie: false,
  localeDetection: false,
});
