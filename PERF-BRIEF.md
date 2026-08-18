# Storefront Performance Brief — Facebook Ad Traffic

**Repo:** `amader-backend` monorepo (NestJS `apps/backend` + Next.js `apps/web` + `apps/admin`, pnpm/turbo)
**Live:** `https://amadere.com` · API `https://api.amadere.com` · served via **Caddy** on a VPS
**Written:** 2026-08-18
**Reported symptom:** product pages opened from a Facebook ad show a **white screen / never load** inside the Facebook in-app browser, especially on mobile data. Homepage is fine.

---

## 0. Read this first

The white screen is **not a JS crash**. I loaded `https://amadere.com/products/amader-fiber-mix?fbclid=…` in a real headless Chromium using a Facebook-iOS user agent: HTTP 200, zero `pageerror`s, zero console exceptions, `<h1>` present, 17,838 chars of body text. The page renders correctly in a modern engine.

The problem is **payload weight and cache behaviour**. Measured on the live product page:

| Metric | Measured |
|---|---|
| Total transfer | **4,989 KB (~5 MB)** |
| Requests | 75 |
| Images on page | 25 |
| Fonts (2 files, over the wire) | **4,489 KB** — 90% of total |
| Full load @ 1.6 Mbps / 300 ms RTT / 4× CPU throttle | **~40 seconds** |
| First contentful paint (same throttle) | 2.1 s |
| TTFB (unthrottled, 4 samples) | 328 / 1223 / 708 / 432 ms |

Forty seconds of near-empty page in an in-app browser reads as "broken" to a user who just tapped an ad. That's the bug.

**Cache-Control, taken from live response headers — this is the other half of the story:**

```
homepage      → s-maxage=300, stale-while-revalidate=31535700   ✅ cached
product page  → private, no-cache, no-store, max-age=0, must-revalidate   ❌ not cached at all
```

---

## 1. Baseline reproduction (do this before and after every task)

Use a headless browser with network + CPU throttling. Do **not** benchmark on a fast desktop connection — it hides everything.

```js
// Playwright
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 " +
             "(KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone13,2;FBMD/iPhone]",
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
});
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 300,
  downloadThroughput: 1.6 * 1024 * 1024 / 8,
  uploadThroughput: 600 * 1024 / 8,
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

await p.goto("https://amadere.com/products/amader-fiber-mix?fbclid=IwZXtest", { waitUntil: "load", timeout: 120000 });

console.log(await p.evaluate(() => ({
  transferKB: Math.round(performance.getEntriesByType("resource")
    .reduce((s, e) => s + (e.encodedBodySize || 0), 0) / 1024),
  loadMs: Math.round(performance.getEntriesByType("navigation")[0].loadEventEnd),
  fcp: Math.round(performance.getEntriesByType("paint")
    .find(x => x.name === "first-contentful-paint").startTime),
  requests: performance.getEntriesByType("resource").length,
})));
```

**Targets:** transfer **< 900 KB**, load **< 8 s** under that throttle, FCP **< 2 s**.

Also check cache headers directly:

```bash
curl -sI "https://amadere.com/products/amader-fiber-mix" | grep -i "cache-control\|x-nextjs-cache\|age"
```

---

## 2. P0 — Fonts ✅ ALREADY DONE (verify, don't redo)

**Problem.** `apps/web/src/fonts.ts` pointed `next/font/local` at raw TrueType:

- `GoogleSans-Variable.ttf` — 4.56 MB on disk, **2,107 KB** over the wire
- `GoogleSans-Variable-Italic.ttf` — 4.85 MB on disk, **2,382 KB** over the wire

`next/font/local` does **not** subset or re-compress — it serves whatever file you point it at, and Next emits a `rel=preload` **Link header** for each, so both were fetched at top priority ahead of everything else. TTF only gets gzip; WOFF2 was never in play.

**What was changed.** Both fonts were subset with `fonttools` and converted to WOFF2:

