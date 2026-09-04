
## 2026-09-02 — Checkout district/thana: typeahead autocomplete with Bengali search

**Request:** make checkout's district and thana work like the attached autocomplete
prototype, on mobile too; then "if possible add bangla too".

**What changed**

- New `packages/ui/src/components/Autocomplete.tsx` — a plain `<input>` plus a
  suggestion list, ranked exact → prefix → contains, matching on the value and on
  any number of hidden aliases. Selection commits on `mousedown`/`touchstart`
  (the input's own `blur` fires first and would otherwise close the list out from
  under the tap).
- New `packages/shared/src/bd-bengali.ts` — Bengali names for all 65 districts and
  for the 67 thanas in the two districts that have area lists, plus older
  romanisations and courier shorthand (Comilla→Cumilla, Jessore→Jashore,
  Chittagong/CTG→Chattogram, Bogra→Bogura, Barisal→Barishal, …). Search-only: the
  value written to an order stays the English name, so couriers, shipping zones
  and reports never see a second spelling.
- `apps/web/src/components/AddressFields.tsx` — both fields now use `Autocomplete`.
  District is `allowFreeText={false}` (the 65 are authoritative and `division` is
  derived from that exact string server-side); thana is free text, because 63
  districts have no curated list and for those it is simply a text box with
  nothing to suggest. Changing district clears the area, so a Dhaka thana cannot
  ride along to a Sylhet address.

**Why this also settles the mobile bug properly.** The earlier fix (`Select.tsx`,
commit 94a801d) hid the search box on touch devices, because Radix dismisses an
open Select on the `window.resize` the virtual keyboard causes. These fields no
longer use Radix at all: a text input expects the keyboard rather than being
broken by it.

**Verified in the browser at 390×844 and at 1440×900:** typing `ঢাকা` ranks
Dhaka above Dhaka Sub-Urban; tapping a suggestion commits; `মিরপুর` finds Mirpur;
switching Dhaka→Jashore clears the thana and falls back to free text; `Jessore`
finds Jashore and `ctg` finds Chattogram; junk (`zzzz`) shows "No district
matches" and reverts to the committed district on blur.

**Not done:** Bengali thana names exist only for Dhaka and Dhaka Sub-Urban,
because those are the only districts `bd-thanas.ts` has any area list for.

## 2026-09-04 — Recovery: a written reason closes the cart; new Recovered tab

**Request:** "when reason written in recovery manager it should deduct the pending
recovery number / also create a tab in recovery to show recovered order lists".

**1. Writing a reason closes the cart.** `RecoveryService.updateReason` now sets
`canceledAt` when a reason is written on a cart that is still open, and clears it
again when the reason is emptied. Staff only type in that box once they have
decided what happened to the cart, so the row was still counted as "open (still
to chase)" by the sidebar badge and the bell after the work was done. A recovered
cart is left alone — it has an order behind it and "cancelled" would contradict
that.

The row is not lost: it moves to the funnel's existing **Cancelled** filter, where
the reason stays editable in place, and clearing the reason puts it back in Open.
`useUpdateCartReason` now also invalidates the rate, `abandonment-alert` and
`abandonment-notifications` queries, so the badge drops immediately instead of
after the next 60-second poll.

**2. New "Recovered" tab** — `_components/RecoveredSection.tsx`, sitting right
after Funnel because the two are the same list split by outcome. Reads the
existing list endpoint with `outcome=recovered`, so its count cannot disagree
with the stats strip. Columns: customer, stage abandoned at, cart value,
attempts, abandoned date, and a **View order** button opening the same
`OrderDetailModal` the Order Manager uses (it fetches the order itself, so the
button only needs `recoveredOrderId`). Rows recovered by the older flow, which
did not record `recoveredOrderId`, say "Order not recorded" rather than linking
nowhere.

**Verified against the live API and UI:** clearing the reason on cancelled cart
43 moved open 0→1 and cancelled 3→2 with `canceledAt: null`; rewriting it moved
them back to 0/3 with a fresh `canceledAt`. Test data restored. The Recovered tab
lists 11 carts with "10.6% of carts, ৳9,486 recovered", and View order opens
`ORD-20260831-8216DE`.

## 2026-09-04 — New `assignment.manage` permission

**Request:** "in roles add a permission option where superadmin can assign people
who can change assign in order manager and customer manager."

Reassignment used to be folded into `net_profit_orders.manage` / `customer.manage`
— anyone who could edit at all could also hand work to someone else. It is now
its own permission, ticked per role in Roles → **ASSIGNMENT / manage**.

