# Product Page Pixel-Perfect Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `apps/web`'s product detail page to visually match
`https://ghorerbazar.com/products/black-seed-honey-1kg` pixel-for-pixel on desktop
and mobile, while keeping quantity picker / viewing-now badge / tabbed content /
mobile pack-size dropdown, and removing the "About This Product" duplicate section
and the "Frequently Bought Together" combos block.

**Architecture:** Presentation-only change. No API, DTO, or schema changes. Six
existing files get restyled/restructured in place (`ProductGallery.tsx`,
`ProductTabs.tsx`, `PdpPurchasePanel.tsx`, `ProductComparisonTable.tsx`, the PDP's
`page.tsx`, `WriteReviewForm.tsx`) and one new file is added (a static related-
products card). All colors/sizes not already defined by this project's shared
design tokens are one-off arbitrary-value Tailwind classes scoped to these PDP
components — this project's established convention (see `WhatsappOrderButton.tsx`'s
`bg-[#25D366]`, the PDP hero card's `shadow-[0_2px_4px_rgba(0,0,0,0.11)]`) for
values that are specific to one page and must not bleed into the shared
`--color-gold`/`--color-green` tokens used site-wide.

**Tech Stack:** Next.js 14 App Router (`apps/web`), React, Tailwind v4 via
`@amader/ui`'s `tokens.css`, `clsx`-based `cn()` (no tailwind-merge — conflicting
utility classes on the same element are NOT reliably overridable by string
concatenation; see Global Constraints).

## Global Constraints

- **Never run `git commit`** — this is a standing rule for this project from
  earlier in the session. Every task below ends with a manual verification step
  instead of a commit step.
- `cn()` in `@amader/ui` is plain `clsx`, not `tailwind-merge`. Two conflicting
  utility classes on one element (e.g. `bg-gold` from a shared variant plus
  `bg-[#F48721]` from a `className` override) are NOT guaranteed to resolve in
  the override's favor — do not rely on className overrides to fix a color/shape
  mismatch. Where a shared component's built-in variant classes conflict with
  this page's required look (`Button`'s `gold`/`green` variants hardcode the
  wrong colors for this page), render a plain `<button>`/`<a>` with the exact
  classes needed instead of fighting the shared component (this is the existing
  pattern: `WhatsappOrderButton`, `CallNowButton`, and `ProductCard`'s own
  Add-to-Cart button are already plain elements for exactly this reason).
- Do **not** edit `packages/ui/src/tokens.css` (`--color-gold`, `--color-green`,
  etc.) — those are used site-wide (badges, other buttons, nav). This page's
  reference-matched colors (`#F48721`, `#041F1E`, `#1DAA61`, `#1E3A8A`, `#222831`,
  `#666666`, `#F5F5F5`) are one-off values for this page only.
  `ProductGallery.tsx` and `ProductTabs.tsx` are confirmed (via grep) to have no
  other consumers anywhere in `apps/web` or `apps/admin`, so they can be edited
  in place with no risk to other pages.
- Body font on this page's PDP-specific text (title, price, buttons, tabs) should
  read as `Open Sans` per the reference; this project's global `--font-ui`/
  `--font-body` tokens are Roboto site-wide (deliberate, documented reset) — do
  **not** change those tokens. Add `font-['Open_Sans',sans-serif]` as a one-off
  arbitrary value on the specific PDP elements the spec calls out, the same
  "page-scoped one-off, not a token change" approach as the colors above.
- No backend/schema changes. The reviews rating-breakdown bars in Task 7 are
  computed from the already-fetched `reviews.items` page (up to `pageSize: 10`
  reviews), not a true all-time aggregate — the review count/average badge above
  it is still accurate (uses `reviews.reviewCount`/`averageRating`, both true
  aggregates already returned by the API). This is a deliberate scope decision to
  avoid a new backend aggregate endpoint; flag in code with a one-line comment.
- Every task's "Verify" step uses the already-open Playwright MCP browser and the
  local dev server (`pnpm --filter web dev`, port 3001) — this project's existing
  convention for pixel verification (see the hero card's shadow/radius/padding,
  already measured and matched this way in an earlier pass). There are no unit
  tests for visual/pixel work in this codebase; `pnpm -r exec tsc --noEmit` is the
  correctness check, side-by-side screenshots are the pixel check.