| File | Before | After | Saved |
|---|---|---|---|
| `GoogleSans-Variable.woff2` | 4.56 MB | **241 KB** | 94.8% |
| `GoogleSans-Variable-Italic.woff2` | 4.85 MB | **268 KB** | 94.6% |

All three variable axes preserved (`opsz` 17–18, `wght` 400–700, `GRAD` −50–200). Glyph set kept: Latin + Latin Ext A/B + IPA, combining diacriticals, **full Bengali block U+0980–09FF (85 codepoints, including ৳ U+09F3)**, general punctuation, currency, arrows, math ops, box/geometric, misc symbols (★ ✓ •), variation selectors. 596 codepoints / ~1,510 glyphs retained.

Files written to `apps/web/src/fonts/`; `apps/web/src/fonts.ts` updated to reference `.woff2`. The original `.ttf` files are still on disk as the re-subsetting source and are no longer imported by anything.

> ⚠️ **Correction to an existing code comment.** `apps/web/src/app/[locale]/layout.tsx` and `packages/ui/src/tokens.css` both claim Google Sans "has no Bengali glyphs at all." **That is wrong** — it has 85 real Bengali outlines with contours. It likely lacks full conjunct coverage, which is presumably why Noto Sans Bengali is also loaded, but the comment as written is inaccurate and shouldn't be relied on for future decisions.

**To verify:** rebuild, then confirm the two `_next/static/media/GoogleSans*` requests are `.woff2` and total **< 550 KB**, and that Bengali product titles still render with correct conjuncts (compare `/bn/products/amader-fiber-mix` against a screenshot from before).

**Regeneration command**, if the glyph set ever needs widening:

```bash
pyftsubset GoogleSans-Variable.ttf \
  --unicodes='U+0000-00FF,U+0100-017F,U+0180-024F,U+0250-02AF,U+0300-036F,U+0980-09FF,U+2000-206F,U+20A0-20BF,U+2100-214F,U+2190-21FF,U+2200-22FF,U+25A0-25FF,U+2600-26FF,U+2700-27BF,U+FE00-FE0F,U+FEFF' \
  --layout-features='*' --flavor=woff2 \
  --output-file=GoogleSans-Variable.woff2
```

`--layout-features='*'` is **mandatory** — the default drops Bengali shaping features (`akhn`, `blwf`, `half`, `pstf`, `vatu`, `cjct`, `rphf`, …) and conjuncts stop forming.

---

## 3. P0 — Product pages are rendered dynamically on every single request

**Files:** `apps/web/src/app/[locale]/products/[slug]/page.tsx` (and the same pattern in `categories/[slug]`, `collections/[slug]`, `brands/[slug]`, `tags/[slug]`, `blog/[slug]` — audit all of them).

**Problem.** The page declares `export const revalidate = 3600`, but **that is being silently ignored**. Both `generateMetadata` and the default export do:

```ts
const { previewToken } = await searchParams;
```