- **One key for both managers** (user's choice): it is the same decision, and
  splitting it would make the superadmin tick two boxes to say one thing.
- **Required in addition to `manage`, never instead of it** — so the new key
  alone cannot grant access to an area the role otherwise has no rights in.
- **`RequirePermission` now takes multiple keys with AND semantics.** The guard
  accepts the old single-string metadata too, so a stale compiled handler cannot
  silently become unguarded.
- **`@Can()`** — a `(key) => boolean` param decorator fed by the guard's existing
  cached lookup, for the two checks a decorator cannot express: the assignee is
  one *field* on `PATCH /customers/:id`, and one *action* inside
  `POST /customers/bulk`. Both reject rather than silently dropping the change.
- **Migration `20260904060000_assignment_permission`** seeds the permission and
  grants it to every role that already holds either manage permission, so nothing
  breaks on deploy. Narrowing is then a deliberate act.
- **Admin UI** — the assignee selects in the Order Manager table, the Order
  detail modal, the Customers table and the customers bulk-assign control are
  *disabled* (not hidden) without the permission, with a title explaining why:
  who a job belongs to is worth seeing even when you may not change it.

**Verified:** `assignment.manage` exists as permission id 3066 and appears in the
roles grid as ASSIGNMENT / manage; `PATCH /net-profit/orders/6757/assign` still
returns 200 under the new two-key guard.

**Note:** this dev database has only the Super Admin role, so the auto-grant half
of the migration had nothing to grant here. The SQL is what matters in production.

## 2026-09-04 — Customers CSV export: selection + full column set

**Request:** "in localhost:3004/customers here selected row doesnt export fix that"
plus a 16-column list to replace the 9-column one.

**Selection now exports.** `exportHref()` only ever sent the filter bar, so
ticking rows and pressing Export silently downloaded the whole filtered set
(2,430 rows). The export endpoint takes `ids` (a CSV in the query string), and
when present it **ignores every other filter** — the admin has already picked the
rows, so re-applying filters on top could only remove rows they asked for. The
button now reads "Export N selected" so it is obvious which of the two it will do.

**Columns**, replacing Name|Phone|Email|Group|Completed Orders|Priority|Status|Assigned To|Joined:

Birth Date, Name, Address, Number, Email, Group, Order Count, Order Status,
Product Details, Assign To, Start Date, Last Order Date, Priority, Status,
Customer Feedback, Agent Feedback.

Header and cells come from one `columns` list so they cannot drift apart.
"Order Status" is new data — the status of the customer's most recent order,
which is a different question from "Status" (crmStatus, where the *customer* is).
It rides on the query `loadListExtras` was already running for the top-product
tally, so it costs no extra round-trip, and it is on the list DTO too.

**Also fixed: CSV escaping.** Only `name` and `assignedAdminName` were quoted
before. With free-text Customer Feedback and Agent Feedback columns, a comma or
quote typed by an agent would have shifted every later column of that row across
by one. Every cell is now quoted with `""` escaping, and rows are CRLF-joined.

**Verified:** exporting 3 selected ids returns exactly those 3 customers against
2,430 for the unfiltered export, with all 16 headers and a real "Order Status"
value (CONFIRMED). In the UI, ticking two rows changed the button to "Export 2
selected" with `?ids=5349,5348`.

## 2026-09-04 — Overview "Top Customers" was measuring the wrong thing

Reported as looking stale. The arithmetic was right; the definition was not.

**It ranked by money never collected.** The groupBy used `status: { not: 'CANCELED' }`.
Shop-wide that is ~2,850 PENDING/PROCESSING orders against ~470 COMPLETED, so the
list ranked customers by uncollected revenue — the top entry's ৳124,682 was 98.7%
a single PROCESSING order from 28 February that had sat unfulfilled for six
months. That same customer's `completedOrderCount` was 0 in the Customers module:
two definitions of customer spend in one admin panel.

**It was frozen.** All-time, so a handful of huge legacy `AEL-*` orders could
never be displaced and the same five names showed indefinitely.

Now `status: 'COMPLETED'` within a 90-day window (`ponytail:` fixed; make it a
query param if the window ever needs to be picked in the UI). `completedOrderCount`
and this list finally agree. The panel says "Completed orders, last 90 days" under
the heading — the previous label promised "Total Spending" while measuring
something else — and the empty state reads "No completed orders in this window."
`topCustomersWindowDays` is on the DTO so the caption cannot drift from the query.

**Verified:** the panel now lists five customers from recent completed orders
(top ৳1,950) instead of the frozen legacy five (top ৳124,682).

## 2026-09-04 — Customer detail: everything in one modal, profile page removed

**Request:** clicking a customer showed only a summary; the rest appeared only
after clicking through to "edit". Show it all up front, modern design, tabs in the
modal, and drop the separate page.

`CustomerDetailModal` is now the whole record. Identity strip (avatar, name,
favourite star, tier/priority/status/new-order pills, click-to-call phone,
mailto email, Facebook link, completed + total order counts) over six tabs, each
with a live count badge:

- **Overview** — all 29 stored fields in five labelled sections: Personal,
  Default address, CRM, Follow-up, Notes on the person. Empty fields render an em
  dash rather than vanishing, so the grid does not reflow between customers and
  "we have no birthday for them" reads as information.
- **Orders**, **Products**, **Notes** (add inline), **Calls** (dial + log
  outcome), **Activity** (timeline) — carried over from the old page.

`apps/admin/src/app/(shell)/customers/[id]/page.tsx` is deleted. The Order
Manager's "view customer" icon now points at `/customers?open=<id>`, which the
customers page reads once on mount — a deep link rather than a nested modal.
Failure in the call tab surfaces as text instead of `alert()`.

**Verified:** `?open=4766` opens straight into the modal with all 29 fields
populated; tabs report Orders 10, Products 7, Activity 67 and all render; adding
a note from the modal persisted and moved the Notes badge to 1; `/customers/4766`
now 404s and nothing else links to it.

## 2026-09-04 — Products list: "All products" page size

**Request:** the 10/25/50 page sizes needed an "all products" option.

`AdminProductQueryDto` gains an `all` boolean; `adminList` returns everything in
one page when it is set, bounded by `ADMIN_PRODUCTS_MAX_PAGE_SIZE` (1000).

**Why a flag and not just a bigger pageSize.** First attempt re-declared
`pageSize` on the subclass with a larger `@Max`. It failed at runtime with
"pageSize must not be greater than 100": class-validator MERGES a subclass's
decorators with the parent's, so `PaginationQueryDto`'s `@Max(100)` still ran.
Asking for the thing wanted beats trying to out-argue an inherited constraint.
The 100 cap stays in place for every other endpoint, which is right for anything
a customer can call.

Frontend: the table's page-size select gains "All products"; `toQueryString`
translates that selection into `all=true` and drops page/pageSize. The pager
(prev, numbers, next) hides when everything is on screen, and the footer reads
"Showing all N products" — or, if the catalogue ever outgrows the cap, "Showing
the first 1000 of N products — pick a page size to see the rest" rather than
silently truncating.

**Verified:** selecting "All products" renders all 84 rows in one page with the
numbered pager gone; `?all=true` returns 84 items.

## 2026-09-04 — District/thana typeahead across the admin panel

**Request:** the checkout's district/thana behaviour in New Order, then "same
change should be in classic view too" and "Create new customer disctric and
thana should do same too".

New `apps/admin/src/components/DistrictThanaFields.tsx` exports
`DistrictAutocomplete` / `ThanaAutocomplete`, wrapping the same `Autocomplete`
the storefront checkout uses — so staff taking an order over the phone can search
the way the caller speaks: English, Bengali (ঢাকা), or the older romanisation
(Comilla, Jessore, CTG). District is `allowFreeText={false}` (the 65 are the
complete list and `division` is derived from that exact string server-side);
thana is free text, since only two districts have curated area lists. Changing
district clears the area everywhere.

`Autocomplete` gained `inputClassName` / `menuClassName` / `optionClassName` /
`optionActiveClassName`, defaulted to the storefront's classes, so one component
serves both apps without either inheriting the other's look.

Swapped in four places, replacing `<select>` dropdowns: **New Order (modern)**,
**New Order (classic)**, **Create Customer** (CustomerAddressFields — also the
/customers/new page), and **Recovery → create order from abandoned cart**, which
was the last remaining copy of the old pattern.

**Verified:** `ঢাকা` ranks Dhaka above Dhaka Sub-Urban and `Comilla` finds
Cumilla in New Order; the classic view shows the autocomplete with no old select;
`যশোর` finds Jashore on Create Customer and commits as "Jashore".

## 2026-09-04 — Correction: a reason must not remove the cart from the funnel

Reported: "when i add cancel reason to them they are leaving from the funnel they
shouldnt leave the funnel they should just stay there and only the pending number
will change."

The earlier fix (same day, above) set `canceledAt` when a reason was written,
which dropped the row out of the default "open" view. Wrong: a row vanishing the
moment someone types in a cell reads as data loss.

`updateReason` no longer touches `canceledAt` or `recovered` at all — writing a
reason changes nothing about the cart's outcome. The workload/list split moved
into a filter instead: `hasReason` on the list endpoint. The sidebar badge and
bell send `hasReason=false` (count only carts nobody has written on); the funnel
table never sends it, so a cart with a reason stays exactly where it is.

**Verified:** writing a reason left the list at 14 rows with the row still
present, moved the pending count 11→10, and left `canceledAt`/`recovered`
untouched; clearing the reason returned the count to 11. Test data cleaned up.

**Note:** dev-DB artifact from the reverted behaviour — cart 43's `canceledAt` is
now 2026-09-04 instead of its original date. Only that one row, only locally.
