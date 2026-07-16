# Announcement bar, banner-carousel sizing fix, mobile hamburger nav

## Context

Reference: two screenshots of the target storefront header/hero layout (desktop and
mobile). Three independent pieces, bundled into one pass because they're all part of
the same header/hero redesign pass and touch overlapping files (`SiteHeader.tsx`,
`packages/ui`'s banner components):

1. A green **announcement bar** above the header — no such concept exists anywhere in
   this codebase today (confirmed: `grep -rln "announcement" packages/db apps/backend
   apps/admin apps/web` returns nothing).
2. **Hero Banner / Ad Banner sizing**. Earlier this session, both were changed from a
   fixed aspect-ratio box (with a blurred-fill background for off-ratio images) to
   fully adaptive sizing (`w-full h-auto`, no fixed box) per an explicit request. That
   surfaced a real problem the user now wants fixed: when a multi-slide carousel's
   slides have different real aspect ratios, the carousel's height jumps as it
   transitions between them.
3. **Mobile header**: collapse all nav links and all icons except cart into a hamburger
   menu, matching the second reference screenshot.

Decisions locked in during brainstorming (not re-litigated here):

- Announcements support an optional link (text-only is also valid — link is optional
  per message, not mandatory).
- No dismiss button — the bar always shows while any active announcement exists.
- Mismatched-size carousel slides get cropped to fill (`object-cover`), never
  distorted/stretched (`object-fit: fill`).
- The Ad Banner carousel gets the identical first-slide-locks-ratio fix as Hero Banner,
  for the same reason (both are multi-slide carousels with the same jumpy-height risk).
- Mobile hamburger opens a **left-side slide-in drawer** (mirrors the existing cart
  drawer's Radix Dialog pattern exactly, mirrored to the left so the two drawers don't
  visually collide — cart already slides in from the right).
- Rotation interval for the announcement bar is a fixed 4000ms (matches the existing
  default already used by `AdBannerSection`) — not admin-configurable. Nothing else in
  this codebase makes autoplay/rotation speed admin-configurable either
  (`AdBannerSection`'s `autoplayMs` and `HeroCarousel`'s `autoplayMs` are both component
  defaults, not admin-authored fields), so this doesn't introduce a new pattern.

## Part 1 — Announcement bar

### Data model (new Prisma models, real migration needed)

Mirrors `MenuItem`/`MenuItemTranslation` (`packages/db/prisma/schema.prisma`) field-for-
field, since that's this codebase's established shape for "admin-managed, ordered list
of small content items with per-locale text":

```prisma
model Announcement {
  id        Int      @id @default(autoincrement())
  linkUrl   String?  @map("link_url")
  sortOrder Int      @default(0) @map("sort_order")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  translations AnnouncementTranslation[]

  @@map("announcements")
}

model AnnouncementTranslation {
  id             Int    @id @default(autoincrement())
  announcementId Int    @map("announcement_id")
  locale         Locale
  message        String

  announcement Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)

  @@unique([announcementId, locale])
  @@map("announcement_translations")
}
```

### Backend

New module `apps/backend/src/modules/announcements/`, structured identically to
`modules/menus/`:

- `announcements.service.ts`: `adminList()`, `adminGet(id)`, `create(dto)`,
  `update(id, dto)`, `delete(id)`, `publicList(locale)` (active only, `sortOrder asc`,
  no cycle/parent logic needed — announcements are a flat list, unlike `MenuItem`'s
  2-level tree).
- `announcements.mapper.ts`: `AdminAnnouncementDto` (`id, linkUrl, sortOrder, isActive,
  translations`), `PublicAnnouncementDto` (`id, message, linkUrl`) — same
  locale-resolution pattern as `toPublicMenuItemDto`.
- `dto/create-announcement.dto.ts` / `update-announcement.dto.ts` /
  `announcement-translation.dto.ts`: same shape as the menu-item DTOs
  (`linkUrl?`, `sortOrder?`, `isActive?`, `translations: [{locale, message}]`).
- `admin-announcements.controller.ts` (`/admin/announcements`, permission-guarded,
  `announcement.view|create|update|delete`), `announcements.controller.ts` (public
  `GET /announcements?locale=`).
- `announcements.module.ts`: registers both controllers + the service.
- Register `AnnouncementsModule` in the root app module (wherever `MenusModule` is
  currently registered).
- New permission keys (`announcement.view/create/update/delete`) need seeding into
  whatever table/seed script currently seeds `menu_item.*` permissions — the plan will
  locate that exact file.

### Admin UI

New `apps/admin/src/app/(shell)/announcements/` — `page.tsx` (list), `new/page.tsx`,
`[id]/page.tsx` — structurally identical to the existing `menu-items` admin pages
(`apps/admin/src/app/(shell)/menu-items/`): message (EN/BN), optional link URL, sort
order, active toggle. Add an `announcements` entry to `apps/admin/src/lib/nav-config.tsx`
(a `campaign`-style Material Symbol icon, e.g. `campaign`).

### Storefront

- New `apps/admin`-mirroring hook `apps/web/src/hooks/useAnnouncements.ts`:
  `useAnnouncements(locale)` — `GET /api/v1/announcements?locale=`.
- New component `packages/ui/src/components/AnnouncementBar.tsx`: green bar
  (`bg-green` — the site's existing brand green token, not a new color), full width,
  centered text, auto-advances every 4000ms when there are 2+ active announcements
  (same `setInterval` pattern as `AdBannerSection`), renders nothing when the list is
  empty (no announcements configured = no bar, no empty placeholder).
- Wired into `apps/web/src/components/SiteHeader.tsx` (already the client boundary
  holding `useNavCollections`, `useCartQuery`, etc.) — rendered above the existing
  `<Header>` component. `SiteHeader` currently returns `<><Header/><Nav/></>`; becomes
  `<><AnnouncementBar/><Header/><Nav/></>`.

## Part 2 — Banner carousel sizing (Hero Banner + Ad Banner)

Both `HeroCarousel.tsx` and `AdBannerSection.tsx` get the same change:

- New local state: `lockedRatio: number | null` (starts `null`).
- The *first* valid slide's `<img>` gets an `onLoad` handler that reads
  `naturalWidth`/`naturalHeight` and calls `setLockedRatio(naturalWidth / naturalHeight)`
  — but only once (a ref guards against re-locking if the first slide's image element
  re-mounts, e.g. on a fast tab-back-and-forth).
- The carousel's outer box uses `style={{ aspectRatio: lockedRatio ?? DEFAULT_RATIO }}`
  instead of a Tailwind `aspect-[]` class (since the value is now dynamic, not a fixed
  design-time constant) — `DEFAULT_RATIO` is a reasonable placeholder (Hero: the old
  1882/500 ≈ 3.764; Ad Banner: the old 1686/759 ≈ 2.221) used only until the first
  image reports its real size, so there's no empty/collapsed box during that brief
  window and no visible jump once the real ratio is measured (assuming a reasonably
  close guess — an exact match isn't required, it's just the starting placeholder).
- Every slide (all of them, including the first) renders inside that box via
  `object-cover` — crops to fill, keeps its own proportions, no distortion. This
  replaces the current plain `w-full h-auto` treatment.
- No more per-slide independent height — the whole carousel now has one fixed height
  for the current browser width (derived from whatever `lockedRatio` currently is),
  matching how the *old* fixed-aspect-ratio version behaved, except the ratio itself
  now comes from the admin's actual first-uploaded image instead of a hardcoded
  design constant, and mismatched slides crop instead of letterboxing with a blurred
  fill.
- Banner Strip is **not** touched — it's a single image, not a multi-slide carousel, so
  it has no "different slides, different sizes" problem to begin with. Its adaptive
  sizing from earlier stays as-is.

## Part 3 — Mobile header restructuring

### Hamburger menu (new)

- New component `packages/ui/src/components/MobileNavDrawer.tsx`, built on the same
  `@radix-ui/react-dialog` primitives `CartDrawer.tsx` already uses, mirrored to the
  left (`Dialog.Content` gets `left-0` instead of `right-0`, matching everything else
  about `CartDrawer`'s structure: overlay, slide-in panel, header with title + close
  button).
- New Zustand store `packages/ui/src/stores/mobileNavDrawerStore.ts`, mirroring
  `cartDrawerStore.ts` (`isOpen`, `open()`, `close()`) — kept as its own store (not
  reusing `cartDrawerStore`) since the two drawers are opened independently and nothing
  about their open/closed state should be coupled.
- Drawer contents: the nav links currently rendered by `Nav.tsx` (All Products + the
  dynamic collection links), plus account link, track order link, and the locale-switch
  button — everything `Header.tsx`'s `#site-header-icons` zone currently renders
  *except* the cart button, which stays in the header directly. Reuses the existing
  `NavItem`/link data already computed in `SiteHeader.tsx` — no new data-fetching, this
  is purely a rendering/layout change.

### Header changes (`packages/ui/src/components/Header.tsx`)

- New hamburger button, visible only below the `sm` breakpoint (`sm:hidden`), placed at
  the start of `#site-header-icons` — actually before the logo, matching the reference
  screenshot's `☰ আমাদের` ordering (hamburger left of the logo, not in the icons zone).
  Opens `MobileNavDrawer` via the new store.
- `#site-header-icons` on mobile keeps only the cart button; account/track-order/locale
  switch move into the drawer (rendered there instead, guarded by the same `sm:hidden`
  / `hidden sm:flex` split already used elsewhere in this component for
  responsive-only elements).
- `Nav.tsx`'s link row (`#site-nav-row`) becomes desktop-only (`hidden sm:block` on the
  `<nav>` itself) — its content now lives inside the drawer on mobile instead of a
  separate always-visible row.
- Desktop (`sm:` and up): unchanged from the current 3-column grid layout
  (`#site-header-logo` / `#site-header-search` / `#site-header-icons`) built earlier
  this session — no hamburger button shown, `Nav.tsx`'s row stays visible as today.
  A pass to fine-tune spacing/search-pill styling against the reference screenshot
  happens during implementation, not as a structural change.

## Explicitly out of scope

- Admin-configurable rotation speed for the announcement bar (fixed 4000ms, matches
  existing site convention).
- A dismiss/close control on the announcement bar.
- Changing Banner Strip's sizing (single image, not a multi-slide carousel — no jumpy-
  height problem exists there).