Reading `searchParams` opts the route into dynamic rendering in the App Router, which overrides `revalidate`. Live proof — the product page returns `private, no-cache, no-store, max-age=0, must-revalidate` while the homepage (which doesn't touch `searchParams`) returns `s-maxage=300, stale-while-revalidate=…`.

**Cost per ad click.** Every visit is a cold SSR that fans out to roughly **nine** NestJS calls:

- layout (`app/[locale]/layout.tsx`): `settings/site`, `analytics/config`, `whatsapp/config`, `menu`, `announcements` — 5
- product page: `products/{slug}`, `products/{id}/reviews`, `products` (related), `whatsapp/config` — 4

None cached. On a campaign this is the dominant load on the VPS, and it directly inflates TTFB, which in an in-app browser is white-screen time.

**Fix — pick one:**

1. **Preferred:** move preview out of the query string entirely. Read the preview token from a cookie or a header set by the admin app, or give preview its own route segment (`/products/[slug]/preview/[token]`). The public product page then touches no `searchParams` and can be statically rendered + ISR'd.
2. Split the component: a static, cacheable default export, with the preview banner isolated behind a `<Suspense>` boundary that reads `searchParams` (dynamicIO / PPR style) so only that subtree is dynamic.

**Acceptance criteria:**

- `curl -sI` on a product page shows `s-maxage` / `stale-while-revalidate`, **not** `no-store`.
- A second request to the same URL is served from cache (check `x-nextjs-cache: HIT` or equivalent, and a much lower TTFB).
- `?previewToken=…` still shows the purple "Preview mode" banner and still renders unpublished products.
- `fbclid`, `utm_*`, and other junk query params **must not** bust the cache or force a dynamic render. Verify explicitly: `/products/amader-fiber-mix?fbclid=abc123` should still be a cache hit.

> The `fbclid` point is important — Facebook appends it to every ad click. If the caching strategy keys on the full query string, every ad click is a unique cache key and you get 0% hit rate even after fixing the `searchParams` issue.

---

## 4. P0 — Images: no optimisation anywhere, and one 1.7 MB PNG

**Problem A — a single image is 1.7 MB.** On `/products/amader-fiber-mix`:

```
https://pub-51174804638049198acba5bbf211435e.r2.dev/image/86f5f481-…-ChatGPT%20Image….png
→ 1,732 KB, image/png
```

An unoptimised PNG (looks like an AI-generated asset uploaded as-is). At 390 px viewport this is being downloaded at full resolution.

**Problem B — `next/image` is used nowhere.** Confirmed by grep:

- `next/image` imports across `apps/web/src` + `packages/ui/src`: **0**
- raw `<img>` tags: **52**, across **40 files**

`apps/web/next.config.ts` has no `images` config at all, which is presumably why — remote images from R2 would need `remotePatterns`. Net effect: no resizing, no WebP/AVIF negotiation, no lazy-loading defaults, no `srcset`.

**Fix:**

1. Add to `apps/web/next.config.ts`:
   ```ts
   images: {
     remotePatterns: [{ protocol: "https", hostname: "<your-r2-custom-domain>" }],
     formats: ["image/avif", "image/webp"],
   }
   ```
2. Migrate `<img>` → `next/image` starting with the highest-traffic surfaces, in this order:
   - `packages/ui/src/components/ProductGallery.tsx` (PDP hero — biggest single win)
   - `packages/ui/src/components/ProductCard.tsx` + `ProductCardTwo.tsx` (every listing page)
   - `packages/ui/src/components/HeroCarousel.tsx`, `HomeBannerTwo.tsx`, `FeaturedCategoriesSection.tsx` (homepage)
   - `apps/web/src/app/[locale]/products/[slug]/page.tsx` (review thumbnails, already 64×64 in CSS but full-size over the wire)
3. Give the PDP gallery's first image `priority`, and everything below the fold `loading="lazy"`.
4. Re-compress existing oversized assets in the bucket. Anything over ~200 KB on a product page should be re-encoded to WebP.
5. Consider enforcing a max upload dimension/size in the backend media module so this can't recur from the admin UI.

**Acceptance criteria:** no single image on a product page exceeds **250 KB**; total image bytes on the PDP under **600 KB**; gallery images served as WebP/AVIF with a `srcset`.

---

## 5. P1 — Images are served from Cloudflare's R2 **dev** endpoint

**Problem.** All media comes from:

```
https://pub-51174804638049198acba5bbf211435e.r2.dev/…
```

`*.r2.dev` is Cloudflare's development/preview endpoint. Cloudflare **rate-limits it and explicitly documents that it is not for production traffic** — it is not backed by the CDN cache the way a custom domain is. Under Facebook ad load this is a real availability risk: throttled or slow image responses look exactly like a broken page.

**Fix.** Bind a custom domain to the R2 bucket (e.g. `cdn.amadere.com`), then update:

- `R2_PUBLIC_BASE_URL` in the backend `.env` (already a supported var — see `.env.example`)
- `images.remotePatterns` in `apps/web/next.config.ts`
- Verify `apps/web/src/lib/media.ts` `toDisplayImageUrl()` still passes URLs through (it only checks for an `http(s)` prefix, so it should need no change)

Existing DB rows will hold old `r2.dev` URLs — either run a migration to rewrite them, or normalise the hostname inside `toDisplayImageUrl()`.

**Also note:** `media.ts` treats any non-`http(s)` value as "no image", and the comment says the B12 migration left every media reference as a `legacy://` pseudo-URL with the R2 upload never done. Worth auditing how many products currently render a placeholder instead of a real image — that's a conversion problem on ad traffic independent of speed.

---

## 6. P1 — Third-party tracking scripts

`apps/web/src/components/AnalyticsScripts.tsx` can inject, all on the same page: GA4/gtag, GTM, **Meta Pixel**, **TikTok Pixel**, Microsoft Clarity, plus an arbitrary admin-pasted custom script. Observed live on the PDP, in addition to those: `pixelfly.io` (293 KB decoded), `ad.doubleclick.net`, `google.com/ccm/collect`.

TikTok's pixel alone was **115 KB**. These are all `strategy="afterInteractive"`, which is correct, but on a throttled connection they still compete for bandwidth with product images.

**Fix:**

- Audit which pixels are actually in use. If GTM is installed, GA4 / Meta / TikTok should generally be fired **through GTM**, not also injected directly — double-firing is both a perf cost and a data-accuracy problem (check for duplicate `PageView` events).
- Consider `strategy="lazyOnload"` for Clarity, which is pure session-recording and never needs to be early.
- Confirm `pixelfly.io` is intentional and not left over from a trial.
- Meta Pixel should stay `afterInteractive` — you need it firing reliably for ad attribution.

---

## 7. P1 — Rate limiter will 429 real mobile users

**Files:** `apps/backend/src/app.module.ts`, `apps/backend/src/modules/cart/cart.controller.ts`, `apps/backend/src/modules/search/search.controller.ts`

**Problem.** `ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])` is registered as a global `APP_GUARD`, keyed on IP (`main.ts` sets `trust proxy: 1`, so IP comes from `X-Forwarded-For`).

Two things are fetched **directly from the customer's browser**, bypassing the Next.js server, and therefore counted against that per-IP bucket:

- `GET /search/products` — `apps/web/src/hooks/useSearch.ts`, fires on typing (2+ chars), both the results page and the header suggestions dropdown
- all cart **mutations** — `apps/web/src/hooks/useCart.ts`: add item, update quantity, remove, apply/remove coupon

`GET /cart` and `GET /settings/site` already have `@SkipThrottle()` with comments explaining exactly this shared-bucket problem — so the issue is known, it just wasn't applied to search or cart writes.

**Why it bites on mobile data specifically.** Bangladeshi carriers (Grameenphone, Robi, Banglalink) put large numbers of subscribers behind a small pool of public IPv4 addresses (CGNAT). A burst of ad traffic can make dozens of distinct customers look like one IP, collectively blow through 120 req/min, and all start getting `429` on search and add-to-cart — while the rest of the page, being server-rendered, looks completely fine.

**Fix.** Key the throttler on something that identifies a real client rather than a raw IP. You already generate a stable per-browser id in `apps/web/src/lib/device-id.ts` and a guest cart token in `apps/web/src/lib/guest-token.ts`. Implement a custom `ThrottlerGuard` with `getTracker()` returning device/guest token where present, falling back to IP. Alternatively apply a generous per-route `@Throttle()` override to search and cart writes.

**How to confirm this is happening in production:** grep the Caddy/NestJS access logs for `429` on `/api/v1/search/products` and `/api/v1/cart/items`. If several share one `X-Forwarded-For` with different User-Agents, that's the CGNAT signature.

**Note:** DNS was checked — `amadere.com`, `www`, and `api.` all resolve to a single IPv4 address with **no AAAA records**, so an IPv6 misconfiguration is *not* a contributing factor here.

---

## 8. P2 — Browser support floor

`apps/web/package.json` pins **Next.js 16.2.10**, **React 19.2.4**, **Tailwind CSS v4**.

Tailwind v4 requires **Safari 16.4+ / Chrome 111+ / Firefox 128+** (it emits `@property`, `color-mix()`, `oklch()`, cascade layers). Next 16's default browserslist targets a similar modern baseline. Anyone on iOS < 16.4, or an Android System WebView that hasn't been updated, will get broken layout or an unparseable JS bundle — the Facebook in-app browser on Android *is* a WebView, so this population is real in Bangladesh.

**Action:** decide explicitly whether to support them. If yes, that means adding a legacy CSS build and lowering the JS target — non-trivial. If no, at minimum add a **`global-error.tsx`**, which the app currently lacks (there's only `app/[locale]/error.tsx`, which does not catch errors thrown from the root layout). Without it, an error escaping the layout unmounts the whole tree and the user gets a genuinely white page with no message.

---

## 9. P2 — Smaller wins

- **`apps/web/src/app/globals.css`:** `body * { font-family: var(--font-body) !important; }` applies a universal selector to every element in the DOM. It exists to beat CKEditor's inline `font-family`, which is legitimate — but scoping it to `.rich-content *` would achieve the same thing at a fraction of the style-recalc cost. The PDP has ~90 top-level body children and a large rich-content tree.
- **Render-blocking Google Fonts stylesheet** in `app/[locale]/layout.tsx` (`ckeditorGoogleFontsUrl(["Open Sans", "Noto Sans Bengali"])`). It's small (2 KB encoded) but it's an extra blocking origin on the critical path. Now that Google Sans carries Bengali, re-evaluate whether Noto Sans Bengali is needed at all, or self-host a subset of it alongside the others.
- **`max-lg:[zoom:80%]`** on the PDP info column (`products/[slug]/page.tsx`) forces an extra layout pass on mobile and interacts badly with some WebViews. Consider `font-size` scaling or a proper responsive type scale instead.
- **HTTP/3 is already advertised** (`alt-svc: h3=":443"`) — good, no action.
- **HTML is ~533 KB uncompressed** for the PDP. Much of that is the serialized RSC payload. Reducing the number of client components on the page (the PDP currently ships `ProductFloatingBarProvider`, `PdpPurchasePanel`, `ProductGallery`, `ProductTabs`, `FrequentlyBoughtTogether`, `WriteReviewForm`, carousels…) would shrink it.
- **With JS disabled the PDP renders only ~1.8 KB of text** vs 17.8 KB with JS. Worth understanding why so much of a supposedly server-rendered page depends on hydration — it's a resilience risk on flaky mobile connections.

---

## 10. Suggested order of work

1. ✅ Fonts — done, just verify (−4.0 MB)
2. Product-page caching / `searchParams` (biggest TTFB + server-load win)
3. The 1.7 MB PNG + `next/image` on `ProductGallery` and `ProductCard` (−1.5 MB or so)
4. R2 custom domain
5. Throttler tracker fix
6. Tracking-script audit
7. `global-error.tsx`
8. Everything in §9

Re-run the §1 benchmark after each step and record the numbers. Steps 1–3 alone should take the product page from ~5 MB / 40 s to roughly 800 KB / under 8 s on the same throttled profile.

---

## 11. Things to be careful about

- **Do not** re-subset the fonts without `--layout-features='*'`. Bengali conjuncts will silently break and it won't be obvious in Latin-only testing.
- **Do not** assume the `.ttf` files are unused junk — they're the source for re-subsetting. They're not imported, so they aren't shipped.
- Verify Bengali rendering on `/bn/…` routes after **any** font or CSS change. Compare screenshots.
- When changing caching, always test with `?fbclid=…` attached — that's what real ad traffic looks like, and it's the case most likely to defeat a cache.
- Benchmark under throttling. On a fast connection every one of these problems is invisible.
