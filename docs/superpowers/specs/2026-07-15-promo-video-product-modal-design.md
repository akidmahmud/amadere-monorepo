# Promo Video: product linking + click-to-open modal

## Context

`PROMO_VIDEO` is an existing `HomepageSection` type (`packages/db/prisma/schema.prisma`
enum `HomepageSectionType`, migration `20260711172902_promo_video_section`). Today it
renders a horizontal row of video cards (`packages/ui/src/components/
PromoVideoSection.tsx`) that autoplay muted **on hover** and, if the admin set an
optional `linkUrl`, navigate away on click. Sources supported: `YOUTUBE`, `TIKTOK`,
`INSTAGRAM`, `R2` (uploaded mp4), `GIF` — all already render inline via `<video>`/
`<iframe>` (never a link out to youtube.com/tiktok.com).

The client wants each video optionally tied to a specific product (reference: a
screenshot from Organic India's website — a reel-style row of product videos that,
on click, opens a modal with the video on one side and that product's info + Add to
Cart on the other, with next/prev navigation between videos in the row).

Decisions locked in during brainstorming (see conversation, not re-litigated here):

- Grid autoplay switches from hover-triggered to **visible-in-viewport-triggered**
  (`IntersectionObserver`), so a section with many cards doesn't autoplay everything
  on page load.
- The modal **starts unmuted** (a click is explicit intent to watch/listen).
- The modal has **both prev and next**, cycling (wraps at both ends).
- A video's product link is **optional** — unlinked videos still work exactly as they
  do today (modal just shows video, full width, no product panel).
- "Add to cart" in the modal adds the **default variant only**; a variant/size picker
  is out of scope — "More info" goes to the full PDP for that.
- The old `linkUrl` field is **removed**. Its only job was "click navigates somewhere";
  now every click opens the modal, so it has no remaining purpose. (Confirmed with the
  user — no fallback "navigate instead of modal" behavior is being kept.)

## Data model — no schema/migration change

`HomepageSection.config` is already a freeform `Json` column. The video-card shape
stored inside `config.videos[]` changes from:

```ts
interface PromoVideoCard {
  source: "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "R2" | "GIF";
  url: string;
  thumbnailUrl?: string;
  linkUrl?: string;       // removed
}
```

to:

```ts
interface PromoVideoCard {
  source: "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "R2" | "GIF";
  url: string;
  thumbnailUrl?: string;
  productId?: number;     // new
}
```

No DTO validation changes needed — `CreateHomepageSectionDto.config` is already a plain
`@IsObject()` field with no per-type shape enforcement at the DTO layer (matches how
every other section type's config is handled today).

## Backend — resolving `productId` into real product data

Mirrors the existing precedent for `PRODUCT_COLLECTION`/`TABBED_COLLECTION_CAROUSEL`:
`HomepageSectionsService.publicList()` already resolves `collectionId`/`tabs[].collectionId`
into real product data server-side before the page reaches the browser
(`homepage-sections.service.ts:109-144`). `PROMO_VIDEO` gets the same treatment instead
of a client-side fetch per modal-open.

1. **New method on `ProductsService`**: `getManyByIds(ids: number[], locale: Locale):
   Promise<Map<number, PublicProductDto>>` — batch `findMany` with `PRODUCT_INCLUDE`,
   filtered to `status: 'PUBLISHED', deletedAt: null` (same filter `CollectionsService
   .loadPublicProducts` already applies), mapped via the existing `toPublicProductDto`.
2. **`HomepageSectionsService.publicList()`**: for `section.type === 'PROMO_VIDEO'`,
   extract every `productId` present in `config.videos`, call `getManyByIds`, and build
   a `promoVideoProducts: (PublicProductDto | null)[]` array — same length/order as
   `config.videos`, `null` at any index whose video has no `productId` or whose product
   no longer resolves (deleted/unpublished since the video was configured) — same
   null-per-entry convention `tabCollections` already uses, not "drop the video".
3. **`HomepageSectionsModule`**: add `ProductsModule` to `imports` (already exports
   `ProductsService`; no circular dependency — `ProductsModule` imports only `SeoModule`
   and `ReviewsModule`).
4. **`PublicHomepageSectionDto`**: add `promoVideoProducts: PublicProductDto[] | null`
   alongside the existing `collection`/`tabCollections` fields.

## Admin UI (`apps/admin/.../homepage-sections/`)

`PromoVideoFields.tsx`'s per-card editor (`PromoVideoCard` local interface, currently
lines ~201-312): replace the `linkUrl` text input with a "Linked product (optional)"
`<select>` sourced from the existing `usePickerProducts()` hook (`apps/admin/src/hooks/
usePickers.ts`) — same plain-dropdown-over-first-100 pattern already used by
`BundleItemsFields.tsx` and the Collections edit page. 77 products total today, well
within what a plain dropdown handles comfortably; no search-as-you-type needed.

## Storefront — grid behavior

`packages/ui/src/components/PromoVideoSection.tsx`:

- New small `useInView` hook (native `IntersectionObserver`, ~15 lines, no new
  dependency) replaces `PromoVideoCardTile`'s `onMouseEnter`/`onMouseLeave` state.
  Threshold: element is "in view" once ≥50% visible; `PlayingMedia` mounts/unmounts
  based on that instead of hover.
- `PromoVideoCardTile` gets an `onClick` that opens the modal (passes its own index),
  regardless of whether a product is linked. The `card.linkUrl` wrap-in-`<Link>`
  behavior is removed entirely.