- Any change to the cart drawer itself, beyond it now sharing screen space with a
  second (independent) drawer on mobile.

## Verification approach

- `pnpm -r exec tsc --noEmit` (or per-package `tsc --noEmit -p <path>`) across
  `packages/db`, `apps/backend`, `packages/ui`, `apps/admin`, `apps/web` after each
  layer lands, same discipline as every prior feature this session.
- Live: create 2+ test announcements via the new admin API, confirm the public
  `/announcements` endpoint returns them in order, confirm the storefront homepage's
  rendered HTML includes the bar's markup, then deactivate/delete the test rows
  afterward (this codebase's established test-data-cleanup discipline).
- Live: for the banner-carousel fix, temporarily set two Hero Banner slides to
  deliberately different aspect-ratio source images (or confirm via reading the
  rendered `style="aspect-ratio: ..."` value that it matches the first slide's real
  dimensions) — SSR alone can't fully prove the client-side `onLoad` measurement fires
  correctly since that's a browser-runtime behavior; disclose this the same way the
  promo-video modal's interactive gaps were disclosed rather than claimed as tested.
- No browser available in this environment (Chromium not installed) — the hamburger
  drawer's open/close animation, the announcement bar's auto-slide timing, and the
  banner's real crop/fit behavior can't be visually verified this session. Flagged
  explicitly per this session's established practice, not silently skipped.
