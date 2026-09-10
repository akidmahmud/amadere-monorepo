
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

## 2026-09-05 — Web Push & Re-engagement (client request)

Browser push built as a third channel on the existing cart-campaign engine,
not as a parallel system.

**Database** — two migrations, kept apart because Postgres refuses to use a new
enum value in the transaction that adds it:
- `20260904100000_campaign_channel_web_push` — `WEB_PUSH` on `CampaignChannel`.
- `20260904100100_push_subscriptions` — `push_subscriptions`, keyed unique on
  `endpoint` because that IS the identity the push service issues: one row per
  BROWSER, so the same person on a phone and a laptop is two rows. `customerId`
  is a soft link an anonymous opt-in gets claimed into later. Dead subscriptions
  are marked `revokedAt`, never deleted, so the opt-in funnel stays measurable.

**Backend** — `modules/push`:
- `PushService` owns keys, encryption and the fate of a dead subscription, and
  nothing else. A 404/410 from the push service is not a retryable error — it
  means the browser is gone for good, so those endpoints are marked revoked
  rather than counted as failures.
- VAPID keys live in `CredentialsService` (encrypted at rest); env vars are the
  bootstrap path only. The private key is never returned by any endpoint.
- Public controller (`/push/public-key`, `/subscribe`, `/unsubscribe`) is
  unauthenticated and rate-limited — an anonymous visitor may opt in. Nothing
  there can send.
- Admin controller: settings, funnel stats, key generation, test send.
  `generate-keys` deliberately does NOT save: rotating invalidates every existing
  subscription, so saving is a second, explicit act.

**The campaign engine gained one branch.** `cart-campaigns.service.ts` dispatch
was `if SMS … else email`; it is now a three-way. Delay rules, the 5-minute
worker, quiet hours, retries, send-locking, per-step de-duplication, EN/BN merge
tags and delivery logging are all reused untouched. For push, the queue row's
`recipient` holds the customer id rather than a phone or an address, because one
person may have opted in on several browsers and all of them should get it.
Zero live subscriptions is recorded as a failure, not a silent success — the
delivery report would otherwise lie.

**Storefront** — `public/sw.js` does exactly two things: draw the notification
and open the right page. No fetch interception, no caching: a caching service
worker that gets a detail wrong serves stale prices. It also handles
`pushsubscriptionchange`, or a browser rotating its subscription goes quiet
without anyone noticing. `PushOptIn` renders nothing until an `add_to_cart`
fires — the browser grants exactly one permission prompt and a denial is
permanent, so it is spent at the moment of real intent, and our own card is
shown first so "not now" costs nothing.

**Admin** — Net Profit → SMS → Web Push Notifications: configured/not state, the
opt-in funnel (subscribed / known customer / lapsed), key entry and generation.
Web Push is selectable as a campaign template channel, with a note that it
reaches signed-in customers who allowed notifications.

**Verified end to end in a real browser.** Service worker registered at scope
`http://localhost:3001/` and became active; `pushManager.subscribe()` produced a
genuine `fcm.googleapis.com` endpoint; the storefront POSTed it and the row
landed (`active: 1`); the admin test send returned **`sent: 1, failed: 0,
revoked: 0`** — a real notification delivered through Google's FCM. The private
key was absent from every settings response.

**Note on the dev environment:** the backend on :3000 was serving a build from
before this module compiled (process started 23:32, module built 23:37) — the
stale-child trap this log has hit before. Killed and restarted; the routes 404'd
until then.

