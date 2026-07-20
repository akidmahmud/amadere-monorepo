# New Order Panel — Progress Ledger

No-git adaptation (same as the Customer Panel plan): no worktree, no commits, no git diff. Each
implementer edits files directly and reports the exact file list; each reviewer reads those files'
current full content against the task brief. This file is the recovery map — trust it over
conversation memory after any compaction.

Plan: docs/superpowers/plans/2026-07-18-new-order-panel.md

## Tasks

- [x] Task 1: Backend shared infra — extract utils, add product search, add permission (complete,
  review clean — implementer's report skipped the brief's live-verification step (real checkout
  + authenticated search curl), so the controller ran it directly: real guest checkout via
  cart→COD-OTP→checkout against variant #134 (Dhonia Gura 1kg), confirmed `reserved_stock` went
  0→2 proving the extracted `reserveStock` util behaves identically to the original, then fully
  cleaned up (order/items/addresses/payments/status-history/OTP/cart deleted, reserved_stock
  restored, all confirmed via follow-up SELECTs returning 0 rows). Authenticated `?q=` search
  confirmed: `q=Ganjia` → 1/77 results, `q=full-fiber` → 2/77, `q=zzzznonexistentxyz` → 0. One
  Minor cosmetic nit from review (stray blank line before checkout.service.ts's closing brace)
  fixed directly by the controller.)
- [x] Task 2: AdminOrderCreationService + CreateManualOrderDto + endpoint (complete, review clean —
  spec ✅, live-verified via curl: new-phone order auto-created a customer via the unmodified
  CustomerOrderEventListener; price-override order produced subTotal 1200/discountAmount
  200/totalAmount 1000, arithmetically correct for a 1400-list/1200-sale product overridden to
  1000. Full cleanup confirmed by both the implementer and independently by the reviewer. Two
  Minor notes, no action needed: (1) the brief's own comment about POST-route-ordering avoiding
  shadowing is technically inaccurate but harmless (Nest dispatches by method first); (2) the
  create response's `customerId` is `null` on first read for new-phone orders (EventEmitter2 fires
  the listener without blocking the immediate re-fetch) — identical pre-existing behavior in real
  checkout, flagged forward for Task 4's frontend hook to tolerate.)
- [x] Task 3: Regenerate admin API types (complete, run directly — mechanical, no code to review;
  `CreateManualOrderDto`/`ManualOrderItemDto` confirmed present in schema.d.ts)
- [x] Task 4: Frontend hooks — useCreateManualOrder, useProductSearch (complete, review clean —
  spec ✅, both hooks inserted verbatim without disturbing existing hooks, tsc clean)
- [x] Task 5: /orders/new page + nav entry (complete — page/nav matched the brief byte-for-byte on
  first pass, but review found 2 real bugs across 2 fix rounds, both baked into the plan's own
  code (not implementer deviations):
  1. **Important** (found round 1): `selectCustomer` cleared `customerQuery`, which refetched an
     unfiltered top-5-most-recent customer list; `selectedCustomer` was derived by looking up
     `customerId` in that list, so any customer outside the 5 most recent silently vanished from
     the confirmation card with no error. Reproduced live (searched "Bakar" → "Abu Bakar", id=1,
     oldest customer in DB). Fixed by storing the picked customer's display data directly in a new
     `selectedCustomerInfo` state, independent of the query.
  2. **Critical** (found round 2, introduced by fix #1): the new `selectedCustomer = preselected ??
     selectedCustomerInfo ?? undefined` derivation never invalidated `preselected` (from the
     `?customerId=` deep link) — clicking "Change" cleared `customerId`/`selectedCustomerInfo` but
     the card kept showing the old customer with no error, while `customerId` state was genuinely
     null underneath, meaning a submit at that point would create a **customer-less order while the
     UI displayed a specific customer's name throughout**. Reproduced live. Fixed by having "Change"
     also call `router.replace("/orders/new")` to strip the query param, letting `preselected`
     naturally fall back to falsy (no new state needed).
  Round 3 re-review independently reproduced both fix scenarios plus a new state-loss check
  (product lines/address text survive the `router.replace`, confirming it's a shallow transition,
  not a remount) — Approved, Spec ✅. Two Minor findings (NaN-guard gap on numeric inputs, a
  loading-flicker cosmetic on deep links) tracked, not fixed — neither blocks shipping.)
- [x] Task 6: "New Order" button on the Customer Panel (complete, review clean — spec ✅, both
  entry points (CustomerDetailModal footer, /customers/[id] header) live-verified to correctly
  preselect and lock in the customer on /orders/new, no other part of either file disturbed)
- [x] Task 7: Full end-to-end verification pass (complete — run directly by the controller via
  Playwright + curl + real DB queries, not delegated, per the plan. Found and fixed one real,
  live-reproduced bug not caught by any prior review: `handleSubmit` in `/orders/new/page.tsx`
  sent `shippingAddress: address` as-is, where blank optional fields default to `""` (not
  `undefined`). The backend's `CheckoutAddressDto.email` is `@IsOptional() @IsEmail()` —
  class-validator's `@IsOptional()` only skips `undefined`/`null`, not `""`, so **every submit
  with no email typed in failed with "shippingAddress.email must be an email"**, blocking the
  core feature entirely for the common no-email case. Confirmed no partial writes occurred on the
  rejected attempt. Fixed with a `cleanAddress()` helper that converts blank optional fields
  (email/area/landmark/postCode) to `undefined` before submitting both shippingAddress and
  billingAddress. Re-tested successfully after the fix (order 6670). tsc re-confirmed clean.

  Verification results:
  1. **Existing customer** (Jesmine sultana, id 4, phone 01716210367) — created via the real UI
     with a price override (2× Dhonia Gura 1kg, real price ৳550→override ৳300). No duplicate
     customer created. Order appeared correctly in her Order History tab. Stock variant #134
     reserved_stock 0→2. `subTotal`/`discountAmount`/`totalAmount` = 1100/500/600, arithmetically
     correct.
  2. **Brand-new phone** (01777099887) — created via the real UI. New `Customer` #4752
     auto-created with the correct name/phone from the address fields, via the unmodified
     `CustomerOrderEventListener`.
  3. **Price override correctness** — covered by #1 above; math confirmed correct.
  4. **Stock conflict** — organically encountered mid-test (variants #135 and #133 both happened
     to be out of stock in the dev DB) rather than deliberately induced, which if anything is a
     more honest test: `POST /admin/orders` correctly rejected with "Insufficient stock for
     variant #N", and confirmed via DB query that **zero** rows were created (no order, no
     customer) — proving the customer auto-create (which only fires after the transaction commits)
     correctly never runs when stock reservation fails inside it.
  5. **Tier recompute** — marked Jesmine's test order COMPLETED via `PATCH
     /admin/orders/:id/status`. `completedOrderCount` 1→2, tier auto-promoted to "Group B" —
     confirmed the manual-order path feeds `ORDER_STATUS_CHANGED_EVENT` →
     `CustomerOrderEventListener.onOrderStatusChanged` identically to storefront orders.
  6. **Full typecheck** — `apps/backend` and `apps/admin` both clean.
  7. **Cleanup** — both test orders and all cascaded children deleted; test customer #4752
     deleted; Jesmine's `completedOrderCount`/`tier_id` reverted to their pre-test values (1,
     null) since raw SQL deletes don't re-trigger the recompute listener; variant #134's
     `stock`/`reserved_stock` restored to pre-test values (50/0, accounting for the COMPLETED
     order's reservation→consumption conversion). All confirmed via follow-up `SELECT`s returning
     0 rows / original values. Leftover `.playwright-mcp` screenshot directory also removed.)
- [x] Final whole-plan review (complete — opus, no git diff, pointed at the full file list +
  ledger. Verdict: **READY TO SHIP.** Architecture confirmed sound (reuse over duplication for
  stock/pricing/address, non-goals genuinely excluded, correct event-based Customer Panel
  integration), `order.create` permission gate confirmed correct and specific, transaction
  guarantees no partial orders, both documented bug fixes (Task 5 customer-selection, Task 7
  blank-email validation) independently re-verified complete and correct in the current code.
  Both typechecks independently re-run clean. Zero blocking findings. Five Minor items tracked for
  a future pass, none affecting correctness: price-override-above-list-price leaves
  `discountAmount` at 0 (cosmetic only, charged total still correct), no NaN guard on quantity/
  price inputs (fails clean at the DTO layer, no data-integrity impact), deep-link
  `?customerId=` doesn't pre-fill address from the customer's last order (spec said "if
  available"), and the pre-existing deep-link loading flicker.)

## Summary

All 7 tasks + final review complete. The New Order Panel is shipped: staff can create a manual
order from `/orders/new` (top-level nav entry, or via a "New Order" button on either Customer
Panel screen with `?customerId=` preselection), selecting or auto-creating a customer by phone,
adding product/variant lines with an optional per-line price override, entering a shipping/
billing address, and picking a payment method (COD/bKash/Nagad/Rocket/Upay) — with zero
storefront fraud/blocker/OTP/advance-payment gates (by design) and full integration with the
Customer Panel's auto-match, order-count, and tier-recompute machinery via the existing, unchanged
`ORDER_CREATED_EVENT`/`ORDER_STATUS_CHANGED_EVENT` events.

Two real bugs were found and fixed during execution (both documented above in detail): a
customer-selection UI bug in Task 5 (3 review rounds) and a blank-optional-field validation bug
found during Task 7's live verification that blocked every no-email order submission. Both are
confirmed fully resolved by the final review.
