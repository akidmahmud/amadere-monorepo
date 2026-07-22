# Admin Dashboard Redesign — Design Spec

## Context

The admin app (`apps/admin`) currently has no real Overview/Dashboard page — the root
route (`(shell)/page.tsx`) just re-renders the Net Profit module's own overview page
wrapped in its violet `.wpfok-scope` theme. The user supplied a reference design,
`getcommerce-dashboard.html` (a self-contained static mockup, blue-accent theme,
Plus Jakarta Sans, Chart.js), and asked for the whole admin panel's design to follow
it, **except** the Net Profit module (`/net-profit/*`), which keeps its existing
violet look untouched (it already lives behind its own `.wpfok-scope` token override,
so it's naturally immune to a base-theme change).

Two things came out of user review that turned this from a pure reskin into a small
feature project:
1. **Order channel** (website / WhatsApp / phone-telemarketing / future app) is a real,
   currently-untracked concept — the store genuinely takes orders through multiple
   channels today. The mockup's "Sales By Source" panel should show this for real, not
   a substitute metric.
2. **Standalone customer creation** doesn't exist — today a `Customer` row is only ever
   created as a side effect of an order (manual or storefront) or CSV import. The user
   needs to register a customer (telesales lead, B2B/"big store" account) before any
   order exists.

## Scope

**In scope:**
- Base design tokens (`packages/admin-ui/src/globals.css` `:root`) swapped to the
  GetCommerce blue palette. Cascades automatically to every shared component
  (`Card`, `Button`, `StatCard`, `NavItem`, etc.) and therefore to all ~30 non-Net-Profit
  admin pages, without hand-editing each page.
- `AppShell`/`NavItem`/`NavGroup` restyled to match the mockup's sidebar (search box,
  section labels) and a rebuilt topbar (breadcrumb, Clear cache, Visit website,
  notification bell, avatar) — the topbar additions render on every page since they
  live in the shared shell.
- `Table` component generalized to work outside `.wpfok-scope` (today its styled CSS is
  hard-scoped to Net Profit only).
- Root `/` decoupled from the Net Profit overview into its own real page, rebuilt to
  match the mockup: 9 stat cards, Quick Actions panel, Sales-by-Source donut, monthly
  revenue bar chart, Recent Orders table, Top Customers table.
- `Order.channel` column + enum (real schema change, needs a Prisma migration).
- Manual order creation (`/orders/new`) gets a Channel field.
- New standalone customer-creation endpoint + `/customers/new` page.
- `GET /admin/dashboard/overview` extended with the fields the new page needs.
- Clear cache button: UI + click feedback only, no real purge wired yet (explicit user
  instruction — "I will make it functional later").
- Visit website button: real link, via a new `NEXT_PUBLIC_STOREFRONT_URL` env var
  (no such var exists today; defaults to `http://localhost:3001` in dev).

**Out of scope (explicitly deferred, not silently dropped):**
- Rebuilding each of the ~30 other admin pages' bespoke layouts to match the mockup's
  structure — they inherit the new colors/components automatically, but their own page
  layouts are untouched in this pass.
- Real cache purge logic.
- Notification bell click-through / real notification data (stays decorative, matching
  its current inert state).
- "Create Ticket" quick action (no ticket system exists — user said to leave it out).
- Marketplace/POS/App as *usable* order channels — the enum includes them for parity
  with the mockup and future-readiness, but nothing in this pass creates orders with
  those values; only WEBSITE (automatic) and WhatsApp/Phone/Marketplace/POS (manual,
  staff-selected) are reachable today, and App has no reachable path at all yet.

## Design tokens

`packages/admin-ui/src/globals.css`, base `:root` block only (`.wpfok-scope` already
overrides these for Net Profit and is untouched):

```
--brand-500: #2570eb   (was #299d91)
--brand-600: #1e61d0
--brand-700: #1a52ae
--brand-400: #4e8cf0
--brand-50:  #e8f0fe

--bg:      #f3f6fb   (was #f4f5f7)
--surface: #ffffff    (unchanged)
--border:  #e9eef5   (was #ecedf0)
--text:    #1e293b   (was #1b1b1f)
--text-secondary: #64748b (was #6b7280)
--text-muted: #94a3b8 (was #9ca3af)

--sidebar-bg: #ffffff (was #fafafa — mockup sidebar is pure white)
--sidebar-hover: #f2f6fd
--sidebar-text: #64748b
--sidebar-text-active: #ffffff

--success: #22c087   (was #22b07d)
--danger:  #ef3a3a   (was #e5484d)
--warning: #f5a623   (unchanged)
--accent-blue: #2570eb

--r-card: 12px (unchanged)
--shadow-card: 0 1px 2px rgba(15,23,42,.04) (unchanged, matches mockup almost exactly)
```