- The play-button overlay icon (currently shown when *not* hovering) stays, but now
  reads as "click to open" rather than "hover to preview" — still shown whenever the
  card isn't the one currently auto-playing in-view, doubling as an affordance for the
  click-to-expand behavior.

## Storefront — the modal

New component, `packages/ui/src/components/PromoVideoModal.tsx`:

- Props: `items: (PromoVideoCard & { product: PromoVideoProduct | null })[]`,
  `openIndex: number`, `onClose: () => void`, `onNavigate: (index: number) => void`,
  `onAddToCart?: (productId: number) => void`, `addToCartPending?: boolean`,
  `pendingProductId?: number`, `linkComponent?: LinkComponent`.
- `PromoVideoProduct` (new, local to this file — plain prop shape, not the raw API
  DTO, matching how `ProductCardProps` already keeps `packages/ui` decoupled from any
  app's generated API types): `{ productId: number; slug: string; name: string;
  description: string | null; price: string; originalPrice?: string; imageUrl?: string }`.
- Layout: two-column on desktop (video left, product panel right) when `product` is
  present; single-column full-width video when it isn't. Reuses the existing
  `PlayingMedia` renderer from `PromoVideoSection.tsx` (exported instead of file-private)
  so YouTube/TikTok/mp4/GIF playback logic isn't duplicated.
- Mute toggle: starts unmuted (`autoplay` without `mute=1` for the YouTube iframe src
  when opened via the modal; `<video>` element's `muted` prop driven by local state
  starting `false`). Toggle button overlays the video, matches the reference screenshot's
  speaker icon.
  **Disclosed platform limitation**: this is guaranteed for `R2` (native `<video>`,
  directly triggered by the click's user gesture in the same document) but not for the
  iframe-embedded sources (`YOUTUBE`/`TIKTOK`/`INSTAGRAM`) — browsers apply stricter
  autoplay-with-sound policies to cross-origin iframes, and a user gesture on the parent
  page doesn't always transfer into the iframe's own autoplay permission. Where a
  browser blocks it, the embed falls back to its own paused/muted state with the
  platform's native play button showing — not something fixable from the embedding
  side (same category of limitation this codebase already discloses for Instagram's
  hover-autoplay, `PromoVideoSection.tsx:39-43`).
- Prev/next: circular arrow buttons, call `onNavigate((openIndex ± 1 + items.length) %
  items.length)` — wraps at both ends per the locked-in decision.
- Close: `×` button, backdrop click, and `Escape` keydown all call `onClose`.
- Product panel: name, price (with a struck-through original price when on sale — same
  presentation `ProductCard` already uses elsewhere), description truncated via
  `line-clamp` with a "Read more" toggle, "More info" (`<Link href="/products/{slug}">`),
  "Add to cart" (calls `onAddToCart(productId)`, shows a pending state via
  `addToCartPending && pendingProductId === productId`, same contract `ProductCard`
  already exposes).

`PromoVideoSection` itself gains `onAddToCart`/`addToCartPending`/`pendingProductId`
passthrough props and owns the `openIndex: number | null` state, rendering
`PromoVideoModal` conditionally.

## Storefront — wiring Add to Cart

`apps/web`'s homepage (`app/[locale]/page.tsx`) is a Server Component; "Add to cart"
needs the client-side cart mutation hook. This codebase already has the exact pattern
for this problem — `ProductCarouselSectionClient.tsx` is a thin `"use client"` wrapper
that wires `useCardAddToCart()` and hands the result down as props to a `packages/ui`
component. New file `apps/web/src/components/PromoVideoSectionClient.tsx` mirrors it
exactly: wires `useCardAddToCart()`, maps `section.promoVideoProducts[i]` (raw
`PublicProductDto | null`) into the `PromoVideoProduct` shape via a small new
`toPromoVideoProductData()` function in `apps/web/src/lib/product-card-mapper.ts`
(sibling to the existing `toProductCardData()`), and renders `PromoVideoSection`.

`page.tsx`'s `PROMO_VIDEO` case switches from rendering `PromoVideoSection` directly to
rendering `PromoVideoSectionClient`, passing `items` (video cards) and
`section.promoVideoProducts` (parallel array) through.

## Explicitly out of scope

- Variant/size picker inside the modal (default variant only; "More info" covers it).
- Search-as-you-type product picker in the admin form (77 products; plain dropdown is
  enough — revisit if the catalog grows much larger).
- Any change to `Product.videoUrl` (the separate, existing single-video-per-PDP field)
  — unrelated to this feature.
- A `linkUrl`-style "navigate instead of opening the modal" fallback — removed, not kept
  in any form (confirmed with the user).

## Verification approach

- `pnpm -r exec tsc --noEmit` across `packages/db`, `apps/backend`, `packages/ui`,
  `apps/admin`, `apps/web` after each layer lands.
- Live: create/extend a `PROMO_VIDEO` section via the admin API with at least one video
  linked to a real product and one left unlinked; confirm `GET /api/v1/homepage-sections`
  (or wherever the public list is exposed) returns the resolved `promoVideoProducts`
  array with correct null-alignment.
- SSR-fetch the homepage and grep for the new video-card/modal trigger markup.
- No browser available in this environment (Chromium not installed) — visual/interaction
  behavior (autoplay-on-scroll-into-view, modal open/close, prev/next, mute toggle) can't
  be screenshot-verified this session; flagged explicitly rather than claimed as tested.
