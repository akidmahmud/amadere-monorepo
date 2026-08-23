# Digital Products — Spec 1: Sold and Delivered

**Date:** 2026-08-22
**Status:** Awaiting owner review
**Scope:** A product that is a PDF can be created in the admin, bought at checkout, and downloaded by the buyer. The storefront product page and preview modal are **Spec 2** and deliberately out of scope here.

## Why this is split in two

Spec 2 (the marketing page, the "আরো পড়ুন" button, the preview modal, the paywall) is the visible half. Spec 1 is the half that makes a purchase real. Built in the other order, you get a product page that can take money for a file nothing can deliver. So Spec 1 ships first and stands alone: an admin can create a digital product, a customer can buy it from the existing product page, and they get the file.

## Current state — what actually exists

`ProductType.DIGITAL` has existed since the beginning and **does nothing**. It is a dropdown option
(`apps/admin/src/components/products/ProductFormFields.tsx:253-256`), a type union, and a column that
`products.service.ts` reads and writes. No code branches on it. A customer buying an "ebook" today is
charged ৳80–120 shipping, enters the courier dispatch queue, and receives nothing.

Two schema stubs anticipate this feature and are entirely unwired — no service, controller, mapper or
UI references either (`packages/db/prisma/schema.prisma`):

- `ProductFile` (line 988) — `productId, url, name, sizeBytes, mimeType, sortOrder`. Commented
  "Digital-product downloadable attachments".
- `ProductLicenseCode` (line 1003) — not used by this spec.

## Decisions taken with the owner

1. **Preview is server-rendered images**, not client-side PDF rendering. Verified feasible (below).
2. **Delivery is both** an emailed link and an account downloads page.
3. **Full checkout separation** — a digital-only order skips the shipping fee and the address
   requirement and never enters the courier dispatch queue.
4. **Mixed carts are allowed**; shipping is charged because there is a parcel anyway.
5. **Digital orders appear in Order Manager and reports** — they are real revenue.
6. **Checkout creates an account** (name, email, phone), logs the buyer in, and redirects to their
   downloads. No password field.
7. **A ৳0 product is a normal order** at ৳0 with no payment step.
8. **Priced products use the existing manual bKash flow** and unlock on payment verification.

## The security problem that shapes everything

**Every object in R2 is publicly readable.** `R2MediaStorage` has `upload` and `delete` and nothing
else — no signing, no ACL, no private notion
(`apps/backend/src/modules/media/storage/r2-media-storage.ts`). `upload()` returns
`` `${publicBaseUrl}/${key}` `` and that URL is the object. Keys embed a `randomUUID`, which is
obscurity, not access control.

So a paid PDF stored through the existing media pipeline would be **downloadable by anyone with the
URL, forever, with no entitlement check** — and that URL would appear in the buyer's email, their
browser history, and any proxy log.

Worse, PDFs cannot go through that pipeline at all today: `mediaTypeFromMime`
(`apps/backend/src/modules/media/media.service.ts:23-27`) throws `BadRequestException` for anything
that is not `image/*` or `video/*`, and the `MediaType` enum has only `IMAGE` and `VIDEO`.

**Decision: the source PDF never becomes a public URL.** It is uploaded to R2 under a private key
prefix and the database stores the **key**, not a URL. Downloads are served by a backend endpoint
that checks entitlement and streams the object.

Streaming through the backend rather than issuing presigned URLs, because the bucket is already
wholly public via `R2_PUBLIC_BASE_URL` — a presigned URL would be pointless while the same key is
reachable unsigned. Making the bucket private is a larger migration affecting every existing image.
Streaming needs no new bucket, no new dependency, and no public key. Ebooks are a few MB at low
volume, so the bandwidth cost is acceptable. **Upgrade path:** a separate private bucket plus
presigned URLs, if download volume ever justifies it.

Preview page images are the opposite case — they are the free sample and *should* be public. They go
through the normal public media path.

## Preview rendering — verified, not assumed

`pdf-to-img` was installed and run against a real 42-page PDF on this machine (Windows, no native
build tools, prebuilt binaries):

```
page count available in    66 ms   (without rendering)
first 5 pages rendered in 1022 ms
page image sizes: 201KB, 127KB, 76KB, 39KB, 135KB  (scale 1.5)
```

So: an admin uploading a PDF waits about a second, page count is known instantly for validating the
preview-page setting, and a 5-page preview costs roughly 500KB of storage. The dependency adds ~69MB
to `node_modules` in `apps/backend`.

Rendering happens **once, at upload time**, not per request.

## Data model