- Reference values cited in every task below were measured live against
  `https://ghorerbazar.com/products/black-seed-honey-1kg` at a 1440×1000 desktop
  viewport and a 390×844 mobile viewport.

---

### Task 1: Product Gallery — vertical thumbnail column + main image

**Files:**
- Modify: `apps/web` package's shared UI component
  `packages/ui/src/components/ProductGallery.tsx` (full file, shown below)

**Interfaces:**
- Consumes: unchanged props — `ProductGalleryProps { images: ProductGalleryImage[]; videoUrl?: string; className?: string }`, called from `page.tsx:208` as `<ProductGallery images={images} videoUrl={toEmbeddableVideoUrl(product.videoUrl)} />` — no caller changes needed.
- Produces: same exported `ProductGallery` component and `ProductGalleryImage` type — no signature change, only internal markup/layout changes.

**Reference measurements** (1440px viewport): thumbnail images 78×78px, vertical
stack with 12px gap between them, thumbnail column starts flush with the hero
card's left padding; main image column starts 18px to the right of the thumbnail
column and is roughly square (505×522 at this viewport — scales with the column,
not a fixed pixel size); active thumbnail gets a 2px solid orange (`#F48721`)
border, inactive thumbnails have a 2px transparent border keeping their box size
constant; this layout is unchanged all the way down to 390px mobile width (no
stacking) — confirmed against the reference at both viewports.

- [ ] **Step 1: Rewrite `ProductGallery.tsx` to a side-by-side layout**

```tsx
"use client";

import { useState } from "react";
import { cn } from "../lib/cn";

export interface ProductGalleryImage {
  url: string;
  alt?: string;
}

export interface ProductGalleryProps {
  images: ProductGalleryImage[];
  /** Embeddable video URL (e.g. YouTube/Vimeo) shown as an extra gallery slide. */
  videoUrl?: string;
  className?: string;
}

const chevronLeft = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[18px] w-[18px]">
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const chevronRight = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[18px] w-[18px]">
    <path d="m9 6 6 6-6 6" />
  </svg>
);
const playIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-[#F48721]">
    <path d="M8 5v14l11-7z" />
  </svg>
);

// Layout matches the reference PDP exactly: a vertical thumbnail column to the
// left (78x78px tiles, 12px gap) and the main image to the right, with
// prev/next arrows overlaid on the main image's edges rather than in a row
// below the thumbnails. Unchanged down to mobile widths — the reference keeps
// this side-by-side layout at 390px too, no stacking breakpoint.
export function ProductGallery({ images, videoUrl, className }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const slideCount = images.length + (videoUrl ? 1 : 0);
  const showVideo = videoUrl && active === images.length;
  const current = images[Math.min(active, images.length - 1)];

  return (
    <div className={cn("flex gap-[18px]", className)}>
      {(images.length > 1 || videoUrl) && (
        <div className="flex w-[78px] shrink-0 flex-col gap-3">
          {images.map((image, i) => (
            <button
              key={image.url + i}
              type="button"
              aria-label={`View image ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                "h-[78px] w-[78px] shrink-0 overflow-hidden rounded-lg border-2 bg-white",
                active === i ? "border-[#F48721]" : "border-transparent",
              )}
            >
              <img src={image.url} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
          {videoUrl && (
            <button
              type="button"
              aria-label="Play product video"
              onClick={() => setActive(images.length)}
              className={cn(
                "grid h-[78px] w-[78px] shrink-0 place-items-center rounded-lg border-2 bg-white",
                active === images.length ? "border-[#F48721]" : "border-transparent",
              )}
            >
              {playIcon}
            </button>
          )}
        </div>
      )}

      <div className="relative aspect-square min-w-0 flex-1 overflow-hidden rounded-lg bg-white">
        {showVideo ? (
          <iframe
            src={videoUrl}
            title="Product video"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          current?.url && (
            <img src={current.url} alt={current.alt ?? ""} className="h-full w-full object-contain" />
          )
        )}

        {slideCount > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={() => setActive((i) => (i - 1 + slideCount) % slideCount)}
              className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#222831] shadow-[0_1px_4px_rgba(0,0,0,0.2)] hover:bg-white"
            >
              {chevronLeft}
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => setActive((i) => (i + 1) % slideCount)}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#222831] shadow-[0_1px_4px_rgba(0,0,0,0.2)] hover:bg-white"
            >
              {chevronRight}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify against the reference at both breakpoints**

