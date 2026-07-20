# Customer Panel — Progress Ledger

No-git adaptation: no worktree, no commits, no git diff. Each implementer
edits files directly and reports the exact file list; each reviewer reads
those files' current full content against the task brief. This file is the
recovery map — trust it over conversation memory after any compaction.

Plan: docs/superpowers/plans/2026-07-18-customer-panel.md

## Minor findings for final review (not fixed inline, tracked for triage)

- **Task 3**: `Customer.phone` and `OrderAddress.phone` are matched by exact
  string equality with no normalization on either side — this is a
  pre-existing gap (the OTP signup path at `customer-auth.service.ts:189`
  has the same limitation) rather than something this task introduced, but
  worth a future pass using the existing `normalizeBdPhone` helper from
  `@amader/shared` (already used in `blocker.service.ts`/`fraud.service.ts`)
  so phone-format variants (`01711112222` vs `+8801711112222`) still match.

- **Task 5** (plan-mandated, not implementer deviations — reviewer noted
  but didn't block): `adminUpdate`/`addNote`/`logCall`/`dial` skip the
  explicit "customer not found" 404 check that `adminGet` has (they rely
  on `findUniqueOrThrow`/FK constraints, which surface a raw 500 instead of
  a clean 404 on a missing customer id). Also `UpdateCustomerDto.dob`
  (string) is passed straight into the Prisma `DateTime` field without a
  `new Date(...)` conversion, unlike the pre-existing `updateProfile`
  method which does convert it — typechecks fine, but inconsistent with
  the sibling method's style.

- **Task 9** (Important, plan-mandated, live impact — not theoretical):
  the `/customers` list page's tier stat cards are computed by fetching
  `useCustomers({ pageSize: 1000 })` and filtering client-side by tier
  label, rather than a real backend aggregate. This dev DB already has
  **2,370 real customers** (confirmed during Task 5's verification) —
  meaning the stat cards are ALREADY silently undercounting today, not
  just at some future scale, with no UI indication of truncation. The
  main list/search/filter table itself is unaffected (it uses proper
  server-side paginated/filtered queries) — only the 5 stat-card numbers
  at the top are wrong. Reviewer recommends a follow-up backend task
  (e.g. `GET /admin/customers/tier-counts` or a summary field on the list
  response) rather than reworking this page, since no such endpoint
  existed for this frontend-only task to consume.

## Post-ship UX change (user request, after final review)

User asked for clicking a customer row on `/customers` to open a quick-view
modal instead of navigating straight to the full profile page, with an
"Edit →" action in the modal handing off to the full `/customers/[id]`
page for notes/calls/order-history/activity management. Added
`apps/admin/src/components/CustomerDetailModal.tsx` (mirrors
`OrderDetailModal.tsx`'s existing "detail modal + dedicated page for deep
editing" split already used elsewhere in this admin app) — shows phone/
email, tier badge, completed orders, birthday, customer since, up to 3
recent orders, and the latest note if any. `/customers` page: name cells
are now buttons that open the modal (`selectedId` state) instead of
`Link`s. Typecheck clean; live-verified: modal opens with real data
(orders, tier, etc.), "Edit →" correctly navigates to `/customers/2370`.

## Final whole-plan review (post-Task-13)

Dispatched a final reviewer (opus) with no git diff available — pointed at
the full file list instead. Verdict: architecture sound, auth uniform, no
security/data-integrity issues, out-of-scope items genuinely non-load-bearing.
One finding upgraded from "Important, tracked" to "confirmed actively wrong
right now": the `/customers` stat cards showed 0 for every tier (true
counts: Group B=12, Group A=1) because they derived from a 1000-row
client-side fetch-and-filter that missed all the (older) tiered customers.

**Fixed same session**: added `CustomerTiersService.countsByTier()` +
`GET /admin/customer-tiers/counts` (real DB aggregate via `_count`), wired
into a new `useCustomerTierCounts()` hook, `/customers` page now uses it
for the 5 stat cards and a cheap `pageSize:1` fetch for the true total —
dropped the wasteful 1000-row fetch entirely. Live-verified: stat cards
now show 12/1/0/0 matching the DB exactly; tier filter dropdown (now
sourced from the same counts data) still lists all 4 tiers correctly.
Both apps typecheck clean.

**Deferred, tracked for a future pass** (per reviewer triage — none block
shipping this feature):
- Phone normalization gap (Task 3) — pre-existing, shared with OTP signup,
  needs a dedicated data-migration pass, not a quick fix here.
- Missing 404 guards + dob-as-string on `adminUpdate`/`addNote`/`logCall`/
  `dial` (Task 5) — currently unreachable (no edit-customer UI exists yet
  to call `PATCH /admin/customers/:id`), fix when that UI is built.
- ~~No pagination controls on `/customers`~~ — **fixed after the user
  reported it**: added `page` state, Previous/Next buttons, and a
  "Showing X–Y of Z" indicator, mirroring the exact pattern already used
  on the Net Profit Order Manager page. Search/tier-filter changes now
  reset to page 1. Live-verified: Next correctly advances from
  "Showing 1–50 of 2370 / Page 1 of 48" to "Showing 51–100 of 2370 / Page
  2 of 48" with different customer rows.
- Historical guest orders placed before this feature existed (`customer_id
  = NULL`, ~408 orders) are not retroactively linked — auto-linking is
  forward-only by design; a backfill pass would need explicit sign-off
  before running against real order data.

Mid-review, the user also reported the CSV import "Choose CSV file" button
not working — investigated live, found it was leftover Playwright state
from the reviewer's own automated spot-check (repeated clicks without
resolving the resulting file-chooser dialogs), not a real product bug.
Re-tested clean end-to-end (button → file picker → real upload → "Imported
1, skipped 0") and confirmed working correctly.

## Tasks

- [x] Task 1: Schema — CustomerTier, CustomerNote, CustomerCallLog (complete, review clean — 1 minor whitespace fix applied by reviewer)
- [x] Task 2: CustomerTiersService + tier settings endpoint (complete, review clean)
- [x] Task 3: Auto-matching + tier recompute event listener (complete, review clean)
- [x] Task 4: Phone normalization + deferred CallProvider (complete, review clean)
- [x] Task 5: AdminCustomersController (list/get/patch/notes/calls/dial) (complete, review clean)
- [x] Task 6: CSV import (complete, review clean)
- [x] Task 7: Regenerate admin API types (complete, run directly — mechanical, no code to review; `AdminCustomerDto`/`AdminCustomerListItemDto`/`CustomerTierDto` confirmed present in schema.d.ts)
- [x] Task 8: Nav entry, layout scope, and hooks (complete — 1 Important stale-cache bug in `useUpdateCustomer` found + fixed + re-reviewed clean)
- [x] Task 9: /customers list page (complete — 1 Important finding tracked, not fixed inline, needs new backend endpoint out of scope)
- [x] Task 10: /customers/[id] profile page (complete — hit a real cross-cutting Swagger schema gap for `Record<string, unknown>[]` fields; fixed with an `@ApiProperty` override on the backend mapper + one justified type assertion in page.tsx, both independently re-verified sound)
- [x] Task 11: /customers/tiers settings page (complete, review clean)
- [x] Task 12: /customers/import CSV upload page (complete, review clean)
- [x] Task 13: Full end-to-end verification pass (complete — run directly by controller via Playwright + real checkout API, not delegated. 2 real guest checkouts on the same phone → auto-created customer → 2x COMPLETED → tier auto-promoted to "Group B", confirmed live in DB and in the admin UI. Added a real note through the actual form, confirmed it appears in Notes + Activity Timeline. Clicked "Call" and confirmed the browser alert reads "Calling is not configured yet". Confirmed Order History shows both real orders. Confirmed the customer appears correctly in the /customers list via search, with the correct tier badge. All test data — customer, both orders + children, notes, OTP rows — fully cleaned up and confirmed removed. Also fixed a live UX gap the user spotted mid-verification: added a "← Back to Customers" link to the profile page (typecheck clean, visually confirmed). Final full typecheck of both apps: clean.)
