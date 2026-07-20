# Customer Panel — Design Spec

## Context

Today there is no admin-facing customer management surface at all — only
self-service endpoints (`/customers/me`, addresses, wishlist) for a logged-in
customer to manage their own account. Guest checkout orders are not linked to
any `Customer` record (`order.customerId` stays `null`). There is also no
admin UI for manually creating an order — orders only originate from
storefront checkout today.

The user wants a first-class **Customer Panel** admin module: automatic
customer creation/matching from orders, an automatic loyalty-tier system
based on completed order count, notes/feedback storage, call and activity
logs, and a "Call" button stubbed against a not-yet-available telephony API.

A second, related feature — a manual "New Order" admin screen (staff placing
an order on a customer's behalf) — was explicitly **descoped to a follow-up
spec**. This document covers the Customer Panel only. Wherever the manual
order screen would eventually plug in (customer auto-matching, tier
recalculation), this spec's backend is built so that follow-up work is a
pure addition, not a rework.

## Goals

- Every order (guest or logged-in checkout) automatically creates or matches
  a `Customer` by phone number — no duplicates.
- Customer status/tier (Group B / Group A / Gold / Platinum) is computed
  automatically from completed order count, using admin-configurable
  thresholds (not hardcoded).
- Admins can import existing customers via CSV (name, phone, email, DOB).
- Each customer profile stores notes/feedback, a call log, and shows a
  merged activity timeline plus order history.
- A "Call" button exists on the profile, wired to a deferred provider
  (real telephony API arrives later — same pattern as SMS/Payment/Courier
  elsewhere in this codebase).
- The whole module gets its own top-level admin sidebar section, styled
  with Net Profit's existing violet/dark design system (not the admin app's
  default neutral theme).

## Non-goals (this spec)

- Manual "New Order" admin screen — separate future spec.
- Real telephony provider integration — stub only (`UnconfiguredCallProvider`).
- Loyalty rewards/points, referral codes — explicitly out of scope per the
  existing `Customer` model's "PHASE 2 HOOK" comment; untouched by this work.
- Automatic recalculation of tiers on a periodic schedule — recalculation is
  event-driven only (order status change, tier-settings edit).

## Data model

### Reused as-is

- `Customer.dob` — already exists, used directly as "birthday."
- `Customer.phone` — already unique, used directly as the auto-matching key.

### New: `CustomerTier`

```prisma
model CustomerTier {
  id                 Int    @id @default(autoincrement())
  label              String                 // "Group B", "Gold", etc.
  minCompletedOrders Int    @unique
  sortOrder          Int    @default(0)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  customers Customer[]

  @@map("customer_tiers")
}
```

Seeded with the 4 rows from the spec (2 → Group B, 3 → Group A, 5 → Gold,
7 → Platinum). Fully admin-editable (label, threshold, add/remove rows) via
`/customers/tiers` — no migration needed to change thresholds later.

### `Customer` additions

```prisma
completedOrderCount Int  @default(0) @map("completed_order_count")
tierId               Int? @map("tier_id")
tier                  CustomerTier? @relation(fields: [tierId], references: [id])
```

"Current tier" = the `CustomerTier` with the highest `minCompletedOrders`
that `completedOrderCount` meets or exceeds. 0–1 completed orders →
`tierId: null` (no badge shown, not "Group B" by default).

### New: `CustomerNote`

```prisma
enum CustomerNoteType {
  CUSTOMER_FEEDBACK
  INTERNAL_NOTE
  REMARK
}

model CustomerNote {
  id            Int              @id @default(autoincrement())
  customerId    Int              @map("customer_id")
  type          CustomerNoteType
  body          String
  authorAdminId Int              @map("author_admin_id")
  createdAt     DateTime         @default(now())

  customer Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  author   AdminUser @relation(fields: [authorAdminId], references: [id])

  @@map("customer_notes")
}
```

One model, type-tagged — covers customer feedback, internal sales notes,
and follow-up remarks without three separate tables. Append-only (no
edit/delete in this phase).

### New: `CustomerCallLog`

```prisma
enum CallOutcome {
  CONNECTED
  NO_ANSWER
  VOICEMAIL
  WRONG_NUMBER
  DECLINED
}

model CustomerCallLog {
  id            Int         @id @default(autoincrement())
  customerId    Int         @map("customer_id")
  phoneCalled   String      @map("phone_called")
  outcome       CallOutcome
  notes         String?
  authorAdminId Int         @map("author_admin_id")
  providerCallId String?    @map("provider_call_id") // populated once a real CallProvider exists
  createdAt     DateTime    @default(now())

  customer Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  author   AdminUser @relation(fields: [authorAdminId], references: [id])

  @@map("customer_call_logs")
}
```

Logged manually by the agent after a call today. `providerCallId` is inert
until a real `CallProvider` exists.

### No new table for "Activity Log"

