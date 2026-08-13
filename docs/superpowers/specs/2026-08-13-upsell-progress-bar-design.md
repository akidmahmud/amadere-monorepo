# Upsell Progress Bar — Design Spec

## Context

The storefront cart drawer already has a single-threshold "spend ৳X more for
free shipping" widget (`FreeShippingLadder` in `packages/ui`, driven by a
`free_shipping_threshold` `Setting` row and `PricingService.freeShippingLadder()`).
The user wants to generalize this into a gamified, up-to-6-stage progress bar:
buying more items unlocks bigger percentage discounts, and/or reaching a
spend amount unlocks free shipping — configurable per stage from the admin
panel, shown in both the cart drawer and at the top of checkout.

This builds on real existing infrastructure rather than starting fresh: the
`Discount`/`PricingService` engine already computes coupon/promotion
discounts and free-shipping waiver against a cart; the cart drawer and
checkout both already consume one shared `PricingSummaryDto` response shape
from the backend.

## Goals

- Up to 6 admin-configured stages, each independently choosing:
  - a trigger: reach N items in cart, OR spend ৳X (subtotal)
  - a reward: percentage discount, fixed-৳ discount, free shipping, or a
    combination
  - a display label
- Item-count mode is itself admin-configurable, globally: count every unit
  in the cart, or count only distinct products — the client's need for this
  changes over time, so it's a toggle, not a fixed decision.
- A global max-discount cap (৳), applied across the whole bar regardless of
  which stage is unlocked.
- A whole-feature enable/disable toggle, independent of each stage's own
  enabled flag — the client sometimes won't want the bar running at all.
- Replaces the existing single free-shipping-threshold setting and widget
  entirely — the new bar's free-shipping stage covers the same need, and
  running both at once would show two redundant progress bars.
- Rendered in the cart drawer (replacing `FreeShippingLadder`) and as a
  banner at the top of the checkout page, both driven by the same backend
  field, no separate frontend calculation.

## Non-goals

- No per-product/category scoping — every reward is "site wide," applying
  to the whole cart subtotal, unlike `Discount`'s optional product/category
  scoping.
- No multiple simultaneous bars, no A/B testing, no per-customer-segment
  variants — one global, sequential ladder.
- No stacking the upsell-bar's own discount amount on top of an existing
  coupon/promotion discount — see "Pricing engine," below, for the actual
  behavior (bigger-wins, not additive; free shipping is the one exception,
  see step 5).
- No stage combines a percentage AND a fixed-৳ discount at once — a stage
  picks one discount value type, matching the existing `Discount` model's
  own `valueType` being a single choice, not a combinable set. "Or both"
  from the request means discount-or-free-shipping-or-both, not
  percent-and-fixed-together — see the data model below.

## Data model

### New: `UpsellStage`

```prisma
enum UpsellTriggerType {
  ITEM_COUNT
  ORDER_AMOUNT
}

model UpsellStage {
  id                  Int               @id @default(autoincrement())
  sortOrder           Int               @map("sort_order") // 1-6, display + evaluation order
  triggerType         UpsellTriggerType @map("trigger_type")
  triggerValue        Decimal           @map("trigger_value") @db.Decimal(10, 2) // item count or ৳ amount, same column either way
  discountPercent     Decimal?          @map("discount_percent") @db.Decimal(5, 2)
  discountFixedAmount Decimal?          @map("discount_fixed_amount") @db.Decimal(10, 2)
  freeShipping        Boolean           @default(false) @map("free_shipping")
  label               String            // e.g. "3% off" — shown at this stage's checkpoint
  enabled             Boolean           @default(true)
  createdAt           DateTime          @default(now()) @map("created_at")
  updatedAt           DateTime          @updatedAt @map("updated_at")

  @@map("upsell_stages")
}
```

`discountPercent` and `discountFixedAmount` are mutually exclusive — a
stage sets at most one of the two (enforced by the DTO, not the DB),
mirroring `Discount.valueType` being a single choice rather than a
combinable set. `freeShipping` is independent of that choice: a stage can
set a discount, free shipping, or both together — that's what "or both"
in the request means. At least one of the three fields must be set per
stage.

### New: settings, reusing the generic `Setting` table

One row, key `upsell_bar.settings`, matching the exact pattern
`EmailTemplateSettings`/`InvoiceTemplateSettings` already use — no new
table:

```ts
interface UpsellBarSettings {
  enabled: boolean; // whole-feature on/off, independent of each stage's own `enabled`
  countMode: 'TOTAL_UNITS' | 'DISTINCT_PRODUCTS';
  maxDiscountCap: number | null; // ৳, applied across the whole bar
}
```

### Removed

`free_shipping_threshold` `Setting` key, `PricingService.freeShippingLadder()`,
`FreeShippingLadderDto`, the `FreeShippingLadder` component and its usage in
`SiteCartDrawer.tsx` — all replaced by the new bar. Confirmed with the user
this is a clean replacement, not a parallel feature.

## Pricing engine

`PricingService.price()` (`apps/backend/src/modules/cart/pricing.service.ts`)
gains a new step, evaluated after the existing coupon/promotion discounts
are computed:

1. Compute the cart's "count" per the configured `countMode`: sum of every
   line's `quantity` (`TOTAL_UNITS`), or the number of distinct `productId`
   values across lines (`DISTINCT_PRODUCTS`).
2. Among enabled stages (sorted by `sortOrder`), find the **highest** stage
   whose trigger is satisfied — `ITEM_COUNT` stages compare against the
   count from step 1, `ORDER_AMOUNT` stages compare against `subTotal`.
   Reaching stage 3 means stage 3's reward applies, not stages 1+2+3
   stacked — this is a ladder, not cumulative.
3. Compute that stage's discount amount (percentage of `subTotal`, or the
   fixed amount — whichever the stage sets, since they're mutually
   exclusive per stage), then clamp it to `maxDiscountCap` if set.
4. Compare this amount against `otherDiscountsTotal` (the sum of the
   existing coupon + promotion discounts, computed as today, unchanged) —
   per the user's explicit choice, **whichever total is bigger wins**; they
   are not added together. The losing side's discount entries are dropped
   from what counts toward `totalDiscount`/`total` (though see the
   `couponError`/display note below).
5. **Free shipping is independent of step 4's comparison** — per the user's
   explicit choice, if the matched stage (from step 2) has `freeShipping:
   true`, an `AppliedDiscount` with `freeShipping: true` is always present
   in the result, regardless of whether the upsell stage or the
   coupon/promotion side won the amount comparison in step 4. This is what
   `cart.service.ts`'s existing `pricing.discounts.some(d => d.freeShipping)`
   check (already used to waive `shippingFee` in `computeCheckoutFees`)
   picks up — no change needed to that call site, only to what
   `PricingService` puts into `discounts`.
6. If the upsell side did not win step 4's comparison, the coupon/promotion
   discounts still display and apply exactly as today — the upsell bar's
   discount amount simply isn't added on top. If the customer has no
   coupon/promotion active at all, `otherDiscountsTotal` is 0 and the
   upsell discount (if any) always wins by default.

## API response shape

`PricingSummaryDto` (`apps/backend/src/modules/cart/dto/cart-response.dto.ts`)
drops `freeShipping!: FreeShippingLadderDto | null` and gains:

```ts
export class UpsellStageProgressDto {
  label!: string;
  triggerType!: 'ITEM_COUNT' | 'ORDER_AMOUNT';
  triggerValue!: string;
  unlocked!: boolean;
}

export class UpsellBarDto {
  stages!: UpsellStageProgressDto[]; // every enabled stage, in sortOrder, for rendering all checkpoints
  currentCount!: string; // the cart's current item-count or ৳ amount context for display
  nextStage!: { label: string; remaining: string } | null; // null once every stage is unlocked
}
```

`upsell: UpsellBarDto | null` — `null` when the whole feature is disabled
(`UpsellBarSettings.enabled === false`) or no stages are configured, so the
frontend's "don't render anything" case is a single null-check, matching
how `freeShipping: null` already works today.

## Admin UI

One page under Marketing (`/upsell-bar`, nav entry placed after "Discounts"
in `nav-config.tsx`, new `upsell_bar.view`/`upsell_bar.manage` permissions
following this app's existing `<resource>.view`/`.manage` convention) — a
single settings-style page, not a list+detail CRUD flow, since there's only
ever one bar with at most 6 rows:

- Top: whole-feature Enabled toggle, count-mode toggle (Total units /
  Distinct products), max discount cap ৳ field, Save.
- Below: up to 6 stage cards — Add Stage (disabled once 6 exist), each
  card has: trigger type toggle (Items / ৳ Amount) + value, discount %
  field, fixed ৳ field, free-shipping checkbox, label text, per-stage
  Enabled toggle, Delete, and up/down reorder buttons (plain buttons, not
  drag-and-drop — 6 items doesn't need it, and it's simpler to build and
  use correctly than wiring up a drag library for a list this short).

## Frontend

New `UpsellProgressBar` component in `packages/ui` (replacing
`FreeShippingLadder`'s import in `SiteCartDrawer.tsx`, and newly added to
`CheckoutForm`): a modern segmented progress bar — a filled track showing
current progress, small checkpoint markers positioned along it at each
stage's relative position, the current/next stage's remaining-amount label
above the bar, already-unlocked stages shown as filled/checked. Both
consumers read the same `cart.upsell` field from the existing shared
pricing response — no separate frontend computation of progress.

## Testing / verification

No unit test framework in this codebase — verification is live, matching
every prior feature this session:
- Configure 2-3 real stages via the new admin page, confirm they persist
  and reorder correctly.
- Add real items to a cart in the storefront, confirm the bar in the cart
  drawer updates as quantity crosses each configured threshold, and that
  an already-unlocked stage stays visually marked as unlocked.
- Confirm the same bar (same unlocked state) renders at the top of
  checkout.
- Verify the pricing math directly: a cart that qualifies for both a
  coupon and an upsell stage shows only the larger discount counted in
  `total`, and — separately — that free shipping applies whenever the
  matched stage grants it, even in a case where the coupon's discount
  amount was larger.
- Toggle the whole-feature Enabled switch off, confirm the bar disappears
  entirely from both the cart drawer and checkout with no console errors.
- Confirm the old `free_shipping_threshold` setting/widget path is fully
  gone — no leftover references, no dead code.
