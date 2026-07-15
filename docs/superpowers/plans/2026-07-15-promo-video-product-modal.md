# Promo Video: Product Linking + Click-to-Open Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each `PROMO_VIDEO` homepage section video optionally link to a product; autoplay only when scrolled into view (not on hover); clicking a video opens an in-site modal with the video, that product's info, and prev/next navigation — never redirecting to YouTube/TikTok.

**Architecture:** No schema migration — `HomepageSection.config` is already freeform JSON, so `productId` is just a new optional field inside the existing `config.videos[]` array. The backend resolves `productId` → full product data server-side (mirroring the existing `PRODUCT_COLLECTION`/`TABBED_COLLECTION_CAROUSEL` pattern) so the storefront never fetches per-click. The storefront's homepage is a Server Component, so "Add to cart" is wired through a thin client-boundary wrapper, mirroring the existing `ProductCarouselSectionClient.tsx` pattern exactly.

**Tech Stack:** NestJS + Prisma (`apps/backend`), Next.js Server Components + a `"use client"` boundary (`apps/web`), shared React component library (`packages/ui`), native `IntersectionObserver` (no new dependency).

## Global Constraints

- No Prisma migration — `HomepageSection.config` stays `Json`, only its TypeScript shape (documented, not DB-enforced) changes.
- The old `linkUrl` field on video cards is removed entirely (confirmed with the user — no fallback "navigate instead of modal" behavior).
- Modal starts unmuted; grid preview stays muted (unchanged from today).
- Modal has both prev and next, cycling at both ends.
- "Add to cart" in the modal adds the product's default variant only — no size/variant picker in the modal.
- A video's `productId` is optional — unlinked videos render the modal as video-only, no product panel.
- No browser is available in this environment to visually verify interactive behavior (autoplay-on-scroll, modal open/close, mute toggle) — every task's verification step is typecheck + a live curl/SSR check of the underlying data/markup, with the interactive-only gap called out explicitly rather than claimed as tested.
- Test data written to the live dev DB during verification must be reverted afterward (this codebase's established discipline — see e.g. the existing `PROMO_VIDEO` section id 6, a single YouTube video with no product, must end this plan in its original state or a clearly-intentional improved state, not left in a broken intermediate state).

---

### Task 1: Backend — resolve `productId` into real product data for `PROMO_VIDEO` sections

**Files:**
- Modify: `apps/backend/src/modules/products/products.service.ts` (add `getManyByIds`, after the existing `publicList` method, ~line 338)
- Modify: `apps/backend/src/modules/homepage-sections/homepage-sections.module.ts` (import `ProductsModule`)
- Modify: `apps/backend/src/modules/homepage-sections/homepage-sections.service.ts` (inject `ProductsService`, resolve `PROMO_VIDEO` products in `publicList`)
- Modify: `apps/backend/src/modules/homepage-sections/homepage-sections.mapper.ts` (add `promoVideoProducts` field)

**Interfaces:**
- Produces: `ProductsService.getManyByIds(ids: number[], locale: Locale): Promise<Map<number, PublicProductDto>>`
- Produces: `PublicHomepageSectionDto.promoVideoProducts: (PublicProductDto | null)[] | null` — same length/order as the section's `config.videos`, `null` at any index whose video has no `productId` or whose product no longer resolves (deleted/unpublished).
- Consumes: existing `PRODUCT_INCLUDE` (`apps/backend/src/modules/products/product-includes.ts`) and `toPublicProductDto` (`apps/backend/src/modules/products/products.mapper.ts`) — unchanged.

- [ ] **Step 1: Add `getManyByIds` to `ProductsService`**

Open `apps/backend/src/modules/products/products.service.ts`. Insert this method immediately after the closing brace of `publicList` (currently ends at line 338, right before `async publicGetBySlug`):

```ts
  async getManyByIds(
    ids: number[],
    locale: Locale,
  ): Promise<Map<number, PublicProductDto>> {
    if (ids.length === 0) return new Map();
    const products = await this.prisma.client.product.findMany({
      where: { id: { in: ids }, deletedAt: null, status: 'PUBLISHED' },
      include: PRODUCT_INCLUDE,
    });
    return new Map(products.map((p) => [p.id, toPublicProductDto(p, locale)]));
  }
```

No new imports needed — `PRODUCT_INCLUDE`, `toPublicProductDto`, `Locale`, and `PublicProductDto` are all already imported at the top of this file (lines 7, 14, 15, 23).

- [ ] **Step 2: Typecheck backend**

Run: `cd "H:\Amder Project\backend" && npx tsc --noEmit -p apps/backend/tsconfig.json`
Expected: no output (clean).

- [ ] **Step 3: Wire `ProductsModule` into `HomepageSectionsModule`**

Replace the full contents of `apps/backend/src/modules/homepage-sections/homepage-sections.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CollectionsModule } from '../collections/collections.module';
import { ProductsModule } from '../products/products.module';
import { AdminHomepageSectionsController } from './admin-homepage-sections.controller';
import { HomepageSectionsController } from './homepage-sections.controller';
import { HomepageSectionsService } from './homepage-sections.service';

@Module({
  imports: [CollectionsModule, ProductsModule],
  controllers: [HomepageSectionsController, AdminHomepageSectionsController],
  providers: [HomepageSectionsService],
})
export class HomepageSectionsModule {}
```

- [ ] **Step 4: Inject `ProductsService` and resolve `PROMO_VIDEO` products in `HomepageSectionsService`**

Open `apps/backend/src/modules/homepage-sections/homepage-sections.service.ts`.

Change the import block (lines 1-12) to add two imports:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { HomepageSectionType, Locale, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CollectionsService } from '../collections/collections.service';
import { ProductsService } from '../products/products.service';
import { PublicProductDto } from '../products/dto/product-response.dto';
import { CreateHomepageSectionDto } from './dto/create-homepage-section.dto';
import { UpdateHomepageSectionDto } from './dto/update-homepage-section.dto';
import {
  AdminHomepageSectionDto,
  PublicHomepageSectionDto,
  toAdminHomepageSectionDto,
  toPublicHomepageSectionDto,
} from './homepage-sections.mapper';
```

Change the constructor (lines 18-21):

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly collections: CollectionsService,
    private readonly products: ProductsService,
  ) {}
```

Replace the `publicList` method (lines 109-129) with:

```ts
  async publicList(locale: Locale): Promise<PublicHomepageSectionDto[]> {
    const sections = await this.prisma.client.homepageSection.findMany({
      where: { isActive: true },
      include: WITH_TRANSLATIONS,
      orderBy: { sortOrder: 'asc' },
    });

    return Promise.all(
      sections.map(async (section) => {
        const collection =
          section.type === 'PRODUCT_COLLECTION' && section.collectionId
            ? await this.collections.getResolvedById(section.collectionId, locale)
            : null;
        const tabCollections =
          section.type === 'TABBED_COLLECTION_CAROUSEL'
            ? await this.resolveTabCollections(section.config, locale)
            : null;
        const promoVideoProducts =
          section.type === 'PROMO_VIDEO'
            ? await this.resolvePromoVideoProducts(section.config, locale)
            : null;
        return toPublicHomepageSectionDto(
          section,
          collection,
          locale,
          tabCollections,
          promoVideoProducts,
        );
      }),
    );
  }

  private async resolvePromoVideoProducts(
    config: unknown,
    locale: Locale,
  ): Promise<(PublicProductDto | null)[]> {
    const productIds = extractPromoVideoProductIds(config);
    const uniqueIds = [...new Set(productIds.filter((id): id is number => id !== null))];
    const resolved = await this.products.getManyByIds(uniqueIds, locale);
    return productIds.map((id) => (id !== null ? (resolved.get(id) ?? null) : null));
  }
```

Add this free function at the bottom of the file, right after `extractProductsPerTab` (currently the last function, ending at line 193):

```ts
function extractPromoVideoProductIds(config: unknown): (number | null)[] {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return [];
  const videos = (config as Record<string, unknown>).videos;
  if (!Array.isArray(videos)) return [];
  return videos.map((v) => {
    const id = v && typeof v === 'object' ? (v as Record<string, unknown>).productId : undefined;
    return typeof id === 'number' ? id : null;
  });
}
```

- [ ] **Step 5: Add `promoVideoProducts` to the public DTO/mapper**

Open `apps/backend/src/modules/homepage-sections/homepage-sections.mapper.ts`.

Change the import block (lines 1-8) to add `PublicProductDto`:

```ts
import {
  HomepageSection,
  HomepageSectionTranslation,
  HomepageSectionType,
  Locale,
  Prisma,
} from '@amader/db';
import { PublicCollectionDto } from '../collections/collections.mapper';
import { PublicProductDto } from '../products/dto/product-response.dto';
```

Replace the `PublicHomepageSectionDto` class (lines 48-61):

```ts
export class PublicHomepageSectionDto {
  id!: number;
  type!: HomepageSectionType;
  sortOrder!: number;
  heading!: string | null;
  subheading!: string | null;
  config!: Prisma.JsonValue;
  collection!: PublicCollectionDto | null;
  /** TABBED_COLLECTION_CAROUSEL only — one resolved collection (with real
   * products, already sliced to config.productsPerTab) per config.tabs
   * entry, same order, null for a tab whose collectionId no longer
   * resolves (deleted/unpublished) rather than dropping the tab silently. */
  tabCollections!: (PublicCollectionDto | null)[] | null;
  /** PROMO_VIDEO only — one resolved product per config.videos entry, same
   * order/length, null for a video with no productId or whose product no
   * longer resolves (deleted/unpublished) rather than dropping the video. */
  promoVideoProducts!: (PublicProductDto | null)[] | null;
}
```

Replace `toPublicHomepageSectionDto` (lines 63-82):

```ts
export function toPublicHomepageSectionDto(
  section: HomepageSectionWithTranslations,
  collection: PublicCollectionDto | null,
  locale: Locale,
  tabCollections: (PublicCollectionDto | null)[] | null = null,
  promoVideoProducts: (PublicProductDto | null)[] | null = null,
): PublicHomepageSectionDto {
  const translation =
    section.translations.find((t) => t.locale === locale) ??
    section.translations[0];
  return {
    id: section.id,
    type: section.type,
    sortOrder: section.sortOrder,
    heading: translation?.heading ?? null,
    subheading: translation?.subheading ?? null,
    config: section.config,
    collection,
    tabCollections,
    promoVideoProducts,
  };
}
```

- [ ] **Step 6: Typecheck backend again**

Run: `cd "H:\Amder Project\backend" && npx tsc --noEmit -p apps/backend/tsconfig.json`
Expected: no output (clean).

- [ ] **Step 7: Live verification against the running dev backend**

The dev backend runs in watch mode on port 3000 and picks up saved changes automatically. Confirm it's still healthy, then exercise the new resolution end-to-end.

Run (bash):
```bash
cd "H:\Amder Project\backend"
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/admin/auth/login -H "Content-Type: application/json" -d '{"email":"admin@amadere.com","password":"ChangeMe123!"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.accessToken))")
echo "token acquired: ${TOKEN:0:10}..."

# Grab a real published product id to link.
PRODUCT_ID=$(curl -s "http://localhost:3000/api/v1/products?pageSize=1" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.items[0].id))")
echo "using product id: $PRODUCT_ID"

# Section id 6 is the existing seeded PROMO_VIDEO section (one YouTube video, no
# product). Confirm its current config before touching it — if this doesn't
# print exactly {"videos":[{"source":"YOUTUBE","url":"https://www.youtube.com/shorts/ynxneIXKpCY"}]},
# STOP and use whatever this actually prints as the restore value in Step 8
# instead of the hardcoded one shown there — don't blindly overwrite
# unfamiliar state.
curl -s "http://localhost:3000/api/v1/admin/homepage-sections/6" -H "Authorization: Bearer $TOKEN" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(d).data.config)))"

# Temporarily link that video to the real product.
curl -s -X PATCH "http://localhost:3000/api/v1/admin/homepage-sections/6" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"config\":{\"videos\":[{\"source\":\"YOUTUBE\",\"url\":\"https://www.youtube.com/shorts/ynxneIXKpCY\",\"productId\":$PRODUCT_ID}]}}"

# Confirm the PUBLIC endpoint now resolves it.
curl -s "http://localhost:3000/api/v1/homepage-sections?locale=EN" | node -e "
let d='';process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  const sections = JSON.parse(d).data;
  const promo = sections.find(s => s.id === 6);
  console.log('promoVideoProducts:', JSON.stringify(promo.promoVideoProducts?.map(p => p && {id: p.id, name: p.name})));
});
"
```

Expected: the last command prints `promoVideoProducts: [{"id":<PRODUCT_ID>,"name":"<real product name>"}]` — i.e. the public API resolved the linked product server-side.

- [ ] **Step 8: Revert the test section back to its original state**

Use the config value Step 7 printed *before* the PATCH — this is only correct if that value matched the one shown below. If Step 7 printed something different, use that instead.

```bash
cd "H:\Amder Project\backend"
curl -s -X PATCH "http://localhost:3000/api/v1/admin/homepage-sections/6" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"config":{"videos":[{"source":"YOUTUBE","url":"https://www.youtube.com/shorts/ynxneIXKpCY"}]}}'
curl -s "http://localhost:3000/api/v1/admin/homepage-sections/6" -H "Authorization: Bearer $TOKEN"
```

Expected: the final GET shows `config.videos` back to exactly `[{"source":"YOUTUBE","url":"https://www.youtube.com/shorts/ynxneIXKpCY"}]` (no `productId`), matching the pre-test state.

- [ ] **Step 9: Commit**

```bash
cd "H:\Amder Project\backend"
git add apps/backend/src/modules/products/products.service.ts apps/backend/src/modules/homepage-sections/homepage-sections.module.ts apps/backend/src/modules/homepage-sections/homepage-sections.service.ts apps/backend/src/modules/homepage-sections/homepage-sections.mapper.ts
git commit -m "$(cat <<'EOF'
Resolve productId into real product data for PROMO_VIDEO sections

Mirrors the existing PRODUCT_COLLECTION/TABBED_COLLECTION_CAROUSEL
pattern: server-side resolution so the storefront never needs a
per-click fetch when the promo video modal opens.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Admin UI — replace "Link URL" with a product picker

**Files:**
- Modify: `apps/admin/src/components/homepage-sections/SectionConfigFields.tsx:198-312` (the `PromoVideoFields` component and its local `PromoVideoCard` type)

**Interfaces:**
- Consumes: `usePickerProducts()` from `apps/admin/src/hooks/usePickers.ts` (already exists, unchanged) — returns `{ data: { id: number; label: string }[] | undefined, isLoading }`.
- Produces: admin-authored `config.videos[].productId?: number`, replacing `config.videos[].linkUrl?: string`.

- [ ] **Step 1: Add `usePickerProducts` to the import line**

Change line 6 of `apps/admin/src/components/homepage-sections/SectionConfigFields.tsx` from:

```ts
import { usePickerBlogPosts, usePickerCategories, usePickerCollections } from "@/hooks/usePickers";
```

to:

```ts
import { usePickerBlogPosts, usePickerCategories, usePickerCollections, usePickerProducts } from "@/hooks/usePickers";
```

- [ ] **Step 2: Update the `PromoVideoCard` interface (lines 201-206)**

Replace:

```ts
interface PromoVideoCard {
  source: PromoVideoSource;
  url: string;
  thumbnailUrl?: string;
  linkUrl?: string;
}
```

with:

```ts
interface PromoVideoCard {
  source: PromoVideoSource;
  url: string;
  thumbnailUrl?: string;
  productId?: number;
}
```

- [ ] **Step 3: Call `usePickerProducts()` inside `PromoVideoFields` and update the helper comment (lines 212-232)**

Replace:

```ts
// Card size on the storefront is fixed at 377×600 (reel/shorts shape).
// Source determines how the "url" field is captured: R2/GIF are files we
// host (MediaPicker, same widget as everywhere else), YOUTUBE/TIKTOK/
// INSTAGRAM are just a link to the post on that platform.
function PromoVideoFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const videos = (config.videos as PromoVideoCard[] | undefined) ?? [];

  function updateVideos(next: PromoVideoCard[]) {
    onConfigChange({ ...config, videos: next });
  }
  function updateCard(i: number, patch: Partial<PromoVideoCard>) {
    updateVideos(videos.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-semibold text-secondary">
        Videos <span className="font-normal text-muted">— cards render at 377 × 600px, hover to autoplay</span>
      </span>
```

with:

```ts
// Card size on the storefront is fixed at 377×600 (reel/shorts shape).
// Source determines how the "url" field is captured: R2/GIF are files we
// host (MediaPicker, same widget as everywhere else), YOUTUBE/TIKTOK/
// INSTAGRAM are just a link to the post on that platform.
function PromoVideoFields({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const videos = (config.videos as PromoVideoCard[] | undefined) ?? [];
  const { data: products } = usePickerProducts();

  function updateVideos(next: PromoVideoCard[]) {
    onConfigChange({ ...config, videos: next });
  }
  function updateCard(i: number, patch: Partial<PromoVideoCard>) {
    updateVideos(videos.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-semibold text-secondary">
        Videos{" "}
        <span className="font-normal text-muted">
          — cards render at 377 × 600px, autoplay when scrolled into view, click opens a product modal
        </span>
      </span>
```

- [ ] **Step 4: Replace the "Link URL" field (lines 291-298) with the product picker**

Replace:

```tsx
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Link URL (optional)</span>
              <input
                value={card.linkUrl ?? ""}
                onChange={(e) => updateCard(i, { linkUrl: e.target.value })}
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
            </label>
```

with:

```tsx
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Linked product (optional)</span>
              <select
                value={card.productId ?? ""}
                onChange={(e) =>
                  updateCard(i, { productId: e.target.value ? Number(e.target.value) : undefined })
                }
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              >
                <option value="">— None —</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
```

- [ ] **Step 5: Typecheck admin**

Run: `cd "H:\Amder Project\backend" && npx tsc --noEmit -p apps/admin/tsconfig.json`
Expected: no output (clean).

- [ ] **Step 6: Live verification — confirm the new shape persists through the existing generic config-JSON storage**

This proves the field name/shape the form now writes is exactly what Task 1's backend reads, without needing to click through the actual UI (not screenshot-testable in this environment).

```bash
cd "H:\Amder Project\backend"
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/admin/auth/login -H "Content-Type: application/json" -d '{"email":"admin@amadere.com","password":"ChangeMe123!"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.accessToken))")
PRODUCT_ID=$(curl -s "http://localhost:3000/api/v1/products?pageSize=1" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.items[0].id))")

curl -s -X PATCH "http://localhost:3000/api/v1/admin/homepage-sections/6" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"config\":{\"videos\":[{\"source\":\"YOUTUBE\",\"url\":\"https://www.youtube.com/shorts/ynxneIXKpCY\",\"productId\":$PRODUCT_ID}]}}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(d).data.config)))"

# Revert.
curl -s -X PATCH "http://localhost:3000/api/v1/admin/homepage-sections/6" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"config":{"videos":[{"source":"YOUTUBE","url":"https://www.youtube.com/shorts/ynxneIXKpCY"}]}}'
```

Expected: first command prints `{"videos":[{"source":"YOUTUBE","url":"https://www.youtube.com/shorts/ynxneIXKpCY","productId":<PRODUCT_ID>}]}`.

- [ ] **Step 7: Commit**

```bash
cd "H:\Amder Project\backend"
git add apps/admin/src/components/homepage-sections/SectionConfigFields.tsx
git commit -m "$(cat <<'EOF'
Replace promo video "Link URL" field with a product picker

Clicking a video now always opens the on-site modal instead of
navigating anywhere, so the old free-text link field has no
remaining purpose — an optional product link takes its place.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Storefront grid — autoplay only when scrolled into view

**Files:**
- Modify: `packages/ui/src/components/PromoVideoSection.tsx` (full file currently 133 lines)

**Interfaces:**
- Produces: `useInView(threshold?: number): [React.RefObject<HTMLDivElement | null>, boolean]` — local to this file, not exported (Task 4 will use it indirectly through `PromoVideoCardTile`, doesn't need to import it directly).
- Produces: `PromoVideoCard` interface without `linkUrl`.
- Note: `PromoVideoSectionProps.linkComponent` stays in the type/destructured signature but is intentionally unused by the end of this task — Task 4 wires it up. This project has no `noUnusedParameters`/`noUnusedLocals` TS flag, confirmed via `grep -n "noUnused" packages/ui/tsconfig.json tsconfig.base.json` returning nothing, so this doesn't break typecheck.

- [ ] **Step 1: Replace the whole file**

Replace the full contents of `packages/ui/src/components/PromoVideoSection.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";
import { Carousel } from "./Carousel";
import { SectionHeading } from "./SectionHeading";

export type PromoVideoSource = "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "R2" | "GIF";

export interface PromoVideoCard {
  source: PromoVideoSource;
  url: string;
  thumbnailUrl?: string;
}

export interface PromoVideoSectionProps {
  heading?: string;
  items: PromoVideoCard[];
  linkComponent?: LinkComponent;
}

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  return m?.[1] ?? null;
}
function tiktokId(url: string): string | null {
  const m = url.match(/tiktok\.com\/(?:@[^/]+\/video|embed(?:\/v2)?)\/(\d+)/) ?? url.match(/(\d{15,})/);
  return m?.[1] ?? null;
}
function instagramCode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reel|p)\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

// Renders the actual playable element for each source. Only mounted while
// in view (see useInView below) — nothing loads/plays until then.
// Disclosed limitation: YouTube/TikTok honor the autoplay+mute query params
// reliably; Instagram's oEmbed widget does not officially support
// autoplay-on-load, so its in-view behavior may just show the embed's own
// play button rather than truly autoplaying — a platform restriction, not
// something fixable from this side.
function PlayingMedia({ card }: { card: PromoVideoCard }) {
  if (card.source === "R2") {
    return (
      <video
        src={card.url}
        autoPlay
        muted
        loop
        playsInline
        className="h-full w-full object-cover"
      />
    );
  }
  if (card.source === "GIF") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={card.url} alt="" className="h-full w-full object-cover" />;
  }
  if (card.source === "YOUTUBE") {
    const id = youtubeId(card.url);
    const src = id
      ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&playsinline=1`
      : card.url;
    return (
      <iframe
        src={src}
        title="Promo video"
        allow="autoplay; encrypted-media"
        className="h-full w-full border-0 object-cover"
      />
    );
  }
  if (card.source === "TIKTOK") {
    const id = tiktokId(card.url);
    const src = id ? `https://www.tiktok.com/embed/v2/${id}?autoplay=1` : card.url;
    return <iframe src={src} title="Promo video" allow="autoplay" className="h-full w-full border-0" />;
  }
  // INSTAGRAM
  const code = instagramCode(card.url);
  const src = code ? `https://www.instagram.com/reel/${code}/embed/?autoplay=1` : card.url;
  return <iframe src={src} title="Promo video" allow="autoplay" className="h-full w-full border-0" />;
}

// Plays the card once it's ≥50% scrolled into view, pauses when it scrolls
// back out of view — replaces the old hover-to-play behavior so a section
// with many cards doesn't autoplay everything at once on page load.
function useInView(threshold = 0.5): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold });
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}

function PromoVideoCardTile({ card }: { card: PromoVideoCard }) {
  const [ref, isInView] = useInView();

  return (
    <div
      ref={ref}
      className="relative h-[600px] w-[377px] shrink-0 overflow-hidden rounded-2xl bg-black"
    >
      {isInView ? (
        <PlayingMedia card={card} />
      ) : card.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 grid place-items-center bg-black/20 transition-opacity",
          isInView ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="grid h-14 w-14 place-items-center rounded-full bg-white/90">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" className="ml-0.5 text-ink">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function PromoVideoSection({ heading, items, linkComponent }: PromoVideoSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="py-9">
      {heading && <SectionHeading>{heading}</SectionHeading>}
      <Carousel>
        {items.map((card, i) => (
          <PromoVideoCardTile key={`${card.url}-${i}`} card={card} />
        ))}
      </Carousel>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck `packages/ui`**

Run: `cd "H:\Amder Project\backend" && npx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: no output (clean).

- [ ] **Step 3: Typecheck `apps/web` (consumer)**

Run: `cd "H:\Amder Project\backend" && npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no output (clean). `page.tsx`'s `PROMO_VIDEO` case casts `config.videos` to a local inline type that still includes `linkUrl?: string` per item — that's harmless: TypeScript's excess-property check only fires on fresh object literals, not on a variable being passed through, so the extra field on `items` doesn't error against `PromoVideoCard[]`, and the call site's other props (`heading`, `items`, `linkComponent`) are unchanged and still valid. `apps/web` genuinely does not need any changes until Task 5 adds the new `products`/`onAddToCart` capability — this step is here to confirm that expectation, not to fix anything.

- [ ] **Step 4: Commit**

```bash
cd "H:\Amder Project\backend"
git add packages/ui/src/components/PromoVideoSection.tsx
git commit -m "$(cat <<'EOF'
Promo video cards autoplay when scrolled into view, not on hover

Replaces onMouseEnter/onMouseLeave with an IntersectionObserver-based
useInView hook, so a section with many cards doesn't autoplay
everything simultaneously on page load. Also drops the linkUrl
click-through, superseded by the click-to-open-modal behavior landing
in the next task.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Storefront — the click-to-open product modal

**Files:**
- Create: `packages/ui/src/components/PromoVideoModal.tsx`
- Modify: `packages/ui/src/components/PromoVideoSection.tsx` (from Task 3's state)

**Interfaces:**
- Consumes: `PromoVideoCard` from `./PromoVideoSection` (Task 3), `Button`/`PriceTag`/`DefaultLink`/`LinkComponent`/`cn` (all pre-existing, unchanged).
- Produces: `PromoVideoModal` component, `PromoVideoProduct` interface (both exported from `PromoVideoModal.tsx`).
- Produces: `PromoVideoSectionProps` gains `products?: (PromoVideoProduct | null)[]`, `onAddToCart?: (productId: number) => void`, `addToCartPending?: boolean`, `pendingProductId?: number` — this is the exact shape Task 5's `PromoVideoSectionClient.tsx` will pass through.

- [ ] **Step 1: Create `PromoVideoModal.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { Button } from "./Button";
import { PriceTag } from "./PriceTag";
import { PlayingMedia, type PromoVideoCard } from "./PromoVideoSection";

export interface PromoVideoProduct {
  productId: number;
  slug: string;
  name: string;
  description: string | null;
  price: string;
  originalPrice?: string;
  imageUrl?: string;
}

export interface PromoVideoModalProps {
  items: PromoVideoCard[];
  products: (PromoVideoProduct | null)[];
  openIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onAddToCart?: (productId: number) => void;
  addToCartPending?: boolean;
  pendingProductId?: number;
  linkComponent?: LinkComponent;
}

const closeIcon = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const chevronIcon = (
  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2.4}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
const mutedIcon = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
    <path d="M16.5 12A4.5 4.5 0 0 0 14 8v2.2l2.45 2.45c.03-.2.05-.43.05-.65zm2.5 0c0 .94-.2 1.82-.54 2.62l1.51 1.51A8.94 8.94 0 0 0 21 12c0-4.28-3-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
  </svg>
);
const unmutedIcon = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4-.91 7-4.49 7-8.77s-3-7.86-7-8.77z" />
  </svg>
);

// Only R2 (native <video> — a real DOM property) and YOUTUBE (documented
// `mute` embed param) actually respond to the mute toggle. TikTok/Instagram
// have no verified mute query param in their public embed APIs, so the
// toggle button is hidden for those — showing a control that silently does
// nothing would be worse than not showing one.
function mutableSource(source: PromoVideoCard["source"]): boolean {
  return source === "R2" || source === "YOUTUBE";
}

function ProductPanel({
  product,
  onAddToCart,
  addToCartPending,
  pendingProductId,
  linkComponent: Link = DefaultLink,
}: {
  product: PromoVideoProduct;
  onAddToCart?: (productId: number) => void;
  addToCartPending?: boolean;
  pendingProductId?: number;
  linkComponent?: LinkComponent;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPending = addToCartPending && pendingProductId === product.productId;

  return (
    <div className="flex w-full max-w-[360px] flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-start gap-3">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-[10px] bg-beige object-cover"
          />
        )}
        <div className="flex flex-col gap-1.5">
          <h3 className="font-ui text-lg font-semibold text-ink">{product.name}</h3>
          <PriceTag price={product.price} originalPrice={product.originalPrice} align="left" size="md" />
        </div>
      </div>
      {product.description && (
        <div>
          <p className={cn("font-body text-sm text-ink/80", !expanded && "line-clamp-3")}>
            {product.description}
          </p>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 font-ui text-xs font-semibold text-green hover:underline"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        </div>
      )}
      <div className="mt-auto flex gap-3">
        <Link
          href={`/products/${product.slug}`}
          className="inline-flex flex-1 items-center justify-center rounded-[9px] border-[1.5px] border-green px-5 py-2.5 text-center font-ui text-sm font-medium text-green hover:bg-cream"
        >
          More info
        </Link>
        <Button
          variant="green"
          className="flex-1"
          disabled={isPending}
          onClick={() => onAddToCart?.(product.productId)}
        >
          {isPending ? "Adding…" : "Add to cart"}
        </Button>
      </div>
    </div>
  );
}

export function PromoVideoModal({
  items,
  products,
  openIndex,
  onClose,
  onNavigate,
  onAddToCart,
  addToCartPending,
  pendingProductId,
  linkComponent,
}: PromoVideoModalProps) {
  const [muted, setMuted] = useState(false);
  const card = items[openIndex];
  const product = products[openIndex] ?? null;

  useEffect(() => {
    setMuted(false);
  }, [openIndex]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNavigate((openIndex + 1) % items.length);
      if (e.key === "ArrowLeft") onNavigate((openIndex - 1 + items.length) % items.length);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openIndex, items.length, onClose, onNavigate]);

  if (!card) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        {closeIcon}
      </button>

      {items.length > 1 && (
        <button
          type="button"
          aria-label="Previous video"
          onClick={() => onNavigate((openIndex - 1 + items.length) % items.length)}
          className="absolute left-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink hover:bg-white"
        >
          <span className="rotate-180">{chevronIcon}</span>
        </button>
      )}

      <div className="flex max-h-[85vh] w-full max-w-[820px] overflow-hidden rounded-2xl bg-white max-sm:flex-col">
        <div className="relative aspect-[377/600] w-full max-w-[420px] shrink-0 bg-black">
          <PlayingMedia card={card} muted={muted} />
          {mutableSource(card.source) && (
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => setMuted((v) => !v)}
              className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              {muted ? mutedIcon : unmutedIcon}
            </button>
          )}
        </div>
        {product && (
          <ProductPanel
            product={product}
            onAddToCart={onAddToCart}
            addToCartPending={addToCartPending}
            pendingProductId={pendingProductId}
            linkComponent={linkComponent}
          />
        )}
      </div>

      {items.length > 1 && (
        <button
          type="button"
          aria-label="Next video"
          onClick={() => onNavigate((openIndex + 1) % items.length)}
          className="absolute right-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink hover:bg-white"
        >
          {chevronIcon}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `PromoVideoSection.tsx` — export and extend `PlayingMedia`, wire click + modal state**

In `packages/ui/src/components/PromoVideoSection.tsx` (as left by Task 3):

Change the imports at the top:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";
import { Carousel } from "./Carousel";
import { SectionHeading } from "./SectionHeading";
import { PromoVideoModal, type PromoVideoProduct } from "./PromoVideoModal";
```

Change `PromoVideoSectionProps`:

```tsx
export interface PromoVideoSectionProps {
  heading?: string;
  items: PromoVideoCard[];
  products?: (PromoVideoProduct | null)[];
  onAddToCart?: (productId: number) => void;
  addToCartPending?: boolean;
  pendingProductId?: number;
  linkComponent?: LinkComponent;
}
```

Change `PlayingMedia` to accept and export `muted` (replace the whole function):

```tsx
// Renders the actual playable element for each source. `muted` only actually
// controls R2 (native <video> — a real DOM property) and YOUTUBE (documented
// `mute` embed param); TikTok/Instagram keep unconditional autoplay-only
// like before (see PromoVideoModal.tsx's mutableSource for why).
// Disclosed limitation: Instagram's oEmbed widget does not officially
// support autoplay-on-load, so its in-view behavior may just show the
// embed's own play button rather than truly autoplaying — a platform
// restriction, not something fixable from this side.
export function PlayingMedia({ card, muted = true }: { card: PromoVideoCard; muted?: boolean }) {
  if (card.source === "R2") {
    return (
      <video
        key={card.url}
        src={card.url}
        autoPlay
        muted={muted}
        loop
        playsInline
        className="h-full w-full object-cover"
      />
    );
  }
  if (card.source === "GIF") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={card.url} alt="" className="h-full w-full object-cover" />;
  }
  if (card.source === "YOUTUBE") {
    const id = youtubeId(card.url);
    const src = id
      ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${id}&playsinline=1`
      : card.url;
    return (
      <iframe
        key={`${card.url}-${muted}`}
        src={src}
        title="Promo video"
        allow="autoplay; encrypted-media"
        className="h-full w-full border-0 object-cover"
      />
    );
  }
  if (card.source === "TIKTOK") {
    const id = tiktokId(card.url);
    const src = id ? `https://www.tiktok.com/embed/v2/${id}?autoplay=1` : card.url;
    return <iframe src={src} title="Promo video" allow="autoplay" className="h-full w-full border-0" />;
  }
  // INSTAGRAM
  const code = instagramCode(card.url);
  const src = code ? `https://www.instagram.com/reel/${code}/embed/?autoplay=1` : card.url;
  return <iframe src={src} title="Promo video" allow="autoplay" className="h-full w-full border-0" />;
}
```

Change `PromoVideoCardTile` to accept and call `onClick` (replace the whole function):

```tsx
function PromoVideoCardTile({ card, onClick }: { card: PromoVideoCard; onClick: () => void }) {
  const [ref, isInView] = useInView();

  return (
    <div
      ref={ref}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="relative h-[600px] w-[377px] shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-black"
    >
      {isInView ? (
        <PlayingMedia card={card} />
      ) : card.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 grid place-items-center bg-black/20 transition-opacity",
          isInView ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="grid h-14 w-14 place-items-center rounded-full bg-white/90">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" className="ml-0.5 text-ink">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
```

Change `PromoVideoSection` to own `openIndex` state and render the modal (replace the whole function):

```tsx
export function PromoVideoSection({
  heading,
  items,
  products,
  onAddToCart,
  addToCartPending,
  pendingProductId,
  linkComponent = DefaultLink,
}: PromoVideoSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="py-9">
      {heading && <SectionHeading>{heading}</SectionHeading>}
      <Carousel>
        {items.map((card, i) => (
          <PromoVideoCardTile key={`${card.url}-${i}`} card={card} onClick={() => setOpenIndex(i)} />
        ))}
      </Carousel>
      {openIndex !== null && (
        <PromoVideoModal
          items={items}
          products={products ?? items.map(() => null)}
          openIndex={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
          onAddToCart={onAddToCart}
          addToCartPending={addToCartPending}
          pendingProductId={pendingProductId}
          linkComponent={linkComponent}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck `packages/ui`**

Run: `cd "H:\Amder Project\backend" && npx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
cd "H:\Amder Project\backend"
git add packages/ui/src/components/PromoVideoModal.tsx packages/ui/src/components/PromoVideoSection.tsx
git commit -m "$(cat <<'EOF'
Click a promo video to open a modal with the linked product

New PromoVideoModal: video on one side, product panel (name, price,
description, More info / Add to cart) on the other when a product is
linked, video-only when it isn't. Prev/next cycles through the
section's videos; Escape/backdrop-click/X all close it. Playback for
every source (YouTube/TikTok/mp4/GIF) stays embedded on-site via the
existing PlayingMedia renderer — never a redirect to the source
platform.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Storefront wiring — `apps/web` mapper, client boundary, and homepage

**Files:**
- Modify: `apps/web/src/lib/product-card-mapper.ts` (add `toPromoVideoProductData`)
- Create: `apps/web/src/components/PromoVideoSectionClient.tsx`
- Modify: `apps/web/src/app/[locale]/page.tsx` (imports + the `PROMO_VIDEO` case)

**Interfaces:**
- Consumes: `PublicProductDto` (generated, from `apps/web/src/lib/api/schema.d.ts`), `PromoVideoSection`/`PromoVideoSectionProps` (Task 4), `useCardAddToCart()` (pre-existing, `handleAddToCart(productId: number, packValue?: string)`).
- Produces: `toPromoVideoProductData(product: PublicProductDto): PromoVideoProductData` — structurally identical to `packages/ui`'s `PromoVideoProduct` (same field names/types), so no explicit type import is needed across the package boundary; TypeScript's structural typing matches them.
- Produces: `PromoVideoSectionClient` component.

- [ ] **Step 1: Add `toPromoVideoProductData` to the product card mapper**

Open `apps/web/src/lib/product-card-mapper.ts`. Append this to the end of the file (it already imports `toDisplayImageUrl` at the top — no new imports needed):

```ts
export interface PromoVideoProductData {
  productId: number;
  slug: string;
  name: string;
  description: string | null;
  price: string;
  originalPrice?: string;
  imageUrl?: string;
}

// Same price/sale/thumbnail logic as toProductCardData above, plus the
// description text the promo video modal's product panel needs (which the
// plain card grid doesn't show).
export function toPromoVideoProductData(product: PublicProductDto): PromoVideoProductData {
  const defaultVariant =
    product.variants.find((v) => v.isDefault) ?? product.variants[0];

  const price = product.price ?? defaultVariant?.price ?? "0";
  const salePrice = product.salePrice ?? defaultVariant?.salePrice ?? null;
  const onSale = salePrice != null && Number(salePrice) < Number(price);

  const primaryMedia =
    product.media.find((m) => m.isPrimary) ?? product.media[0];

  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: onSale ? salePrice! : price,
    originalPrice: onSale ? price : undefined,
    imageUrl: toDisplayImageUrl(primaryMedia?.url),
  };
}
```

- [ ] **Step 2: Typecheck `apps/web`**

Run: `cd "H:\Amder Project\backend" && npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no output (clean) — `toPromoVideoProductData` isn't imported/used by anything yet (that happens in Step 4), so this step just confirms the new function itself compiles without introducing errors elsewhere in the file.

- [ ] **Step 3: Create `PromoVideoSectionClient.tsx`**

```tsx
"use client";

import { PromoVideoSection, type PromoVideoSectionProps } from "@amader/ui";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";
import { AppLink } from "@/components/AppLink";

type Props = Omit<PromoVideoSectionProps, "onAddToCart" | "addToCartPending" | "pendingProductId" | "linkComponent">;

// Mirrors ProductCarouselSectionClient.tsx — the Server Component homepage
// can't use hooks directly, so this is the thin client boundary that wires
// the real "Add to Cart" handler for the promo video modal.
export function PromoVideoSectionClient(props: Props) {
  const { handleAddToCart, isPending, pendingProductId } = useCardAddToCart();

  return (
    <PromoVideoSection
      {...props}
      linkComponent={AppLink}
      onAddToCart={(productId) => handleAddToCart(productId)}
      addToCartPending={isPending}
      pendingProductId={pendingProductId}
    />
  );
}
```

- [ ] **Step 4: Wire it into the homepage**

Open `apps/web/src/app/[locale]/page.tsx`.

Change the `@amader/ui` import block (lines 4-18) — remove `PromoVideoSection` from it:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import {
  AdBannerSection,
  BentoBlogs,
  CategoryCard,
  CertificationRow,
  CircleBadgeBar,
  Carousel,
  HeroCarousel,
  ProductCarouselSection,
  SectionHeading,
  TestimonialsBento,
  ViewAllLink,
  type ProductCarouselItem,
} from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import type { components } from "@/lib/api/schema";
import { toProductCardData, toPromoVideoProductData } from "@/lib/product-card-mapper";
import { toDisplayImageUrl } from "@/lib/media";
import { HealthConcernSection } from "@/components/HealthConcernSection";
import { ProductCarouselSectionClient } from "@/components/ProductCarouselSectionClient";
import { PromoVideoSectionClient } from "@/components/PromoVideoSectionClient";
import { TabbedCollectionCarouselSection } from "@/components/TabbedCollectionCarouselSection";
```

Replace the `PROMO_VIDEO` case (currently lines 244-254):

```tsx
    case "PROMO_VIDEO": {
      const items = config.videos as
        | { source: "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "R2" | "GIF"; url: string; thumbnailUrl?: string }[]
        | undefined;
      if (!items || items.length === 0) return null;
      const products = (section.promoVideoProducts ?? items.map(() => null)).map((p) =>
        p ? toPromoVideoProductData(p) : null,
      );
      return (
        <div className={WRAPPER} key={section.id}>
          <PromoVideoSectionClient heading={section.heading ?? undefined} items={items} products={products} />
        </div>
      );
    }
```

- [ ] **Step 5: Regenerate the OpenAPI-derived types and typecheck**

Task 1 added `promoVideoProducts` to the backend's `PublicHomepageSectionDto` — `apps/web`'s generated `schema.d.ts` needs to pick that up before this typechecks clean.

```bash
cd "H:\Amder Project\backend\apps\web" && npm run typegen
cd "H:\Amder Project\backend" && npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: `typegen` prints the usual `openapi-typescript ... → src/lib/api/schema.d.ts` success line; the typecheck prints no output. If there's still an error about `section.promoVideoProducts` not existing on the local `HomepageSection` type (`apps/web/src/app/[locale]/page.tsx` lines 69-76), check whether `PublicHomepageSectionDto`'s generated shape needs `promoVideoProducts` explicitly added to that local type's fields — read the current `schema.d.ts` entry for `PublicHomepageSectionDto` first (`grep -n "PublicHomepageSectionDto:" -A 15 apps/web/src/lib/api/schema.d.ts`) to see whether it came through automatically (most likely, since it's not an enum field) before adding anything.

- [ ] **Step 6: Also regenerate admin's types (Task 2 already covered the admin form, but its `schema.d.ts` should stay in sync too)**

```bash
cd "H:\Amder Project\backend\apps\admin" && npm run typegen
cd "H:\Amder Project\backend" && npx tsc --noEmit -p apps/admin/tsconfig.json
```

Expected: both commands succeed with no errors.

- [ ] **Step 7: Live SSR verification — grid renders, no build errors**

```bash
cd "H:\Amder Project\backend"
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/admin/auth/login -H "Content-Type: application/json" -d '{"email":"admin@amadere.com","password":"ChangeMe123!"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.accessToken))")
PRODUCT_ID=$(curl -s "http://localhost:3000/api/v1/products?pageSize=1" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.items[0].id))")

# Link the seeded video to a real product so the homepage has something to resolve.
curl -s -X PATCH "http://localhost:3000/api/v1/admin/homepage-sections/6" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"isActive\":true,\"config\":{\"videos\":[{\"source\":\"YOUTUBE\",\"url\":\"https://www.youtube.com/shorts/ynxneIXKpCY\",\"productId\":$PRODUCT_ID}]}}"

curl -s -o /tmp/homepage.html -w "status: %{http_code}\n" -L "http://localhost:3001/"
grep -o "youtube.com/embed/ynxneIXKpCY" /tmp/homepage.html | head -1
grep -oE "class=\"relative h-\[600px\] w-\[377px\]" /tmp/homepage.html | head -1
grep -ic "error\|failed to compile\|unhandled" /tmp/homepage.html

# Revert the seeded section.
curl -s -X PATCH "http://localhost:3000/api/v1/admin/homepage-sections/6" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"config":{"videos":[{"source":"YOUTUBE","url":"https://www.youtube.com/shorts/ynxneIXKpCY"}]}}'
```

Expected: `status: 200`; the YouTube embed src and the `377px` card class both appear in the rendered HTML (the grid card itself is server-rendered, not click-gated); the error-string grep returns `0`.

**Explicitly not verifiable here**: the modal's actual open/close, prev/next, mute toggle, and product panel content only exist in the DOM after a client-side click — there is no browser available in this environment to drive that click and inspect the result. This is a known gap, not a claim of "tested and working."

- [ ] **Step 8: Commit**

```bash
cd "H:\Amder Project\backend"
git add apps/web/src/lib/product-card-mapper.ts apps/web/src/components/PromoVideoSectionClient.tsx apps/web/src/app/\[locale\]/page.tsx apps/web/src/lib/api/schema.d.ts apps/admin/src/lib/api/schema.d.ts
git commit -m "$(cat <<'EOF'
Wire promo video product data through to the homepage

PromoVideoSectionClient mirrors ProductCarouselSectionClient's
existing client-boundary pattern to give the Server Component
homepage a working Add to Cart handler for the new modal.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Full end-to-end verification and cleanup check

**Files:** none (verification only)

- [ ] **Step 1: Full monorepo typecheck**

```bash
cd "H:\Amder Project\backend"
npx tsc --noEmit -p packages/db/tsconfig.json
npx tsc --noEmit -p apps/backend/tsconfig.json
npx tsc --noEmit -p packages/ui/tsconfig.json
npx tsc --noEmit -p apps/admin/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: no output from any of the five commands.

- [ ] **Step 2: Confirm the seeded `PROMO_VIDEO` section (id 6) is back to its exact original state**

```bash
cd "H:\Amder Project\backend"
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/admin/auth/login -H "Content-Type: application/json" -d '{"email":"admin@amadere.com","password":"ChangeMe123!"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.accessToken))")
curl -s "http://localhost:3000/api/v1/admin/homepage-sections/6" -H "Authorization: Bearer $TOKEN"
```

Expected: `config` is exactly `{"videos":[{"source":"YOUTUBE","url":"https://www.youtube.com/shorts/ynxneIXKpCY"}]}` — no leftover `productId`, matching what Step 7 of Task 1 first captured.

- [ ] **Step 3: One more full end-to-end resolution check, this time with two videos — one linked, one not**

```bash
cd "H:\Amder Project\backend"
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/admin/auth/login -H "Content-Type: application/json" -d '{"email":"admin@amadere.com","password":"ChangeMe123!"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.accessToken))")
PRODUCT_ID=$(curl -s "http://localhost:3000/api/v1/products?pageSize=1" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.items[0].id))")

curl -s -X PATCH "http://localhost:3000/api/v1/admin/homepage-sections/6" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"config\":{\"videos\":[{\"source\":\"YOUTUBE\",\"url\":\"https://www.youtube.com/shorts/ynxneIXKpCY\",\"productId\":$PRODUCT_ID},{\"source\":\"GIF\",\"url\":\"https://example.com/placeholder.gif\"}]}}"

curl -s "http://localhost:3000/api/v1/homepage-sections?locale=EN" | node -e "
let d='';process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  const promo = JSON.parse(d).data.find(s => s.id === 6);
  const results = promo.promoVideoProducts;
  console.log('length matches config.videos:', results.length === 2);
  console.log('index 0 resolved:', results[0] !== null && results[0].id === $PRODUCT_ID);
  console.log('index 1 is null (unlinked):', results[1] === null);
});
"

# Final revert.
curl -s -X PATCH "http://localhost:3000/api/v1/admin/homepage-sections/6" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"config":{"videos":[{"source":"YOUTUBE","url":"https://www.youtube.com/shorts/ynxneIXKpCY"}]}}'
curl -s "http://localhost:3000/api/v1/admin/homepage-sections/6" -H "Authorization: Bearer $TOKEN"
```

Expected: all three `console.log` lines print `true`; the final GET shows the section back to its single-video, no-`productId` original state.

- [ ] **Step 4: Report the disclosed gap to the user**

No code change — just make sure whoever reads this plan's completion summary states plainly: autoplay-on-scroll, the modal's open/close/prev/next/mute-toggle, and the product panel's live rendering were never visually driven or screenshotted in this environment (no Chromium installed). Everything that curl/SSR/typecheck can confirm has been confirmed; the click-triggered interactive surface has not been.