### `Product` — five new fields

```prisma
/// Digital products only. The R2 object KEY, never a public URL — the file is
/// served by the entitlement-checked download endpoint, never fetched directly.
digitalFileKey     String? @map("digital_file_key")
digitalFileName    String? @map("digital_file_name")
digitalFileSize    Int?    @map("digital_file_size")
digitalPageCount   Int?    @map("digital_page_count")
/// The inclusive page RANGE the storefront preview shows, e.g. 5..9 — an
/// admin-chosen excerpt, not the front of the book, whose first pages are
/// usually a cover, a copyright notice and a blank leaf. Both null until a
/// file is uploaded; the uploader then defaults them to 1..5.
digitalPreviewStartPage Int? @map("digital_preview_start_page")
digitalPreviewEndPage   Int? @map("digital_preview_end_page")
```

`ProductFile` is **not** used. Its `url String` field is the wrong shape — it presumes a public URL,
which is precisely what must not exist — and it models many files per product when this feature has
exactly one. Leaving the stub untouched rather than bending it into a shape it does not fit.

### `ProductPreviewPage` — new

```prisma
model ProductPreviewPage {
  id         Int     @id @default(autoincrement())
  productId  Int     @map("product_id")
  pageNumber Int     @map("page_number")
  /// Public URL — these are the free sample and are meant to be readable.
  imageUrl   String  @map("image_url")
  product    Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  @@unique([productId, pageNumber])
  @@map("product_preview_pages")
}
```

### `OrderItem` — one new field

```prisma
/// Snapshotted like productNameSnapshot/skuSnapshot beside it. Neither CartItem
/// nor OrderItem carries product type today, so every "is this order digital?"
/// check would otherwise re-join to Product — and would give the wrong answer
/// if the product were later edited or deleted.
productTypeSnapshot ProductType @default(PHYSICAL) @map("product_type_snapshot")
```

### `DigitalDownload` — new

The buyer's entitlement. Separate from `OrderItem` so a download can be revoked, counted, and
re-issued without touching order history.

```prisma
model DigitalDownload {
  id            Int       @id @default(autoincrement())
  orderId       Int       @map("order_id")
  productId     Int       @map("product_id")
  customerId    Int?      @map("customer_id")
  /// Unguessable, emailed to the buyer. Works without a session so a guest can
  /// download from the email link.
  token         String    @unique
  downloadCount Int       @default(0) @map("download_count")
  lastDownloadAt DateTime? @map("last_download_at")
  /// Null until the order is paid/confirmed. The endpoint refuses while null.
  unlockedAt    DateTime? @map("unlocked_at")
  createdAt     DateTime  @default(now()) @map("created_at")

  order    Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product  Product   @relation(fields: [productId], references: [id])
  customer Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)

  @@index([customerId])
  @@map("digital_downloads")
}
```

No expiry. A customer who paid for a book should not lose it because a link aged out; the token is
long and unguessable, and `downloadCount` gives visibility if one is shared widely.

## Backend — `apps/backend/src/modules/digital-products/`

| File | Responsibility |
|---|---|
| `digital-products.service.ts` | Upload the PDF, render previews, wire fields onto the product |
| `pdf-preview.util.ts` | `renderPreviewPages(buffer, count)` — pure, testable, wraps `pdf-to-img` |
| `admin-digital-products.controller.ts` | `POST /admin/digital-products/:id/file` (multipart), `DELETE …/file` |
| `downloads.service.ts` | Entitlement checks, token issue, stream, count |
| `downloads.controller.ts` | `GET /downloads/:token` (public, token-gated), `GET /customers/me/downloads` (session) |
| `dto/` | Upload and response DTOs |

**Storage keys.** The PDF goes to `digital/{uuid}-{sanitizedFilename}.pdf`. `MediaStorage` gains an
`uploadPrivate(key, buffer, contentType)` that writes the object but returns the **key**, not a URL,
plus a `getObjectStream(key)` for the download endpoint. `mediaTypeFromMime` is untouched — this path
does not create `Media` rows at all, so the IMAGE/VIDEO enum stays as it is.

Filenames pass through the existing `sanitizeFilename` helper, so this feature cannot reintroduce the
space-in-URL bug fixed earlier today.

**Limits.** The current upload cap is 20MB (`admin-media.controller.ts:37`). Ebooks can exceed that,
so the digital-file endpoint gets its own `MaxFileSizeValidator` at **50MB**, and rejects anything
whose MIME is not `application/pdf`.

## Admin — Digital Products section

