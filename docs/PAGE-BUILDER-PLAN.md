# Page Builder (Puck) — Implementation Instructions

> **Audience:** Claude Code working inside this monorepo.
> **Status:** Spec / plan. Nothing here is built yet.
> **Read first:** `README.md`, `PERF-BRIEF.md`, `apps/web/src/app/[locale]/[...path]/page.tsx`,
> `apps/web/src/components/CheckoutForm.tsx`, `apps/backend/src/modules/homepage-sections/`.

---

## 1. What we are building

A **Page Builder** section in the admin panel (`apps/admin`) that lets the site owner
compose storefront pages by dragging pre-built blocks onto a canvas, editing their
props in a side panel, and publishing.

Two kinds of page come out of it:

1. **Content pages** — About, FAQ, Terms, landing pages, campaign pages. Served at
   `/{slug}` through the existing catch-all route.
2. **Checkout pages** — a page that contains the real checkout fields and can
   actually place an order. The owner must be able to re-arrange and re-skin the
   checkout without a developer, and must be able to build *additional* checkout
   variants (e.g. a single-product landing page with the order form embedded at the
   bottom).

The library is **Puck** (`@measured/puck`). It stores a JSON document, renders through
our own React components, and ships its own editor UI.

---

## 2. Non-negotiable rules

These exist because breaking them turns checkout into an outage. Do not "improve" past them.

1. **The builder never owns business logic.** Validation rules, the checkout DTO, cart
   maths, COD OTP, fraud preflight, analytics events, payment provider handling — all
   stay in TypeScript. Puck controls **layout, order, copy, and appearance only.**
2. **Blocks are our own React components.** No raw-HTML-blob editing, no GrapesJS-style
   inline CSS, no arbitrary `<script>`. Everything renders through `@amader/ui` and the
   existing Tailwind v4 tokens so builder pages cannot drift from the design system.
3. **`/checkout` must never 500 or render an unsubmittable form.** The route falls back
   to the hardcoded default layout if no published checkout layout exists, if the stored
   document fails schema validation, or if a required block is missing.
4. **A checkout layout is validated server-side at publish time.** A layout missing any
   required block is rejected with a clear error — it is never published and then
   discovered broken by a customer.
5. **No new client JS on content pages that do not need it.** Content pages render on the
   server via Puck's RSC renderer and keep the ISR behaviour documented in `PERF-BRIEF.md`.
   Only the checkout blocks are client components.
6. **Reserved slugs are refused.** A builder page can never claim a route the app owns.
7. **Every schema change ships as a Prisma migration**, never `db push`.
8. **Bilingual (EN/BN) is a first-class requirement.** Structure is shared; text is per-locale.
   See §5.2.

---

## 3. Pre-flight checks (do these before writing code)

Run these and report results before Phase 1.

1. `pnpm --filter @amader/admin add @measured/puck` — confirm it resolves against
   **React 19.2.4 / Next 16.2.10**. If peer deps complain, report the exact error and stop;
   do not force-install with `--force` or an override without asking.
2. Read the installed version's own docs/types before writing config. Puck's API has moved:
   - Nested content used `<DropZone zone="...">`; newer versions prefer **slot fields**
     (`{ type: "slot" }`). **Use whichever the installed version documents as current.**
   - Check whether `@measured/puck/rsc` exists in the installed build — that is the
     server-component renderer we want for content pages. If it does not exist, say so and
     propose the fallback (client `<Render>` behind a `dynamic()` import) before proceeding.
3. Confirm the admin app can load Puck's stylesheet (`@measured/puck/puck.css`) without
   fighting Tailwind v4's preflight. If there is a conflict, scope Puck's CSS to the
   editor route only.

---

## 4. Architecture

```
packages/page-builder/            NEW shared workspace package (@amader/page-builder)
  src/
    config.ts                     Puck config assembled from the block registry
    blocks/                       Block definitions: fields + defaultProps + render
      content/                    Server-safe content blocks
      checkout/                   Client checkout blocks (thin, no logic)
    types.ts                      PageDocument, BlockName, PageKind
    validate.ts                   Zod validation of a stored Puck document
    required-blocks.ts            Which blocks a CHECKOUT page must contain

apps/admin/src/app/(shell)/pages/[id]/builder/page.tsx    Editor route (client)
apps/backend/src/modules/pages/                            Extended, not replaced
apps/web/src/app/[locale]/[...path]/page.tsx               Renders layout when present
apps/web/src/app/[locale]/checkout/page.tsx                Renders active checkout layout
```

