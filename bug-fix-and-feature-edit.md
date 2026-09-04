
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

## 2026-09-04 — Product edit: sticky action bar

**Request:** on `/products/[id]`, Cancel / Delete / Preview / Save & Exit / Save
should be sticky.

The product form is long enough that Save is off-screen for most of the editing,
so every small change cost a scroll back to the top. The header row that carries
those five controls is now `sticky top-16`.

- `top-16` parks it directly under AppShell's own sticky `h-16` header.
- `z-[5]`, below that header's `z-10`, so the two can never fight.
- `-mx-6 -mt-6 px-6 py-4` cancels `<main>`'s `px-6 py-6` so the bar spans the
  full width and sits flush — without it, page content would scroll through the
  24px gutters either side.
- `bg-surface` + `border-b`, so content scrolls behind it rather than through it.

**Verified:** after scrolling to y=2000 the bar's top is still 64px (exactly the
header's bottom edge), with all five controls — Cancel, Delete product, Preview,
Save & Exit, Save — visible in it.

## 2026-09-04 — Sticky action bar on the remaining editor forms

**Request:** the same sticky header for digital products, blog posts and
categories.

The class string moved into `apps/admin/src/lib/sticky-form-header.ts` as
`STICKY_FORM_HEADER` — one constant rather than eight copies, because
`top-16` / `z-[5]` / `-mx-6` are only correct in relation to AppShell and would
silently drift apart if each page kept its own. Applied to all eight editor
forms: products (new + edit), digital products (new + edit), blog posts
(new + edit), categories (new + edit).

**A sticky element only stays pinned while its PARENT is on screen.** Two pages
put a `SeoMetaCard` *after* the `</form>` (it renders its own `<form>`, so it
cannot be nested inside), which meant a bar parented to the form scrolled away
the moment the form ended. Caught in the browser on `/categories/2`: the bar
sat correctly at 64px, then read `top: -609` at scrollY 2627.

Fixed on `categories/[id]`, `categories/new` and `blog-posts/[id]` by hoisting
the bar out of the form to the page wrapper, with the submit button keeping its
form via the HTML `form="…"` attribute. The other five pages have nothing after
their form, so their bars stayed where they were.

**Verified in the browser:** `/categories/2` holds top=64 at scrollY 0 / 1500 /
2627 (page 3,516px) and its detached Save still fires the form's submit handler;
`/blog-posts/204` holds top=64 across a 6,425px page with Save wired to
`blog-post-form`; `/digital-products/new` holds top=64 at the bottom of a
2,290px page; `/products/92` was verified earlier.

## 2026-09-04 — Facebook: "og:image did not meet the minimum size constraint"

Reported from the Sharing Debugger on `/categories/amader-chatu`.

**Cause.** `cdnImageUrl` uses `fit=scale-down`, which never upscales — correct
for page images, wrong for a share card. The category's source image is
**150x150**, so asking for width 1600 returned 150x150 and Facebook rejected it
(its floor is 200x200). Measured every category: **all ten are 150x150**, so
every category page had a rejected og:image, not just this one.

**Fix.** New `cdnOgImageUrl` / `toOgImageUrl`, and all six og:image call sites go
through it — category, product, blog post, brand, collection and the site-wide
default in the root layout. Three of those (blog, brand, collection) were passing
the raw stored URL straight into the tag, so they never even reached the CDN.

The share card is now always exactly **1200x630**:
- `fit=pad`, not `cover` — it scales the whole image to fit and fills the rest
  with white, so a square product shot is centred on a card rather than having
  its top and bottom cropped away to make 1.91:1.
- `format=jpeg`, not `auto` — `auto` keys off the requester's Accept header and
  scrapers commonly send `*/*`. JPEG is the one format every scraper renders, and
  og:image is not a bandwidth-sensitive path.

**Also fixed: literal spaces in CDN paths.** Some uploads have a raw space in
their key ("…-ChatGPT Image Jul 23, 2026, 11_21_08 AM.png"). Measured: the raw
form fails to resolve at all, the `%20` form returns 200. `withCdnParams` now
encodes literal spaces only — a raw space is never valid in a URL, so this cannot
damage the already-percent-encoded paths the surrounding comment warns about.

**Verified against the live CDN:** the new URL for the chatu category returns a
200, `image/jpeg`, 42,329 bytes, and decodes to **1200 x 630** — the product shot
centred on white. Comfortably past Facebook's floor.