A new nav entry under **Product Management**, beside Products, gated on a new `digital_product.view` /
`.create` / `.update` / `.delete` permission set in `packages/shared/src/permission-catalog.ts`.

**These are `Product` rows with `productType = 'DIGITAL'`**, not a parallel entity. The list and the
form reuse the existing products backend, filtered by product type. That is what "same fields as a
normal product" means concretely — pricing, categories, tags, SEO, media, descriptions, FAQs and
cross-sell all work unchanged, because it is the same model.

The form is the one place duplication is unavoidable. `ProductFormFields.tsx` is 547 lines with no
seam for product type — no conditional rendering, and stock/shipping/variants are woven through it. So
the digital form is a **separate, smaller component** that renders the General, Media, SEO and
Analytics tabs and replaces Inventory / Variants / Shipping with a single **Digital File** tab:

- PDF upload (drag-drop, 50MB cap, `accept="application/pdf"`)
- Filename, size and detected page count, shown read-only after upload
- **Preview pages** number input, defaulting to 5, validated against the real page count
- A thumbnail strip of the rendered preview pages, so the admin can see what customers will see
- Replace / remove file

It shares `useProductFormState` for everything else rather than forking the state logic.

Changing the preview range (`digitalPreviewStartPage`/`digitalPreviewEndPage`) re-renders the preview
images from the stored PDF; it does not require re-upload. `ProductPreviewPage.pageNumber` holds the
page's REAL number in the document (5..9 for a 5-9 range), not its position in the preview.

## Checkout

**Digital-only detection.** A cart or order is digital-only when every line's product type is
`DIGITAL`. On the order it reads `productTypeSnapshot`; in the cart it joins to `Product`, the way
`computeOrderWeight` already does for `shippableWeight`.

**Shipping fee.** `computeCheckoutFees` already takes a `freeShipping` boolean that early-returns
zero. Both call sites — `cart.service.ts:441` and `checkout.service.ts:233` — pass
`freeShipping || cartIsDigitalOnly`. The shared function and the physical path are untouched.

**Address.** For a digital-only cart the storefront collects name, email and phone only, and the
backend accepts a `CheckoutDto` with no `shippingAddress`. `CheckoutAddressDto` itself does not
change; `CheckoutDto.shippingAddress` becomes conditionally required, enforced in the service where
the digital-only determination lives. No `OrderAddress` rows are written for a digital-only order —
today both SHIPPING and BILLING are written unconditionally (`checkout.service.ts:296-307`).

**Skipped for digital-only orders:** stock reservation (`checkout.service.ts:243-250`), the COD OTP
path, and the courier fraud gate. The **Net Profit blocker still runs** — it is fraud protection keyed
on phone, email, IP and device, all of which are still collected — but reads an empty address string
rather than a missing object.

**Dispatch queue.** `ShipmentsService.adminQueue()` has **no filter at all** — it deliberately selects
every non-deleted order. It gains one condition: exclude orders whose every line is digital. Mixed
orders still appear, correctly, because they contain a parcel.

**Completion.** `COMPLETED` is today set only by staff action or a courier webhook reporting
`DELIVERED`. A digital-only order has no courier, so it needs its own trigger: on payment confirmation
(immediately for ৳0), the service unlocks the downloads and transitions the order to `COMPLETED`
through the existing `OrdersService.updateStatus` with `adminUserId: null`, exactly as the courier
webhook does. This matters beyond tidiness — `profit.service.ts:101-105` computes profit **only** on
the transition to `COMPLETED`, so without this a digital sale would be invisible in Net Profit while
still showing in Order Manager.

Order Manager and the Sales Report need no changes: neither filters by channel or product type, and
`LEFT JOIN LATERAL` on shipment means a missing shipment does not drop the row.

## Account creation at checkout

The buyer of a digital product supplies name, email and phone. There is no password field.

**There is already a precedent for exactly this.** `POST /auth/otp/verify` with `purpose='REGISTER'`
creates a `Customer` with **no password** and immediately returns signed tokens
(`customer-auth.service.ts:216-246`); `socialLogin` does the same. So passwordless
account-creation-plus-session is an established pattern here, not an invention.

`POST /auth/register` is **not** reused: it creates a *pending* customer and sends an OTP, returning
no tokens. That is the wrong shape for a checkout that must end in a logged-in session.

**The rule that prevents account takeover:**

| Case | Behaviour |
|---|---|
| Email and phone match no verified customer | Create the customer, issue tokens, set cookies, redirect to downloads |
| Either matches an existing **verified** customer | **Do not issue a session.** Attach the order and downloads to that customer, email the link, and show "You already have an account — sign in to download." |
| Buyer already logged in | Attach to their account, no creation |