**Why a shared package:** the admin editor and the storefront renderer must use the
*same* config object, or a page will preview one way and render another. `apps/admin`
and `apps/web` both depend on `@amader/page-builder`. Follow the existing conventions in
`packages/ui` for build setup, `exports`, and `workspace:*` wiring.

**Import boundary:** blocks import presentational components from `@amader/ui` only.
A block must never import from `apps/web/src/hooks/*` directly — checkout blocks read
their data from a context the storefront provides (§7.2).

---

## 5. Data model

### 5.1 Prisma changes

`packages/db/prisma/schema.prisma`:

```prisma
enum PageKind {
  CONTENT
  CHECKOUT
}

model Page {
  // ... existing fields unchanged ...
  kind        PageKind @default(CONTENT)
  // Exactly one CHECKOUT page may be active at a time — enforced in the service,
  // and this is the flag the /checkout route resolves by.
  isDefaultCheckout Boolean @default(false) @map("is_default_checkout")

  revisions PageRevision[]
}

model PageTranslation {
  // ... existing fields unchanged ...
  content String   // KEEP. Legacy HTML. Still rendered when `layout` is null.
  layout  Json?    // NEW. Puck document for this locale.
}

// Publish history + rollback. A broken checkout must be revertible in one click.
model PageRevision {
  id        Int      @id @default(autoincrement())
  pageId    Int      @map("page_id")
  locale    Locale
  layout    Json
  label     String?
  createdAt DateTime @default(now()) @map("created_at")
  createdBy Int?     @map("created_by")

  page Page @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@index([pageId, locale, createdAt])
  @@map("page_revisions")
}
```

**Rendering precedence, everywhere:** `layout` if present and valid → else `content` HTML
(through the existing `sanitizeHtml`) → else 404. This is what makes the migration
zero-risk: every existing page keeps working untouched.

### 5.2 Bilingual strategy

One Puck document **per locale** (`PageTranslation.layout`), because `PageTranslation`
already has the per-locale row and the admin already thinks in that shape.

To stop the owner having to rebuild the design twice, the admin editor gets a
**"Copy layout from EN → BN"** action that clones the document and leaves the text
fields for translation. Add this in Phase 5; do not attempt structural field-level
locale merging — it is complexity we do not need.

### 5.3 Migration

Write `packages/db/prisma/migrations/<timestamp>_page_builder/migration.sql` by hand or
via `prisma migrate dev`. **No data backfill** — every existing page keeps `layout = null`
and continues rendering its HTML. Legacy pages become builder pages one at a time, on
demand, via the "Convert to builder" action (§8.4).

---

## 6. Backend (`apps/backend/src/modules/pages/`)

Extend the existing module; follow its current controller/service/mapper/dto layout and
the RBAC guards used by `admin-pages.controller.ts`.

### 6.1 Admin endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `PATCH` | `/api/v1/admin/pages/:id/layout` | Save draft layout for one locale |
| `POST` | `/api/v1/admin/pages/:id/publish` | Validate + publish + snapshot revision |
| `GET` | `/api/v1/admin/pages/:id/revisions` | List revisions |
| `POST` | `/api/v1/admin/pages/:id/revisions/:revId/restore` | Roll back |
| `POST` | `/api/v1/admin/pages/:id/set-default-checkout` | Make this the live checkout |

### 6.2 Publish validation (this is the safety net)

`pages.service.ts` on publish:

1. Parse the document with the zod validator from `@amader/page-builder/validate`.
   Reject unknown block names, missing required props, wrong prop types.
2. Reject a slug in the reserved list:
   `checkout, cart, account, orders, order, login, register, logout, search, track,
   products, product, categories, category, brands, brand, collections, collection,
   blog, tags, tag, faq, api, admin, sitemap.xml, robots.txt`
   (case-insensitive, and reject any slug beginning `api/` or `_next`).
