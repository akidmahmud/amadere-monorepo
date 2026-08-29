import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Listing routes that declare `export const revalidate` and then silently
// lose it. Awaiting `searchParams` anywhere in a route — page or generateMetadata —
// opts the whole route into dynamic rendering, which overrides `revalidate`
// and makes Next emit `private, no-cache, no-store`. Measured on production:
// every one of these returned no-store and `cf-cache-status: DYNAMIC`, so
// Cloudflare cached nothing and each hit was a cold SSR on the single VPS.
//
// That is the same failure mode the `images` note below describes — origin
// CPU saturating under ad traffic and taking the whole site down — except
// reached through HTML rather than image encoding. It is also multiplied by
// Next's link prefetching: one homepage load fired ~50 RSC prefetches, and
// because a page that reads searchParams gets a prefetch cache key that
// INCLUDES those params, repeat prefetches of the same route do not dedupe
// (see Next's own segment-cache `vary-params` tests). Roughly 20 uncached
// origin renders per homepage visit.
//
// These pages are safe to cache: they render only public catalogue data via
// safeGet (no cookies(), no auth — auth-cookies.ts is used exclusively by the
// /api route handlers), and locale comes from the URL alone by deliberate
// design (see i18n/routing.ts), which is what already makes "/" cacheable.
//
// Setting Cache-Control here rather than refactoring the routes is load-
// bearing on a documented Next behaviour, not a guess: next.config headers
// are applied to the response BEFORE the page renders, and Next only sets its
// own no-store `if (!res.getHeader('Cache-Control'))`. A header set here
// therefore survives on a dynamically rendered page.
//
// The real fix is to stop reading searchParams during render (the product
// detail route already does this deliberately and is cached as a result).
// Until then this restores the caching those `revalidate = 3600` lines were
// always asking for.
const CACHEABLE_LISTING_PATHS = [
  "/products",
  "/categories/:slug",
  "/brands/:slug",
  "/collections/:slug",
  "/tags/:slug",
  "/blog",
  "/blog/author/:id",
  "/blog/category/:slug",
];

// Routes Next prerenders as fully static and therefore serves with a bare
// `s-maxage=31536000` — a ONE YEAR shared-cache lifetime, and no
// stale-while-revalidate to ever refresh it.
//
// No user data is in that HTML (these shells fetch everything client-side),
// so this is not a data-leak. It is worse in a more boring way: the shell
// hard-references build-specific chunk filenames
// (`/_next/static/chunks/04bxsxp7-16c-.js`), and those names change on every
// deploy. A shell pinned at the edge for a year keeps pointing at chunks that
// no longer exist — which is exactly the production chunk-load error this
// codebase has already been bitten by once (see chunk-error.ts). Telling a
// shared cache that a checkout page stays valid for 365 days is not something
// we ever want to be true.
//
// Transactional and account routes: keep them out of shared caches entirely.
// Their behaviour depends on cart, auth, pricing and OTP state, and the cost
// of never caching a checkout shell is negligible next to debugging a stale
// one.
const PRIVATE_PATHS = ["/checkout", "/account", "/account/:path*"];

// Public shells that are genuinely identical for every visitor. Caching these
// is fine — pinning them for a year is not, for the chunk-staleness reason
// above. A short s-maxage with stale-while-revalidate keeps the edge hit rate
// while letting a deploy actually take effect.
const PUBLIC_SHELL_PATHS = ["/login", "/register", "/faq", "/search", "/track"];

