# Homepage Section Types: AD_SLIDER, CATEGORY_TABS, REEL_CARDS

## Context

The storefront homepage (`apps/web/src/app/[locale]/page.tsx`) renders entirely from
admin-authored `HomepageSection` rows (B13): 9 registered types today (`HERO_BANNER`,
`PRODUCT_COLLECTION`, `BANNER_STRIP`, `CATEGORY_SHOWCASE`, `BLOG_TEASER`,
`CERTIFICATION_ROW`, `TESTIMONIAL_BENTO`, `FEATURE_TILES`, `CIRCLE_BADGE_BAR`). The dev
database currently has zero `HomepageSection` rows, which is why the homepage renders
empty — not a code bug, a data gap (see `AGENTS.web.md` §14 for the investigation).

The user described a Shopify-style homepage builder vision. Cross-referencing against
the 9 existing types, 6 already match (hero, ad banner, product collection,
certification, blog, happy-client gallery). Two are genuinely new (Category Tabs, Ad
Slider) and one needed clarification (resolved: a hover-to-play video/gif reel row,
distinct from testimonials).

**Explicitly out of scope, confirmed with the user**: an actual point-and-click admin
UI (image upload widgets, drag-reorder, live preview). That's a separate, unbuilt admin
dashboard app per `AGENTS.web.md`'s own charter ("does not cover the admin dashboard
UI"). This spec only adds section *types* (backend enum + storefront rendering code).
Admins configure instances via the existing `POST/PATCH /admin/homepage-sections` API
directly (already how all 9 existing types work today — nothing new here).

## New section types

### 1. `AD_SLIDER`

Horizontal scrollable row of promotional banners — the multi-slide sibling of the
existing single-image `BANNER_STRIP`. Reuses the existing generic `Carousel` primitive
(`packages/ui/src/components/Carousel.tsx`, already used by `CATEGORY_SHOWCASE`) rather
than a new carousel component.

- **Config shape**: `{ slides: { imageUrl: string; linkUrl?: string }[] }`
- **Rendering**: inline in `page.tsx`'s `renderSection`, same visual treatment as
  `BANNER_STRIP` (rounded image, optional `AppLink` wrap) but each slide is a `Carousel`
  child instead of a single full-width block.