Without the second row, anyone could place a ৳0 order using a customer's email and land inside that
customer's account — order history, saved addresses, everything. Free products make this sharper: there
is no payment step to slow an attacker down. Registration already 409s on a verified phone or email
(`customer-auth.service.ts:66-104`); this reuses the same check.

The created account has `passwordHash = null`. `POST /customers/me/password` already exists and only
works when the hash is null (`customers.service.ts:156-174`), so the buyer can set a password from
their account whenever they like. **No password-reset email flow is built** — none exists in this
codebase today, and this design does not need one.

## Delivery

**Email.** The order-confirmation email for an order containing digital items includes a download link
per item: `{STOREFRONT_BASE_URL}/download/{token}`. A new `digital_download` email template joins the
existing admin-editable set, so the wording is yours to change.

**Account page.** `/account/downloads` lists every unlocked download for the logged-in customer — cover,
title, purchase date, download count, button. It follows the established account pattern exactly:
a thin `page.tsx` rendering a client component that calls `proxyFetch` through the authenticated
`/api/backend` route, with `AccountShell` handling the auth redirect. A nav entry is added to
`AccountNav`.

**The endpoint.** `GET /api/v1/downloads/:token`:

1. Look up the `DigitalDownload` by token — 404 if absent, and identically 404 for a token that
   exists but is locked, so the endpoint never reveals which
2. Refuse with a clear message if `unlockedAt` is null (payment not yet confirmed)
3. Increment `downloadCount`, set `lastDownloadAt`
4. Stream the R2 object with `Content-Disposition: attachment` and the original filename

Token-based rather than session-based so the emailed link works for a buyer who never signs in.

## Free vs paid

**৳0** — no payment step. The order is created at ৳0, downloads unlock immediately, status goes
straight to `COMPLETED`, and the buyer lands on their downloads page.

**Priced** — the existing manual bKash flow: the buyer pays in their app and submits a transaction ID,
and downloads unlock when staff verify the payment. This is stated plainly on the confirmation page
rather than promising an instant download that will not arrive.

Manual verification is the owner's explicit interim choice, pending a bKash merchant account or
SSLCommerz. Because unlocking hangs off **"payment confirmed"** rather than "order placed", swapping
in a real gateway later is a change to what sets `unlockedAt` and nothing else — no redesign of the
download, entitlement or email paths. Priced products become instant the day the gateway lands.

Unlocking on TXID submission instead was considered and rejected: anyone could type a fake transaction
ID and take the file, and a digital good has no marginal cost to stop them.

## Testing

Backend, where the test runner lives:

- `renderPreviewPages` — correct page count, honours the limit, and a request for more pages than the
  document has yields all of them rather than throwing.
- Digital-only detection — all-digital true, all-physical false, mixed false.
- Shipping fee — a digital-only cart is charged ৳0; a mixed cart is charged the normal zone rate. This
  is the regression guard for the money path.
- Checkout — a digital-only order writes no `OrderAddress` rows, reserves no stock, and reaches
  `COMPLETED` when free.
- Account creation — a new email creates and returns tokens; an **existing verified** email creates no
  session and still attaches the download. This is the security test.
- Download endpoint — valid unlocked token streams; locked token refuses; unknown token 404s;
  `downloadCount` increments.
- Dispatch queue — a digital-only order is absent; a mixed order is present.

## Risks

**The 20MB → 50MB upload limit** is on the digital-file endpoint only, not raised globally. A larger
book still fails, with a clear message rather than a truncated file.

**Preview rendering happens synchronously on upload.** About a second for five pages, but a 300-page
book at a high preview count would be slower. The page count is read first (66ms) and the preview
count is capped, so the work is bounded by the setting rather than the document.

**Digital-only orders bypass stock reservation entirely.** Correct for a PDF, and it means a digital
product's stock fields are meaningless — the admin form hides them for exactly that reason.

**The download endpoint streams through the backend**, so a large book downloaded many times consumes
application bandwidth rather than CDN bandwidth. Acceptable at expected volume; the private-bucket
plus presigned-URL upgrade path exists if that changes.

## Out of scope — Spec 2

The storefront product page in the mockup, the "আরো পড়ুন" button on the product image, the preview
modal, scroll-through-N-pages behaviour and the buy prompt. Spec 1 renders and stores the preview
images and exposes them on the product API; Spec 2 consumes them.

Also out of scope: `ProductLicenseCode`, multiple files per product, video or audio products,
subscriptions, and download expiry.