Computed at read time in the service layer: merges order status history
(`OrderStatusHistory`, already exists), `CustomerNote` rows, and
`CustomerCallLog` rows into one chronological, read-only feed. Avoids a
redundant duplicate-of-everything-else table; nothing needs to query
"activity" independently of its source records.

## Auto-linking behavior

On every checkout completion (`CheckoutService`, both guest and logged-in
paths):

1. Look up `Customer` by the order's phone (from the shipping address).
2. Match found → set `order.customerId` to that customer.
3. No match, and the checkout wasn't already made by a logged-in customer →
   create a new `Customer` (phone + name from shipping address,
   `passwordHash: null`, same as existing OTP/social-only accounts).
4. Two orders with the same phone always resolve to the same customer.

Tier recalculation hooks into the existing `OrdersService.updateStatus`
flow: whenever an order's status changes to or from `COMPLETED`, recompute
that customer's `completedOrderCount` and `tierId`.

Editing tier thresholds in settings (`/customers/tiers`) triggers a
one-time recalculation pass across all customers (not a background job —
synchronous, run inline on save, given expected customer table size).

## Backend API

New `CustomersAdminController`, following the existing admin-controller
pattern (`AdminOrdersController`, `AdminProductsController`, etc.):

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/customers` | Paginated list; search by name/phone/email; filter by tier |
| GET | `/admin/customers/:id` | Full profile: info, tier, order history, notes, call logs, computed activity timeline |
| PATCH | `/admin/customers/:id` | Edit name/dob/etc. |
| GET | `/admin/customers/:id/notes` | List notes |
| POST | `/admin/customers/:id/notes` | Add a note |
| GET | `/admin/customers/:id/calls` | List call log entries |
| POST | `/admin/customers/:id/calls` | Log a call's outcome after the fact |
| POST | `/admin/customers/:id/calls/dial` | The "Call" button's action — normalizes phone, invokes `CallProvider.dial()` |
| GET | `/admin/customer-tiers` | List tier thresholds |
| PUT | `/admin/customer-tiers` | Replace tier threshold set (triggers recalculation) |
| POST | `/admin/customers/import` | CSV upload (name, phone, email, dob) |

CSV import: rows whose phone already exists as a `Customer` are skipped
(not overwritten, not erroring the whole batch) — response reports
imported vs. skipped counts.

## Call button & deferred provider

Same "deferred provider" pattern used for SMS/Payment/Courier elsewhere in
this codebase:

```typescript
export interface CallProvider {
  dial(phoneNumber: string, customerId: number): Promise<{ providerCallId: string }>;
}

@Injectable()
export class UnconfiguredCallProvider implements CallProvider {
  async dial(): Promise<never> {
    throw new ServiceUnavailableException('Calling is not configured yet');
  }
}
```

Registered by default via the same DI-token-swap pattern as
`UnconfiguredCourierProvider`/`GoogleSocialLoginVerifier`. The "Call" button
on the profile page normalizes the customer's phone to BD E.164
(`+880...`) client-side for display, then POSTs to
`/admin/customers/:id/calls/dial`, which currently always throws
"not configured" — surfaced as a clear toast, not a silent failure. Once
real API details arrive, a real provider swaps in behind the same
interface; no other code changes.

## Frontend

New top-level admin sidebar section **"Customers"**, using Net Profit's
existing violet/dark design system (`PageHeader`, `StatCard`,
`SettingsCard`, `Table`, `Tabs`, `ToggleSwitch` — the same components,
`.wpfok-scope` theme extended to these routes, not the admin app's default
neutral theme):

- **`/customers`** — list page: dark-gradient `PageHeader`, a `StatCard`
  row (Total Customers, Group B, Group A, Gold, Platinum counts), a
  searchable/filterable table (search by name/phone/email, filter by tier).
- **`/customers/[id]`** — profile page: customer info card + tier badge, a
  "Call" button, pill-tabs (Notes / Call Log / Order History / Activity
  Timeline).
- **`/customers/tiers`** — tier threshold settings, editable list using
  `SettingsCard`.
- **`/customers/import`** — CSV upload page.

## Edge cases

- A customer with 0–1 completed orders shows no tier badge (`tierId: null`).
- Notes and call logs are append-only — never edited or deleted, since the
  point is giving repeat-buyer calling agents an accurate history of what
  actually happened.
- CSV rows with a phone already in use are skipped and reported, not
  merged/overwritten — avoids silently corrupting an existing customer's
  data via a bad import file.

## Testing approach

Same live-verification discipline as the rest of this project: real
checkout API calls to create genuine test orders (verifying auto-link and
tier computation), verified through the actual admin UI via Playwright,
then cleaned up afterward. No direct SQL fabrication of customer-facing
data (test rows created via real APIs only, as already established for
Marketing Review Cards / Product Info Visual / Comparison earlier in this
project).