- **Empty state**: `config.slides` empty/missing → render `null` (matches `BANNER_STRIP`
  and `CIRCLE_BADGE_BAR`'s existing empty-state convention).

### 2. `CATEGORY_TABS`

Pill tabs sourced from product Categories; clicking a tab re-fetches and displays that
category's products inline, no page reload. This is a new, cleaner sibling of the
existing tag-based `HealthConcernSection` (`apps/web/src/components/
HealthConcernSection.tsx`), which today is **hardcoded** at the bottom of every
homepage render (not a registered `HomepageSection` type, always shown when tags exist,
not admin-positionable). `CATEGORY_TABS` becomes a proper section type; the existing
tag-based section is left exactly as-is (out of scope — not asked for).

- **Config shape**: `{ categoryIds?: number[] }` — omitted/empty means "all categories"
  (matches `CATEGORY_SHOWCASE`'s existing `categoryIds` convention exactly).
- **New component**: `apps/web/src/components/CategoryTabsSection.tsx`, a
  `"use client"` component, near-identical in shape to `HealthConcernSection.tsx`:
  `useState` for active category + products, `useTransition` for the re-fetch,
  `safeGet("/api/v1/products", { params: { query: { categoryId, ... } } })` on tab
  change. Rendered via `PillTabs` + `ProductCarouselSection` (existing `@amader/ui`
  primitives — the same ones `HealthConcernSection` already uses).
- **Data needed at render time**: the section needs the full category list (already
  fetched once per home-page render as `categories`, passed through `ctx` to
  `renderSection` — no new backend call needed at initial render) plus one initial
  products fetch for the first tab (mirrors how `Home` already pre-fetches
  `firstTagProducts` for the hardcoded tag section).
- **Empty state**: no categories resolved (explicit `categoryIds` that don't exist, or
  zero categories site-wide) → render `null`.

### 3. `REEL_CARDS`

Horizontal row of video/gif cards — poster image by default, hover triggers inline
muted+looping playback (confirmed with user), optional click-through link.

- **Config shape**:
  `{ items: { mediaUrl: string; posterImageUrl?: string; linkUrl?: string; caption?: string }[] }`
- **New component**: `packages/ui/src/components/ReelRow.tsx` — presentation-only
  (no data fetching), consistent with the other 8 section components already living in
  `packages/ui` (`HeroCarousel`, `CertificationRow`, `TestimonialsBento`, etc). Ships
  with a Storybook story, matching every existing `packages/ui` component.
  - Each card: `<video>` (muted, loop, playsInline, `preload="none"`) swapped visible on
    `onMouseEnter`/hidden on `onMouseLeave` over a poster `<img>`; `.gif` URLs need no
    special handling (an `<img src=".gif">` already animates natively — the hover
    interaction there is really just poster-vs-playing where "playing" IS the gif
    itself, so gif items render as a plain `<img>`, mp4/webm items render as `<video>` —
    detected by checking `mediaUrl`'s extension (`.gif` → `<img>`, anything else →
    `<video>`), no separate config field needed).
  - Card content wrapped in `AppLink` when `linkUrl` is present, plain `div` otherwise.
  - Rendered inside the existing `Carousel` primitive for the horizontal scroll +
    arrow-button chrome (same reuse as `AD_SLIDER`).
- **Empty state**: `config.items` empty/missing → render `null`.

## Implementation surface

1. **`packages/db/prisma/schema.prisma`**: add `AD_SLIDER`, `CATEGORY_TABS`,
   `REEL_CARDS` to the `HomepageSectionType` enum. New Prisma migration.
2. **Backend**: no new validation needed — of the 9 existing types, only
   `PRODUCT_COLLECTION` gets backend-side config validation
   (`assertValidCollectionRef` in `homepage-sections.service.ts`); the other 8 are
   free-form JSON validated only by the frontend renderer reading it defensively. The 3
   new types follow that same established precedent, not a stricter one.
3. **`apps/web/src/app/[locale]/page.tsx`**: add the 3 new literals to the local
   `HomepageSectionType` union (re-declared locally because of the documented
   swagger-CLI enum-erasure issue — see `AGENTS.web.md` changelog) and 3 new `case`s in
   `renderSection`.
4. **`packages/ui/src/components/ReelRow.tsx`** (new) + `ReelRow.stories.tsx` (new),
   exported from `packages/ui`'s index.
5. **`apps/web/src/components/CategoryTabsSection.tsx`** (new).
6. Regenerate `apps/web/src/lib/api/schema.d.ts` via `npm run typegen` (backend must be
   running) after the Prisma enum change lands and the backend rebuilds.
7. **Seed data**: once all 12 types exist end-to-end, create one real instance of each
   via the admin API against the dev DB, using already-seeded products/categories/tags,
   so the homepage renders a realistic, populated page locally. This directly closes the
   "why is the homepage empty" question from this session.

## Testing / Verification

- `npx tsc --noEmit` clean in `apps/web` after the type-union and component changes.
- Prisma migration applies cleanly (`prisma migrate dev`) against the local dev DB.
- Live verification (matching this project's established phase-verification pattern —
  see `AGENTS.web.md` §14 for precedent): start real backend + frontend, create one
  instance of each new type via the admin API, confirm each renders correctly on the
  homepage, confirm `CATEGORY_TABS`'s tab-click re-fetch actually swaps products,
  confirm `REEL_CARDS`' hover-to-play works for both a `.mp4` and a `.gif` item, confirm
  all three degrade to nothing (no broken layout) when their `config` is empty. Delete
  test section rows that aren't part of the final "populate the homepage" seed step.

## Out of scope (explicit)

- Any admin dashboard UI (upload widgets, drag-reorder, live preview). Confirmed with
  the user — separate future project.
- Changing the existing hardcoded tag-based `HealthConcernSection` — left as-is, not
  asked for.
- Backend-side JSON-schema validation of section `config` beyond the existing
  `PRODUCT_COLLECTION` precedent — matches, not exceeds, current rigor.