Run: `pnpm --filter web dev` (port 3001), open a real product page with 3+ images
in the Playwright browser at 1440×1000, then 390×844. Confirm:
- Thumbnails are a vertical column of 78×78px tiles with visible gaps, not a
  horizontal row.
- Clicking a thumbnail swaps the main image and moves the orange border.
- The prev/next chevrons sit on top of the main image's left/right edges, not
  below the thumbnails.
- The side-by-side layout is unchanged at 390px width (no stacking).

Expected: matches `ref-mobile-top.png`/`ref-desktop-top.png` captured during
brainstorming (thumbnail column left, main image right, at both widths).

---

### Task 2: Purchase panel — title, price, quantity, CTAs, brand pill, viewing badge

**Files:**
- Modify: `apps/web/src/components/PdpPurchasePanel.tsx`

**Interfaces:**
- Consumes: `PublicProductDetailDto` (unchanged, already includes `product.brand: { id, slug, name } | null` — confirmed in `schema.d.ts`, not currently read anywhere in this file), `WatchingNowBadge` from `@amader/ui` (unchanged props).
- Produces: same exported `PdpPurchasePanel` component signature — no prop changes, only internal JSX/markup.

**Reference values** (from the design spec's "Confirmed pixel values" table):
title `#222831` 24px/500 letter-spacing -0.6px margin-bottom 16px; price `#F48721`
26px/600 letter-spacing -1.3px; Add to Cart bg `#F48721`/white, Buy Now bg
`#041F1E`/white (both: 14px/600 uppercase, radius 6px, padding 12px, height 44px,
2-col grid gap 12px); Order On WhatsApp bg `#1DAA61`/white, Call For Order bg
`#1E3A8A`/white (both: radius 8px, padding 8px, capitalize — not uppercase —
14px/600, height 44px, same 2-col grid); CTA grid gap 12px both directions.

- [ ] **Step 1: Read the current file's imports/state (already read in full during
  brainstorming — no changes to hooks, state, or business logic in this task,
  only the returned JSX and the two button implementations)**

- [ ] **Step 2: Replace the returned JSX**

Replace the `return (...)` block (current lines 138-257) with:

```tsx
  return (
    <div className="font-['Open_Sans',sans-serif]">
      <h1 className="mb-4 text-2xl font-medium tracking-[-0.6px] text-[#222831]">{product.name}</h1>

      <PriceTag price={price} originalPrice={originalPrice} align="left" size="lg" className="mb-4 [&_span]:text-[26px] [&_span]:font-semibold [&_span]:tracking-[-1.3px] [&_span]:text-[#F48721]" />

      {/* Desktop keeps variants above the CTAs (normal convention). Mobile
          moves them below the CTA grid instead — same position ghorerbazar's
          mobile PDP uses for its Brand row — so the first screen on mobile is
          just image/title/price/qty/buttons, per explicit user request. */}
      {product.hasVariants && packOptions.length > 0 && selectedVariantId && (
        <div className="hidden md:block">
          <h4 className="mb-2.5 font-ui text-sm font-medium text-ink">Select Pack Size</h4>
          <PackSizeSelector options={packOptions} value={selectedVariantId} onChange={setSelectedVariantId} />
        </div>
      )}

      {outOfStock ? (
        <p className="mb-4 font-ui text-sm font-semibold text-red-600">Out of Stock</p>
      ) : (
        (stockStatus as unknown as string) === "ON_BACKORDER" && (
          <p className="mb-4 font-ui text-sm text-gold-dark">Available on backorder</p>
        )
      )}

      {addToCart.isError && (
        <p className="mb-3 font-ui text-sm text-red-600">
          {addToCart.error instanceof Error ? addToCart.error.message : "Couldn't add to cart"}
        </p>
      )}

      <hr className="mb-4 border-line" />

      <div className="mb-3 flex items-center gap-3">
        {product.hasVariants && packOptions.length > 0 && selectedVariantId && (
          <select
            aria-label="Select pack size"
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-full border border-line bg-white px-3 font-ui text-sm text-ink md:hidden"
          >
            {packOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {formatMoney(option.price)}
              </option>
            ))}
          </select>
        )}
        <QtyStepper
          value={qty}
          onChange={setQty}
          min={product.minOrderQuantity || 1}
          max={product.maxOrderQuantity ?? undefined}
        />
        <button
          type="button"
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={handleToggleWishlist}
          disabled={addToWishlist.isPending || removeFromWishlist.isPending}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line ${isWishlisted ? "text-red-600" : "text-muted"}`}
        >
          {heartIcon(isWishlisted)}
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:grid md:grid-cols-2">
        {!outOfStock && (
          <>
            <button
              type="button"
              disabled={addToCart.isPending}
              onClick={handleAddToCart}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#F48721] font-semibold uppercase text-white transition-colors hover:bg-[#d9720f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add To Cart
            </button>
            <button
              type="button"
              disabled={addToCart.isPending}
              onClick={handleBuyNow}
              className="flex h-11 w-full animate-[wiggle_2.5s_ease-in-out_infinite] items-center justify-center gap-2 rounded-md bg-[#041F1E] font-semibold uppercase text-white transition-colors hover:bg-[#0a2f2d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Buy Now
            </button>
          </>
        )}
        <div className="grid grid-cols-2 gap-3 md:contents">
          <WhatsappOrderButton config={whatsappConfig} productName={product.name} />
          <CallNowButton config={whatsappConfig} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {product.brand && (
          <a
            href={`/brands/${product.brand.slug}`}
            className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3.5 py-2 font-ui text-sm text-[#222831]"
          >
            <span className="text-muted">Brand:</span> {product.brand.name}
          </a>
        )}
        <WatchingNowBadge productId={product.id} className="mb-0" />
      </div>
    </div>
  );