3. If `kind = CHECKOUT`, assert every block in `REQUIRED_CHECKOUT_BLOCKS` is present
   exactly once. Return `422` naming the missing block(s) — e.g.
   `"A checkout page must contain: Payment Method, Place Order Button"`.
4. If `isDefaultCheckout` is being set, clear the flag on all other pages in the same
   transaction. Never allow zero active checkout layouts *and* a deleted fallback — the
   code fallback in §9.2 covers the zero case.
5. Snapshot the previous published layout into `PageRevision` **before** overwriting.
6. Fire the revalidation call to the storefront (`/api/revalidate`) for the affected
   paths — `/{locale}/{slug}`, and `/{locale}/checkout` for a checkout page. Note the
   caveat in `apps/web/src/app/api/revalidate/route.ts`: the backend has no event→webhook
   dispatcher yet, so **call the route directly from the publish handler** rather than
   relying on an event.

### 6.3 Public endpoints

- `GET /api/v1/pages/:slug` — extend `PublicPageDetailDto` with `layout: unknown | null`.
  Keep `content` in the response; the storefront picks.
- `GET /api/v1/checkout-layout?locale=` — returns the active checkout page's layout, or
  `null`. Cacheable; must be fast, it is on the checkout critical path.
- Draft preview: `GET /api/v1/admin/pages/:id/preview-token` issuing a short-lived signed
  token the storefront exchanges in Next.js draft mode (§9.3). Never expose an unpublished
  layout on a public, cacheable URL.

---

## 7. Blocks

### 7.1 Content blocks (Phase 2) — server components

Build these first; they are low-risk and prove the whole pipeline end to end.

| Block | Notes |
| --- | --- |
| `Section` | Wrapper: max-width, padding, background token, optional slot for children |
| `Columns` | 2/3/4 responsive columns, each a slot |
| `Heading` | level (h1–h4), text, align |
| `RichText` | Sanitized HTML — **the legacy migration target**, see §8.4 |
| `Image` | Uses the existing `MediaPicker` via a Puck `custom` field |
| `Button` | Label, href, variant — routes through `AppLink` for locale handling |
| `Spacer` | Height token |
| `Faq` | Wraps `FaqAccordion` |
| `ProductGrid` | Pick a collection; renders through the same mapper as the storefront |
| `ProductCarousel` | Wraps `ProductCarouselSectionClient` |
| `PromoVideo` | Wraps `PromoVideoSectionClient` |
| `NewsletterBanner` | Wraps the existing component |
| `HtmlEmbed` | Sanitized. Admin-only, gated behind a role check. |

Rules for every block:
- `defaultProps` for every field, so a freshly dragged block renders something sane.
- No hardcoded hex colours — use the existing Tailwind tokens (`text-ink`, `border-line`,
  `bg-beige`, `text-green`, `rounded-brand`, …) as the current components do.
- Anything that fetches must fetch on the server or reuse the existing client hook —
  do not invent a second data path for the same resource.

### 7.2 Checkout blocks (Phase 4) — the hard part

**`apps/web/src/components/CheckoutForm.tsx` is currently 1150 lines that mix state,
side effects, and layout. It must be split before any of this works.**

#### Step 1 — extract the brain

Create `apps/web/src/components/checkout/CheckoutProvider.tsx` (client). Move into it,
unchanged in behaviour:

- `useForm` + `makeCheckoutFormSchema(codOtpEnabled, requireEmail, digitalOnly)` + `FormProvider`
- `useCartQuery`, `useSiteInfo`, `useMe`, `useAddresses`, `useCheckoutPrefill`,
  `usePaymentMethodConfigs`, `useGiftVoucherCheck`, coupon mutations, `usePlaceOrder`
- the `digitalOnly` / `isFreeOrder` / `hasItems` derivations
- all GA4 firing refs (`firedBeginCheckout`, `firedPaymentType`, `firedShippingInfo`)
- `onSubmit`, `onInvalid`, `submitForm`, `handleCardAddToCart`, `handleAddMultipleCards`
- COD OTP popup state, fraud preflight state, block popup state
- `placedOrder` → renders `OrderConfirmation` and short-circuits, exactly as today