**Still worth doing (data, not code):** 150x150 upscaled ~4x is soft. Re-uploading
the category images at 1200x630 or larger would make the cards sharp; the code
change just guarantees a valid card whatever is uploaded.

## 2026-09-04 — Category editor: Save stays on the page

**Request:** saving a category kicked you out of the edit panel; stay there
instead.

`handleSubmit` always ended in `router.push("/categories")`. Now it takes an
`exit` flag, matching the product editor's long-standing split:

- **Save** (primary, submit) stays put, so editing a category — rename, then
  reorder its products, then adjust the banner — no longer means navigating back
  in after every change.
- **Save & Exit** (ghost) keeps the old always-redirect behaviour as its own
  explicit action.

A save that stays has to *say* something happened, or it is indistinguishable
from a click that did nothing, so it raises a "Category saved" toast.

On `/categories/new` the same split applies, with one difference: a new category
has no edit URL until it exists, so **Create category** hands over to
`/categories/<id>` via `router.replace` — staying on the create form would make a
second category on the next submit, and `replace` means Back goes to the list
rather than to a spent create form.

**Verified:** on `/categories/2`, Save leaves the URL at `/categories/2` and
shows "Category saved"; Save & Exit still redirects to `/categories`.

## 2026-09-04 — Save & Exit lands on the category you just edited

**Request:** after Save & Exit, be on that category, highlighted.

The editor's Save & Exit now pushes `/categories?highlight=<id>`. The list reads
the param, marks that row (`bg-brand-50` + an inset brand ring) and scrolls it
into view with `block: "center"` — the default `start` would park it under the
sticky header. The same applies after creating a category.

**Two implementations were wrong before this one, both worth recording:**

1. **Lazy `useState` initializer reading `window.location.search`.** This is a
   client component, so its first render happens on the server where there is no
   `window` — and React does NOT re-run an initializer during hydration. It
   silently produced `null` every time. Moved into a `useEffect`.

2. **Clearing the param with `history.replaceState`, plus a timeout to fade the
   mark.** Console-instrumented render logs showed the state going
   `null → 6 → 6 → null` within a second: the App Router re-renders the segment
   on the history change, and the timer then raced the row into and out of
   existence. Both removed. The param stays in the URL and the highlight stays
   until you next navigate here without it — which is every other route into this
   page.

**Verified:** `/categories?highlight=6` marks "Amader Achar" with a real computed
background (`rgb(232, 240, 254)`), in the viewport. End to end: editing category
9, pressing Save & Exit, lands on `/categories?highlight=9` with "Amader Rice"
highlighted and scrolled into view.

## 2026-09-04 — Order Manager assignment mirrors onto the customer

**Request:** "order manager assign will store in customer manager and can be
changed".

`OrderManagerService.assign` now writes the same staff member onto the order's
customer, so Customer Manager's "Assign To" reflects who is actually handling
them — the CRM no longer disagrees with the order queue. Both the per-row select
and the bulk assign action route through this one method, so both are covered.

- **One transaction**, so the two rows cannot end up disagreeing because the
  second write failed.
- **Guest orders** (`customerId` null) skip the mirror.
- **Unassigning mirrors too.** It is the same statement in reverse; mirroring one
  direction only would leave a customer pointing at someone who is no longer on
  any of their orders.
- **Customer Manager stays the override.** The mirror is not a second source of
  truth: editing the assignee there wins until the next order assignment.
- Permission-wise nothing new is needed — the assign route already requires
  `assignment.manage`, so the customer write inherits that gate.

Admin cache: `useAssignOrder` and the bulk-action hook now invalidate
`CUSTOMERS_LIST_KEY` (exported from useCustomers) on assign, or the Customers
table and the customer modal would keep showing the previous assignee.

**Verified against the live API** on customer 4766 / order 6751: assigning the
order set the customer to "Super Admin"; a Customer Manager PATCH cleared it back
to null; re-assigning the order set it again; unassigning the order cleared it.
Original value restored.

## 2026-09-04 — REVERTED: Order Manager assignment mirroring