```

- [ ] **Step 3: Update `WhatsappOrderButton.tsx` and `CallNowButton.tsx` to the
  reference's colors/sizing**

In `apps/web/src/components/WhatsappOrderButton.tsx`, replace the `<a>`'s
`className`:

```tsx
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1DAA61] px-5 font-ui text-sm font-semibold capitalize text-white transition-colors hover:bg-[#178f50]"
```

In `apps/web/src/components/CallNowButton.tsx`, replace the `<a>`'s `className`:

```tsx
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-5 font-ui text-sm font-semibold capitalize text-white transition-colors hover:bg-[#16296b]"
```

(Both keep their existing copy — "Order via WhatsApp" / "Call Now" — the spec
calls out color/shape/text-transform parity, not a copy change.)

- [ ] **Step 4: Verify**

Run the dev server, open a real product page (one with a brand assigned and one
without, to confirm the pill is conditional) at 1440px and 390px:
- Title/price/button colors match the hex values above (use browser devtools or
  a `getComputedStyle` check the same way the reference was measured).
- All 4 CTA buttons are 44px tall in a 2-col grid with 12px gaps on desktop and
  stacked full-width rows on mobile (unchanged existing mobile behavior).
- Brand pill renders only when `product.brand` is set and links to
  `/brands/{slug}`.
- The viewing-now badge appears next to the Brand pill, below the CTA grid — not
  in its old spot above the CTAs.
- `pnpm -r exec tsc --noEmit` passes.

---

### Task 3: Tabs — pill styling

**Files:**
- Modify: `packages/ui/src/components/ProductTabs.tsx`

**Interfaces:**
- Consumes/Produces: unchanged — `ProductTabsProps { tabs: ProductTab[]; className?: string }`, same export. Confirmed via grep this component has exactly one consumer (`page.tsx`), so no other page is affected.

**Reference values**: inactive tab bg `#F5F5F5` / text `#666666`; active tab bg
`#F48721` / text white; both radius 4px, padding `12px 24px`, 14px/600,
text-transform capitalize; tabs sit in a row with visible gaps (not a full-bleed
underline strip).

- [ ] **Step 1: Replace the tab-button markup**

```tsx
"use client";

import { ReactNode, useState } from "react";
import { cn } from "../lib/cn";

export interface ProductTab {
  id: string;
  label: string;
  content: ReactNode;
}

export interface ProductTabsProps {
  tabs: ProductTab[];
  className?: string;
}

export function ProductTabs({ tabs, className }: ProductTabsProps) {
  const [active, setActive] = useState(tabs[0]?.id);
  if (tabs.length === 0) return null;
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className={cn(className)}>
      <div role="tablist" className="mb-4 flex flex-wrap gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "rounded font-['Open_Sans',sans-serif] text-sm font-semibold capitalize",
              "px-6 py-3",
              tab.id === activeTab.id ? "bg-[#F48721] text-white" : "bg-[#F5F5F5] text-[#666666]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="font-body text-sm leading-relaxed text-ink">
        {activeTab.content}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Open the product page, confirm the Description/Key Benefits/How to Use tabs show
as grey pills with the active one filled solid orange with white text, matching
`ref-desktop-top.png`'s tab strip. Click through all three tabs to confirm
content still switches correctly (no behavior change, only styling).

---

### Task 4: Page structure — remove About/Combos sections, restyle comparison table

**Files:**
- Modify: `apps/web/src/app/[locale]/products/[slug]/page.tsx`
- Modify: `packages/ui/src/components/ProductComparisonTable.tsx`

**Interfaces:**
- No prop/type changes to `ProductComparisonTable` (`{ title, ownLabel, competitorLabel, rows }`, all unchanged) — visual restyle only.
- `page.tsx`'s combos-fetching (`safeGet("/api/v1/product-bundles", ...)`) and its
  `combos`/`toComboCardData` variables are deleted entirely along with the JSX
  section that renders them — nothing later in the file references them.

- [ ] **Step 1: Delete the "About This Product" section**

In `page.tsx`, delete this whole block (currently right after the hero card's
closing `</div>`, before the tabs card):

```tsx
        {product.description && (
          <div className="mx-auto max-w-[820px] py-14 text-center">
            <SectionHeading>About This Product</SectionHeading>
            <div
              className="font-body text-sm leading-loose text-text"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
            />
          </div>
        )}
```

- [ ] **Step 2: Delete the combos fetch, mapping, and section**

Remove `toComboCardData` (the whole function), remove `combosRes` from the
`Promise.all` destructure and its corresponding `safeGet("/api/v1/product-bundles", ...)`
call, remove the `combos` variable, and delete this JSX block near the end of
the file:

```tsx
      {combos.length > 0 && (
        <div className="mx-auto max-w-full px-0 sm:max-w-[80%] sm:px-5 py-14">
          <SectionHeading>Frequently Bought Together</SectionHeading>
          <Carousel>
            {combos.map((combo: ReturnType<typeof toComboCardData>) => (
              <ComboCard key={combo.href} {...combo} linkComponent={AppLink} />
            ))}
          </Carousel>
        </div>
      )}
```

Also remove the now-unused imports `Carousel`, `ComboCard` from the `@amader/ui`
import list and `PublicBundleDto` type alias, and drop `whatsappRes` stays (still
used) but confirm `Promise.all` array/destructure stays valid with 3 entries
instead of 4 (`reviewsRes, relatedRes, whatsappRes`).

- [ ] **Step 3: Restyle `ProductComparisonTable`'s heading to match the page's new
  visual language** (left-aligned bold heading like Related Products, instead of
  the old centered green serif `SectionHeading` — the reference has no equivalent
  section to copy exactly, so this keeps the table's existing data/logic and
  only aligns its heading style with the rest of the redesigned page)

```tsx
import { SectionHeading } from "./SectionHeading";

export interface ProductComparisonRow {
  feature: string;
  own: boolean;
  competitor: boolean;
}

export interface ProductComparisonTableProps {
  title?: string | null;
  ownLabel?: string | null;
  competitorLabel?: string | null;
  rows: ProductComparisonRow[];
}

function Check({ on }: { on: boolean }) {
  return on ? (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-green">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="mx-auto text-line">
      <circle cx="12" cy="12" r="9" />
      <line x1="8" y1="8" x2="16" y2="16" />
      <line x1="16" y1="8" x2="8" y2="16" />
    </svg>
  );
}

// Admin-configured "Why Choose Us" table — hidden entirely when the admin
// hasn't filled in any rows, so it's an opt-in section per product. No
// reference equivalent exists on ghorerbazar.com; kept per explicit decision,
// heading restyled to match this page's new left-aligned bold section style.
export function ProductComparisonTable({ title, ownLabel, competitorLabel, rows }: ProductComparisonTableProps) {
  if (rows.length === 0) return null;

  return (
    <div className="mx-auto hidden w-full max-w-[1180px] px-5 py-14 md:block">
      <h2 className="mb-4 text-xl font-bold text-[#222831]">{title || `Why Choose ${ownLabel || "This Product"}?`}</h2>
      <div className="mx-auto max-w-[920px] overflow-x-auto">
        <table className="w-full min-w-[480px] border-separate border-spacing-0 overflow-hidden rounded-brand border border-line bg-white">
          <thead>
            <tr>
              <th className="border-b border-line bg-white p-4 text-left font-ui text-sm font-bold text-ink" />
              <th className="border-b border-line bg-green p-4 font-ui text-sm font-bold text-white">
                {ownLabel || "This Product"}
              </th>
              <th className="border-b border-line bg-white p-4 font-ui text-sm font-bold text-ink">
                {competitorLabel || "Regular Alternative"}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="border-b border-line p-4 font-ui text-sm font-semibold text-text last:border-b-0">
                  {row.feature}
                </td>
                <td className="border-b border-line bg-[#e8f4ea] p-4 last:border-b-0">
                  <Check on={row.own} />
                </td>
                <td className="border-b border-line p-4 last:border-b-0">
                  <Check on={row.competitor} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

(Removed the now-unused `SectionHeading` import since it's no longer called —
delete that import line too.)

- [ ] **Step 4: Verify**

`pnpm -r exec tsc --noEmit` passes (catches any leftover reference to the
deleted `combos`/`toComboCardData`/`ComboCard`/`Carousel` imports). Load a
product page with no comparison-table data — confirm nothing renders in that
slot. Load a product page that has "About This Product" content today — confirm
the section is gone and the content only appears in the Description tab.

---

### Task 5: Related Products — static grid + "More Products" link

**Files:**
- Create: `apps/web/src/components/RelatedProductCard.tsx`
- Modify: `apps/web/src/app/[locale]/products/[slug]/page.tsx`

**Interfaces:**
- Consumes: the same shape `page.tsx` already builds via `toProductCardData` — `{ href, name, imageUrl, price, originalPrice, discountLabel }` (from `apps/web/src/lib/product-card-mapper.ts`, unchanged).
- Produces: `RelatedProductCard(props: { href: string; name: string; imageUrl?: string | null; price: string; originalPrice?: string | null; discountLabel?: string })` — a plain presentational card, no `onAddToCart`/cart-mutation wiring (the reference's related-products "Add To Cart" just links to the product page in this rebuild — matches the fact this section is now a plain link grid, not a carousel with inline cart actions).

**Reference values**: heading `#222831` 20px/700 margin-bottom 8px, left-aligned
(not centered); card "Add To Cart" is an **outlined** button — transparent bg,
1px solid `#F48721` border, `#F48721` text, radius 4px, padding 8px, 14px/600, NOT
uppercase; badge (e.g. "New Arrival", "Save 13%") is `#F48721` bg/white text,
10px, padding `2px 6px`, radius 4px, absolute top-left (`top: 6px; left: 6px`);
product name 16px/500 `#222831`; reference fits 5 cards per row at 1440px width.

- [ ] **Step 1: Create the new card component**

```tsx
import { formatMoney } from "@amader/ui";
import { AppLink } from "@/components/AppLink";

export interface RelatedProductCardProps {
  href: string;
  name: string;
  imageUrl?: string | null;
  price: string;
  originalPrice?: string | null;
  discountLabel?: string;
}

// Reference's Related Products card: plain grid tile (no shadow/border), a
// top-left badge ribbon, and an outlined (not solid) Add To Cart button that
// links through to the product page — this section dropped its carousel/
// inline-add-to-cart behavior when it became a static grid (Task 5 of the PDP
// pixel-redesign plan), so "Add To Cart" here navigates rather than mutating
// the cart directly.
export function RelatedProductCard({ href, name, imageUrl, price, originalPrice, discountLabel }: RelatedProductCardProps) {
  return (
    <div className="flex h-full flex-col">
      <AppLink href={href} className="relative block aspect-square overflow-hidden rounded bg-white">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} loading="lazy" className="h-full w-full object-contain" />
        )}
        {discountLabel && (
          <span className="absolute left-1.5 top-1.5 rounded bg-[#F48721] px-1.5 py-0.5 text-[10px] text-white">
            {discountLabel}
          </span>
        )}
      </AppLink>
      <div className="flex flex-1 flex-col gap-1.5 pt-3">
        <AppLink href={href} className="truncate text-base font-medium text-[#222831]">
          {name}
        </AppLink>
        <div className="text-base font-semibold text-[#F48721]">
          {formatMoney(price)}
          {originalPrice && Number(originalPrice) > Number(price) && (
            <span className="ml-2 text-xs text-muted line-through">{formatMoney(originalPrice)}</span>
          )}
        </div>
        <AppLink
          href={href}
          className="mt-auto flex h-9 w-full items-center justify-center rounded border border-[#F48721] text-sm font-semibold text-[#F48721] transition-colors hover:bg-[#fdf1e8]"
        >
          Add To Cart
        </AppLink>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Swap the carousel for a static grid in `page.tsx`**

Replace this block:

```tsx
      <div className="mx-auto max-w-full px-0 sm:max-w-[80%] sm:px-5">
        <ProductCarouselSectionClient
          heading="Related Products"
          products={relatedProducts}
          visibleCount={4}
          autoplayMs={4000}
        />
      </div>
```

with:

```tsx
      {relatedProducts.length > 0 && (
        <div className="mx-auto max-w-full px-5 py-10 sm:max-w-[80%]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#222831]">Related Products</h2>
            {category && (
              <AppLink href={`/categories/${category.slug}`} className="text-sm font-medium text-[#F48721] hover:underline">
                More Products →
              </AppLink>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {relatedProducts.map((p) => (
              <RelatedProductCard key={p.href} {...p} />
            ))}
          </div>
        </div>
      )}
```

Add `import { RelatedProductCard } from "@/components/RelatedProductCard";` and
remove the now-unused `import { ProductCarouselSectionClient } from "@/components/ProductCarouselSectionClient";` (confirm nothing else in this file still uses it — it doesn't, per Task 4's changes).

- [ ] **Step 3: Verify**

Load a product page whose category has 5+ other products. Confirm: heading is
left-aligned bold (not the old centered green serif), 5 columns at desktop width
narrowing to 3/2 on smaller screens, cards show an outlined orange button (not
solid green), "More Products →" link only appears when the product has a
category, and clicking a related card's Add To Cart navigates to that product
(no cart-drawer/mutation call from this grid). `pnpm -r exec tsc --noEmit`
passes.

---

### Task 6: Customer Reviews — rating breakdown bars + card/form restyle

**Files:**
- Modify: `apps/web/src/app/[locale]/products/[slug]/page.tsx` (Customer Reviews section JSX only)
- Modify: `apps/web/src/components/WriteReviewForm.tsx`

**Interfaces:**
- Consumes: `reviews: ProductReviewsPageDto | undefined` (already fetched in `page.tsx`; unchanged shape — `{ items, total, page, pageSize, averageRating, reviewCount }`). `reviews.items[].rating` (already present per-review) is used client-side to compute the 5-bar breakdown for **the currently-fetched page of reviews only** (see Global Constraints — no new backend aggregate).
- Produces: no new exported functions; JSX-only changes within `page.tsx` and `WriteReviewForm.tsx`.

- [ ] **Step 1: Replace the Customer Reviews section in `page.tsx`**

Replace this block:

```tsx
      <div className="mx-auto max-w-full px-0 sm:max-w-[80%] sm:px-5 py-14">
        <SectionHeading>Customer Reviews</SectionHeading>

        {reviews && reviews.items.length > 0 && (
          <div className="mx-auto mb-6 max-w-2xl space-y-4">
            {reviews.items.map((review) => (
              <div key={review.id} className="rounded-brand border border-line bg-white p-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-ui text-sm font-semibold text-ink">{review.customerName}</span>
                  <RatingStars rating={review.rating} />
                </div>
                {review.comment && <p className="font-body text-sm text-muted">{review.comment}</p>}
                {review.images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {review.images.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={toDisplayImageUrl(url) ?? url}
                        alt=""
                        className="h-16 w-16 rounded-lg border border-line object-cover"
                      />
                    ))}
                  </div>
                )}
                {review.reply && (
                  <p className="mt-2 border-l-2 border-green pl-3 font-body text-xs text-muted">
                    <span className="font-semibold text-ink">Reply: </span>
                    {review.reply.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <WriteReviewForm productId={product.id} />
      </div>
```

with:

```tsx
      <div className="mx-auto max-w-full px-5 py-10 sm:max-w-[80%]">
        <h2 className="mb-4 text-xl font-bold text-[#222831]">Customer Reviews</h2>

        {reviews && (
          <div className="mb-8 grid gap-8 md:grid-cols-[auto_1fr]">
            <div>
              <div className="text-4xl font-bold text-[#222831]">{(reviews.averageRating ?? 0).toFixed(1)}</div>
              <RatingStars rating={reviews.averageRating ?? 0} />
              <p className="mt-1 text-sm text-muted">({reviews.reviewCount} Reviews)</p>
            </div>
            {/* Breakdown is computed from the currently-fetched review page
                (up to `pageSize` items), not a true all-time aggregate — see
                Global Constraints in the PDP pixel-redesign plan. Good enough
                for the reviewCount range this site sees today without adding
                a new backend endpoint. */}
            <div className="flex flex-col justify-center gap-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const countAtStar = reviews.items.filter((r) => r.rating === star).length;
                const pct = reviews.items.length > 0 ? Math.round((countAtStar / reviews.items.length) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-3 text-sm">
                    <span className="w-16 shrink-0 text-[#F48721]">{"★".repeat(star)}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eee]">
                      <div className="h-full rounded-full bg-[#F48721]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-muted">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {reviews && reviews.items.length > 0 && (
          <div className="mb-8 space-y-4">
            {reviews.items.map((review) => (
              <div key={review.id} className="rounded-brand border border-line bg-white p-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-ui text-sm font-semibold text-ink">{review.customerName}</span>
                  <RatingStars rating={review.rating} />
                </div>
                {review.comment && <p className="font-body text-sm text-muted">{review.comment}</p>}
                {review.images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {review.images.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={toDisplayImageUrl(url) ?? url}
                        alt=""
                        className="h-16 w-16 rounded-lg border border-line object-cover"
                      />
                    ))}
                  </div>
                )}
                {review.reply && (
                  <p className="mt-2 border-l-2 border-green pl-3 font-body text-xs text-muted">
                    <span className="font-semibold text-ink">Reply: </span>
                    {review.reply.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <WriteReviewForm productId={product.id} />
      </div>
```

(This removes the centered `max-w-2xl` layout and the `SectionHeading` call for
this section — confirm `SectionHeading` is still imported/used elsewhere in this
file before deciding whether to drop its import; it is NOT used elsewhere after
Task 4 and this step, so remove that import too if no other call site remains.)

- [ ] **Step 2: Restyle the submit button in `WriteReviewForm.tsx`**

Replace the final `<Button type="submit" ...>` element:

```tsx
        <button
          type="submit"
          disabled={rating < 1 || createReview.isPending}
          className="self-start rounded-md bg-[#041F1E] px-6 py-2.5 text-sm font-semibold uppercase text-white transition-colors hover:bg-[#0a2f2d] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createReview.isPending ? "Submitting…" : "Submit Review"}
        </button>
```

(Leave the "Add photos" `Button` with `variant="ghost"` untouched — the spec's
confirmed values only cover the primary CTA colors, and `ghost` isn't one of the
colors being replaced here.)

- [ ] **Step 3: Verify**

Load a product with several reviews of mixed star ratings. Confirm: the average
rating shows as a large number with stars and review count next to a 5-row
percentage-bar breakdown, the existing review cards are unchanged below that,
and the write-review form's submit button is now dark (`#041F1E`) uppercase
matching the Buy Now button. Load a product with zero reviews — confirm nothing
crashes (`reviews.items` is an empty array, so all `.filter()`/`.map()` calls
degrade to 0%/no cards, matching the reference's own "0.0 / 0 Reviews / 0% every
row" empty state). `pnpm -r exec tsc --noEmit` passes.

---

## Self-Review Notes

- **Spec coverage**: every numbered item in the design spec's Page Structure and
  Retained/Removed sections maps to a task above — Task 1 (gallery/mobile
  layout), Task 2 (qty picker retained, viewing badge repositioned, CTAs),
  Task 3 (tabs), Task 4 (About/Combos removed, comparison table kept), Task 5
  (Related Products), Task 6 (Reviews stay separate, restyled). The mobile
  pack-size `<select>` (retained item 5) is untouched in Task 2's replacement
  JSX — confirm by diffing against the original file before/after.
- **Placeholder scan**: no TBD/TODO; the one deliberate approximation (reviews
  breakdown computed from the fetched page, not a true aggregate) is called out
  explicitly in Global Constraints and Task 6, not left vague.
- **Type consistency**: `RelatedProductCardProps` matches exactly the fields
  `toProductCardData` already produces (`href, name, imageUrl, price,
  originalPrice, discountLabel`) — no renamed fields between Task 5's producer
  and consumer.