Expose everything through a `CheckoutContext`. Add a `useCheckoutContext()` hook that
**throws a clear error** if a checkout block is rendered outside the provider — that error
is how a mis-built page fails loudly in the editor instead of silently at 2am.

The provider renders `<FormProvider><form onSubmit={submitForm}>{children}</form></FormProvider>`
plus the three popups (`CodOtpPopup`, `BlockPopup` ×2). Blocks go in `{children}`.

#### Step 2 — extract presentational blocks

Each is a small client component reading `useCheckoutContext()` and `useFormContext()`.
**Zero business logic. Zero fetching.** Preserve current markup and Tailwind classes
verbatim on first extraction — this step must be a pure refactor with no visual diff.

| Block | Wraps today's | Required? |
| --- | --- | --- |
| `CheckoutRoot` | the `<form>` + grid | ✅ (implicit root) |
| `CheckoutOrderReview` | "Order Review" card + `CartLineItem` list | — |
| `CheckoutShippingAddress` | `AddressFields` + `SavedAddressPicker` + `ShippingRatesNotice` | ✅ when physical |
| `CheckoutContactDetails` | the digital-only "Your details" card | ✅ when digital |
| `CheckoutBillingAddress` | Billing card + "same as shipping" | — |
| `CheckoutPaymentMethod` | `PaymentMethodSelector` + manual-payment instructions | ✅ |
| `CheckoutOrderSummary` | Subtotal / shipping / discount / grand total | ✅ |
| `CheckoutCoupon` | coupon input + apply/remove | — |
| `CheckoutGiftVoucher` | voucher input + live check | — |
| `CheckoutCustomerNote` | note textarea | — |
| `CheckoutTerms` | `renderTermsAgreement` | ✅ |
| `CheckoutPlaceOrder` | submit button + error message | ✅ |
| `CheckoutUpsellBar` | `UpsellProgressBar` | — |
| `CheckoutFbt` | `CheckoutFbtSection` | — |
| `CheckoutCrossSell` | cross-sell carousel | — |

`REQUIRED_CHECKOUT_BLOCKS` = the ✅ rows. The physical/digital pair is conditional:
require **at least one of** `CheckoutShippingAddress` / `CheckoutContactDetails`, and warn
in the editor (not an error) if only one is present, since the same layout serves both
cart types and the provider decides which renders.

#### Step 3 — prove the refactor before touching Puck

Rebuild the *current* `/checkout` page as `CheckoutProvider` + hardcoded blocks in the
current order. **`/checkout` must be pixel-identical and functionally identical at this
point.** Place a real COD order on a physical cart and a real order on a digital-only cart
before moving on. Do not proceed to Step 4 until both pass.

#### Step 4 — expose blocks to Puck

Register them in the config under a `checkout` category. Constrain placement: checkout
blocks are only droppable inside `CheckoutRoot`'s slots, content blocks are droppable
anywhere. Use the installed version's mechanism (`allow`/`disallow` on the zone, or slot
field constraints).

Editable props per checkout block are **presentation only**: heading text, card
title, whether the section is collapsible, column span, show/hide optional sub-elements,
CTA label. Never: field names, required-ness, validation messages tied to schema paths,
payment provider list.

#### Step 5 — seed the default layout

Write the current checkout arrangement as a JSON seed in
`packages/db/scripts/data/checkout_layout_seed.json`, loaded by a seed script alongside the
existing `pages_seed_data.json`. This is what the owner starts from when they click
"Customise checkout", and what the fallback in §9.2 mirrors.

---

## 8. Admin UI (`apps/admin`)

### 8.1 Navigation

The existing `(shell)/pages` list stays. Add a **Page Builder** entry. Each row gets a
`Builder` action alongside the current `Edit`.

### 8.2 The editor route