// `export const revalidate` in app/manifest.ts stops the per-request backend
// call (x-nextjs-cache goes to HIT) but does NOT change the response header:
// Next serves metadata routes with `max-age=0, must-revalidate` regardless,
// so Cloudflare marked it DYNAMIC and it was still an origin round trip on
// every page load — 414 ms and the longest single chain in the production
// trace. Site identity changes when an admin edits a name or favicon, so a
// day at the edge with a week of stale-while-revalidate is generous.
//
// Not locale-prefixed: there is one manifest at the app root.
const MANIFEST_HEADERS = [
  {
    source: "/manifest.webmanifest",
    headers: [
      {
        key: "Cache-Control",
        value: "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    ],
  },
];

// EN is unprefixed and BN lives under /bn (localePrefix: "as-needed"), so
// every path needs both forms.
const withBn = (paths: string[]) => paths.flatMap((p) => [p, `/bn${p}`]);

const nextConfig: NextConfig = {
  // Drop the `x-powered-by: Next.js` framework fingerprint from every
  // response — no need to advertise the stack to anyone probing.
  poweredByHeader: false,

  transpilePackages: ["@amader/ui", "@amader/page-builder"],

  async headers() {
    return [
      ...MANIFEST_HEADERS,
      ...withBn(PRIVATE_PATHS).map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      })),
      ...withBn(PUBLIC_SHELL_PATHS).map((source) => ({
        source,
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      })),
      ...withBn(CACHEABLE_LISTING_PATHS).map((source) => ({
        source,
        headers: [
          {
            key: "Cache-Control",
            // `public` because Next's default for a dynamic page is `private`,
            // which Cloudflare will not cache at all. s-maxage matches the
            // `revalidate = 3600` these routes already declare.
            //
            // stale-while-revalidate is one day, not the ~1 year used on "/" and
            // the product pages: a catalogue listing carries prices and stock,
            // and serving a year-old copy of one to revalidate in the background
            // is a different risk from doing it to a marketing page.
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      })),
    ];
  },
  // PERF-BRIEF.md §4/§5.
  //
  // ⚠️ Resizing must NEVER run on the origin. Next's *built-in* optimizer
  // downloads each image from R2, re-encodes it per requested width/format,
  // and serves it from `/_next/image` — all on this single VPS. Enabling that
  // (briefly, with AVIF on top — roughly 10-50x more CPU than WebP per
  // encode) moved every image request off Cloudflare's CDN and onto the box.
  // Under real ad traffic that saturated it and the whole site stopped
  // loading on mobile data, not just images, since the same process serves
  // the HTML. It never "finishes" either: encoding is on-demand per
  // (image × width × format), and every deploy rebuilds .next and starts the
  // cache over.
  //
  // The previous state was `unoptimized: true`, which kept the origin safe by
  // doing no resizing at all — browsers downloaded the raw upload. Measured
  // on the live homepage: the hero was a 1.77 MB PNG, which on Bangladeshi
  // mobile data is essentially the whole LCP budget spent on one image.
  //
  // This is the third option the old comment called for: a custom loader
  // pointing at Cloudflare Image Resizing, so resizing happens at the edge.
  // Zero origin CPU — the failure mode above cannot recur — and that same
  // hero comes down to 14.8 KB of AVIF at 800px wide.
  //
  // Requires the R2 bucket to be served from the cdn.amadere.com custom
  // domain (on the Cloudflare zone) — the loader rewrites legacy pub-*.r2.dev
  // URLs to it, since /cdn-cgi/image/ does not exist on r2.dev.
  images: {
    loader: "custom",
    loaderFile: "./src/lib/cloudflare-image-loader.ts",
    // Next's default deviceSizes run to 3840, so every responsive image
    // offered 8 srcset candidates and the homepage carried 1,601 candidate
    // URLs — markup the browser parses on every load.
    //
    // The widest container on the site is max-w-[1920px], so 2048 and 3840
    // could only ever be chosen by a display wider than the layout itself.
    // Dropping them removes two candidates per responsive image with no
    // change to what any real viewport actually downloads.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    remotePatterns: [
      { protocol: "https", hostname: "cdn.amadere.com" },
      {
        protocol: "https",
        hostname: "pub-51174804638049198acba5bbf211435e.r2.dev",
      },
    ],
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