New tokens needed for stat-card icon tiles (mockup's 8 distinct `ic-*` tints) and quick
action button colors (mockup's `qa-*` set) — added as plain Tailwind-consumed CSS vars
alongside the existing ones, same pattern as `--wpfok-*` extras:

```
--stat-green-bg: #e3f7ee;  --stat-green: #22c087;
--stat-blue-bg:  #e8f0fe;  --stat-blue:  #2570eb;
--stat-orange-bg:#fef0e2;  --stat-orange:#f7941d;
--stat-yellow-bg:#fdf3dd;  --stat-yellow:#e9a23b;
--stat-red-bg:   #feeaec;  --stat-red:   #ef4b62;
--stat-purple-bg:#f1eafe;  --stat-purple:#9b5cf6;
--stat-indigo-bg:#eaecfe;  --stat-indigo:#6366f1;
--stat-teal-bg:  #e0f6f2;  --stat-teal:  #14b89b;
```

## Shared component changes

**`AppShell.tsx`**
- Sidebar gains a search input above the nav list (`SearchInput`, filters the nav list
  client-side by label — pure UI convenience, no new data).
- Topbar rebuilt: breadcrumb (`Home › {pageTitle}`) + page title on the left (replaces
  today's plain title), then on the right: **Clear cache** button (amber, clock+check
  icon), **Visit website** button (dark, opens `NEXT_PUBLIC_STOREFRONT_URL` in a new
  tab), the existing bell (restyled, kept decorative), avatar circle (existing).
- New `AppShellProps`: `onClearCache?: () => void` (page-level pages don't need to pass
  this — `ShellLayout` wires a default handler that just shows a toast), no new required
  props otherwise.

**`NavItem.tsx` / `NavGroup.tsx`**: token-driven already (active = `bg-brand-500` +
white text) — only the section-label styling changes (bold, blue, uppercase-tracking,
matching mockup's `.nav-label`).

**`Table.tsx`**: the `wpfok-table`/`wpfok-table-scroll`/`wpfok-id-badge` CSS in
`globals.css` currently only has effect inside `.wpfok-scope`. Generalize those
selectors to apply everywhere (drop the `.wpfok-scope` prefix requirement), so the same
`<Table>` component works in both the base theme and Net Profit — the token cascade
(border/text-secondary/brand-50 already differ per scope) means it'll render correctly
in both without a fork.

## Schema change

`packages/db/prisma/schema.prisma`, on `Order`:

```prisma
enum OrderChannel {
  WEBSITE
  WHATSAPP
  PHONE
  MARKETPLACE
  POS
  APP
}
```

```prisma
model Order {
  ...
  channel OrderChannel @default(WEBSITE) @map("channel")
  ...
}
```

Requires `prisma migrate dev` locally and `prisma migrate deploy` on the VPS as part of
the next deploy (unlike the earlier SKU-edit change, this one **is** a real schema
migration — flag this clearly when this ships).

## Backend changes

**Checkout (`checkout.service.ts`)**: order creation from the storefront always sets
`channel: 'WEBSITE'` — one field added to the existing `order.create(...)` call, no
new logic.

**Manual order creation** (`CreateManualOrderDto`, `create-manual-order.dto.ts`): add
`channel: OrderChannel` (`@IsEnum(OrderChannel)`, required — staff must pick one when
keying in an order; `WEBSITE` is deliberately excluded from the picker's options list at
the frontend level since a staff-entered order is by definition not a self-serve website
order). `admin-orders.controller.ts`'s create handler passes it through unchanged to the
order-creation call.

**Dashboard endpoint** (`dashboard.controller.ts` / `dashboard.service.ts` /
`dashboard.dto.ts`), extending the existing `GET /admin/dashboard/overview` response:

```ts
interface DashboardOverviewDto {
  // existing fields unchanged: totalRevenue, totalOrders, totalCustomers,
  // completedOrderRate, statusBreakdown, monthlyRevenue, topProducts

  totalProducts: number;

  today: { orders: number; revenue: string };
  completed: { orders: number; revenue: string };
  pending: { orders: number; revenue: string };

  avgOrderValue: string; // lifetime, totalRevenue / totalOrders

  ordersByChannel: { channel: OrderChannel; count: number }[]; // lifetime counts

  topCustomers: {
    id: number;
    name: string;
    orderCount: number;
    totalSpend: string;
  }[]; // top 5 by lifetime spend

  recentOrders: {
    id: number;
    orderNumber: string;
    customerName: string;
    total: string;
    status: OrderStatus;
    createdAt: string;
    paymentMethod: 'COD' | 'PAID'; // from the order's most recent Payment.provider —
                                    // COD stays "COD", everything else maps to "PAID"
  }[]; // last 5, existing shape + new paymentMethod field
}
```

Implementation notes for `dashboard.service.ts`:
- `totalProducts`: `prisma.product.count()`.
- `today`/`completed`/`pending`: grouped aggregate queries against `Order`, scoped by
  `createdAt >= startOfToday` and by `status`, summing `totalAmount` for revenue.
- `topCustomers`: `groupBy` on `Order.customerId` (excluding null/guest), sum
  `totalAmount`, count, order by sum desc, take 5, then a `customer.findMany` to resolve
  names for the winning IDs.
- `ordersByChannel`: `groupBy` on `Order.channel`, count.
- `recentOrders.paymentMethod`: include the order's `payments` relation ordered by
  `createdAt desc`, take 1; `COD` if that payment's `provider === 'COD'`, else `PAID`;
  orders with no payment row yet (e.g. still pending) fall back to `COD` (matches how
  COD orders behave today — no payment row is created until settlement).

**New customer creation** (`admin-customers.controller.ts` / `customers.service.ts`):
`POST /admin/customers` — `CreateCustomerDto { name: string; phone: string; email?:
string; note?: string }` (validated: `phone` required + `@IsPhoneNumber` or the same
validator the checkout address DTO already uses for consistency). Service method
`createCustomer(dto)`: same phone-uniqueness handling the manual-order auto-match path
already has (if a customer with that phone already exists, this is a **conflict** — a
standalone creation with a colliding phone should error, not silently merge, since
that's a different intent than order-time auto-match). Returns the created `Customer`.

## Frontend changes

**New Overview page** (`(shell)/page.tsx`, replacing the current
`NetProfitOverviewPage` re-export): a plain page component (not `.wpfok-scope`-wrapped)
built from new presentational pieces:
- `OverviewStatGrid` — 9 `StatCard`s in the mockup's 3-row layout (Today's Orders,
  Lifetime Sales, Completed Orders / Total Products, Total Customers, Today Revenue /
  Average Order Value, Total Revenue, Pending Orders), each using the new `--stat-*`
  icon-tile tokens.
- `QuickActionsPanel` — static 2×3 grid of colored link-buttons (`Link` + styled
  `button`-look), one per the finalized 6 actions listed above.
- `SalesBySourceCard` — reuses `DoughnutChart` with `ordersByChannel` mapped to
  `{label, value, color}` (one fixed color per channel).
- `SalesStatisticsCard` — reuses `BarChart` with `monthlyRevenue` as
  `{label, current: revenue, compare: previousRevenue}` (current/compare labeled
  "This period" / "Previous period").
- `RecentOrdersTable` / `TopCustomersTable` — built on the now-generalized `Table`.

All data from one `useDashboardOverview()` hook (extends the existing hook backing the
current dashboard query, new response fields flow straight through since it's the same
endpoint).

**`/customers/new` page**: a plain form (name, phone, email, note) posting to the new
endpoint, redirecting to `/customers/{id}` on success — same form patterns already used
elsewhere in the admin (e.g. `/blog-posts/new`).

**`/orders/new`**: add a required Channel `<select>` (WhatsApp / Phone / Marketplace /
POS), included in the `CreateManualOrderDto` payload.

**Quick actions, final 6**: Create Sale → `/orders/new`, Create Product →
`/products/new`, Add Customer → `/customers/new`, Add Membership Tier →
`/customers/tiers`, New Discount → `/discounts`, Write Blog → `/blog-posts/new`.

**Clear cache**: `ShellLayout` passes a default `onClearCache` that shows a toast
("Cache cleared") — no backend call. `AppShell`'s button is otherwise fully real UI
(hover state, icon, position) so wiring a real handler in later is a one-line change.

**Visit website**: reads `process.env.NEXT_PUBLIC_STOREFRONT_URL` (new env var,
documented in `apps/admin/.env.example`, falls back to `http://localhost:3001` if unset)
and opens it in a new tab via a plain `<a target="_blank">`.

## Testing / verification

- `pnpm -r exec tsc --noEmit` after backend + frontend changes.
- `prisma migrate dev` run locally, confirm the new column/enum exist via `\d orders` or
  Prisma Studio.
- Live pass against real dev-DB data (existing orders/customers), same discipline as the
  rest of this project — no direct SQL seeding.
- Manually place one manual order via `/orders/new` with each non-Website channel value,
  confirm `ordersByChannel` on the Overview page reflects it.
- Manually create one customer via `/customers/new`, confirm it appears in `/customers`
  and that re-submitting the same phone number is rejected as a conflict.
- Visual check of the Overview page and one or two other pages (e.g. `/products`) via
  the dev server to confirm the base reskin cascaded correctly, and a check of
  `/net-profit` to confirm it visually did **not** change.