`apps/admin/src/app/(shell)/pages/[id]/builder/page.tsx` — client component, full-bleed
(escape the shell's padded container; it needs the whole viewport).

```tsx
<Puck
  config={config}
  data={data}
  iframe={{ enabled: true }}
  viewports={[{ width: 390, label: "Mobile" }, { width: 768, label: "Tablet" }, { width: 1180, label: "Desktop" }]}
  onPublish={handlePublish}
  overrides={{ /* header actions: Save draft, Preview, Publish, Revisions */ }}
/>
```

Requirements:
- **Autosave the draft** (debounced ~2s) to `PATCH /layout`. Reuse the pattern behind the
  existing `DraftRestoreBanner.tsx` so the owner never loses work on a tab close.
- **Locale switcher** in the header — EN / BN, loading that locale's document, with the
  "Copy from EN" action.
- **Publish** shows the backend's validation errors inline, naming the missing block.
- **Revisions drawer** listing snapshots with a one-click restore + confirm.
- **Media**: wire the existing `MediaPicker.tsx` into a Puck `custom` field so image props
  use the R2 library, not a URL paste box.
- Puck's iframe must load the **storefront's** Tailwind build, not the admin's, or every
  preview lies. Simplest correct approach: serve the preview iframe from a storefront
  route in draft mode rather than rendering blocks inside the admin's own CSS scope. If
  that proves awkward with Puck's iframe model, the alternative is publishing the
  storefront's compiled CSS as a static asset the editor iframe links. **Pick one, write
  down which, and be consistent.**

### 8.3 Checkout customisation entry point

Under `(shell)/settings` (or a `Checkout` tab): a **"Customise checkout"** screen listing
checkout-kind pages, showing which is live, with `Set as live checkout`, `Duplicate`,
`Builder`, and a prominent **`Restore default layout`** button that clears
`isDefaultCheckout` and falls the route back to code. That button is the owner's undo when
they break something at midnight — make it impossible to miss.

### 8.4 Legacy conversion

On a page with `layout = null`, a **"Convert to builder"** action creates a one-block
document: `{ content: [{ type: "RichText", props: { html: <existing content> } }] }`.
Lossless, reversible (the original `content` column is untouched), and the owner can then
split it apart block by block.

---

## 9. Storefront (`apps/web`)

### 9.1 Content pages

In `apps/web/src/app/[locale]/[...path]/page.tsx`, after `getStaticPage`:

```tsx
if (page.layout) return <Render config={config} data={page.layout} />;   // from @measured/puck/rsc
return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }} />;  // unchanged
```

Keep `export const revalidate = 3600` and the empty `generateStaticParams()` exactly as
they are — the comment in that file explains why removing either silently kills ISR.
**Do not touch the error-handling in `getStaticPage`**; the re-throw is deliberate and
documented (it is the fix for the intermittent-404 bug on live footer links).

### 9.2 Checkout

`apps/web/src/app/[locale]/checkout/page.tsx`:

```tsx
const layout = await getActiveCheckoutLayout(locale);   // null-safe, never throws
return (
  <main className="flex-1" data-checkout>
    <CheckoutProvider>
      {layout ? <Render config={config} data={layout} /> : <DefaultCheckoutLayout />}
    </CheckoutProvider>
  </main>
);
```

- `DefaultCheckoutLayout` is the hardcoded arrangement from §7.2 Step 3. **It stays in the
  codebase forever.** It is the fallback for: no published layout, fetch failure, and
  validation failure.
- Wrap the `<Render>` in an error boundary that falls back to `DefaultCheckoutLayout` and
  logs loudly. A checkout that renders the old design is a bad day; a checkout that renders
  nothing is lost revenue.
- Keep `robots: { index: false }` and the `data-checkout` attribute — `globals.css` keys the
  mobile footer rule off it.
- Checkout must **not** be ISR-cached. Fetch the layout with `cache: "force-cache"` +
  tag-based revalidation on publish, but keep the page itself dynamic as it is today.

### 9.3 Draft preview

Add `apps/web/src/app/api/preview/route.ts`: validates the signed token from §6.3, enables
Next.js draft mode, redirects to the target path. In draft mode the page fetches the
*draft* layout instead of the published one. This is what the admin's Preview button and
the editor iframe point at.

---

## 10. Phasing and acceptance criteria

Ship each phase to `main` before starting the next. Each phase must leave the site working.

| Phase | Deliverable | Done when |
| --- | --- | --- |
| **0** | Pre-flight (§3) | Peer deps confirmed, Puck version + slot/DropZone decision written into this doc |
| **1** | Schema + backend + `@amader/page-builder` skeleton | Migration applied; `layout` round-trips through the API; existing pages render exactly as before |
| **2** | Content blocks + storefront rendering | A hand-crafted JSON document renders correctly at `/{slug}`; ISR still verified (check the `x-nextjs-cache` header) |
| **3** | Admin editor for content pages | Owner builds and publishes an About page end to end, EN + BN, with images from the media library |
| **4a** | **`CheckoutForm` refactor only** | `/checkout` pixel-identical; real COD order placed on a physical cart; real order on a digital-only cart; COD OTP path exercised |
| **4b** | Checkout blocks in Puck + validation + fallback | Owner re-orders the checkout in the builder, publishes, and places a real order on the rebuilt layout; deleting the layout falls back cleanly |
| **5** | Revisions, locale copy, "Restore default", legacy conversion | Rollback works; a legacy HTML page converts and re-publishes unchanged |

**Phase 4a is the risky one.** Do it as a pure refactor in its own PR with no Puck code in
the diff. If the diff contains both "moved code" and "new behaviour", split it.

---

## 11. Things not to do

- Do not delete `PageTranslation.content` or the `sanitizeHtml` path. Ever.
- Do not let the builder edit zod schemas, DTO shapes, or the payment provider list.
- Do not add `localStorage`-backed layout state as a source of truth — the DB is the truth.
- Do not put the Puck editor in the storefront app. It belongs to the admin.
- Do not make `/checkout` depend on a successful network call to render.
- Do not "temporarily" bypass publish validation to unblock a demo.
- Do not introduce a second toast/dialog/button system — use `@amader/admin-ui`.
- Do not regress `PERF-BRIEF.md`'s ISR findings; re-verify after Phase 2.

---

## 12. Open questions for the owner (ask before building the affected part)

1. Should a checkout **variant** be reachable at its own URL (e.g. `/lp/winter-offer`
   with the order form embedded), or is there only ever one checkout design at
   `/checkout`? This changes whether `isDefaultCheckout` is enough or we need
   per-page checkout routing. *Assume one-live-checkout until told otherwise.*
2. Who may use the builder — any admin, or a specific role? Wire it to the existing
   RBAC module either way; default to the most restrictive role that already manages pages.
3. Do BN and EN checkout layouts need to differ structurally, or is BN a translation of
   the EN layout? *Assume translation.*

---

## 13. Phase 0 results (completed 2026-08-26)

### 13.1 The package moved

**`@measured/puck` is deprecated.** npm returns:

> Puck has moved. Please use `@puckeditor/core` instead.

Installed **`@puckeditor/core@0.23.0`** in `apps/admin` instead of the
`@measured/puck` named throughout this document. Every `@measured/puck` import
path in §3, §7, §8.2 and §9 should be read as `@puckeditor/core`.

- `peerDependencies: { react: "^18.0.0 || ^19.0.0" }` — satisfied by React 19.2.4.
- `pnpm peers check` reports **no** puck- or react-related issues. The peer
  warnings it does print (`@nestjs/swagger@8.1.1` wanting NestJS ^9/^10 against
  the installed 11.1.27) are pre-existing and unrelated.

### 13.2 RSC renderer: available

`@puckeditor/core/rsc` resolves to `dist/rsc.d.ts`, exporting `Render` plus
`migrate`, `resolveAllData`, `transformProps`, `walkTree`. §9.1's
server-component rendering plan works as written — no `dynamic()` fallback needed.

### 13.3 Slots, not DropZone

**Use `{ type: "slot" }`.** `DropZone` is still exported for backwards
compatibility, but the `migrate()` helper ships a `migrateDynamicZonesForComponent`
option whose whole purpose is converting legacy DropZone "zones" into slots —
which settles which direction the library considers current.

### 13.4 CSS: no Tailwind v4 conflict, but use the no-external build

Puck's stylesheet is fully CSS-module scoped (`._Puck-portal_tzaxg_` etc.). A
scan for unscoped global selectors (`*`, `html`, `body`, `:root`, bare element
tags) found **none**, so it does not fight Tailwind v4's preflight and needs no
route-scoping workaround.

**However:** `@puckeditor/core/puck.css` (`dist/index.css`) begins with

```css
@import "https://rsms.me/inter/inter.css";
```

— an external font fetch on every editor load. `dist/no-external.css` is
byte-identical apart from that line. **Import `@puckeditor/core/no-external.css`.**

### 13.5 Bonus finding

0.23 ships a built-in richtext field (`RichtextField`, tiptap-backed). Evaluate
it for the §7.1 `RichText` block before writing our own.

### 13.6 Owner answers to §12

1. **One live checkout only.** `isDefaultCheckout` is sufficient; no per-page
   checkout routing. Checkout variants exist only as unpublished alternatives
   swapped in by moving the flag.
2. **Access:** content pages use the existing `page.update`. Publishing a
   CHECKOUT layout requires a **new `page.checkout_publish`** permission, added
   to `PERMISSION_CATALOG` and granted to Super Admin only by default.
3. **BN is a translation of EN.** Structure shared, text per-locale; the
   "Copy layout from EN → BN" action in Phase 5 is the expected workflow.

### 13.7 Incident during Phase 0 (resolved)

Installing/removing packages aborted repeatedly against the npm registry and
left `node_modules` corrupt: the junction
`.pnpm/gcp-metadata@8.1.2/node_modules/gaxios` was dangling, so the **backend
would not boot** (`Cannot find module 'gaxios'`). `pnpm install`, even with
`--force`, reported "already up to date" and would not relink. Repaired by
recreating that one junction; it was the only casualty.

Root cause of the install failures was a **stale pnpm metadata cache** — it had
only `@radix-ui/react-id@1.1.2` cached, so a transitive `@1.1.4` requirement
(published a month earlier) resolved to "no matching version". Fixed with
`pnpm cache delete "@radix-ui/*"`. Worth remembering: that error names an
upstream package and reads like an upstream bug, but is local.

---

## 14. Phase 3 decisions (completed 2026-08-26)

### 14.1 Preview fidelity — the §8.2 decision

**Chosen: the admin's own Tailwind build styles the canvas.**

§8.2 offered two options and asked for one to be picked and written down. The
first — serving the preview iframe from a storefront route in draft mode — does
not fit Puck's model: the canvas iframe is a React tree Puck renders itself,
not a URL it navigates to. (A storefront-served iframe is still the right
answer for the *Preview* button in Phase 5's draft-mode work; it is just not
available for the editing canvas.)

So the canvas is styled by the admin build, which already imports
`@amader/ui/tokens.css` and `@source`s `packages/ui/src` for the footer
editor's live preview — the identical problem, already solved this way. Added:

```css
@source "../../../../packages/page-builder/src";
```

to **both** `apps/admin/src/app/globals.css` and `apps/web/src/app/globals.css`.
Puck clones the parent document's stylesheets into its iframe, so the canvas
gets whatever the admin page has, and the blocks use only tokens from
`@amader/ui/tokens.css` — so canvas colours and fonts are the storefront's own.

**The web one is not optional.** Verified with clean builds: without it,
`max-w-[1100px]` (used only by the Section block) is absent from the storefront
CSS entirely, while `max-w-[760px]` survives only because something else in the
app happens to use it. A builder page would render subtly wrong rather than
obviously broken — the worst kind of failure to notice.

### 14.2 Config sharing

`apps/admin/src/lib/page-builder-config.tsx` layers admin-only **field editors**
onto the shared config (the MediaPicker for `Image.url`). It never touches
`render`. That distinction is what preserves §4's guarantee: editor and
storefront run the same render functions, so a page cannot preview one way and
publish another. Only *how the owner picks a value* differs, and the storefront
never sees that.

### 14.3 Autosave

Server-side, debounced 2s to `PATCH /layout` — **not** the localStorage-backed
`useAutosaveDraft` used elsewhere in the admin, because §11 requires the DB to
be the source of truth for a layout.

A debounce alone loses the last edit if the tab closes inside the window, and
`beforeunload` cannot await a fetch, so the editor warns instead of pretending
to have saved. Publish force-flushes the pending debounce first, or the owner
would publish the version before their last edit.