The change logged immediately above ("Order Manager assignment mirrors onto the
customer") was reverted at the user's request. Order assignment writes only
`Order.assignedAdminId` again; Customer Manager's "Assign To" is once more an
independent field, set only from the Customers screen.

Reverted in three places:
- `OrderManagerService.assign` — back to a single `order.update`, no transaction
  and no customer write.
- `useAssignOrder` and the bulk-action hook — no longer invalidate the customers
  cache on assign.
- `useCustomers` — `CUSTOMERS_LIST_KEY` un-exported, back to a private
  `const LIST_KEY`.

**Verified:** assigning order 6751 (customer 4766) leaves the customer's
`assignedAdminId` at null, unchanged. No `CUSTOMERS_LIST_KEY` references remain
anywhere in the admin app. Both apps typecheck. Test data restored.

## 2026-09-04 — Fraud detection now uses bdcourier sitewide

**Request:** use bdcourier instead of Steadfast for sitewide fraud detection,
plus a place in the admin to set/rotate the API key.

`BdCourierFraudSource` (`providers/bdcourier-fraud-source.ts`) implements the
existing `FraudSource` interface — the swap point CLAUDE.net-profit.ADDENDUM.md §A
put there for exactly this ("a future BD courier-fraud aggregator plugs in behind
this same interface without FraudService's scoring logic changing"). Nothing in
the scoring, caching, checkout gate or admin board changed.

One `POST /courier-check` returns the phone's history across Pathao, SteadFast,
RedX, PaperFly, ParcelDex, CourierFast and CarryBee. `data.summary` feeds the
totals; each non-zero courier row feeds the stored breakdown (all-zero rows are
dropped — they say nothing about the phone).

**It REPLACES the Steadfast source rather than joining it.** `FraudService` sums
the totals of every source in `this.sources`, and bdcourier's response already
contains SteadFast's numbers — running both would count every SteadFast parcel
twice and inflate the success ratio the whole gate is scored on.
`SteadfastFraudSource` stays wired as the standby; swapping the two back is a
one-line change.

Every failure path returns `unavailable` (no key, non-200, malformed body, quota
exhausted, 8s timeout). FraudService already treats that as "no data" and defers
to `allowNoHistory` — a third party being down must never block a real sale.

**Admin credential UI** — new "bdcourier API Credential" card on
`/net-profit/fraud` → Settings. Shows configured/not-set, takes a new key to set
or rotate, and has a Remove key button. The key is write-only: it is stored via
`CredentialsService` (aes-256-gcm, encrypted at rest) under
`fraud.bdcourier.apiKey`, and `GET settings` returns only a `bdCourierApiKeySet`
boolean, never the key. Blank input means "keep the current key", not "clear it".
`BDCOURIER_API_KEY` in env is the bootstrap path for a fresh environment.

**Verified live.** `GET /check-connection` authenticated (user_id 2500). Saving
the key through the new card flipped the status to "API key configured" with the
key absent from the settings response. `POST /fraud/checks/01840193060/recheck`
returned totalOrders 24, delivered 24, successRate 1, riskLevel LOW, breakdown
REDX 8 / PATHAO 9 / STEADFAST 7 — matching the raw API response exactly.

**Quota warning.** The account is on **Free Basic: 50 calls total**, 47 remaining
after testing. Fraud checks run per unique phone at checkout, cached 72h
(`cacheTtlHours`), but 50 lifetime calls will not cover live traffic — a paid
plan is needed before this is relied on sitewide. When the quota runs out the
source returns `unavailable` and the gate falls back to `allowNoHistory`, so
checkout keeps working rather than breaking.

## 2026-09-04 — Nav: SMS + Fraud Detection moved, and fraud checks made faster

**Nav.** Courier Fraud Detection and SMS moved from Net Profit into **Orders &
Fulfillment**, right after Recovery — same reasoning as Order Manager and
Recovery before them: both are things you do TO an order as it arrives, not
profit reporting. Hrefs unchanged (`/net-profit/fraud`, `/net-profit/sms`), so
permissions and deep links are unaffected. Verified: the section now reads New
Order → Shipments → Order Manager → Recovery → Courier Fraud Detection → SMS,
and neither appears under Net Profit any more.

**Speed — the real cause was not the API.** Profiling found `CredentialsService`
re-deriving its AES key with `scryptSync` on **every** encrypt and decrypt.
scrypt is a deliberately expensive KDF: **measured at 57ms per call on this
machine**, and `scryptSync` blocks the event loop, so it stalled every other
in-flight request too. Every fraud check, courier dispatch and SMS send paid it.

Its inputs are one env var and a fixed salt, so the result cannot change while
the process lives — now derived once. Decrypted values also get a 60s in-process
cache (same reasoning as PermissionGuard's, and a save/delete invalidates its
entry immediately so an admin sees a rotated key take effect at once).

This is an app-wide win, not just a fraud one — every credential reader benefits.

Also fixed a regression from earlier today: `getSettings()` (called on every
checkout gate) used `hasCredential`, an uncached database round-trip. Switched to
the now-cached `getCredential`.

**Measured after:** `/fraud/settings` (reads a credential) median **47ms** against
a **39ms** baseline for `/fraud/savings` on the same auth+proxy path — so the
credential read costs ~8ms, down from ~57ms of blocking scrypt plus a query.
Cached fraud checks land in ~45ms.

**What is left is the third party.** A live check is **~860ms end to end**, of
which ~750ms is bdcourier itself (~485ms of that its TLS handshake). Nothing in
our code to reclaim there. The upstream timeout was cut from 8s to **3.5s** —
about 4x the observed worst case, so a slow-but-working response still lands
while an outage costs the shopper a moment instead of an abandoned checkout; the
gate then falls through to the configured no-history behaviour.

Not changed: the checkout badge's 800ms debounce. It looks like latency but is
protective — without it every keystroke of an 11-digit phone would spend an API
call, and the plan allows 50 in total.

**Quota: 13 of 50 used, 37 remaining.**

## 2026-09-04 — Order Manager "Origin" was a hardcoded constant

**Request:** an order created from Recovery should have Origin = Website.

Recovery orders **already** stored `channel: WEBSITE` (the schema default), so
the data was right. The problem was the display: `OrderManagerService` set
`origin: 'Web'` as a literal for every row and never read `Order.channel` at all.
Its own comment explained why — "every order today comes through the storefront
checkout, no admin manual-order-creation flow exists yet" — which stopped being
true once manual orders (`/orders/new`), wholesale and recovery were built.

So a manual order deliberately marked WhatsApp, Phone or Facebook still showed as
"Web". Of the first 100 orders, **16 were mislabelled**: 6 WhatsApp, 9 Phone,
1 Marketplace.

- The list query now selects `o.channel` and maps it through an `ORIGIN_LABELS`
  table (WEBSITE → "Website", TIKTOK → "TikTok", …). Anything unlisted falls
  through to the raw enum value, so a newly added channel is never blank.
- `createOrderFromIncomplete` now states `channel: 'WEBSITE'` explicitly instead
  of relying on the schema default — the cart was filled on the storefront and
  staff only pressed the button, and a change to that default must never
  silently reclassify recovered sales.

**Verified:** the Origin column now reads Website 84 / WhatsApp 6 / Phone 9 /
Marketplace 1 across the same 100 orders that previously all said "Web";
recovery orders show "Website"; flipping one order to FACEBOOK made the column
read "Facebook" and flipping it back restored "Website".

## 2026-09-04 — Recovery orders: Source = website, and one Origin label table

**Recovery Source.** `createOrderFromIncomplete` now sets `utmSource: 'website'`
alongside `channel: 'WEBSITE'`. Nothing is lost by writing it: `IncompleteOrder`
carries no UTM columns, so a recovered order has no original attribution to
preserve, and staff can still edit Source on the order afterwards.

**Verified end to end** by actually recovering cart 43: the created order
REC-MTMPWTT6 came back with `channel: WEBSITE`, `utmSource: "website"` and an
Origin column reading "Website". Cleanup: the test order was binned and cart 43
reset (`recovered = false`, `recovered_order_id = NULL`) with its original
cancel reason intact.

**Origin labels — my own duplication, caught by the user ("Origin should be
instore pos").** The label table I added to `OrderManagerService` in the previous
change immediately disagreed with the one the admin already owns
(`ORDER_CHANNEL_LABELS` in useOrders.ts): the backend said "POS" and "Phone"
where the detail modal says "In-store POS" and "Telemarketing", and it was
missing YOUTUBE and X entirely.

Fixed by deleting the duplicate rather than correcting it twice. The list
endpoint now returns the raw `OrderChannel` and `OrderManagerTable` renders it
through `ORDER_CHANNEL_LABELS`, so the column and the dropdown can never drift
apart again.

**Verified:** with an order set to POS the column renders "In-store POS"; the API
returns raw enums (WEBSITE / WHATSAPP / PHONE / MARKETPLACE) and the table shows
"Website" for them. Test order 6757 restored to WEBSITE.

## 2026-09-04 — Order Manager Source column: fbads kept, Facebook variants folded

**Origin** already comes from the detail modal's field — the previous change made
the list read `Order.channel`, and a WHATSAPP order shows WHATSAPP in both. No
further change needed; verified on ORD-20260816-8AEE35.

**Source.** The column is a `<select>` over a fixed `ORDER_SOURCES` list. A stored
`utm_source` outside that list selected nothing, so the cell rendered **blank and
the real UTM was invisible** — and one careless click overwrote it. Live data
already had one: `facebook-qa-test`.

- `fbads` added as its own option. Paid Facebook traffic stays separate from
  organic, because "how much came from the ads" is the question this column
  exists to answer.
- `canonicalFacebookSource()` folds messy real-world UTMs to the canonical
  option: `fb`, `FB`, `facebook.com`, `m.facebook.com`, `facebook-qa-test` all
  display as **facebook**, while `fbads`/`fb-ads`/`fb_ads`/`facebook-ads`/
  `facebookads` display as **fbads**.
- Anything not Facebook-related is shown **verbatim** as its own option rather
  than guessed at, so no source is ever hidden or silently lost.
- When the displayed label differs from what is stored, the cell carries a
  `title` — "Recorded as \"m.facebook.com\"" — so the raw value stays inspectable.

**Verified** by seeding four orders and reading the rendered cells: `fbads` → shows
"fbads"; `m.facebook.com` → "facebook" (tooltip: Recorded as "m.facebook.com");
`FB` → "facebook" (tooltip: Recorded as "FB"); `some-affiliate` → "some-affiliate"
verbatim. All four restored afterwards.

**Assumption flagged:** "else make it facebook" was read as *within Facebook
traffic* — anything Facebook-ish that is not the paid marker shows as facebook.
It does NOT rewrite unrelated sources (instagram, whatsapp, an affiliate tag) to
facebook, which would destroy attribution. Nothing is written to the database by
the display rule; it only changes what the cell shows until someone picks a value.

## 2026-09-04 — Order Manager: Origin and Source filters

Two new selects in the Order Manager filter bar.

**Origin** filters `Order.channel` — the same field the detail modal edits and
the Origin column reads, so filter, column and modal cannot disagree. Options use
the admin's own `ORDER_CHANNEL_LABELS` (Telemarketing, In-store POS…). WEBSITE is
listed even though staff cannot *set* it manually, because most orders have it
and it is the one people most want to filter by.

**Source** filters `utm_source` **the way the Source column displays it**, not the
raw string. Picking `facebook` also finds `fb`, `FB`, `facebook.com`,
`m.facebook.com`, `facebook-qa-test` but never the paid markers; `fbads` finds
`fbads`/`fb-ads`/`fb_ads`/`facebook-ads`/`facebookads`. A filter that only matched
the literal string would return fewer rows than the column above it shows, which
would make both untrustworthy. `No source` is its own option for the same reason
"Unassigned" is — absent already means "don't filter".

**The folding rule now lives in `@amader/shared`** (`order-source.ts`:
`ORDER_SOURCES`, `FB_PAID_SOURCES`, `canonicalFacebookSource`). Both ends need the
same answer — the admin renders the column with it, the backend builds SQL with
it — and this is exactly the mistake made earlier today with the Origin label
table, where a second copy in the backend immediately disagreed with the admin's.

**Verified against live data, counts reconciling exactly:**
- Origin: WEBSITE 3380 + WHATSAPP 6 + PHONE 9 + MARKETPLACE 1 = 3396 unfiltered.
- Source: none 3388 + facebook 5 + fbads 1 + instagram 1 + some-affiliate 1 = 3396.
- `utmSource=facebook` returned rows stored as m.facebook.com, FB,
  facebook-qa-test, facebook, facebook — and excluded fbads.
- `utmSource=fbads` returned only fbads.
- Combined `channel=WEBSITE&utmSource=facebook` = 3.
- Through the UI: choosing WhatsApp narrowed the table from 20 rows to 6, every
  one showing Origin "WhatsApp".

Seeded test values on orders 6754-6757 were cleared afterwards.