**Not built** (from the client's list, deliberately deferred): back-in-stock
"notify me" is a feature in its own right with no existing hook; segmentation UI,
click tracking and recommendations only make sense once the opt-in rate is known.

## 2026-09-05 — Back-in-stock alerts

The one item deliberately deferred from the push build, now added.

**Found by a sweep, not a hook.** Stock rises through many paths — an admin
editing the field, a cancelled order restocking its lines, a return, a CSV
import, a wholesale reversal. Hooking each one means every future path has to
remember to call us. `StockAlertsService.sweep()` asks the opposite question on a
10-minute cron — "which waiting alerts now have stock?" — which catches all of
them with one query and cannot be forgotten. A few minutes' delay on a restock
alert costs nothing.

**Model `StockAlert`** (migration `20260905090000_stock_alerts`), keyed on the
browser's push `endpoint` rather than an account: the shopper looking at a
sold-out product usually is not logged in, and requiring a login would lose most
of the people the feature exists for. The unique index is
`(endpoint, product_id, variant_id) NULLS NOT DISTINCT` — Postgres 15 (confirmed
15.18), without which two rows with a NULL variant would both be allowed and one
browser could be notified twice for the same simple product.

Guards in the sweep: an unpublished, ADMIN_ONLY or deleted product is never
announced as "back", because the customer still cannot buy it; a variant alert
reads the variant's own stock, since the parent Product row of a variant product
holds 0 by design; `take: 500` per tick, so one restock of a popular product
cannot fire thousands of sends at once; and rows are marked notified regardless
of delivery result, so a dead subscription is not retried forever.

**Storefront** — `BackInStockButton` appears in the PDP's out-of-stock state
(`PdpPurchasePanel`). One press subscribes the browser and registers the alert
together; a refusal leaves nothing behind. It says plainly what happened in each
outcome, including the iPhone case ("add Amader™ to your Home Screen first").

**Admin** — `POST /admin/push/stock-alerts/sweep` runs it on demand, for the case
that actually happens: stock is corrected by hand and whoever did it wants the
waiting customers told now, not within ten minutes.

**Verified end to end** on product 80: sold out → registered an alert (pressing
twice produced **one** row, not two) → sweep while still sold out notified
**0** → restocked to 12 → sweep notified **1** → immediate repeat sweep notified
**0**. Product 80's stock restored to 23 and the test alert rows deleted.

## 2026-09-05 — Why the WEB_PUSH campaign never fired (two real bugs + two by-design)

Reported: a WEB_PUSH template "akkid" at +1 minute produced nothing. Four
separate causes, found by reading the database rather than guessing.

**Bug 1 — push was keyed on customerId, which is NULL on every cart here.**
`enqueueForIncomplete` set the push recipient to `incomplete.customerId`, so the
step was skipped whenever there was no signed-in customer. Every abandoned cart
in this database has `customer_id: null` — shoppers fill a cart long before they
sign in — so the channel was dead on arrival, not merely limited.

Fixed by keying on the CART: `push_subscriptions` gained `guest_token`
(migration `20260905020000_push_subscription_guest_token`), the queue recipient
is now the cart id, and `PushService.sendToCart()` matches on guest token OR
customer id, so an anonymous shopper is reachable and a signed-in one's other
devices are too.

**Bug 2 — the guest token drifted, so subscription and cart never matched.**
The server issues the token, not the client: a cart request carrying an unknown
token comes back with a freshly issued one. Measured on a real run — the
subscription held `b0a9fe86…` while the cart the backend created was
`3b04070e…`, and the send matched zero rows (`push sent:0 failed:0 revoked:0`).
`persistGuestToken` now re-points an existing subscription whenever the token
actually changes. Best-effort and silent: a browser with no subscription has
nothing to re-point, and a failure must never disturb a cart update.

**Not bugs, but why the test looked dead:**
- *Quiet hours 22:00–08:00.* The worker returns immediately inside that window
  and it was ~02:00 locally. Nothing would have sent regardless.
- *Steps are enqueued once, at first capture.* Deliberate — `scheduledAt` is
  relative to the real abandonment moment — but it means a template only applies
  to carts abandoned AFTER it is created. The newest cart here predated the
  template by five days, so the queue was empty.

**Verified end to end**, with the tokens aligned and quiet hours temporarily
moved: queue row 4 (WEB_PUSH, cart 169) went `PENDING → SENT`, attempts 1, no
error — the campaign engine rendered the merge-tagged body ("hi Akiid buy") and
delivered it as a browser notification. Quiet hours restored to the 22–08
default afterwards.

**Still true and worth stating:** a WEB_PUSH template only reaches a cart whose
browser has agreed to notifications. Template 3 ("AKid") is PAUSED, so only
template 4 is live.

## 2026-09-05 — Product form redesign: built, rejected, reverted

A redesign of the product form was built and then reverted at the user's
request — recorded so nobody rebuilds it assuming it was never tried.

What was built (admin only, backend untouched): the Shipping tab deleted and its
duplicate weight field removed, SKU derived from the product name, min order
quantity no longer required, validation errors labelled with their tab, a
collapsible section component, and cartesian variant generation from the
selected attributes with a guard against saving variants left at 0.

Reverted with `git checkout --` on six files plus deletion of two new ones. The
form is back to 8 tabs and 10 required fields.

The analysis behind it still stands and is unchanged by the revert: 42 fields
across 8 tabs, 10 required fields spread over 4 of them, weight asked for twice.
If it is revisited, ask first which specific part felt wrong — the revert was of
the whole thing, so which parts were unwelcome is not yet known.

## 2026-09-05 — SKU fills from the name on create only

Requested: creating a product should derive the SKU from its name; editing one
must never change the SKU when the name changes.

`ProductFormFields` now derives the SKU (`AMD-FERMENTED-GARLIC-HONEY-400GM`)
from the product name, gated on `productId === undefined` — undefined on the
new-product page, set on edit, which is the whole distinction. Typing into the
SKU field stops the name driving it for the rest of the session, the same rule
the slug field already used. Derived rather than random because staff read these
off packing slips and courier labels.

Nothing else from the reverted redesign came back: 8 tabs, all 10 required
fields, weight still asked on both Pricing and Shipping, variants still built by
hand.

**Verified:** on /products/new an empty SKU became AMD-FERMENTED-GARLIC-HONEY-400GM,
then AMD-SUNDARBAN-KHOLISHA-HONEY on rename, and a manual "MY-OWN-CODE-1"
survived a further rename. On /products/24 the SKU stayed "Kholisha Honey 1kg"
across a rename.

**Found while testing, NOT fixed — the slug has the bug the SKU just lost.**
Renaming an existing product silently rewrites its permalink: product 24's slug
went from `sundarban-kholisha-flower-honey` to `renamed` simply by editing the
name, because `slugify` drops the Bengali characters and the parenthetical. That
is a live product URL — saving would break the existing link and its SEO. The
fix is the same one-line gate (`isNewProduct &&`) on the slug line, but it was
left alone because it was not asked for.

## 2026-09-05 — Order Manager: Courier Charge column

Requested: from the COD the courier collects, subtract the goods the customer
ordered, and show the remainder — the delivery charge — as a column just before
Invoice.

`courierCharge = Shipment.codAmount − (Order.subTotal − Order.discountAmount)`

Goods are sub-total **minus discount**, not sub-total: a discount comes off the
products, so ignoring it would report the discount as extra delivery charge.
Null until an order is consigned — there is no COD figure before that — and the
cell shows a dash rather than 0, because "not known" and "free delivery" are
different things. Negative values render in red.

Both figures were already stored; nothing new is fetched from Steadfast.
`Shipment.codAmount` is written at dispatch. The `codAmount` is also returned so
the cell carries a tooltip with the raw COD.

One SQL trap: `s` in the list query is a LATERAL subquery selecting only
`id, provider, status`, so `s.cod_amount` failed with
`column s.cod_amount does not exist` (a 500 on the whole Order Manager) until
`cod_amount` was added to that subquery's own SELECT.

**Verified:** column sits at index 16, Invoice at 17 — immediately before it, as
asked. Across the first 100 orders, 8 are consigned: ORD-20260731-30DBB8 shows
COD 710 − goods 650 = **৳60**, matching its shipping_amount exactly.

**What it exposes — worth looking at.** The COD figures we send are not
consistent, and the column makes that visible for the first time:
- ORD-20260731-30DBB8 → COD 710, delivery **60** ✓ correct
- ORD-20260731-FDD4F4 → COD 650, delivery **0** — the delivery charge was never
  added to the COD, so ৳60 went uncollected
- ORD-20260816-8AEE35 → COD 0, delivery **−2700** — consigned with no COD at all
- ORD-20260813-B3763E → COD 414, delivery 60, but its `shipping_amount` says 80

Three of eight consigned orders have a COD that does not match their own
shipping amount. That is a pre-existing data problem in what gets sent at
dispatch, not something this column introduced — but it is now visible per row.

### Renamed to "Courier Charge"

"Delivery Charge" was too vague about whose fee it is. The column and its API
field are now `courierCharge` / **Courier Charge** — it names the party, and the
table already speaks of Courier Send and Courier Status, so the vocabulary
matches. Verified still at index 16 with Invoice at 17.

Unrelated `deliveryCharge*` fields elsewhere (the Net Profit "Delivery Earned"
KPI, the wholesale order modal) were deliberately left alone.

**Worth knowing about what this number actually is.** It is the delivery portion
of the COD *we asked the courier to collect* — derived from our own records. It
is not necessarily what Steadfast finally deducts from the settlement. Their
`/payments/{payment_id}` endpoint returns the real per-consignment deduction; if
the two need to agree, that endpoint is the source to reconcile against, and it
is not wired up.

---

## Shipping Rules — the courier's own rate card, wired into checkout, New Order and Order Manager

Steadfast publishes a weight-banded rate card, and until now nothing in the app
knew it. Staff typed the delivery fee from memory, and the previous internal
estimate (`ShippingChargeCalculator`: flat base + per-kg + outside-Dhaka
surcharge) did not match Steadfast's published numbers for any parcel.

### What was built

**Shipments → Shipping Rules**, a fifth tab beside Shipping Rates. Pre-loaded
with the full card from `Stead-Fast_Delivery_Rate_Report.xlsx`, and every rule
is editable — bands, per-kg overflow, districts, delivery type — plus "Add rule"
for rates the sheet doesn't cover and "Reset to Steadfast rates" to get back.

The two tabs are deliberately separate, and it's worth being precise about why:

- **Shipping Rates** = one flat fee the CUSTOMER pays for a district.
- **Shipping Rules** = the COURIER's weight-banded price to US for that district.

They answer different questions. Folding one into the other would produce a row
that sometimes means a fee and sometimes means a rate card.

### The rate card, as shipped

Origin Gazipur. Home delivery: Dhaka ৳105/kg-1, Gazipur ৳60/kg-1, Dhaka
Sub-Urban and everywhere else ৳115 to 0.5kg then ৳135 to 1kg — all +৳20 per
additional kg. Point delivery (hub pickup): Gazipur ৳60 and elsewhere ৳120 to
1kg, +৳20/kg to 7kg, then flat slabs (8–10kg, 11–15kg, 16–20kg).

Steadfast rounds 100g–900g of *additional* weight up to a full kg, so overflow
is always `ceil()`'d — but the sub-1kg bands are matched on the raw weight, or
the ৳115 half-kilo band could never be reached.

### The checkout toggle

Off by default. **Off** — the storefront keeps quoting the assigned Shipping
Rates zones, exactly as before. **On** — the storefront quotes the calculated
rule amount instead.

The rules show as a suggestion in New Order and Order Manager either way. That
is the point of the toggle: what the courier bills us is not automatically what
the customer should pay.

Wired through `computeCheckoutFees`, which gained an optional `ruleOverride`.
A null override means "keep using the zones" and never means free — the caller
owns the DB read because the quote needs a parcel weight and that function is
pure. Both the cart preview and real order placement pass it, from the same
priced lines, so the previewed fee and the charged fee cannot drift.

### Where the suggestion appears

- **Order Manager modal** — next to the existing greyed "Courier est." line, a
  clickable **"Suggested ৳X — apply"**. Priced from the order's own items and
  shipping district; one click writes it to `shippingAmount`.
- **New Order (modern and classic)** — a fourth chip in Quick Shipping Fee,
  labelled with the matched rule. Held back until there is both a district and
  at least one line, since a quote with no district silently prices as the
  catch-all.

Nothing is ever written automatically. The courier's charge and what the
customer was quoted are two different numbers, and only staff can decide to
reconcile them.

### Notable decisions

- **No new table, no migration.** One row in `Setting` (`shipping_rules`), same
  reuse pattern as `ShippingZonesService`. One card, edited whole, read on every
  quote — a table would buy nothing but joins.
- **A rule is a dumb tier list**, not a formula. Steadfast's point-delivery
  ladder ("+৳20/kg to 7kg, then slabs") is spelled out as explicit bands rather
  than growing a second per-kg boundary field. Verbose seed, trivial model, and
  the admin table stays one editable grid.
- **One quote endpoint, three callers.** `POST /admin/shipping-rules/quote`
  takes an `orderId` (Order Manager), a draft `items` list (New Order), or a
  bare `weightKg` (the tab's calculator). Splitting that into three endpoints
  would triple the surface for one shared calculation.
- **Reuses `shipping_zone.view` / `shipping_zone.update`.** Both editors are on
  the same page doing the same job; a role that could edit one but not the other
  is a distinction nobody asked for.
- **Weight comes from the same `weightOverride` → `shippableWeight` precedence
  `ShipmentsService` uses** when it weighs a real parcel, so a quote and the
  actual dispatch cannot disagree. Two queries regardless of basket size.
- A malformed or missing Setting row degrades to the shipped Steadfast card
  rather than to an empty list — this value prices real parcels.

### Verified

`shipping-rules.quote.spec.ts` (5 tests) checks the shipped card against the
merchant's own rate sheet — base rates, ceil()'d overflow, the point slabs above
7kg, unweighed parcels, and that no match returns null rather than zero.

Live against the running backend:
- Every published rate reproduced exactly (Dhaka 1kg ৳105, 1.5kg ৳125, Gazipur
  ৳60, unlisted district 0.4kg ৳115, Gazipur point 9kg ৳200).
- Real orders priced by id — order 6760 at 7.25kg to Dhaka → 105 + ceil(6.25)×20
  = **৳245**.
- An unknown district is rejected on save (`Unknown district(s): Atlantis`)
  rather than silently never matching.
- **The toggle actually moves money.** With a test rule at ৳99 for Dhaka and the
  toggle ON, the cart quoted ৳99. Toggled OFF, the same cart quoted ৳80 — the
  zone rate. Restored to the real Steadfast card, toggle off, cart back to ৳80.

Nine `vat.service.spec.ts` failures are pre-existing and unrelated — identical
with these changes stashed.

---

## Deploy pipeline: CI can no longer reach the VPS — switched to a VPS-side pull

The `shipping rules` deploy failed. It was **not a code failure** — the job died
before it ran a single line:

```
2026/09/05 07:30:27 dial tcp ***:2222: i/o timeout
Error: Process completed with exit code 1.
```

That is the SSH connect in `appleboy/ssh-action`, before `git fetch`, before
`pnpm build`. Confirmed by prod still answering **404** on
`/api/v1/admin/shipping-rules` (localhost answers 401) — production never moved
off `97336d4`.

### The diagnosis

The decisive detail is `i/o timeout`, **not** `connection refused`:

- *refused* = the port is reachable and nothing is listening → sshd problem.
- *timeout* = packets are silently dropped → firewall/network blackhole.

And from an ordinary connection, ports 22, 2222, 443 and 80 on the VPS are all
open, with the site serving normally on all three hostnames. So sshd is healthy
and the box is fine — the drop is specific to the runner's source network.

This is the exact failure the workflow's own comment documents for port 22,
recurring one port later: **Hostinger's abuse filtering blackholes inbound SSH
from datacenter/cloud ASNs, which is what GitHub-hosted runners are.** Port 22
went first, CI moved to 2222, and now 2222 is caught too. A third port only buys
time until the next sweep.

### The fix: the VPS pulls, CI stops pushing

`deploy/poll-deploy.sh` + `deploy/install-poll-deploy.sh`. A systemd timer
checks `origin/master` once a minute and runs the same deploy steps when it
moves. **No inbound connection at all**, so no port and no source-ASN filter can
break it again.

`.github/workflows/deploy.yml` is kept but changed to `workflow_dispatch` only.
Left on `push` it would fail on every commit, and a permanently red master hides
real failures.

Install once, from a normal login user (not root):

```
cd /var/www/amadere-monorepo && sudo -E bash deploy/install-poll-deploy.sh
```

    watch a deploy : journalctl -u amadere-deploy -f
    deploy now     : sudo systemctl start amadere-deploy
    pause deploys  : sudo systemctl disable --now amadere-deploy.timer

Trade-off accepted: up to ~60s delay, and deploy logs move from the Actions tab
to `journalctl`.

### Things that had to be got right

- **`flock`, and a guard around it.** The timer fires every minute; a build
  takes several. Overlap is the normal case. Ticks that find the lock held exit
  immediately rather than queueing. The guard exists because `if ! flock` cannot
  distinguish "lock held" (exit 1) from "flock not installed" (exit 127) — the
  latter would report a phantom running deploy forever and silently ship
  nothing. Found while testing.
- **Silent when there is nothing to do**, so `journalctl -u amadere-deploy` is a
  log of real deploys and not 1,440 "up to date" lines a day.
- **PATH.** The single most common way a working script dies once it is moved
  into a systemd unit: systemd starts services with a near-empty PATH, so
  pnpm/pm2/node under nvm/corepack/fnm are invisible. The installer resolves all
  three against the real user's login shell and bakes them into
  `/etc/amadere-deploy.env`.
- **The deploy user is derived, not assumed.** First version of the installer
  refused to run as root — wrong for this box, which is logged into as root with
  a root-owned checkout and PM2 running as root. That is a perfectly consistent
  setup, and the refusal just blocked a correct install. It now takes the user
  from `stat -c %U` on the checkout itself, so the deploy runs as whoever
  already owns the files. Getting this wrong is silently destructive both ways:
  root onto a non-root checkout leaves root-owned `node_modules`/`.next` the
  next build cannot overwrite, and a normal user onto a root-owned checkout
  fails outright. It also warns if that user has no PM2 process named
  `backend`, since otherwise deploys would build and restart nothing.
- **The `.next` retry is preserved verbatim** — never delete `.next` before the
  build, only after a build failure, for the reasons the old workflow spells out.

### CRLF — a real bug, caught before it shipped

The scripts were written on Windows with CRLF endings, which on Linux is a hard
syntax error (`$'\r': command not found`). Added `.gitattributes` with
`*.sh text eol=lf` so it cannot regress on any machine regardless of that
machine's `core.autocrlf`.

Worth recording: the same Windows text-mode writes touched several `.ts` files
earlier, but `core.autocrlf=true` normalised them on commit — `c245024` records
minimal diffs (`5 +`, `8 +`), not whole-file rewrites. No pollution.

### Verified

- Local full production build: `pnpm build` → **6/6 tasks successful, exit 0**.
  The shipping-rules code was never the problem.
- `deploy/poll-deploy.test.sh` runs the real script against a scratch git repo
  with pnpm/pm2 stubbed — **6/6 scenarios pass on Linux**: up-to-date is silent,
  a new commit deploys, an immediate re-run is silent, a held lock skips, a
  freed lock deploys, and hand-edits on the server are discarded by
  `reset --hard`.

---

## Courier Charge from Steadfast's actual settlement (in progress)

Requested: derive the courier charge from what Steadfast **actually collected**
after delivery, not from the COD figure we asked them to collect.

### The discount math was already right

Worth recording, because it looked like a change was needed and it is not.

Requested: "total collected 1060, product cost 1000 → charge 60; and with a ৳10
discount, still subtract the **main** ৳1000, not the discounted price."

Delivery = collected − what the customer was actually charged for goods
= `cod − (subtotal − discount)`, which is algebraically identical to the shipped
`cod − subtotal + discount`. A ৳1000 order with a ৳10 discount collects ৳1050,
and `1050 − 1000 + 10 = 60`. The discount is added back, so the full undiscounted
subtotal is what gets subtracted — exactly as asked. No change made.

### The real gap: our COD figure is not the settled figure

`courierCharge` currently reads `shipments.cod_amount` — what we **asked**
Steadfast to collect. Three of eight consigned orders already disagree with
their own shipping amount (logged above). The authoritative number is what
Steadfast actually collected and paid out.

### Finding the endpoint

Steadfast's public docs list no settlement API. Found it by probing: made-up
paths (`/payment/list`, `/get_payment_list`, `/settlement/list`, `/invoice/list`)
all return a 404 HTML page, while **`/payments` and `/payments/list` return a
JSON 401** — the route exists, only auth failed.

**Warning recorded in the code for whoever probes this next:** a failed auth
returns `{"status":401,...,"attempts_left":N}` and **that counter decrements**.
Three attempts were burned (9 → 7) before this was spotted. Never retry-loop
against it and never probe with credentials you are unsure of — locking this out
would stop live dispatch.

The `.env` `STEADFAST_API_KEY`/`SECRET_KEY` are stale and return 401. The live
credentials live in the encrypted credential store, which is what the code
prefers (`.env` is only a fallback). Confirmed working without reading them, via
production's own balance endpoint: `{"balance":812}`.

### Built so far

- `CourierProvider.getPayments?()` — optional, presence-checked, same pattern as
  `fraudCheck`/`getBalance`. Returns the provider's **raw** payload: couriers
  shape settlements differently, and fixing a common type before seeing real
  data from more than one would be inventing an abstraction.
- `SteadfastCourierProvider.getPayments()` against `/payments` and
  `/payments/{id}`. Never throws — same contract as the other optional calls.
- `GET /admin/shipments/payments?provider=STEADFAST[&page=&paymentId=]`,
  read-only, `shipment.view`. Declared **before** the `:id` route so `payments`
  is not swallowed by the numeric-id matcher.

Deliberately stops here. The next step is to map the settled amount onto
shipments and switch `courierCharge` to prefer it — and writing that parsing
before seeing one real response would be guessing at field names.

Backend typechecks clean; courier specs pass (3/3).

---

## Courier Charge, part 2: settled COD + a real cost column

### What Steadfast's settlement API actually gives

Found by probing (`/payments` and `/payments/list` return JSON 401 while every
invented path returns a 404 HTML page). Live shape, verified:

- **Per payout**: `payment_id`, `amount` (total COD collected), `due_bills`
  (the delivery charges), `charges` (a small payout/bank fee), `total` (net
  paid). `amount − due_bills − charges = total`, exactly.
- **Per consignment**: `consignment_id`, `cod_amount` — **what they actually
  collected** — plus `status`. There is **no per-consignment delivery charge**.

Both checked against a real payout: `sum(consignment.cod_amount) == amount`
(43425), and `50250 − 8025 − 423 = 41802`.

### The formula was right; what it measures was not

The requested math (`collected − undiscounted subtotal`) is algebraically
identical to what already shipped, and the settled data confirms it: 20 of 21
orders had Steadfast collecting exactly what we asked.

But it measures **the delivery fee the customer paid**, not what the courier
charges us — ৳20/parcel against a real ৳157/parcel, because nine of those 21
orders charged the customer ৳0 shipping while Steadfast still billed ~৳130. And
`due_bills` cannot be divided down: that payout mixed 21 of our orders with 27
shipped outside this system on the same courier account.

So the column was split in two, as agreed:

- **Delivery Collected** — renamed from the misleading "Courier Charge". Same
  math, but preferring `settled_cod_amount` over `cod_amount`. A `~` marks a
  figure not yet confirmed by a payout.
- **Courier Cost** — priced off the Shipping Rules card (district + weight).

### Correction: the product weights were NOT broken

Earlier this log said weights were bad enough to block the rate card. Wrong, and
worth recording why: this is a **grocery business selling by the kilo** (the
company's own P&L sheet has rows like 35 kg of atta and 0.25 kg of jira gura),
so 10–11 kg parcels are normal, not corrupt.

Exactly **one** product is wrong: **Moringa Powder (id 20)** —
`shippableWeight = 1000` (should be 1) and variant *"Moringa Powder 250 gram"*
`weightOverride = 1000` (should be 0.25). Its 1kg and 500gm siblings are
correct.

With that one row excluded the rate card lands at **৳170.5/parcel against
Steadfast's actual ৳156.7** — within ~9%, and good enough to be the Courier Cost
column. Not fixed here: it is production data and was not asked for.

### Built

- Migration `20260905140000_shipment_settlement`: `settled_cod_amount`,
  `settlement_reference`, `settlement_status`, `settled_at` on `shipments`, plus
  a `consignment_id` index the sync needs. Deliberately separate from
  `cod_settlement_id` — that points at a `CodSettlement`, an accounting record
  with a party and cash account that staff create on purpose. **Nothing here
  posts to the ledger.**
- `SettlementSyncService` — walks payouts newest-first (doubling probe + binary
  search for the last page, since the API exposes no page count), stops once a
  whole page changes nothing, and reports under-collection rather than absorbing
  it. `POST /admin/shipments/settlements/sync`.
- Order Manager carries `settled_cod_amount` and a parcel-weight subquery; the
  rate card is read once per page and applied as a pure function per row.

### Verified

`settlement-sync.service.spec.ts` 4/4 against the real payout shape: writes the
collected figure, reports the ৳100 shortfall, skips rows already correct,
degrades cleanly for a courier with no settlement API.

Live: sync ran clean (11 payouts, 228 parcels, 5.9s) but matched 0 — the **local
dev DB is stale** (consignments 277–285xxxxxx vs current 288–292xxxxxx). On
production 21 of 48 matched by hand.

Both columns confirmed against real orders, and the gap is the point:

| order | Delivery Collected | Courier Cost |
|---|---|---|
| ORD-20260731-FDD4F4 | ৳0 | ৳105 |
| ORD-20260731-30DBB8 | ৳60 | ৳105 |
| AEL-4241 | ৳0 | ৳295 |

---

## Sales Report: per-source product P&L (the spreadsheet, in the app)

Reproduces the P&L the business keeps by hand ("Amader eBuy Limited — Aug 3,
2026"): product rows grouped by source, a Total per source, one Grand total.

**Quantities are in kilograms, not units** — the sheet has 5.5 and 0.25 — so a
line's quantity is multiplied by its variant weight, and cost is a rate per kg,
which is exactly what `Product.costPriceUnit` already means. `PER_G`/`PER_100G`
are normalised to a per-kg rate.

Arithmetic verified against the supplied sheet before writing any code:
`70 × 35 = 2450` product cost; `4205 − 2450 = 1755` profit;
`(11325 + 17826 + 3322) − 5780 delivery = 26693`; `26693 − 21000 = 5693` net.

### Decisions

- **Source mapping**: FACEBOOK + WHATSAPP + PHONE → "FB, WA & Call"; the
  wholesale module → "wholesale"; WEBSITE + APP → "website"; everything else
  falls into "other" rather than being silently dropped from the grand total.
- **Delivery** is what the courier bills us (Shipping Rules), not what the
  customer paid — a free-delivery order still costs us a delivery. Deducted once
  at the grand total, the same place the sheet deducts it.
- **`avg value`**: the sheet's own subtotal for this column SUMS the per-row
  averages, which is a pivot artefact and means nothing. The weighted average is
  used instead (30180 ÷ 128.6 = 234.7, not 11314.08).
- **On screen and in CSV, identical columns in identical order** — an export
  that differs from what is on screen is a second, unverifiable report.

### Fixed while building

- `order_items` has no `line_total`; revenue is `unit_price × quantity`.
- Date labels used `toISOString()`, which in +06 reports the **previous day** —
  a September report labelled `2026-08-31`. Now formatted from local parts, and
  the `to` label names the last day actually included.
- A bare `to` date parses to midnight, which would drop that whole day's orders.
  The window is half-open `[from, to+1day)`.
- CSV gets a UTF-8 BOM — without it Excel renders Bangla product names as
  mojibake.

### Verified

`product-pnl.csv.spec.ts` 10/10 — Saturday week start (the Bangladeshi working
week), whole-`to`-day inclusion, backwards ranges rejected, the spreadsheet
header and column order, source labelled on its block's first row only, and a
product name containing a comma staying quoted so columns do not shift.

Live: `GET /admin/net-profit/reports/sales/pnl` returns all four source blocks;
CSV downloads with the sheet's header and correct totals
(`1350 + 14556 − 380 = 15526`). New **P&L** tab under Reports & Profit
Analytics with Today / This week / This month / Custom, screenshotted and
confirmed rendering.

Backend and admin both typecheck; 22/22 specs pass across sales-report, courier
and shipping-rules.

---

## Homepage newsletter section: uploadable banner with the form on top

There was no way to upload an image because **the newsletter strip was not a
managed section at all** — hardcoded at the foot of the homepage, and built
deliberately without artwork ("no matching asset in this codebase").

Now a real `NEWSLETTER` homepage section, managed like every other block:
sort order, active toggle, the standard `MediaPicker`.

- **Two images, not one.** Desktop **1600×500**, mobile **800×800**. At 3.2:1
  the desktop banner is ~120px tall on a phone — physically too short to put an
  email field and a button on top of and still read them. Same desktop/mobile
  split `HOME_BANNER_TWO` already uses. Mobile falls back to the desktop image
  if left empty.
- Optional heading/subheading, plus a **darken toggle** for artwork that
  already carries its own text.
- Both images go through the CDN (`toDisplayImageUrl`, 1600px) rather than
  being served raw.
- The enum value needed **its own migration** — Postgres refuses to use a new
  enum value in the transaction that adds it.

**The old hardcoded strip is kept as a fallback**, rendering only while no
NEWSLETTER section exists. It is live on the homepage today, so removing it
outright would have left a gap until someone configured the replacement.

### Verified in a real browser

Desktop 1392×435 = **exactly 3.20:1**, desktop `<img>` shown and mobile hidden,
form inside the image bounds. At 390px wide it flips to **1.00:1**, exactly one
image visible, form still overlaid. Image confirmed loading through the CDN at
1600px.

Also regenerated the OpenAPI types for both apps (they were stale — the cause of
the earlier `settledCodAmount` cast). Zero source type errors in web or admin.

---

## Customer Campaigns: automatic email/SMS when a customer is added

Asked for: a campaign that messages a customer when they are added, by email or
SMS or both. **Not** the newsletter.

What already existed: an email campaign engine (newsletter subscribers only), an
SMS sender (order events only), and an abandoned-cart engine that already does
EMAIL/SMS/WEB_PUSH on a delay. What was missing was the join — campaigns target
`NewsletterSubscriber`, so a customer who ordered without ticking the newsletter
box was invisible to them, and the campaign queue is email-only.

### Built

`apps/backend/src/modules/net-profit/customer-campaigns/` — templates (channel,
subject, EN/BN body, delay, active/paused), a queue table, a 5-minute cron
worker. Two tables, no new enum values, so one plain migration.

- **A parallel pair of tables, not a generalisation of `cart_campaign_*`.** That
  engine is live abandoned-cart recovery; widening its schema to carry two
  subject types would put every existing recovery send at risk to save two
  tables.
- **Triggered by an event**, `customer.created`, with an `@OnEvent` listener —
  so `CustomersService` carries no dependency on the campaign engine and a
  failing campaign can never fail the customer creation that triggered it.
- **CSV bulk import deliberately does NOT emit it.** Importing an existing
  customer list would otherwise fire a welcome SMS at every one of them at once:
  a real bill and a spam complaint waiting to happen. Enrolling a batch on
  purpose is what the admin `enqueue` endpoint is for.
- **Recipient snapshotted at enqueue**, so editing a profile cannot silently
  redirect an already-queued message.
- **Unique on (customer, template, channel)** — the thing that stops a repeated
  enqueue from double-messaging somebody.
- **No WEB_PUSH channel**, unlike the cart engine: a push subscription belongs
  to a browser, and a customer an admin just typed in has no browser attached.
- **Off by default.** Turning it on starts messaging real people, so it is an
  explicit decision and never a side effect of deploying.

Admin page at **Marketing → Customer Campaigns** (chosen over Net Profit, where
its sibling engine lives, because staff already go to Marketing to write
outbound messages). Master switch, template editor, and a queue tab with
Send now / Cancel.

### Verified

Live against the running server:

| check | result |
|---|---|
| Engine **off** → add a customer | 0 queued |
| Engine **on** → add a customer | EMAIL today + SMS tomorrow, correct recipients |
| Re-enqueue the same customer 3× | still 2 rows |
| Customer with no email address | SMS step only |

`customer-campaigns.service.spec.ts` 5/5 — disabled sends nothing, **quiet hours
across midnight** (22:00–08:00 wraps, which is exactly where a naive
`hour >= start && hour < end` silently sends at 3am), a template paused after
queueing is SKIPPED rather than sent, and `{{first_name}}` is substituted before
sending.

Both admin tabs screenshotted and confirmed rendering. Test templates and queue
rows were deleted and the engine switched back off afterwards.

---

## Customer campaigns: HTML email + recurring sends

Follow-up to the campaign engine above, after two questions: "do I have to send
manually?" and "can we use a GPT-generated HTML template?"

**Sending was already automatic** — a 5-minute cron worker drains the queue on
each template's delay. "Send now" is only a test button, so a template can be
proven to deliver before the engine is switched on. The confusion was worth
recording: nothing in the UI said so.

### HTML email

`bodyHtmlEn` / `bodyHtmlBn` on the template, an editor field with a **sandboxed**
`srcDoc` preview (pasted HTML is not trusted to run scripts inside the admin),
and `{ html }` passed to the mailer.

The plain-text body is still sent alongside it, deliberately: some clients block
HTML outright, and a mail with no text/plain part scores worse with spam
filters. Merge tags are substituted into both.

### Recurring

A template is now either `CUSTOMER_ADDED` (fires once on signup) or `RECURRING`
(fires for everyone matching an audience). Audience is `ALL` or
`NO_ORDER_IN_DAYS`; `repeatEveryDays` is the cool-off.

- **A daily 2am scan**, not the 5-minute worker: "no order in 30 days" cannot
  meaningfully change between breakfast and lunch, and re-scanning the customer
  table every 5 minutes to find that out is pure waste.
- **`cycleKey` on the queue.** The dedupe index was
  `(customer, template, channel)` — which would have made a recurring campaign
  fire exactly once, ever. The cycle key ('once', or the enqueue date) lets
  legitimate repeats through while a second scan on the same day is still a
  no-op.
- **`recurringBatchSize`, default 200.** A first scan against a large customer
  table would otherwise queue tens of thousands of messages in one go — a real
  bill and a deliverability problem. The rest are picked up the next day.
- **Missing `repeatEveryDays` is treated as "never repeat", not "repeat
  constantly"** — the failure mode of the other reading is messaging the same
  person daily.
- Recurring templates are excluded from the signup enqueue, or a brand-new
  customer would get a "we miss you" the moment they join.

Spec 5/5, including quiet hours across midnight and merge tags reaching the HTML
body.

---

## Newsletter custom HTML was being silently mangled

Reported as "fix the newsletter campaign custom html field". Both the campaign
and template editors already HAD an HTML tab — the bug was on save.

Measured against a typical generated email template, `sanitizeCampaignHtml`
destroyed:

| | before | after |
|---|---|---|
| `target="_blank"` | stripped | kept |
| `<!--[if mso]>` conditionals | **stripped** | kept |
| `<!DOCTYPE>` | stripped | kept |

The Outlook conditionals are the one that matters: practically every generated
template uses them, and without them the layout breaks in Outlook. That is why
pasted templates "looked wrong".

**Fixed without weakening XSS protection.** Conditional comments are parked
before sanitizing and restored after, with their CONTENTS sanitized separately —
so the old IE conditional-comment script vector stays closed. Verified: a
`<script>` hidden inside a conditional is still stripped, while `<b>ok</b>`
beside it survives.

Two implementation notes worth keeping:

- **The placeholder must be plain text, not a comment.** DOMPurify deletes
  comments outright, so a comment-shaped placeholder vanished and took the
  conditional with it — the first attempt scored 12/14 for exactly this reason.
- **The check is a node script, not a `.spec.ts`.** `isomorphic-dompurify` pulls
  jsdom, which pulls ESM-only packages this app's ts-jest cannot transform. A
  `transformIgnorePatterns` fix opened a deeper ESM problem and was reverted;
  `sanitize-campaign-html.check.cjs` runs the same 14 assertions under plain
  node.

Also caught: one edit wrote literal NUL bytes into the util. File rewritten and
confirmed clean.

---

## Product preview opens in a new tab

Was a modal iframe; now a real tab.

The trap: the preview URL only exists after an async token call, and
`window.open` outside a user gesture is blocked as a popup. So the tab is opened
**synchronously inside the click** showing "Preparing preview…", and its location
is replaced once the token arrives. If the browser blocked it anyway, an
"open preview" link is shown rather than the click silently doing nothing; a
failed token closes the tab instead of stranding a blank one.

---

## Newsletter banner: overlay removed, and a real blur bug behind it

### The overlay is now opt-in

It shipped defaulting to ON, which darkened designed artwork nobody asked to
darken. Now off unless ticked.

Removing it exposed what it had been hiding: white heading text is unreadable on
a pale banner. So the heading gained a **Light/Dark colour choice** (defaulting
to Dark, matching bare artwork) and, when light text is used without the
overlay, a text-shadow — which lifts it off busy artwork without dimming the
whole image.

### The blurriness was a site-wide bug, not this section

Measured on the live banner: served **1200x375** into a **1392x435** box — a 16%
upscale.

Cause: `FULL_MAX_WIDTH = 1200` in the upload pipeline. **Every** uploaded image
is downsized to 1200px, so the CDN has nothing sharper to resize from
(`fit=scale-down` never upscales). This was not specific to the newsletter — the
hero banner is documented at 1882px and the ad banner at 1690px, and both have
been upscaled from a 1200px source all along.

Raised to **1920**. Safe on bandwidth: every placement fetches through
`cdn-cgi/image/width=...`, so the stored file is only the SOURCE the CDN resizes
from and shoppers still download a per-placement size. Only storage grows.

Verified: a 2245x700 source now yields a 1920x599 derivative (was 1200x375).

**Existing images are still 1200px** — the cap applies at upload, so banners
already in the library must be re-uploaded to benefit.

Known remaining limit: at DPR 2 a 1392px box wants ~2784px, so it would still be
slightly soft. Fixing that means `srcset`, which nothing else on the site uses.

---

## `tsc --noEmit` was silently passing everything in apps/admin

A runtime `ReferenceError: inputStyle is not defined` reached the browser from a
line I had "typechecked". Worth recording, because the verification method was
at fault, not just the typo.

`apps/admin/tsconfig.json` includes `.next/dev/types/**/*.ts`. That directory
held a **truncated** generated file (left half-written when a dev server was
killed mid-run), which tsc reported as a syntax error — and a parse error in any
included file makes tsc stop doing semantic analysis for the whole program. So
it emitted exactly one TS1128 and no type errors at all.

Proven both ways: with the corrupt file present, an injected
`definitelyNotDefinedAnywhere` produced no error; after deleting
`.next/dev/types`, the same injection correctly produced
`TS2304: Cannot find name`.

**So any "admin typechecks clean" in this log from before this point is
unreliable.** Deleting `.next/dev/types` (dev regenerates it) restores real
checking. Worth watching for after any killed dev server — the same truncation
broke a production build earlier in this session.

---

## Click-to-call in Recovery

The main funnel table already had `tel:` links. Three places did not:

- **Recovered** and **Trash** tabs — phone shown as plain text. Now linked,
  matching the funnel table.
- **Create order from abandoned cart** modal — the phone here is an editable
  `<input>`, not display text, which is why there was no link to click.

For the modal the call button sits **inside** the field, not beside it: the form
is a two-column grid, and giving the phone its own button cell would knock every
field after it out of alignment. It appears only once the field holds a number,
and the same treatment is on Alternative Phone.

Verified in the browser: `tel:8801840193060` present on the filled field, absent
on the empty optional one.

---

## Email templates (docs/EMAIL-TEMPLATES.md)

Three pasteable HTML templates — welcome, promotion, and a plain text-forward
one — for the HTML tab in Newsletter Campaigns, Newsletter Templates and
Customer Campaigns.

Table-based, inline styles, 600px, `<!--[if mso]>` conditionals. Dated-looking on
purpose: Outlook ignores `max-width`, Gmail strips much of `<style>`, and
flexbox is unsupported in several major clients.

**Checked against the real sanitizer, not assumed**: all three come through with
doctype, both MSO conditionals, `target="_blank"`, `bgcolor`, inline styles,
merge tags and table layout intact. Template 1 also rendered in a browser.

### Merge tags were inconsistent, and silently so

Writing the doc surfaced it: the customer-campaign engine used
`{{first_name}}`/`{{name}}` while recovery and cart campaigns use
`{{firstName}}`/`{{customerName}}`.

An unresolved tag renders as **empty, not literal text** — so a template moved
between those screens would quietly mail people "Hi ," and nothing would look
broken. The customer engine now accepts both spellings.

The doc carries a table of which tags actually resolve where. Newsletter
Campaigns currently resolves **none**, which is worth knowing before writing one
that expects `{{firstName}}`.

---

## Recovery: Send Email with a real preview

An **Email** action on each funnel row, shown only where the cart actually
carries an email address. Clicking it opens a preview of the exact message, and
Send delivers it.

### The email

Logo from Settings, a Bangla message, every product the shopper chose with its
image and price, the subtotal, an "অর্ডার সম্পূর্ণ করুন" button back to the
cart, and a WhatsApp button through to sales.

### Decisions worth keeping

- **Preview and send share ONE renderer** (`recovery-email.renderer.ts`). A
  preview that renders separately from what actually goes out is worse than no
  preview: staff would approve one email and mail another.
- **Missing pieces are dropped, not faked.** No logo configured → no logo block
  rather than a broken image at the top of the mail. No WhatsApp number → no
  WhatsApp button rather than a dead chat link. A product with no image → the
  image cell is omitted entirely, because an empty cell collapses and knocks the
  row out of alignment.
- **The button only renders where there is an email.** A disabled button on
  every phone-only cart would be three dead controls in a row.
- **The preview iframe is sandboxed** — this is real email markup and the admin
  is not the place to let it run anything.
- **A plain-text alternative is sent alongside the HTML**, same reasoning as the
  campaign engine: some clients block HTML, and a mail with no text part scores
  worse with spam filters.
- Sending increments `recoveryAttempts`, so the funnel's attempt column counts
  every channel rather than SMS only.

### Fixed while building

`WhatsappModule` did not export `WhatsappSettingsService`, so Nest failed to
resolve `RecoveryService` and the whole backend refused to boot
(`UnknownDependenciesException ... argument WhatsappSettingsService at index
[7]`). Exported it.

### Verified

Rendered a real row end to end: logo, Bangla copy, 4 products (one with no image
— degraded cleanly), subtotal ৳1,267, cart link, and the live WhatsApp number
from Settings. Screenshotted the rendered mail and the modal.

In the funnel, exactly **one** Send Email button appears across two rows — on
the one with an address, titled `Email rahim.test@example.com` — and none on the
row without. Test row created through the real
`POST /checkout/abandonment` capture path rather than by hand-editing the DB.

---

## Recovery email: editable wording

The copy was hardcoded in the renderer. Now editable in two places, on purpose:

- **Recovery → Settings** — the saved default everyone uses: subject, heading,
  message, and both button labels.
- **The Send Email modal** — "Edit text" opens the same five fields, seeded from
  the saved default, and the preview re-renders as you type.

**Modal edits apply to that one send and are never written back.** Personalising
a single chase must not silently rewrite the template the rest of the team
relies on.

### What is NOT editable, deliberately

The logo, the product cards, the totals and the WhatsApp button are generated
from real data on every send. There is nothing there for staff to get out of
sync with the actual cart.

### Details worth keeping

- `{{name}}` and `{{total}}` are the only tokens. An unrecognised token is left
  **as written** rather than blanked, so a typo shows up in the preview instead
  of silently deleting a word — the opposite of the merge-tag behaviour
  elsewhere, and the right call for copy someone is editing live.
- Preview moved from GET to POST so the body can carry the in-progress edits.
  It still writes nothing, so it stays on the `view` permission.
- The preview query keeps the previous render on screen while the next one is in
  flight, so the email does not blank out on every keystroke.
- Send re-renders through the same call the preview used, with the same
  override — what was approved on screen is what goes out.

### Verified

Default render fills the tokens (`Rahim Uddin, ... — ৳798`). A per-send override
replaces subject, heading, message and both button labels, confirmed present in
the HTML. Changing the saved default changes the default render, and reverting
restores it. In the browser, "Edit text" shows all five fields pre-filled with
the real Bangla copy beside the live preview.

**Self-inflicted, worth recording:** restoring the Bangla default over `curl -d`
in Git Bash silently corrupted it to literal `?????` — the shell mangled the
UTF-8 payload. Caught by checking the rendered HTML rather than trusting the
200. Rewritten via a UTF-8 file with `--data-binary`. Any Bangla sent to this
API from a shell needs the same treatment.

---

## Thank-you page: the confirmation gets its own URL

After placing an order the buyer stayed on `/checkout` — `CheckoutProvider`
swapped the form for `OrderPlacedPanel` in React state and the URL never
changed. No landing page to point analytics at, nothing to return to.

Now: checkout stores the placed order and `router.replace("/thank-you")`.

### Why the order travels in the browser, not a fetch

`GET /orders/:orderNumber` is behind `CustomerJwtGuard`, and most buyers here
check out as guests — so a thank-you page has nothing it could ask the server
for. The only public route is `POST /orders/track`, which needs orderNumber +
phone, and demanding a phone number seconds after paying is friction at the
happiest point of the funnel.

The browser already holds the full order the checkout call returned, so it
carries it across the redirect in `sessionStorage` (`lib/placed-order.ts`).

Accepted trade-off: the URL is not shareable and not reachable from another
device. Someone who loses it uses `/track`, exactly as before.

### The purchase event could have started double-firing

This is the part that mattered. `OrderConfirmation` fired `purchase` on mount,
and its own comment explained why that was safe:

> a page refresh loses the parent's `placedOrder` state entirely rather than
> re-rendering this, so there's no double-fire risk

That safety was an **accident of having no URL**. Giving the confirmation a real
one removes it — refresh and back-button both remount the component. A
duplicated purchase inflates conversions in GA4/Meta, distorts ROAS, and teaches
the ad algorithms to bid on the wrong thing.

So the guard is now explicit: `markPurchaseFired(orderNumber)` in
**localStorage**, not sessionStorage, so a new tab or a browser restart cannot
report the same order twice. The list is capped at 50 so a shared/kiosk browser
does not grow it forever. If storage is blocked entirely it fires anyway — a
missing conversion is worse than a rare duplicate.

### Other decisions

- **`router.replace`, not `push`** — Back from the thank-you page must not
  return to a checkout form for an order that is already placed.
- **Inline fallback kept.** The redirect only happens once the hand-off is
  confirmed present in storage; if the browser refused it, `OrderPlacedPanel`
  renders the confirmation in place exactly as before. A buyer must never be
  left staring at a checkout form after paying.
- **Direct visits degrade honestly** — "No recent order to show" plus links to
  Products and Track, rather than a blank page.
- Digital orders are untouched: they never reached the confirmation anyway, they
  go straight to downloads.

### Verified with a real order in a browser

Placed `ORD-20260906-55AC54` through the actual storefront checkout:

| check | result |
|---|---|
| URL after ordering | `/thank-you` |
| Order shown | ORD-20260906-55AC54 |
| `purchase` events | **1** — value 479, BDT, 1 item, `user_data` present |
| sessionStorage hand-off | order number present |
| **After refresh** | order still shown, **`purchase` fired 0 times** |

`lib/placed-order` guard checked separately, 8/8: first call fires, refresh and
back-button do not, a different order still fires, the list caps at 50 newest
first, and a blocked-storage browser still fires.

## Origin dropdown silently rewrote Website orders to WhatsApp

Opening a Website order in the Order Manager modal showed its Origin as
**WhatsApp**. The order was fine; the dropdown was lying.

`ORDER_CHANNELS` in `apps/admin/src/hooks/useOrders.ts` deliberately omitted
`WEBSITE`, on the reasoning that staff must not be able to *create* a manual
order claiming to be a website order. But that list feeds two places that are
not order creation:

- the Order Manager **filter** bar, and
- the detail modal's Origin **edit** dropdown.

New Order never used it — it keeps its own local `CHANNELS` — so the omission
bought nothing and cost correctness. A `<select>` whose `value` matches no
`<option>` renders the *first* option, and the first option was WhatsApp. So
every Website order displayed as WhatsApp, and saving anything else in that
modal would have written WhatsApp to the database.

### Fix

- `WEBSITE` added to `ORDER_CHANNELS`, first in the list.
- Removed the hardcoded `<option value="WEBSITE">` the filter bar had added to
  work around the omission — it now rendered twice.
- `CreateManualOrderDto`'s `@NotEquals(OrderChannel.WEBSITE)` is **unchanged**:
  a staff-typed order still cannot claim to be a website order. Only filtering
  and correcting an existing order accept it, and `UpdateOrderDetailsDto`
  already allowed it.

Verified in the running admin: modal Origin for `REC-MTQ5779T` now reads
**Website** (was WhatsApp), filter bar lists Website once, `tsc --noEmit` clean
after confirming `.next/dev/types/validator.ts` was intact.

## Facebook ad attribution — `fbads` / Website

No code change needed; verified the existing path end to end.

- `apps/web/src/lib/utm.ts` stores `utm_source` **verbatim** — it does not fold
  or normalise. Visiting the storefront with `?utm_source=fbads` writes
  `{"utm_source":"fbads"}` to the `amader_utm` cookie, confirmed in the browser.
- `packages/shared/src/order-source.ts` already treats `fbads` (and `fb-ads`,
  `fb_ads`, `facebook-ads`, `facebookads`) as the paid marker, kept distinct
  from organic `facebook`.
- A recovered order inherits the cart's UTMs and carries `channel: WEBSITE`.
  `REC-MTQ5779T` shows Origin **Website**, Source **facebook** — organic only
  because the test URL said `utm_source=facebook`.

**Action needed outside the code:** tag Meta ad destination URLs with
`utm_source=fbads`. Paid vs organic Facebook is decided entirely by that tag.

## Manual "N people bought" count in the product form

The PDP social-proof badge showed `SUM(order_items.qty)` over non-canceled
orders, which undercounts anything just launched or migrated from a legacy
site. Staff can now write the number themselves.

### The column already existed — and was dead

`Product.salesCountOverride Int?` was already in the schema and already read in
`ProductsService.getBySlug`, but **nothing could write it**: no admin field, no
DTO property. It had been sitting unreachable.

It is now `String? @db.VarChar(24)`. An Int could only ever print what the
compact formatter chose (1200 -> "1.2k"); staff wanted to write the badge
itself — `1k`, `1.5k`, `2k+`. Converted in place rather than adding a second
column beside a dead one; `USING …::text` keeps any existing value.

### Consequence: `salesCount` is display copy now

`PublicProductDto.salesCount` changed from `number` to `string`. The compacting
moved out of `WatchingNowBadge` and into the service, so one slot is formatted
one way whether it holds a hand-written override or a computed count — the
badge would otherwise format one case and not the other. The badge renders it
verbatim; nothing parses it.

Blank counts as unset at both ends (form sends `null`, service treats `""` as
absent), so clearing the box returns the badge to the real number rather than
printing an empty badge.

### Files

| file | change |
|---|---|
| `20260907100000_sales_count_override_text` | `ALTER COLUMN … TYPE VARCHAR(24) USING …::text` |
| `schema.prisma` | `salesCountOverride String? @db.VarChar(24)` |
| `create-product.dto.ts` | `salesCountOverride?: string \| null`, `@MaxLength(24)` |
| `products.service.ts` | `formatSalesCount()` helper; wired through create/update/duplicate |
| `products.mapper.ts` | exposed on `AdminProductDto` only — not on the public DTO |
| `WatchingNowBadge.tsx` | takes a string, renders verbatim; local formatter deleted |
| `useProductFormState.ts` / `ProductFormFields.tsx` | field in the Media tab, under Video URL |

### Verified end to end in the running apps

| step | result |
|---|---|
| Baseline `GET /products/gawa-ghee` | `salesCount: "169"` |
| Typed `1.5k` in the admin form, saved | API returns `"1.5k"` |
| Storefront PDP badge | **16 People watching • 1.5k People bought** |
| Reopened the form | prefilled `1.5k` |
| Cleared the box, saved | API back to `"169"` |

`formatSalesCount` checked separately, 8/8: 0, 169, 999 pass through; 1000 ->
`1k`, 1200 -> `1.2k`, 1500 -> `1.5k`, 12345 -> `12.3k`, 1000000 -> `1m`.
Backend, admin, web and `packages/ui` all typecheck clean (OpenAPI types
regenerated for both frontends after the `salesCount` type change).

## 81 seeded reviews for Talbina Package

Added to `packages/db/scripts/data/reviews_seed_data.json` (550 -> 631 rows)
and seeded with the existing `pnpm --filter @amader/db seed:reviews`. No code
was written — the loader, the synthetic-customer convention and the negative
`order_item_id` sentinel all already existed for the other 11 products.

Matched the `amader-fiber-mix` convention the reviews were meant to look like:
Latin reviewer name, Bengali comment, `status: APPROVED`, dates spread across
2025-09-01 to 2026-08-11 so the batch does not land on one timestamp.

Occupation and city ("গৃহিণী, ঢাকা") were dropped — `reviews` has no column
for them and the reference product does not show them. Confirmed with the user.

| check | result |
|---|---|
| Rows seeded | 81 created, 0 updated |
| `GET /products/17/reviews` | total 81, averageRating 4.84 |
| Breakdown | 68 x 5-star, 13 x 4-star (matches the source list) |
| PDP renders | "4.8 · (81 Reviews) · 84% / 16%", "Load more reviews (71 left)" |

### These are DEV-ONLY until seeded against production

Reviews are database rows, not code. `git push` deploys the repo; it does not
copy rows. The JSON file travels with the push, but nothing runs the seeder on
deploy — someone must run it against the production DATABASE_URL.

Note `amader-fiber-mix` does not exist in the dev database, and the seeder
aborts if ANY slug is missing, so the full 631-row file cannot run locally. The
talbina rows were verified by temporarily filtering the file to those 81, then
restoring it. On production every slug resolves, so the whole file runs — and
the loader is idempotent (upsert by email, update-if-exists per
product+customer), so re-running it will not duplicate the other 550.

## `--only=<slug>` for the review seeder

Production's dry run aborted on two slugs from the pre-existing 550 rows:

    amader-multigrain-sattu-amader-mixed-chatu-1kg-pack
    amader-desi-gmer-lal-ata-...-amader-lal-atta-220

Neither is new. Both products were re-slugged on production after their
reviews were seeded, so the file's slugs went stale. Verified read-only
against live: `multigrain-chatu` (id 59) already carries 49 reviews and
`deshi-gomer-lal-atta` (id 61) carries 50, and of the 20 live reviewers
sampled on 59, **20/20 match the long-slug block and 0/20 match `mixed-chatu`**
— so that block is already applied, not missing. Nothing is lost by skipping
them. (The `lal-ata` block is additionally byte-identical to the long one:
same 50 names AND comments.)

The all-or-nothing slug check is right — a typo must not half-seed a batch —
but it also let one stale slug block an unrelated new product. `--only=<slug>`
(repeatable) narrows the run; the all-or-nothing check still applies to
whatever survives the filter, and a slug with no rows in the file is its own
error rather than a silent no-op.

| check | result |
|---|---|
| `--only=amader-talbina-package --dry-run` | `81 of 631 rows`, "every product slug resolved" |
| `--only=talbina-typo` | aborts: "named slug(s) with no reviews in the seed file" |
| Re-run of the real seed | `0 created, 81 updated` — idempotent, no duplicates |

Left alone deliberately: the two stale slugs are still in the JSON. Correcting
them would re-target 100 pre-existing reviews at live products, which is a
data decision for the owner, not a side effect of adding talbina reviews.

## Product share cards were cropping half the artwork away

Shared to Facebook/WhatsApp, every product link showed a zoomed-in crop with
the top and bottom of the jar — and the label — cut off.

### Why

Scrapers render link previews at 1.91:1 and crop whatever they are handed to
that shape. **Every product image in the catalogue is square** (measured
14/14 at 1:1, mostly 1080x1080). The route was passing `fit=cover`, so
1080x1080 -> 1200x630 discarded **47% of the height**.

Every single-setting alternative breaks one requirement:

| setting | full image | side bars |
|---|---|---|
| `fit=cover` (was live) | no — crops 47% | none |
| `fit=pad` / contain | yes | **white bars** |
| stretch | yes | none, but squashes a square to 52% height |

`fit=pad` is not safe by default. Sampling the live catalogue's own og
sources: 9 of 14 have a near-white border (239-246, invisible when padded)
but 5 are clearly coloured — green (154,192,161), olive (126,134,100), tan
(190,173,137), (213,208,195), (204,193,170). Padding is seamless on two
thirds and an obvious bar on the rest.

### Fix — the card is generated, not cropped

New `apps/web/src/app/[locale]/products/[slug]/opengraph-image.tsx` draws the
photo twice on a 1200x630: a `fit=cover` copy blurred hard as backdrop, and
the complete uncropped square centred on top. The strips either side are the
photo's own colours, so there is nothing white to see and nothing cropped.

The backdrop is blurred because these are not plain product photos — they are
finished creatives with Bengali headline text running the full width. Drawn
sharp (tried first), the sides showed enlarged fragments of that same text as
a ghosted duplicate, worse than the bars it replaced. Cloudflare blurs at the
edge (`blur=120`), so it costs nothing here and compresses smaller.

Both layers are pre-sized by the CDN so satori only places them and never
scales anything.

`generateProductMetadata` no longer sets `openGraph.images`/`twitter.images`.
Next only falls back to the file convention when metadata does not name an
image itself — leaving it set would have silently kept shipping the crop.

### Two bugs found while verifying

- **`params` is a Promise** in Next 16 (page.tsx already awaits it).
  Destructuring it directly gave `undefined` for slug, the product fetch
  404'd, and the card rendered as the flat fallback colour — a silent, valid
  200. Caught only by inspecting the returned pixels.
- **`contentType` claimed `image/jpeg`** while ImageResponse always encodes
  PNG, publishing a wrong `og:image:type`. Now `image/png`.

### Verified on rendered pixels, not by reading code

| check | talbina | chia-seed |
|---|---|---|
| card size | 1200x630 | 1200x630 |
| centre vs FULL source at 630x630 | mean diff **(1,1,1)** — identical | **(1,1,1)** |
| centre vs the old cover crop | (34,33,47) — clearly not the crop | (36,34,47) |
| pure-white pixels in side strips | **0** / 359,100 | **0** / 359,100 |

Both cards also inspected by eye: whole creative legible, sides a soft wash of
the photo's own palette. `og:image` and `twitter:image` both point at the
generated card; `twitter:card` stays `summary_large_image`. Web typechecks
clean.

Categories/brands/blog/collections still use `toOgImageUrl(..., 'pad')` —
untouched, their sources are logos that must not be cropped.

## Dedicated SEO/share image per product

The product SEO tab had no image control — shares always used the primary
gallery photo, with no way to publish a different one.

### The field already existed and was deliberately ignored

`SeoMeta.ogImageUrl` has always been stored, and `SeoService.resolve` already
returns exactly the wanted precedence:

    ogImageUrl: meta?.ogImageUrl ?? fallback.imageUrl

`ProductsService.getBySlug` then threw that away with an explicit override
back to the primary photo. That override was added for a real reason: a
stored value was a hand-entered URL snapshot and went stale silently —
lal-ata's pointed at a `-full.webp` derivative no longer in the bucket, so
every share of it rendered blank while the product page looked fine.

So the fix is to delete the override (one line) and remove the reason it
existed, rather than to add a parallel mechanism.

### Why it is safe now

- The admin control is a **media-library picker, not a URL box**, so the
  value can only be a real `Media` row.
- It stores `media.url`, **not** `media.fullUrl`. `MediaPicker`'s `onChange`
  hands back `fullUrl ?? url`, and `fullUrl` is a generated derivative —
  precisely the kind of URL that went stale before. `onSelectMedia` fires
  after `onChange` and overwrites it with the canonical one.
- The chosen image renders next to the field, so a broken one is visible
  immediately. That is what made the stale value invisible last time.

### Clearing it had to be fixed too

`update: { ogImageUrl: dto.ogImageUrl }` — Prisma treats `undefined` as
"leave unchanged", and the admin sent `|| undefined`. Emptying the picker
would have silently kept the old image forever. `UpsertSeoMetaDto.ogImageUrl`
is now `string | null` (`@IsOptional()` skips null as well as undefined) and
the tab sends an explicit `null`.

### Verified end to end against the running API

| step | `seo.ogImageUrl` returned |
|---|---|
| baseline, nothing set | the primary photo |
| dedicated image stored | **the dedicated image** |
| cleared back to null | the primary photo again (matches primary: true) |

### Also driven through the real admin UI

Product 17, SEO tab: picked an image from the library, saved, and confirmed
the public API returned it over the primary photo — and that the stored value
was the canonical `...-ChatGPT-Image-....png`, **not** the `-card.webp`
thumbnail that was clicked or the `-full.webp` derivative `onChange` hands
back. Then Remove + Save, and the API fell back to the primary photo.

Backend and admin both typecheck clean; admin OpenAPI types regenerated for
the now-nullable field.

Not changed: `SeoMetaCard` (categories/brands/blog) still sends
`|| undefined`, so clearing an image there has the same latent no-op. Left
alone rather than changing other entities' behaviour as a side effect of a
product-only request.

## Staff could not see the shipping rule in New Order

Not a UI bug — a 403. Both quote endpoints were gated on `shipping_zone.view`:

    @Post('checkout-quote')  @RequirePermission('shipping_zone.view')
    @Post('quote')           @RequirePermission('shipping_zone.view')

That is the **Shipments settings** permission. The two endpoints it guards are
not settings — they are the price suggestion New Order and the Order Manager
modal show while someone types an order in. Any role with `order.create` but
without the shipping-settings permission got a 403, and since nothing in the
admin renders an error for it, the rule simply never appeared.

### Reproduced before fixing

Created a throwaway role with `order.view`/`order.create`/`order.update` and
nothing else, logged in as it, and called both endpoints:

    {"code":"FORBIDDEN","message":"Missing permission: shipping_zone.view"}

### Fix

Both quote endpoints now require `order.view`. `order.view` rather than
`order.create` because the Order Manager modal shows the same suggestion on an
existing order, and viewing is the lower bar. A quote reads no customer data —
weight and district in, price out.

`@RequirePermission` is AND, not OR, so "either permission" is not expressible;
picking the right single key is the fix.

| as the order-only role | before | after |
|---|---|---|
| `POST /admin/shipping-rules/checkout-quote` | 403 | **200** — ৳105, "Steadfast — Home, Dhaka" |
| `POST /admin/shipping-rules/quote` | 403 | **200** — ৳105 |
| `GET /admin/shipping-rules` (the editor) | 403 | **403**, unchanged |

The settings editor stays locked: staff can now see a suggested rate but still
cannot edit the rate card. Throwaway role/user deleted afterwards.

## Checkout quoted a delivery charge before it knew the address

With no district chosen, the checkout summary showed a confident delivery
charge that changed as soon as one was picked.

Both halves of the calculation fall through to a catch-all when the district
is missing — `quoteShippingRule` matches the rule with no district set, and
`resolveZoneFee` returns the default zone. Measured on a real cart, an
address-less checkout showed **৳135** ("Steadfast — Home, other districts"),
which is wrong in both directions: Dhaka is ৳125 and Rajshahi ৳155.

`CartService.serializePricing` now skips the calculation entirely when the
district is blank. Preview path only — `checkout.service.ts` is untouched,
since a real order always carries a shipping address.

| cart (same 1 item, ৳990) | shippingFee | grandTotal |
|---|---|---|
| no district | **0** | 990 |
| Dhaka | 125 | 1115 |
| Rajshahi | 155 | 1145 |

The existing UI already handles a zero correctly: `CheckoutProductCard` renders
"কুরিয়ার চার্জ প্রযোজ্য", the other two summaries gate their row on
`shippingFee > 0`, and `ShippingRatesNotice` already returned null without a
district. No frontend change needed.

Backend typechecks clean; 42 cart/shipping tests pass.

## Permission audit across every module

Scanned all 124 backend controllers — 620 routes, 519 of them admin — for the
same class of bug as the shipping-rule quote.

### Real finding: 9 permission keys nothing could ever hold

Controllers required these, but they were **absent from PERMISSION_CATALOG**,
so `seed.ts` never created the Permission rows and the RBAC editor never
offered them. No role could be granted them, so only a super admin (who
bypasses every check) could reach these features. Everyone else saw the
feature fail with no explanation — exactly the shipping-rule symptom.

| resource | keys | affected |
|---|---|---|
| `email_settings` | view, manage | Email settings |
| `invoice_settings` | manage | Invoice settings |
| `invoice_template_settings` | manage | Invoice template settings |
| `shipping_label_settings` | view, manage | Shipping label settings |
| `sitemap` | view, manage | Sitemap tools |
| `net_profit_recovery` | **view** (`.manage` existed) | every Recovery READ endpoint |

All added. Verified in the built catalog (9/9 present) and seeded into the dev
database: **177 -> 188 permission rows**, and they now appear to the role
editor.

### Corrected: there are NO unguarded admin routes

A first pass of the scanner reported 15. On reading each one, every single one
was a false positive — the scanner attached decorators to the preceding route.
They are all guarded, by `@RequirePermission` or `@UseGuards(SuperAdminGuard)`
(trash/restore are super-admin-only by design). Nothing to fix here; recording
it so the claim is not repeated.

### Noted, deliberately NOT changed

Some modules guard on another feature's permission:

    payments   /admin/payment-settings/bkash  -> net_profit_settings.manage
    push       /admin/push/settings           -> net_profit_sms.*
    catalog-feed                              -> analytics.*

Unlike the shipping-rule case these do not block a common workflow, and
re-keying them would **revoke access from every role that currently holds the
old key** until roles are re-edited. That is an operational decision, not a
side effect to slip into an audit.

## Disabled controls instead of missing ones

`useCan()` already existed but was used in only **4 places** in the whole
admin, all for `assignment.manage` — so lacking a permission produced a
missing control or a silent 403, never an explanation.

New `apps/admin/src/components/PermissionButton.tsx`:

- `<PermissionButton requires="brand.delete">` — a Button that disables itself
  and explains why on hover (`Button` already styles `disabled` with
  `cursor-not-allowed` + 50% opacity).
- `<PermissionGate requires="...">` — the same for a panel or form; dims and
  disables pointer events, or takes a `fallback`.

Disabled rather than hidden on purpose: an absent control is
indistinguishable from a broken page, which is precisely how the shipping-rule
403 read to staff. A greyed-out button names the permission to ask for.

Applied so far: brands (create/edit/delete), discounts (create/bulk delete).
**The rest of the admin is not yet converted** — the mechanism is in place and
adoption is a one-line change per button, but it is a large mechanical sweep
and is deliberately not claimed as done.

Shared, backend and admin all typecheck clean.

### Production step

`PERMISSION_CATALOG` additions only reach a database when the seed runs:

    pnpm --filter @amader/db prisma:seed

Idempotent and safe to re-run — every seeded row uses `update: {}` (it will
not overwrite customised email templates) and it skips Super Admin creation if
that user exists. It needs `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` present
or it throws before doing anything.

## bKash gateway payments were invisible in the admin

Reported: a customer paid ৳430 by bKash (PGW, MerchantOrderID ORDER-11127,
trxID DI709NWKN8) and nothing showed in Net Profit > Payments.

Nothing was lost. The order was marked paid and confirmed correctly — there
was simply **no screen anywhere that showed the payment**.

### Cause

Two different things, one name:

- `ManualPayment` — a customer's CLAIM ("I sent money, here's my trx id"),
  awaiting staff verification.
- `Payment` — the real row, which the gateway captures itself.

Net Profit > Payments listed only ManualPayment and advance payments.
`BkashCallbackService` states the mismatch in its own comment — it is "built
around a ManualPayment row this flow never creates". And `payment.findMany`
appeared **nowhere in the entire codebase**, so gateway payments had no admin
surface at all.

Measured on the dev database once the view existed: **53 gateway payments,
৳31,563.40 captured**, none of which had ever been visible.

### Fix

New read-only module `net-profit/gateway-payments`:

    GET /admin/net-profit/payments/gateway?provider=&status=&q=

with a **Gateway Payments** tab on the same page. Columns: date, order number,
provider, status, transaction id, amount, refunded — plus a captured total for
the current filter, and search across transaction id or order number.

Deliberately no verify/reject: these are already CAPTURED by the provider, so
an approve button would be theatre. The screen exists to be reconciled against
a bKash/Nagad merchant statement, which is why `transactionRef` is the field
that matters. COD is excluded from the default list — that money arrives via
courier settlement, which has its own screen.

`OrderPaymentDto.transactionRef` is now exposed too, so the same id is
readable from the order itself. Reuses `net_profit_payments.verify` rather
than minting a key, since it sits on the same screen and is the same job.

### Verified

Inserted a CAPTURED BKASH payment of ৳430 with trx `DI709NWKN8` and queried
the endpoint as a super admin:

    capturedTotal: 31563.4   total rows: 53
      REC-MTQ5779T  BKASH CAPTURED  ৳430  trx DI709NWKN8
      ORD-20260831-D3A388  BKASH CANCELED  ৳1380  trx TEST-RESV-1
      ORD-20260831-D717ED  BKASH PENDING   ৳499   trx TR0011q7SOjiN...

Backend and admin typecheck clean.

## Credentials were reachable through the generic settings API

Settings showed 83 rows, 14 of them `credential.*`.

### What was NOT wrong

Those values are **not plaintext**. `CredentialsService` encrypts with
AES-256-GCM, key derived by scrypt from `CREDENTIALS_ENCRYPTION_KEY` via
`getOrThrow` (no insecure default). Confirmed by inspecting stored values:
ciphertext, not readable secrets. The public `/settings/site` endpoint is also
fine — it whitelists 11 named keys and cannot dump the table.

### What was wrong

**Reading.** `GET /admin/settings` returned every row, including all 14
credential ciphertexts, to anyone holding `setting.view`. Ciphertext is not
plaintext, but handing it to a low-privilege settings role is free material
for an offline attack and buys nothing — each credential already has its own
screen that reports only whether it is set.

**Writing — the sharper bug.** `PUT /admin/settings/:key` writes the value
RAW. Pointed at a credential key it replaces valid ciphertext with a plain
string, so `CredentialsService.readCredential`'s decrypt throws and it returns
**null**, while `hasCredential()` still returns **true** because the row
exists. The screen would keep reporting bKash/SMTP/Steadfast as configured
while the integration silently had no credential at all.

### Fix

`credential.*` is now excluded from `SettingsService` entirely — list, get and
upsert. Enforced in the service, not the controller, so any future caller
inherits it. `get()` returns the same "not found" as a missing key rather than
confirming which credentials exist.

| check | result |
|---|---|
| `GET /admin/settings` | **69** rows (was 83), **0** `credential.*` |
| `GET /admin/settings/credential.payment.bkash.appSecretKey` | 404, same as a nonexistent key |
| `PUT` a raw value over that key | **400** with an explanation |
| `PUT site_name` (a normal setting) | still works |

Credentials remain editable through their own screens, which encrypt properly.

### Self-inflicted, then repaired

Verifying step 4 I sent the Bangla site name through `curl -d`, which mangles
UTF-8 — it stored `site_name` as `"??????"`. Caught it in the response and
restored `"আমাদের"` via Prisma. Noted because this is the second time in this
session that `curl -d` has corrupted Bangla; use `--data-binary @file`.

## Settings page: raw JSON replaced with real controls

The bottom of Settings printed all 69 rows as
`JSON.stringify(value, null, 2)` inside a `<pre>` — a boolean read as `true`
in a code block, and changing anything meant hand-editing JSON that rejected
the save on a stray comma.

### The shape of the data decided the design

Profiled the real table (credentials already excluded): **47 of 69 values are
plain scalars** — 20 numbers, 15 booleans, 12 strings. Only 22 objects and 1
array are genuinely arbitrary JSON. So most of that screen never needed to be
JSON at all.

New `components/settings/RawSettingsBrowser.tsx`:

- **Boolean** -> a toggle that saves on the spot (nothing to type, so a Save
  button would only add a step).
- **Number / string** -> a typed input with Save, enabled only when changed.
- **Object / array** -> still a JSON editor, but folded behind an "Advanced"
  button with a `3 fields` / `5 items` chip, instead of being the default
  presentation for everything.
- Keys are grouped and collapsed. `net_profit.*` is 46 of 69 on its own, so it
  splits one level deeper (`net_profit.advance_payment`, ...) or it would
  swallow the page.
- Search across key and humanised label; a search force-opens every matching
  group, otherwise a hit stays hidden behind a collapsed header and the search
  looks broken.
- Each row shows a human label ("Always On Enabled") with the raw key in
  monospace beneath, so it stays greppable.

The whole block is retitled **Advanced settings** and sits below the
purpose-built screens, with a line saying most keys should be changed there.

### One UI-kit gotcha worth recording

`<Card className="p-0">` does not work: admin-ui's `cn` is plain clsx with no
tailwind-merge, so Card's own `p-[22px]` survives alongside the override and
wins. Every group header rendered ~100px tall for one line of text. Swapped
for a plain div carrying the same tokens.

### Verified in the browser

Zero `<pre>` blocks remain. Groups collapse/expand, and clicking the
`alwaysOnEnabled` toggle wrote `false -> true` to the database (confirmed by
querying it, then restored to `false`).

## Drag-and-drop reordering for product images

The Media section could only promote an image to first ("Make primary").
Every other position was unreachable — a 5-image gallery could not be put in
a chosen order.

`ProductMediaGallery` now supports dragging a thumbnail onto another to move
it there. Order is the meaning: `mediaIds` is sent in gallery order and the
first entry is the primary image, so this is the same operation "Make
primary" performs, generalised to any position.

### Native HTML5 drag, no dependency

- `draggable` on the **image area only**, not the whole card, so the alt-text
  input stays selectable — a draggable ancestor swallows text selection in
  child inputs.
- The **whole card** is the drop target, for a generous area to aim at.
- `preventDefault()` in `onDragOver`, without which the browser never fires
  `onDrop` at all.
- `dataTransfer.setData()` in `onDragStart` — Firefox refuses to begin a drag
  otherwise.
- Drag state is tracked by **id, not index**, so a re-render mid-drag cannot
  mis-target a card.
- Feedback: the dragged card dims to 40%, the hovered target gets an amber
  ring, a grip dot-grid appears on hover, and a hint line explains the
  interaction and what "first" means.

`moveToFront` is kept. It is the touch and keyboard path — HTML5 drag events
do not fire on touch — and it stays the one-click way to do the common thing.

### The first attempt was too subtle, and was called out

A hover-only grip on a thumbnail tells nobody the grid is sortable. Replaced
with an **always-visible handle bar** across the top of every card: a grip
icon and the word "Drag" on the left, and the position on the right —
`Primary`, `#2`, `#3`, `#4`. Order is now readable without counting, and the
control announces itself before the pointer arrives.

The image stays draggable too; both sources share one `dragSourceProps(id)`
helper so they cannot drift apart. The old hover grip and the separate
"Primary" star overlay were removed as redundant once the bar carries both.

### Verified in the browser

Firing every drag event in ONE evaluate call proves nothing: React has not
flushed `dragId` from `dragstart` before the `drop` handler's closure reads
it, so the list never moves. That is a artefact of the test, not the feature.
Driven correctly — one event per call, as a real drag does across separate
tasks — dragging the 4th image onto the 1st gave:

    before:  family-combo, combo-thumbnails, ramadan-mubarak, free-air-tickets
    after:   free-air-tickets (Primary), family-combo (#2), combo-thumbnails (#3), ramadan (#4)

Badges renumbered correctly. The reorder algorithm was also checked in
isolation, 6/6, including that dropping onto slot 1 produces exactly the same
array as `moveToFront`.


## Customer card claimed every shopper was new

The order detail modal's Customer card showed **"0 order(s)"** for a phone
with 10 prior orders.

It was a hardcoded string literal — `<p>0 order(s)</p>` — never wired to
anything, so it read 0 for every order ever opened.

### Counted by phone, not customerId

Most orders here are guest checkouts with no customer record, so a
customerId-based count would read 0 for exactly the repeat shoppers staff most
want to recognise.

Matching the raw phone string would also under-count badly. Measured across
all 3,074 shipping addresses: **2,980 stored as `01…`, 52 `+` prefixed, 35
`880…`**, and the reported customer appears as BOTH `01840193060` and
`8801840193060`. Every form ends with the same last 10 digits, so that is what
is compared (`phone: { endsWith: last10 }`).

Computed in `adminGet` only — the list endpoints do not pay for it per row.

| check | result |
|---|---|
| `GET /admin/orders/6681` | `customerOrderCount: 11` |
| Orders behind it | 11 rows, spanning both stored phone formats and 3 guest `REC-*` orders with `customerId: null` |
| Modal now renders | **"11 orders"** (was "0 order(s)") |

11 includes the order being viewed, so 10 are prior — matching the reported
count exactly.

## Promo video thumbnail could not be removed

The Thumbnail section offered Upload and Choose from Library, with no way to
clear one.

Added a **Remove Thumbnail** button, shown only when there is one. Clearing
falls back to the platform's own poster (YouTube and friends supply one), so
it is a real choice rather than an undo.

### The button alone would not have worked

Same trap as the SEO image: `thumbnailUrl: dto.thumbnailUrl` in a Prisma
update treats `undefined` as "leave unchanged", and the panel sent
`thumbnailUrl || undefined`. Removing a thumbnail would have silently kept the
old one. `CreatePromoVideoDto.thumbnailUrl` is now `string | null` and the
panel sends an explicit `null`.

Verified against the API: `PATCH {"thumbnailUrl": null}` on video 3 returned
`thumbnailUrl: None`, and the original was restored afterwards.

## Product Video: spacing and YouTube chrome

### Spacing — it was `mt-10`

The card carried `mt-10` = **2.5rem = 40px** top margin. With its own `p-6`
(24px) padding and the heading's `mb-4` (16px), that is ~64px between the
tabs card and the words "Product Video" — on a phone it read as the section
having drifted loose. Now `mt-5` (20px) and `mb-3` (12px): **40px -> 20px**.

### YouTube's buttons — what is actually removable

Being straight about the limits: YouTube's embed used to accept `showinfo=0`
and `modestbranding=1` to drop the title bar and the watermark. Both are
retired — `showinfo` was removed outright and `modestbranding` is now a
no-op. **No parameter hides the title, the channel avatar or the YouTube
wordmark**, and stripping them by other means is against YouTube's terms.

`controls=0` does still work, and it removes the entire bottom bar: progress,
volume, captions, fullscreen. It also removes YouTube's play button — which is
the opening this uses.

New `ProductVideoPlayer` renders a **click-to-load facade**: the video's own
poster with one custom play button and nothing else. Only on click does the
iframe load, from `youtube-nocookie.com` with
`controls=0&rel=0&iv_load_policy=3&playsinline=1`.

- Before play: a clean poster, one play button. Exactly what was asked.
- During play: no control bar. YouTube's title/watermark may still surface —
  the only way to be fully rid of those is to host the file instead of
  embedding YouTube.

Two things that came free: no YouTube cookie until someone chooses to play,
and the ~1MB of player JS that every product view used to download is now
deferred until a viewer actually wants to watch.

Non-YouTube URLs keep the previous plain-iframe behaviour — those params are
YouTube's, and guessing at another host's would be worse than leaving it.

### Product video, continued: real controls and no title

The first pass used `controls=0` alone, which was too blunt — it removed
pause, mute and the progress line along with the branding. Three further
problems surfaced, each found by driving the real page:

**1. No controls.** The player is now driven through YouTube's IFrame API and
the useful controls are rebuilt: play/pause, mute, a seekable progress line
and elapsed/total time. Captions, fullscreen, the channel avatar and the
wordmark are simply never drawn.

**2. The title was still visible.** `controls=0` hides YouTube's chrome WHILE
PLAYING, but the instant the player is unstarted or paused it draws its own
title card — title, channel, subscriber count, a big red button, related
videos — INSIDE the iframe. A transparent overlay cannot help: YouTube paints
it, so blocking clicks leaves it perfectly readable. Fixed by keeping an
**opaque poster over the frame whenever `playing` is false**. The iframe is
only ever visible while actually playing, which is precisely when YouTube
shows nothing. Confirmed by hit-testing the top strip of the video: it returns
our cover, not the iframe.

While playing, a transparent sheet takes the tap instead of the iframe, so
YouTube's overlay never appears mid-video — and the tap still toggles
playback, so it behaves as expected.

**3. The video played behind the poster.** Measured on the running page: the
playhead advanced 0:03 -> 0:06 while `onStateChange` never delivered a
"playing" event, so the cover stayed up over a video that was running, with no
working pause. `getPlayerState()` is now polled in the same 250ms ticker
rather than trusting events, which cannot be missed.

Two smaller fixes found the same way:

- `p.getDuration is not a function`, thrown several times a second: the ticker
  started right after `new YT.Player(...)`, but a player's methods only exist
  once the API has wired the iframe. It now starts inside `onReady`.
- `origin` added to playerVars — without it the API posts to the nocookie
  origin and the browser logs a mismatch on every message.

Centre play button reduced 64px -> **44px** (still the accessible tap target);
it read as a splash screen over a small card.

**The honest limit is unchanged:** while the video is genuinely playing,
YouTube may still show its wordmark. Everything else — title, channel,
captions, fullscreen, related videos — is gone. Only self-hosting the file
removes YouTube's branding entirely.

## Meta catalog feed as CSV (Commerce Manager's URL box rejects JSON)

Asked for the catalog feed URL to paste into Commerce Manager > Data sources >
Upload data file > "Use a URL or Google Sheets".

**The existing feed could not be used there.** `/api/feed/meta` serves
`application/json` (`{"data": [...]}`), and that screen accepts only **CSV,
TSV, XML (RSS/ATOM) or XLSX**. The JSON feed is the right shape for Meta's
API, not for a scheduled URL fetch.

### Added

`toMetaCsv` in catalog-feed.formatters.ts, `GET /feed/meta.csv` on the
backend, and the matching storefront pass-through, so the public address is:

    https://amadere.com/api/feed/meta.csv

Same rows, same ids, same 30-minute cache as the JSON — only the container
differs. `.csv` is in the path, not just the content type, because some
fetchers sniff the extension.

Details that matter:

- **RFC 4180 escaping.** A description containing a comma, a quote or a
  newline silently shifts every later column, which Meta reads as a malformed
  record rather than an error worth naming. Fields with `,` or `"` are quoted
  and inner quotes doubled; newlines are collapsed rather than quoted, since a
  multi-line quoted field is legal but trips several importers.
- **No UTF-8 BOM.** Meta reads plain UTF-8, and a BOM would turn the first
  header into `\ufeffid` and lose every row's id. (Trade-off: opening the file
  directly in Excel needs Data > From Text/CSV with UTF-8, or Bangla shows as
  mojibake.)
- CRLF line endings, per the spec.

### Verified by parsing the generated file, not by eye

    78 rows, 19 columns
    all 9 required columns present (id, title, description, availability,
      condition, price, link, image_link, brand)
    0 rows missing a required value
    availability: 73 in stock, 4 out of stock, 1 preorder
    75 rows carry a sale_price, 0 rows lack an image

### Feed images were on the wrong host AND in a format Meta rejects

Every one of the 78 `image_link` values pointed at `pub-….r2.dev`. Not just
legacy rows either — `R2_PUBLIC_BASE_URL` still points at that bucket, so
every current upload is stored with it. The storefront rewrites that host to
`cdn.amadere.com` on render (apps/web/src/lib/image-url.ts); the feed builder
never did, and no CDN rewrite existed anywhere in the backend.

The format was the worse half. Measured against the live bucket, the raw URL
returns **`image/webp`** for every row, because the stored derivatives are
`-full.webp`. **Meta's catalogue accepts JPEG and PNG.** So all 78 images
would have failed, quietly, in a way that reads as "your products have no
photos".

`toFeedImageUrl` now rewrites the host and routes through Cloudflare:

    width=1200,quality=85,fit=scale-down,format=jpeg

- `format=jpeg` explicitly, not `auto` — `auto` keys off the requester's
  Accept header, and a crawler sending `*​/*` is not something to bet a whole
  catalogue on. (Caveat: a source PNG with transparency will be flattened.)
- `fit=scale-down` never upscales, so a small original keeps its own size.
- A host we do not control, or an already-transformed URL, is left untouched.
- CDN host reads `MEDIA_CDN_BASE_URL`, defaulting to `cdn.amadere.com`.

Applies to Google and TikTok too, since all three render from the same
`FeedItem`.

| after | |
|---|---|
| `image_link` on cdn.amadere.com | **78 / 78** |
| `image_link` with `format=jpeg` | **78 / 78** |
| additional images still on r2.dev | **0** (of 188) |
| random sample of 6 fetched live | all `200 image/jpeg`, 24-94 KB |
| dimensions | 600x600 from a 600px source — above Meta's 500x500 minimum |

**Root cause left alone:** `R2_PUBLIC_BASE_URL` should point at
`cdn.amadere.com` so new uploads stop being stored on the bucket host at all.
Changing it affects every stored URL from that moment on, which is the
owner's call, not a side effect of building a feed.

## Order Manager, Customers and Recovery on mobile

All three were unusable on a phone. Not "a bit cramped" — the tables are
declared `minWidth: 1600`, `3400` and `1200`, each with a sticky first column
that eats a third of a 375px screen, so every figure worth reading sat off the
right edge. Horizontal scrolling is technically responsive and practically
useless.

### Cards below `md`, table untouched above it

New `components/MobileRecordCard.tsx`: title, subtitle, a status badge, a
two-column grid of label/value pairs, and an actions row. Empty values are
dropped rather than rendered as blank rows, so short records stay short.

It is a `div` with a click handler, not a `<button>` — these rows carry
`<select>`s and `<a>`s, and a button may not legally contain either. The
actions row stops propagation so a tap on "Create order" does not also open
the card.

| screen | card shows | tap |
|---|---|---|
| Order Manager | order no., customer, status pill, total, date, items, origin, payment, district, courier, assignee, tap-to-call | opens the same detail modal |
| Customers | name, email, tier, orders, RFM, last order, CRM status, top product, assignee, tap-to-call | opens the customer modal |
| Recovery | name, email, stage, cart value, items, last seen, source/campaign, attempts, reason, tap-to-call, Create order | — |

The desktop table is wrapped in `hidden md:block` and otherwise unchanged:
column drag-reorder, sticky headers and the 62vh scroll box all still work.

### The tables were not the only thing overflowing

With the cards in, all three pages STILL scrolled sideways — 133px on Order
Manager, 90px on Customers. Measured by walking the DOM for any element wider
than the viewport, the culprit was the same on every page: the header action
row (`flex items-center gap-2.5`) holding four or five ~90px buttons with no
`flex-wrap`. Added it.

### Verified at 375px and back at 1440px

| page | sideways scroll @375 | cards | elements wider than viewport |
|---|---|---|---|
| Order Manager | **0** | 20 | none |
| Customers | **0** | 6 | none |
| Recovery | **0** | 1 | none |

At 1440px the Order Manager table is back at 3124px wide across 22 columns
with the cards hidden — no desktop regression.

## Customers list: editing the Address did nothing

Typing a new address in the Customers table and blurring appeared to save
nothing. It was saving fine — the list was displaying a different column.

    read  (loadListExtras)  address.area ? `${area}, ${district}` : addressLine
    write (updateAdmin)     CustomerAddress.addressLine

So for any customer with `area` set, the cell showed "Adabor, Dhaka", the edit
wrote to `addressLine`, and the list re-rendered the unchanged area/district.
Proven on a real row: `addressLine` was already `'Test Road'` while the list
rendered `'Mirpur, Dhaka'`.

There was a second half. The editor seeds from the display string
(`useState(c.address ?? "")`), so on those rows the input opened containing
"Adabor, Dhaka" — tweak it and you would write the city summary INTO
`addressLine`, quietly corrupting the real address.

### Fix

The list now reads `addressLine` — the field the editor writes — falling back
to the area/district summary only if it is somehow empty. One change fixes
both the invisible save and the poisoned seed value.

Safe to switch, measured across all **2,192** customer addresses: every one
has a non-empty `addressLine`, only 20 have `area` at all, and **zero** have
an area without an address line. Nothing goes blank.

### The rest of the row was audited, and is fine

Every other inline-editable field was checked for the same read/write split.
All 19 keys the UI sends (`phone`, `firstName`/`lastName`, `email`, `dob`,
`isFavorite`, `assignedAdminId`, `nextCallTarget`, `followUpCadenceDays`,
`hasNewOrder`, `newOrderAt`, `priority`, `crmStatus`, `behaviour`,
`customerFeedback`, `amaderFeedback`, `familyDetails`, `purchaseReason`,
`facebookProfileUrl`) are accepted by `UpdateCustomerDto`, and every one is
read back straight off its own column in `toAdminCustomerListItemDto`.

`name` deserved a second look because it is derived, but it is consistent:
the mapper joins `firstName + lastName` and the editor splits on the first
space and writes exactly those two. **`address` was the only mismatch.**

## District and Thana are now editable on a customer

The Customers table only let you edit the street line. `CustomerAddress` also
has `division`, `district` and `area` (thana), and none were reachable from
the admin — worse, the create branch of the quick-edit wrote
`division: '', district: ''`, so a customer added from this table had no
usable location at all until someone opened their storefront account.

### Added

- `UpdateCustomerDto` gains `division`, `district`, `area`.
- `adminUpdate` fires the address upsert when **any** of the four address
  fields is sent, not only `addressLine`, and writes each one only if it was
  actually sent — spreading the dto wholesale would blank the other three
  every time one of them changed.
- The list DTO exposes `division`, `district`, `area` alongside `address`.
- Two new columns, **District** and **Thana**, as cascading selects driven by
  the `BD_DISTRICTS_BY_DIVISION` / `BD_THANAS_BY_DISTRICT` data already in
  `@amader/shared`.

Choosing a district clears the thana, because a thana from the old district
is not a real place in the new one — a row could otherwise read "Adabor,
Chattogram". `division` has no column of its own and is derived from the
chosen district, so the stored row stays internally consistent instead of
keeping the empty string the create path used to write.

### Verified against the running API

| step | result |
|---|---|
| PATCH `district: Chattogram, area: Pachlaish, division: Chattogram` | list returns all three |
| PATCH `addressLine` **only** | district/area/division untouched — `Flat 3B` with `Pachlaish` intact |
| restored | `Dhaka / Dhaka / Mirpur / Test Road` |

`UpdateCustomerInput` in the admin is hand-written rather than generated, so
it needed the three fields adding by hand — noted in a comment there, since
the response types come from schema.d.ts and this one does not.

## Thana was uneditable for 63 of 65 districts, and order addresses were not the customer's

Two separate reports, one screenshot each.

### 1. "Only Dhaka and Dhaka Sub-Urban have a thana dropdown"

Correct, and worse than it sounds: measured, **only 2 of 65 districts** have
any entry in `BD_THANAS_BY_DISTRICT`. The `<select>` I had added therefore
offered nothing at all for the other 63 — the field simply could not be
filled.

Replaced both cells with the components the Add Customer form already uses:
`DistrictAutocomplete` (locked to the 65 real districts — `allowFreeText={false}`)
and `ThanaAutocomplete`, which is free text by default and suggests only where
data exists. Typed thanas are accepted everywhere; Dhaka still gets its 59
suggestions.

### 2. "I changed it but it still shows the previous address"

Working as designed, and the design is right: an order carries its own
`OrderAddress` snapshot of where it is actually going. Editing the customer's
saved address does not — and must not — rewrite orders already placed.

The real gap was next to it: `UpdateOrderDetailsDto` accepted `addressLine`,
`division` and `phone` but **not `district` or `area`**, so the address that
actually ships could not be corrected — and district is exactly what Steadfast
is handed at consignment.

- DTO gains `district` and `area`.
- `updateDetails` fires on any of the five address fields and writes each only
  when sent; `area` is nullable so an empty string clears it rather than
  storing `""`.
- The order modal gets District and Thana controls, the same autocompletes.
  Changing district clears the thana and derives the division.

### Verified against the running API

| step | result |
|---|---|
| order 6761 before | Dhaka / Dhaka / Mohammadpur / "House 9, Road 3, Block C" |
| PATCH district+area+division to Sylhet/Kadamtali | all three changed |
| addressLine after that PATCH | **unchanged** — single-field writes do not clobber siblings |
| restored | back to Dhaka / Dhaka / Mohammadpur |

`useUpdateOrderDetails`'s input type is hand-written rather than generated, so
the two fields were added there by hand with a comment saying so — the second
place in this codebase where that has bitten.

## Thana lists for all 65 districts

`BD_THANAS_BY_DISTRICT` only ever covered **2 of 65 districts** — Dhaka and
Dhaka Sub-Urban — because it was sourced from Steadfast's merchant-panel area
picker, which is metropolitan-only. The other 63 districts had an empty
dropdown, so a thana could not be picked at all.

Added the official upazila list for those 63: **489 new entries**, 556 total.
Dhaka and Dhaka Sub-Urban keep their Steadfast metropolitan lists untouched.

### Why widening is safe

`area` reaches Steadfast only inside the free-text `recipient_address` string
`ShipmentsService` assembles (`addressLine, area, landmark, district,
postCode`) — never as a zone id they validate. So an official upazila name
Steadfast happens to spell differently costs nothing. Both pickers accept free
text anyway, so a name missing here can still be typed.

### Validated after building the package

| check | result |
|---|---|
| districts in `BD_ALL_DISTRICTS` | 65 |
| districts with a thana list | **65** |
| districts still empty | **0** |
| keys that are not a real district | **0** |
| districts with duplicate thana names | **0** |
| total thanas | 556 |

The key check matters: a key that does not match `BD_DISTRICTS_BY_DIVISION`
exactly makes the dropdown silently never appear, which is the failure mode
the file's own header warns about. `Cox's Bazar` needed a double-quoted key.

Accuracy caveat worth recording: these are the official upazila names from
general knowledge, not scraped from a government dataset or from Steadfast.
Spot-checking a few districts against Steadfast's own picker before relying on
them for bulk consignment would be sensible.

## Bengali names for every thana

The 489 upazilas added in the previous change were English-only, while Dhaka's
had Bengali. `BD_THANA_BN` held 67 entries against 541 distinct thanas.

Added the missing **474**. Coverage is now **541 / 541**, and every value was
checked to actually contain Bengali characters (0 entries slipped through as
Latin text). `thanaOptionsFor` already feeds this in as each option's `hint`
and as a search alias, so staff can type either script.

Four needed a second pass: `Sherpur`, `Kishoreganj` and `Faridpur` are also
DISTRICT names, so the de-duplication skipped them on the assumption they were
already present in the file — they were, but in `BD_DISTRICT_BN`, which is a
different lookup. `Kawkhali` (Pirojpur) is a near-duplicate of `Kaukhali`
(Rangamati) and had been folded into it.

## Wholesale: cash sales, delivery snapshot and payment detail (backend)

Rebuilding wholesale to match the `WholeSale&Cash.html` prototype. Option B
was chosen — match the demo — with one deliberate departure confirmed by the
owner: **a cash sale still raises a `Due` and posts to the accounts ledger**,
which the demo does not model at all.

### Schema (migration `20260910090000_wholesale_cash_sale`)

Four new enums (`WholesaleOrderType`, `WholesaleOrderChannel`,
`WholesalePaymentMethod`, `WholesalePaymentStatus`) and, on
`wholesale_orders`: `type`, `channel`, `payment_method`, `payment_status`,
`transaction_id`, `gp_number`, plus a nine-column delivery snapshot
(`recipient_name/phone`, `alternative_phone`, `recipient_email`,
`address_line`, `district`, `thana`, `landmark`, `post_code`).
`wholesale_order_items` gains a per-line `discount`.

Two things worth noting:

- **`courier` became nullable.** A cash sale is carried out of the shop.
- **Everything else is additive with a default**, so the orders that already
  exist stay valid — verified after applying: existing rows read back as
  `type: WHOLESALE` with their courier intact.

The delivery snapshot is on the ORDER, not read from the Party, for the same
reason retail keeps `OrderAddress`: editing a customer's address later must
not rewrite where past orders actually went.

### Service

- Rejects a WHOLESALE order with no courier, and a CASH_SALE with one.
- Rejects any non-cash `paymentMethod` without a `transactionId` — without it
  a payment cannot be reconciled against a statement.
- Rejects a line discount larger than its own line, which would otherwise push
  `lineTotal` negative and understate the subtotal with nothing on the invoice
  explaining why.
- `paymentStatus` is **derived** from what was actually collected, never taken
  from the client.
- A cash sale writes no delivery snapshot at all rather than blank strings.
- The restate path carries an existing per-line discount through, instead of
  silently resetting it to zero.

### Verified against the running API

| check | result |
|---|---|
| Cash sale created | `WS-2609-0001` — CASH_SALE / IN_STORE_POS / CASH / **PAID** |
| GP number, courier | `GP-TEST-001`, courier `null` |
| Per-line discount | 2 x 500 − 50 = **950.00** |
| **Ledger receivable raised** | **`AR-2609-0001`** — as required |
| wholesale with no courier | rejected |
| cash sale with a courier | rejected |
| bKash with no transaction id | rejected |
| line discount > line | rejected, `৳900.00 is more than the ৳500.00 line` |
| existing test suite | **25 / 25 pass** |

The spec's line fixture needed `discount` adding; without it the mapper's
`item.discount.toFixed(2)` threw on 18 tests. Real rows cannot hit that — the
column is NOT NULL DEFAULT 0.

**Still to do:** the three admin screens (full-page create flow, Orders
dashboard with stat cards, Customer dashboard with detail view), and the
dashboard stats endpoints they read.

## Wholesale rebuilt to the `WholeSale&Cash.html` prototype (admin UI)

The three screens from the prototype, replacing the old single Orders/Customers
table page. Option B — match the demo — with the one agreed departure: **a cash
sale still raises a `Due` and posts to the accounts ledger**, which the demo
does not model.

### Screens

**Create Order** (`_components/CreateOrderPanel.tsx`) — customer type-ahead
with "create new" inline, a delivery card that fills from the buyer, courier
card, cart with per-line qty/price/discount, channel and payment pills, and a
live summary. The Wholesale/Cash Sale toggle does everything the demo's does:
retitles the screen, drops the delivery and courier cards, drops the delivery
charge from the total, shows the GP number field, switches the channel to
In-store POS, renames the button — **and re-prices every line**.

**Orders Dashboard** — 4 stat cards, search, type and status filters, CSV
export, and the demo's nine columns. **Customer Dashboard** — 4 stat cards,
search, and a detail view with the profile grid and complete order history
(including the demo's "Price Details" column, e.g. `৳380.00 × 10 − ৳200.00`).

Both tables become cards below `md` rather than a horizontal scrollbar.

### Things the demo doesn't have that were needed anyway

- **Stats are server-side** (`GET /admin/wholesale/stats`). The tables page, so
  totalling the rows in the browser would have reported the page rather than
  the business, and the cards would have moved as staff typed in the search.
- **The customer's order history is fetched by `partyId`**, not filtered out of
  the list — "complete history" that silently stops at the last loaded page is
  worse than no history.
- **Cancelled orders now carry a badge.** Their goods went back on the shelf
  and their invoice was voided; a cancelled row that looked identical to a live
  one invited someone to chase a delivery or a payment that no longer existed.
  The stat cards count live orders only, and say so.
- **`wholesalePrice`**, so the mode toggle has something to re-price *to*.
  Product-level, nullable, falling back to the retail price. It is only ever
  the line's starting point — the rate actually billed is snapshotted on the
  order, so editing it never rewrites a past invoice.
- **Party address detail** (`alternativePhone`, `district`, `thana`,
  `landmark`, `postCode`), which is what the delivery card fills from.
- **Enum values the demo offers**: 4 more couriers, 4 more channels.

### A real bug found on the way

The product picker read price **only off the default variant**. A simple
(non-variant) product keeps its price on the product row and has no variant at
all, so **27 of 84 products returned a null price** — and would have started
every wholesale line at ৳0.00. Now falls back to the product's own columns.
Verified: 0 of 84 null.

### Verified live, through the UI

| check | result |
|---|---|
| Toggle re-prices the cart | 320 (bulk) → **399** (retail) on switch |
| Cash sale created from the form | `WS-2609-0003` · Paid · GP-UI-0001 |
| Delivery fills from the buyer | address, phone, outstanding balance |
| Wholesale order via API | `WS-2609-0002` · SA_PARIBAHAN · TELEMARKETING |
| Line discount | ৳380 × 10 − ৳200 = **৳3,600** |
| Derived payment status | 1000 of 3650 → **PARTIALLY_PAID** |
| **Ledger receivable** | **`AR-2609-0002`**, shown on the detail modal |
| Search by product / phone / GP | 4 / 2 / 1 matches |
| Cash sale with no GP number | rejected |
| Picker prices | 27 null → **0 null** |
| Wholesale tests | **32 / 32** (7 new: the type-split guards) |
| Typecheck | backend and admin clean |

**Not done:** `pnpm --filter @amader/admin lint` cannot run — `eslint-config-next`
is in `package.json` and in the pnpm store but is not linked into
`apps/admin/node_modules`. Pre-existing and unrelated to this work; it needs an
install, which I have not run.

**Also outstanding:** production still needs `prisma migrate deploy` for the two
new migrations, and no product has a wholesale price set yet, so until someone
fills them in every wholesale line starts at the retail price.

## Wholesale follow-ups: invoice tab, pagination, cash-sale address, product images

Six things off the back of using the rebuilt screens.

### 1. Invoice settings, reachable from Wholesale

There was already a full invoice configuration at Settings → Invoices, and the
wholesale invoice already rendered from it — it was just buried. Rather than
build a second one, the form moved to
`components/settings/InvoiceSettingsForm.tsx` and is now rendered in **two**
places: the settings page, and a new **Invoice Settings** tab on Wholesale.
One config, one template, one company. The tab carries a banner saying so, so
nobody edits it expecting wholesale-only changes.

### 2. A preview

`InvoicePreview` renders the **real** `WholesaleInvoiceDocument` against a
made-up order, fed the **draft** settings rather than the saved ones — a
preview of what is already saved would show the very thing you are trying to
change. `WholesaleInvoiceDocument` gained an optional `settingsOverride` for
this; nothing else passes it.

Two deliberate choices: the sample order is invented, not a real one (this
screen gets shown on shared displays, and a real invoice carries a real
buyer's name, phone and address); and the shrink-to-fit uses `zoom`, not
`scale` — a transform does not affect layout, so the first attempt reserved
the invoice's full height and left a slab of empty box under it.

### 3. Pagination

Both dashboards were fetching `pageSize=200` and rendering everything. Now a
25-row page with a `Pager` (prev / next / "3–4 of 6 orders"), `keepPreviousData`
so the table does not blank on every keystroke, and a reset to page 1 whenever
a filter changes — page 3 of the old result set is usually past the end of the
new one, which showed an empty table with no hint why.

The customer's own order history pages too. The create-order screen still
loads every buyer in one request (`pageSize: 0`) because it searches that list
in the browser to keep picking a customer instant.

### 4. Cash sales now keep a delivery address

**My mistake in the rebuild.** I hid the whole Delivery Address card for cash
sales, reading the prototype's `deliveryCard` as "the address". It is not —
that id is on the **Courier** card, and the demo shows the address in both
modes and validates recipient name/phone/address in both. Only the courier is
wholesale-only.

Fixed in the form, the validation, the create path (the snapshot was gated on
`type === 'WHOLESALE'`) and the order detail modal. A counter sale is still
handed to a named person at an address, and the shop wants that on the invoice.

### 5 & 6. Product images, and clicking the row to add

`AdminProductPickerItemDto` gained `imageUrl` (primary image, falling back to
the gallery's first). Shown in the product search results, the cart lines, and
the order detail table.

For the detail table the image is **resolved from the product, not
snapshotted** beside the name and price. Those snapshots exist because they
are financial facts that must never change under a past invoice; a thumbnail
is not one, and a product whose photo was replaced should show the photo it
has. Null once the product is deleted — the shared `Thumb` falls back to a
lettered tile rather than a broken-image icon.

The separate **Add** button is gone: the whole result row is the button now,
with a `+` on the right.

### Verified

| check | result |
|---|---|
| Invoice tab renders the shared form | company info, footer, typography, layout, stamp |
| Preview | real invoice, sample order, draft settings, no dead space |
| Pagination | `3–4 of 6 orders` · `2 / 3` · prev+next both live |
| Cash sale delivery card | shown, and required |
| Picker images | **82 of 84** products have one |
| Order item images | resolved on every line |
| Row click adds to cart | Add button gone |
| Wholesale tests | **32 / 32** |
| Typecheck | backend and admin clean |

The spec fixture needed `media: []` on its item's `product` to match
`ORDER_INCLUDE` — without it the mapper threw on 20 tests. Real rows always
have the relation.
