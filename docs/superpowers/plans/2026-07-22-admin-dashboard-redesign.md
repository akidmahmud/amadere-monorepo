# Admin Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the admin app's shared chrome/tokens to a new blue design system (from
the `getcommerce-dashboard.html` reference), rebuild the root Overview page to match it
with real data, and close two real product gaps surfaced along the way: order channel
tracking (website/WhatsApp/phone/marketplace/POS) and standalone customer creation.

**Architecture:** Token-only reskin cascades through existing shared `admin-ui`
components to every non-Net-Profit page for free. `AppShell` gets structural changes
(topbar buttons, sidebar search). The Overview page is a new page built from small
local components consuming one extended backend endpoint. Two small, independent
backend features (`Order.channel`, standalone customer create) plug into existing
services following their established patterns exactly.

**Tech Stack:** NestJS + Prisma (backend), Next.js App Router + React Query + Tailwind
v4 CSS-variable theming (admin frontend), recharts (`BarChart`) + hand-rolled SVG
(`DoughnutChart`).

## Global Constraints

- Full context: `docs/superpowers/specs/2026-07-22-admin-dashboard-redesign-design.md`
  (read first if anything below is ambiguous — it has the "why" behind every decision).
- **This codebase has zero automated tests anywhere** (`find . -name "*.spec.ts"` /
  `*.test.ts*` both return nothing in `apps/backend` and `apps/admin`). Every prior
  feature in this project was verified live (typecheck + curl + Playwright against real
  dev-DB data), not with a test suite. Follow that same practice here — do NOT invent a
  test framework or write `.spec.ts` files that don't fit the codebase's actual
  convention. Each task's "verify" step is a real command + expected real output.
- `pnpm -r exec tsc --noEmit` must stay clean after every task.
- Net Profit (`/net-profit/*`) must not visually change — its `.wpfok-scope` token
  overrides in `packages/admin-ui/src/globals.css` are untouched by every task below.
- No new npm dependencies — every task uses libraries already in the repo
  (`recharts`, `@tanstack/react-query`, `class-validator`, `class-transformer`).
- Money fields are `Decimal`/strings end-to-end (never `number`) — matches every
  existing DTO in `dashboard.dto.ts` and `orders/dto/*`.
- Permission strings: reuse `'dashboard.view'`, `'order.create'`, `'customer.manage'`
  exactly as already seeded — do not invent new permission strings.

---

### Task 1: `Order.channel` schema column

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (add `OrderChannel` enum + `Order.channel`
  field, right before the `Order` model at line 968)

**Interfaces:**
- Produces: Prisma enum `OrderChannel` with values `WEBSITE | WHATSAPP | PHONE |
  MARKETPLACE | POS | APP`, and `Order.channel: OrderChannel` (default `WEBSITE`,
  non-nullable) — every later task that touches `Order` creation or the dashboard
  aggregation reads/writes this field by these exact names.

- [ ] **Step 1: Add the enum and field**

In `packages/db/prisma/schema.prisma`, immediately above `model Order {` (line 968),
insert:

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

Then inside `model Order { ... }`, immediately after the existing `status` field
(currently line 972: `status      OrderStatus @default(PENDING)`), insert:

```prisma
  channel     OrderChannel @default(WEBSITE) @map("channel")
```

- [ ] **Step 2: Generate and run the migration**

Run: `pnpm --filter @amader/db run prisma:migrate -- --name add_order_channel`

Expected: Prisma prints `Your database is now in sync with your schema.` and creates a
new folder under `packages/db/prisma/migrations/` containing a `migration.sql` with an
`ALTER TABLE "orders" ADD COLUMN "channel" ...` statement and a `CREATE TYPE
"OrderChannel"` statement. Every existing row gets `channel = 'WEBSITE'` (Postgres
applies the column default to existing rows on an `ADD COLUMN ... DEFAULT` when the
column is `NOT NULL`).

- [ ] **Step 3: Rebuild the generated Prisma client**

Run: `pnpm --filter @amader/db run build`

Expected: exits 0. This regenerates `@prisma/client` types so `OrderChannel` and
`Order.channel` are available to TypeScript in every backend module that imports
`@amader/db`.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @amader/db exec prisma studio` is unnecessary — instead verify via
psql or the existing dev DB connection:

```bash
psql "$DATABASE_URL" -c "SELECT channel, count(*) FROM orders GROUP BY channel;"
```

Expected: one row, `channel = WEBSITE`, count equal to the total existing order count
(confirms the backfill default applied).

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "Add Order.channel column for order-source tracking"
```

---

### Task 2: Wire `channel` into order creation (checkout + manual)

**Files:**
- Modify: `apps/backend/src/modules/orders/checkout.service.ts:186-202` (storefront
  checkout — always `WEBSITE`)
- Modify: `apps/backend/src/modules/orders/dto/create-manual-order.dto.ts` (add
  `channel` field, staff-selected)
- Modify: `apps/backend/src/modules/orders/admin-order-creation.service.ts:77-113`
  (pass `dto.channel` through to `tx.order.create`)

**Interfaces:**
- Consumes: `OrderChannel` enum from Task 1 (`import { OrderChannel } from
  '@amader/db'`).
- Produces: `CreateManualOrderDto.channel: OrderChannel` (required) — Task 10's
  frontend form sends this field by this exact name.

- [ ] **Step 1: Storefront checkout always writes `WEBSITE`**

In `apps/backend/src/modules/orders/checkout.service.ts`, in the `tx.order.create({
data: { ... } })` call starting at line 186, add `channel: 'WEBSITE',` right after the
`orderNumber,` line (188):

```ts
      const created = await tx.order.create({
        data: {
          orderNumber,
          channel: 'WEBSITE',
          customerId: identity.customerId ?? null,
```

- [ ] **Step 2: Add `channel` to the manual-order DTO**

In `apps/backend/src/modules/orders/dto/create-manual-order.dto.ts`, add the import and
field:

```ts
import { OrderChannel, PaymentProvider } from '@amader/db';
```

(replacing the existing `import { PaymentProvider } from '@amader/db';` line)

```ts
  @ApiProperty({
    enum: OrderChannel,
    description: 'How this order was taken — never WEBSITE for a staff-created order',
  })
  @IsEnum(OrderChannel)
  channel!: OrderChannel;
```

Add this new property right after the existing `customerId` property (after line 36).

- [ ] **Step 3: Pass it through in `AdminOrderCreationService`**

In `apps/backend/src/modules/orders/admin-order-creation.service.ts`, in the
`tx.order.create({ data: { ... } })` call starting at line 77, add `channel:
dto.channel,` right after `orderNumber: generateOrderNumber(),` (line 79):

```ts
      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          channel: dto.channel,
          customerId: dto.customerId ?? null,
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @amader/backend exec tsc --noEmit`

Expected: exits 0.

- [ ] **Step 5: Verify — start the backend and place one order of each origin**

Rebuild and restart the backend dev process (this session's established pattern — the
running backend process does not hot-reload if it was launched as a plain `node
dist/main`; confirm with `netstat -ano | findstr :3000` plus checking the process
command line, and if it's not `nest start --watch`, `pnpm --filter @amader/backend
build` then kill and relaunch it).

Then, via `curl` against `POST /api/v1/checkout` with a valid cart (or via a real
storefront checkout at `http://localhost:3001`), confirm the resulting order has
`channel: 'WEBSITE'`:

```bash
curl -s http://localhost:3000/api/v1/admin/orders/<new-order-id> -H "Authorization: Bearer <token>" | grep -o '"channel":"[A-Z]*"'
```

Expected: `"channel":"WEBSITE"`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/orders
git commit -m "Wire Order.channel into storefront checkout and manual order creation"
```

---

### Task 3: Standalone customer creation

**Files:**
- Create: `apps/backend/src/modules/customers/dto/create-customer.dto.ts`
- Modify: `apps/backend/src/modules/customers/customers.service.ts` (add
  `createCustomer` method, after `adminGet`, i.e. after line 195)
- Modify: `apps/backend/src/modules/customers/admin-customers.controller.ts` (add
  `POST /admin/customers` route)

**Interfaces:**
- Produces: `POST /admin/customers` → `AdminCustomerDto` (the same shape `GET
  /admin/customers/:id` already returns, via `toAdminCustomerDto`/`adminGet`) — Task 9's
  frontend hook calls this exact route.

- [ ] **Step 1: Create the DTO**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}
```

Save as `apps/backend/src/modules/customers/dto/create-customer.dto.ts`.

- [ ] **Step 2: Add `createCustomer` to `CustomersService`**

In `apps/backend/src/modules/customers/customers.service.ts`:

Add to the import block at the top:

```ts
import { ConflictException } from '@nestjs/common';
```

(merge into the existing `import { BadRequestException, Inject, Injectable,
NotFoundException } from '@nestjs/common';` on lines 1-6, making it read
`BadRequestException, ConflictException, Inject, Injectable, NotFoundException`.)

```ts
import { CreateCustomerDto } from './dto/create-customer.dto';
```

Add this method immediately after `adminGet` (after line 195, before `adminUpdate`):

```ts
  async createCustomer(dto: CreateCustomerDto): Promise<AdminCustomerDto> {
    const existing = await this.prisma.client.customer.findUnique({
      where: { phone: dto.phone },
    });
    if (existing) {
      throw new ConflictException(`A customer with phone "${dto.phone}" already exists`);
    }
    const customer = await this.prisma.client.customer.create({
      data: {
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
      },
    });
    return this.adminGet(customer.id);
  }
```

- [ ] **Step 3: Add the controller route**

In `apps/backend/src/modules/customers/admin-customers.controller.ts`:

Add `Post` and `Body` to the existing `@nestjs/common` import (already imports `Post`
and `Body` — no change needed there, they're already imported on line 1).

```ts
import { CreateCustomerDto } from './dto/create-customer.dto';
```

Add this route right after the class opens, before `list()` (before line 25):

```ts
  @Post()
  @RequirePermission('customer.manage')
  @ApiOkResponse({ type: AdminCustomerDto })
  create(@Body() dto: CreateCustomerDto): Promise<AdminCustomerDto> {
    return this.customers.createCustomer(dto);
  }

```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @amader/backend exec tsc --noEmit`

Expected: exits 0.

- [ ] **Step 5: Verify live**

Rebuild/restart the backend (see Task 2 Step 5 note), then:

```bash
curl -s -X POST http://localhost:3000/api/v1/admin/customers \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"phone":"01700000099","firstName":"Test","lastName":"Lead"}'
```

Expected: `200` with `{"success":true,"data":{"id":<n>,...,"phone":"01700000099",...}}`.
Repeat the same call a second time — expected: `409` with
`{"success":false,"error":{"code":"CONFLICT","message":"A customer with phone
\"01700000099\" already exists"}}`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/customers
git commit -m "Add standalone customer creation endpoint"
```

---

### Task 4: Extend `GET /admin/dashboard/overview`

**Files:**
- Modify: `apps/backend/src/modules/dashboard/dashboard.dto.ts`
- Modify: `apps/backend/src/modules/dashboard/dashboard.service.ts`

**Interfaces:**
- Consumes: `OrderChannel` enum from Task 1.
- Produces: `DashboardOverviewDto` extended with `totalProducts`, `today`, `completed`,
  `pending`, `avgOrderValue`, `ordersByChannel`, and `recentOrders[].paymentMethod` —
  Task 7's frontend hook types against this exact shape.

- [ ] **Step 1: Extend the DTO**

In `apps/backend/src/modules/dashboard/dashboard.dto.ts`, add these new classes above
`DashboardOverviewDto`:

```ts
export class OrderChannelCountDto {
  @ApiProperty() channel!: string;
  @ApiProperty() count!: number;
}

export class TopCustomerDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() orderCount!: number;
  @ApiProperty() totalSpend!: string;
}

export class PeriodStatsDto {
  @ApiProperty() orders!: number;
  @ApiProperty() revenue!: string;
}
```

Change `RecentOrderDto` (currently lines 8-15) to add the new field:

```ts
export class RecentOrderDto {
  @ApiProperty() id!: number;
  @ApiProperty() orderNumber!: string;
  @ApiProperty() customerName!: string;
  @ApiProperty() total!: string;
  @ApiProperty() status!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ enum: ['COD', 'PAID'] }) paymentMethod!: 'COD' | 'PAID';
}
```

Change `DashboardOverviewDto` (currently lines 31-40) to add the new fields:

```ts
export class DashboardOverviewDto {
  @ApiProperty() totalRevenue!: string;
  @ApiProperty() totalOrders!: number;
  @ApiProperty() totalCustomers!: number;
  @ApiProperty() totalProducts!: number;
  @ApiProperty() completedOrderRate!: number;
  @ApiProperty() avgOrderValue!: string;
  @ApiProperty({ type: PeriodStatsDto }) today!: PeriodStatsDto;
  @ApiProperty({ type: PeriodStatsDto }) completed!: PeriodStatsDto;
  @ApiProperty({ type: PeriodStatsDto }) pending!: PeriodStatsDto;
  @ApiProperty({ type: [OrderStatusCountDto] }) statusBreakdown!: OrderStatusCountDto[];
  @ApiProperty({ type: [OrderChannelCountDto] }) ordersByChannel!: OrderChannelCountDto[];
  @ApiProperty({ type: [RecentOrderDto] }) recentOrders!: RecentOrderDto[];
  @ApiProperty({ type: [TopCustomerDto] }) topCustomers!: TopCustomerDto[];
  @ApiProperty({ type: [MonthlyRevenuePointDto] }) monthlyRevenue!: MonthlyRevenuePointDto[];
  @ApiProperty({ type: [TopProductDto] }) topProducts!: TopProductDto[];
}
```

- [ ] **Step 2: Extend the service**

In `apps/backend/src/modules/dashboard/dashboard.service.ts`, replace the whole
`overview()` method (lines 11-131) with:

```ts
  async overview(): Promise<DashboardOverviewDto> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      revenueAgg,
      totalOrders,
      totalCustomers,
      totalProducts,
      completedOrders,
      completedAgg,
      pendingAgg,
      todayAgg,
      statusGroups,
      channelGroups,
      recentOrdersRaw,
      revenueOrders,
      itemsRaw,
      customerSpendRaw,
    ] = await Promise.all([
      this.prisma.client.order.aggregate({
        where: { status: NON_CANCELED },
        _sum: { totalAmount: true },
      }),
      this.prisma.client.order.count(),
      this.prisma.client.customer.count(),
      this.prisma.client.product.count(),
      this.prisma.client.order.count({ where: { status: 'COMPLETED' } }),
      this.prisma.client.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
      this.prisma.client.order.aggregate({
        where: { status: 'PENDING' },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.client.order.aggregate({
        where: { createdAt: { gte: startOfToday } },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.client.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.client.order.groupBy({ by: ['channel'], _count: { _all: true } }),
      this.prisma.client.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          customer: { select: { firstName: true, lastName: true } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { provider: true } },
        },
      }),
      this.prisma.client.order.findMany({
        where: { status: NON_CANCELED },
        select: { totalAmount: true, createdAt: true },
      }),
      this.prisma.client.orderItem.findMany({
        where: { order: { status: NON_CANCELED }, productId: { not: null } },
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          productNameSnapshot: true,
          product: { select: { slug: true } },
        },
      }),
      this.prisma.client.order.groupBy({
        by: ['customerId'],
        where: { status: NON_CANCELED, customerId: { not: null } },
        _sum: { totalAmount: true },
        _count: { _all: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 5,
      }),
    ]);

    // Bucket revenue by calendar month (real order history, not synthetic
    // weeks — the migrated data spans ~10 real months). "previousRevenue"
    // is the prior chronological month's real revenue, not a fake compare.
    const monthBuckets = new Map<string, number>();
    for (const o of revenueOrders) {
      const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + Number(o.totalAmount));
    }
    const sortedMonths = [...monthBuckets.keys()].sort();
    const monthlyRevenue = sortedMonths.slice(-12).map((key, i, arr) => {
      const [year, month] = key.split('-');
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleString('en', {
        month: 'short',
        year: '2-digit',
      });
      const prevKey = sortedMonths[sortedMonths.indexOf(arr[i]) - 1];
      return {
        label,
        revenue: monthBuckets.get(key)!.toFixed(2),
        previousRevenue: (prevKey ? monthBuckets.get(prevKey) : 0)!.toFixed(2),
      };
    });

    const productTotals = new Map<
      number,
      { name: string; slug: string | null; revenue: number; unitsSold: number }
    >();
    for (const item of itemsRaw) {
      if (item.productId == null) continue;
      const existing = productTotals.get(item.productId);
      const revenue = Number(item.unitPrice) * item.quantity;
      if (existing) {
        existing.revenue += revenue;
        existing.unitsSold += item.quantity;
      } else {
        productTotals.set(item.productId, {
          name: item.productNameSnapshot,
          slug: item.product?.slug ?? null,
          revenue,
          unitsSold: item.quantity,
        });
      }
    }
    const topProducts = [...productTotals.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([id, p]) => ({
        id,
        slug: p.slug ?? '',
        name: p.name,
        revenue: p.revenue.toFixed(2),
        unitsSold: p.unitsSold,
      }));

    const customerIds = customerSpendRaw
      .map((c) => c.customerId)
      .filter((id): id is number => id !== null);
    const customers = customerIds.length
      ? await this.prisma.client.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const customerNameById = new Map(
      customers.map((c) => [c.id, [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Customer']),
    );
    const topCustomers = customerSpendRaw.map((c) => ({
      id: c.customerId!,
      name: customerNameById.get(c.customerId!) ?? 'Customer',
      orderCount: c._count._all,
      totalSpend: (c._sum.totalAmount ?? 0).toString(),
    }));

    const totalRevenue = revenueAgg._sum.totalAmount ?? 0;

    return {
      totalRevenue: totalRevenue.toString(),
      totalOrders,
      totalCustomers,
      totalProducts,
      completedOrderRate: totalOrders > 0 ? completedOrders / totalOrders : 0,
      avgOrderValue: totalOrders > 0 ? (Number(totalRevenue) / totalOrders).toFixed(2) : '0.00',
      today: {
        orders: todayAgg._count._all,
        revenue: (todayAgg._sum.totalAmount ?? 0).toString(),
      },
      completed: {
        orders: completedOrders,
        revenue: (completedAgg._sum.totalAmount ?? 0).toString(),
      },
      pending: {
        orders: pendingAgg._count._all,
        revenue: (pendingAgg._sum.totalAmount ?? 0).toString(),
      },
      statusBreakdown: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
      ordersByChannel: channelGroups.map((g) => ({ channel: g.channel, count: g._count._all })),
      recentOrders: recentOrdersRaw.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer
          ? [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') || 'Customer'
          : 'Guest',
        total: o.totalAmount.toString(),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        paymentMethod: o.payments[0]?.provider && o.payments[0].provider !== 'COD' ? 'PAID' : 'COD',
      })),
      topCustomers,
      monthlyRevenue,
      topProducts,
    };
  }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @amader/backend exec tsc --noEmit`

Expected: exits 0. (If `groupBy` with `orderBy: { _sum: { totalAmount: 'desc' } }`
errors on the Prisma-generated type, check the generated
`node_modules/.prisma/client/index.d.ts` for `OrderGroupByArgs` — this is a standard
Prisma `groupBy` + `orderBy` on an aggregated field, supported since Prisma 4; if it
errors, add `having: undefined` is not needed — instead confirm `@prisma/client` is
`^7.8.0` per `packages/db/package.json`, which supports this natively.)

- [ ] **Step 4: Verify live**

Rebuild/restart the backend, then:

```bash
curl -s http://localhost:3000/api/v1/admin/dashboard/overview -H "Authorization: Bearer <token>"
```

Expected: `200` with `data.totalProducts` a positive integer, `data.today.orders` a
number `>= 0`, `data.ordersByChannel` an array containing at least
`{"channel":"WEBSITE","count":<n>}`, `data.topCustomers` an array of up to 5 items each
with `totalSpend`, and `data.recentOrders[0].paymentMethod` equal to `"COD"` or
`"PAID"`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/dashboard
git commit -m "Extend dashboard overview endpoint with products/today/completed/pending/topCustomers/ordersByChannel"
```

---

### Task 5: Base design tokens + Table CSS generalization

**Files:**
- Modify: `packages/admin-ui/src/globals.css`

**Interfaces:**
- Produces: new base `:root` token values (consumed automatically by every existing
  `admin-ui` component via `@theme inline`) and 8 new `--stat-*` tokens (consumed by
  Task 8's stat cards) — no code interface, pure CSS values.

- [ ] **Step 1: Swap base `:root` token values**

In `packages/admin-ui/src/globals.css`, replace lines 7-50 (the base `:root` block,
NOT `[data-theme="dark"]` and NOT `.wpfok-scope`, both of which are untouched) with:

```css
:root {
  /* Brand — the one accent color, used with restraint (§1.1) */
  --brand-500: #2570eb;
  --brand-600: #1e61d0;
  --brand-700: #1a52ae;
  --brand-400: #4e8cf0;
  --brand-50: #e8f0fe;

  /* Neutrals — light theme (default) */
  --bg: #f3f6fb;
  --surface: #ffffff;
  --surface-2: #fafbfc;
  --border: #e9eef5;
  --text: #1e293b;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;

  /* Sidebar — pure white panel, matching the reference design's sidebar. */
  --sidebar-bg: #ffffff;
  --sidebar-hover: #f2f6fd;
  --sidebar-text: #64748b;
  --sidebar-text-active: #ffffff;

  /* Semantic / accent */
  --accent-blue: #2570eb;
  --success: #22c087;
  --danger: #ef3a3a;
  --warning: #f5a623;
  --chart-current: #2570eb;
  --chart-compare: #e4e4e7;

  /* Stat-card icon tiles (Overview page, Task 8) */
  --stat-green-bg: #e3f7ee;
  --stat-green: #22c087;
  --stat-blue-bg: #e8f0fe;
  --stat-blue: #2570eb;
  --stat-orange-bg: #fef0e2;
  --stat-orange: #f7941d;
  --stat-yellow-bg: #fdf3dd;
  --stat-yellow: #e9a23b;
  --stat-red-bg: #feeaec;
  --stat-red: #ef4b62;
  --stat-purple-bg: #f1eafe;
  --stat-purple: #9b5cf6;
  --stat-indigo-bg: #eaecfe;
  --stat-indigo: #6366f1;
  --stat-teal-bg: #e0f6f2;
  --stat-teal: #14b89b;

  /* Radius (§2.6) */
  --r-card: 12px;
  --r-inner: 10px;
  --r-sm: 8px;
  --r-pill: 999px;

  /* Shadow — light theme only (§2.8) */
  --shadow-card: 0 1px 2px rgba(16, 24, 40, 0.04);
  --shadow-pop: 0 4px 16px rgba(16, 24, 40, 0.1);
}
```

- [ ] **Step 2: Register the new `--stat-*` tokens in `@theme inline`**

In the same file, in the `@theme inline { ... }` block (currently lines 77-114), add
these lines right after the existing `--color-chart-compare: var(--chart-compare);`
line:

```css
  --color-stat-green-bg: var(--stat-green-bg);
  --color-stat-green: var(--stat-green);
  --color-stat-blue-bg: var(--stat-blue-bg);
  --color-stat-blue: var(--stat-blue);
  --color-stat-orange-bg: var(--stat-orange-bg);
  --color-stat-orange: var(--stat-orange);
  --color-stat-yellow-bg: var(--stat-yellow-bg);
  --color-stat-yellow: var(--stat-yellow);
  --color-stat-red-bg: var(--stat-red-bg);
  --color-stat-red: var(--stat-red);
  --color-stat-purple-bg: var(--stat-purple-bg);
  --color-stat-purple: var(--stat-purple);
  --color-stat-indigo-bg: var(--stat-indigo-bg);
  --color-stat-indigo: var(--stat-indigo);
  --color-stat-teal-bg: var(--stat-teal-bg);
  --color-stat-teal: var(--stat-teal);
```

This makes `bg-stat-blue-bg`, `text-stat-blue`, etc. available as Tailwind utility
classes, same mechanism as the existing `bg-brand-500` etc.

- [ ] **Step 3: Generalize the Table CSS out of `.wpfok-scope`**

In the same file, the block currently reading (lines 165-230):

```css
.wpfok-scope .wpfok-table-scroll {
  ...
}

.wpfok-scope .wpfok-table {
  ...
}

.wpfok-scope .wpfok-table thead {
  ...
}

... (etc, through .wpfok-scope .wpfok-id-badge)
```

Remove the `.wpfok-scope ` prefix from every one of these selectors (`.wpfok-table-scroll`,
`.wpfok-table`, `.wpfok-table thead`, `.wpfok-table thead th`, `.wpfok-table tbody tr`,
`.wpfok-table tbody tr:nth-child(even)`, `.wpfok-table tbody tr:hover`, `.wpfok-table
tbody td`, `.wpfok-table .wpfok-no-data td`, `.wpfok-id-badge`) so they apply globally.
The rules still reference `var(--border)`, `var(--text-secondary)`, `var(--brand-50)`,
`var(--brand-500)` — which already resolve differently inside `.wpfok-scope` vs. the
base theme, so no other change is needed; the same `<Table>` component now renders
correctly in both.

Also update the comment above this block (currently reading "Data table (WPFOK
parity)...") to:

```css
/* Data table — shared `<Table>` primitive, used by every admin page (base theme
   and inside .wpfok-scope alike). Header gradient/hover tint are one-off literals
   (not reusable tokens) originally matched to the Net Profit plugin's own hardcoded
   values, but read fine against the base theme's tokens too. */
```

- [ ] **Step 4: Typecheck / build**

Run: `pnpm --filter @amader/admin-ui exec tsc --noEmit`

Expected: exits 0 (this is a CSS-only change; the command mainly confirms nothing else
broke).

- [ ] **Step 5: Verify visually**

Start the admin dev server (`pnpm --filter @amader/admin dev`, or confirm it's already
running) and open `http://localhost:3004/products` (any plain non-Net-Profit page) —
confirm the page background, cards, and buttons now show the blue palette. Then open
`http://localhost:3004/net-profit` — confirm it still looks violet/unchanged (proves the
`.wpfok-scope` override still wins there).

- [ ] **Step 6: Commit**

```bash
git add packages/admin-ui/src/globals.css
git commit -m "Reskin base admin design tokens to the blue GetCommerce palette; generalize Table CSS"
```

---

### Task 6: Shell reskin — sidebar search + topbar rebuild

**Files:**
- Modify: `packages/admin-ui/src/components/AppShell.tsx`
- Create: `apps/admin/.env.local` (dev-only, gitignored — add
  `NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3001`)

**Interfaces:**
- Produces: `AppShell` renders a sidebar search box and a rebuilt topbar (breadcrumb,
  Clear cache, Visit website, bell, avatar) with no new required props — every existing
  caller of `AppShell` (just `apps/admin/src/app/(shell)/layout.tsx`) keeps working
  unchanged.

- [ ] **Step 1: Add the sidebar search box**

In `packages/admin-ui/src/components/AppShell.tsx`, add `useState` for a filter query
(the import on line 3 already has `useState`), and add these three new icon constants
near the top (after `collapseIcon`, before `const COLLAPSED_KEY`):

```ts
const searchIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const cacheIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="m21 2-9.6 9.6" />
    <path d="m15.5 7.5 3 3L22 7l-3-3" />
  </svg>
);

const visitIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
```

Inside the `AppShell` function body, add state right after the existing `const
[collapsed, setCollapsed] = useState(false);` line:

```ts
  const [navFilter, setNavFilter] = useState("");
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  function handleClearCache() {
    setCacheMessage("Cache cleared");
    setTimeout(() => setCacheMessage(null), 2000);
  }

  function matchesFilter(item: AppNavItem): boolean {
    if (!navFilter.trim()) return true;
    const q = navFilter.trim().toLowerCase();
    if (item.label.toLowerCase().includes(q)) return true;
    return (item.children ?? []).some((c) => c.label.toLowerCase().includes(q));
  }
```

Then in the JSX, right after the closing `</div>` of the brand row (the `<div
className="flex items-center justify-between pb-[22px]">...</div>` block) and before
`<nav className="flex flex-col gap-1">`, insert:

```tsx
        <label className={cn("mb-3 flex h-9 items-center gap-2 rounded-inner border border-border bg-surface px-2.5 text-secondary", collapsed && "hidden group-hover/sidebar:flex")}>
          {searchIcon}
          <input
            type="text"
            value={navFilter}
            onChange={(e) => setNavFilter(e.target.value)}
            placeholder="Search menu..."
            className="w-full border-0 bg-transparent font-ui text-xs text-text outline-none placeholder:text-muted"
          />
        </label>
```

Then change `{nav.map((item) => ...)}` to `{nav.filter(matchesFilter).map((item) =>
...)}` (filters the sidebar list down as the admin types, purely client-side — no new
data source).

- [ ] **Step 2: Rebuild the topbar**

This removes the only remaining use of `SearchInput` in this file — delete the now-unused
`import { SearchInput } from "./SearchInput";` line (line 8) at the same time.

Replace the existing `<header className="flex h-14 flex-none items-center
justify-between border-b border-border px-6">...</header>` block (lines 163-182) with:

```tsx
        <header className="flex h-16 flex-none items-center gap-5 border-b border-border px-6">
          <div>
            <div className="flex items-center gap-1.5 font-ui text-[11px] font-bold tracking-wide text-secondary uppercase">
              <span className="text-brand-500">Home</span>
              <span className="text-muted">›</span>
              <span className="text-brand-500">{pageTitle}</span>
            </div>
            <h1 className="mt-0.5 font-ui text-lg font-extrabold text-text">{pageTitle}</h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {cacheMessage && <span className="text-xs font-semibold text-success">{cacheMessage}</span>}
            <button
              type="button"
              onClick={handleClearCache}
              className="inline-flex h-9 items-center gap-2 rounded-inner bg-[var(--stat-yellow,#e9a23b)] px-3.5 font-ui text-[13px] font-bold text-white transition-[filter] hover:brightness-95"
            >
              {cacheIcon}
              Clear cache
            </button>
            <a
              href={process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3001"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-inner bg-[#3a4356] px-3.5 font-ui text-[13px] font-bold text-white transition-[filter] hover:brightness-110"
            >
              {visitIcon}
              Visit website
            </a>
            <button
              type="button"
              onClick={onNotificationClick}
              aria-label="Notifications"
              className="relative grid h-9 w-9 place-items-center rounded-inner bg-brand-50 text-brand-500"
            >
              {bellIcon}
              {hasNotification && (
                <span className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-pill border-2 border-surface bg-danger px-1 text-[10px] font-bold text-white">
                  •
                </span>
              )}
            </button>
            <div className="grid h-9 w-9 flex-none place-items-center rounded-pill bg-brand-500 font-ui text-sm font-extrabold text-white outline outline-3 outline-brand-50">
              {userName.trim().charAt(0).toUpperCase() || "A"}
            </div>
          </div>
        </header>
```

Note this drops the old `<SearchInput />` from the topbar (the reference design's
topbar search is order-number-specific, not a generic admin search — Task 8 does not
reintroduce it, matching the design spec's scope) and the old
`dateLabel`/`hasNotification` badge dot styling is replaced with a small dot badge
matching the mockup's bell — `dateLabel` prop becomes unused; leave the prop on
`AppShellProps` (still valid TypeScript, just currently unconsumed by any caller) rather
than removing it, since removing a public prop is a wider-blast-radius change than this
task's scope.

- [ ] **Step 3: Add the dev env var**

Create `apps/admin/.env.local` (new file, this file does not exist yet in the repo) with:

```
NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3001
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @amader/admin-ui exec tsc --noEmit`

Expected: exits 0.

- [ ] **Step 5: Verify visually**

With the admin dev server running, open `http://localhost:3004/products`. Confirm: a
search box now sits above the nav list and typing into it filters the visible nav rows;
the topbar shows "Home › Products" breadcrumb + "Products" title, then Clear cache
(amber) / Visit website (dark) buttons, bell, and a blue avatar circle. Click "Clear
cache" — confirm a green "Cache cleared" message briefly appears and disappears after ~2s.
Click "Visit website" — confirm it opens `http://localhost:3001` in a new tab.

- [ ] **Step 6: Commit**

```bash
git add packages/admin-ui/src/components/AppShell.tsx apps/admin/.env.local
git commit -m "Rebuild admin topbar (clear cache, visit website, avatar) and add sidebar nav search"
```

---

### Task 7: `useDashboard` hook

**Files:**
- Create: `apps/admin/src/hooks/useDashboard.ts`

**Interfaces:**
- Consumes: `GET /admin/dashboard/overview` from Task 4.
- Produces: `useDashboardOverview()` returning a React Query result typed as
  `DashboardOverview` — Task 8's page components import this hook and this type by
  these exact names.

- [ ] **Step 1: Write the hook**

```ts
import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type DashboardOverview = components["schemas"]["DashboardOverviewDto"];

export function useDashboardOverview() {
  return useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => proxyFetch<DashboardOverview>("/admin/dashboard/overview"),
  });
}
```

Save as `apps/admin/src/hooks/useDashboard.ts`.

- [ ] **Step 2: Regenerate the API schema types**

The `components["schemas"]["DashboardOverviewDto"]` type comes from
`apps/admin/src/lib/api/schema.d.ts`, which is generated from the backend's OpenAPI
spec. Run whatever schema-generation script this repo already uses for this — check
`apps/admin/package.json` for a script name:

```bash
grep -n "\"gen\|openapi\|schema\"" apps/admin/package.json
```

Run that script (with the backend dev server up so it can fetch `/api/docs-json`).
Expected: `apps/admin/src/lib/api/schema.d.ts` is rewritten and now contains
`totalProducts`, `today`, `completed`, `pending`, `avgOrderValue`, `ordersByChannel`,
`topCustomers` inside `DashboardOverviewDto`, and `paymentMethod` inside
`RecentOrderDto`.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @amader/admin exec tsc --noEmit`

Expected: exits 0.

- [ ] **Step 4: Verify**

Add a temporary console.log-free check: render `useDashboardOverview()` anywhere
reachable (Task 8 does this for real) — or simpler, confirm via curl (already done in
Task 4 Step 4) that the proxied route works the same way through the admin's own API
route: `curl -s http://localhost:3004/api/backend/admin/dashboard/overview -H "Cookie:
<admin session cookie>"` returns the same extended shape.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/hooks/useDashboard.ts apps/admin/src/lib/api/schema.d.ts
git commit -m "Add useDashboardOverview hook"
```

---

### Task 8: New Overview page

**Files:**
- Modify: `apps/admin/src/app/(shell)/page.tsx` (full rewrite — no longer re-exports
  `NetProfitOverviewPage`)
- Create: `apps/admin/src/components/overview/OverviewCharts.tsx`
- Create: `apps/admin/src/components/overview/OverviewTables.tsx`

**Interfaces:**
- Consumes: `useDashboardOverview()` / `DashboardOverview` from Task 7; `BarChart`,
  `DoughnutChart`, `Card`, `Table`, `TableEmptyRow` from `@amader/admin-ui`.
- Produces: nothing consumed by later tasks — this is the leaf page.

- [ ] **Step 1: Build the charts component**

```tsx
"use client";

import { BarChart, DoughnutChart } from "@amader/admin-ui";
import type { DashboardOverview } from "@/hooks/useDashboard";

const CHANNEL_COLORS: Record<string, string> = {
  WEBSITE: "#2570eb",
  WHATSAPP: "#22c087",
  PHONE: "#8b5cf6",
  MARKETPLACE: "#3a4356",
  POS: "#f7941d",
  APP: "#14b89b",
};

const CHANNEL_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  PHONE: "Phone",
  MARKETPLACE: "Marketplace",
  POS: "POS",
  APP: "App",
};

export function OverviewCharts({ data }: { data: DashboardOverview }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BarChart
        title="Sales Statistics"
        currentLabel="This period"
        compareLabel="Previous period"
        data={data.monthlyRevenue.map((m) => ({
          label: m.label,
          current: Number(m.revenue),
          compare: Number(m.previousRevenue),
        }))}
      />
      <div className="rounded-card border border-border bg-surface p-[22px] shadow-card">
        <div className="mb-4 font-ui text-sm font-semibold text-text">Sales By Source</div>
        <DoughnutChart
          slices={data.ordersByChannel
            .filter((c) => c.count > 0)
            .map((c) => ({
              label: CHANNEL_LABELS[c.channel] ?? c.channel,
              value: c.count,
              color: CHANNEL_COLORS[c.channel] ?? "#94a3b8",
            }))}
        />
      </div>
    </div>
  );
}
```

Save as `apps/admin/src/components/overview/OverviewCharts.tsx`.

- [ ] **Step 2: Build the tables component**

```tsx
"use client";

import Link from "next/link";
import { Table, TableEmptyRow } from "@amader/admin-ui";
import type { DashboardOverview } from "@/hooks/useDashboard";

const STATUS_PILL: Record<string, string> = {
  COMPLETED: "bg-stat-green-bg text-stat-green",
  PROCESSING: "bg-brand-50 text-brand-500",
  PENDING: "bg-stat-yellow-bg text-stat-yellow",
  CONFIRMED: "bg-brand-50 text-brand-500",
  CANCELED: "bg-stat-red-bg text-stat-red",
};

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-inner px-2.5 py-1 text-[11px] font-bold ${className}`}>{children}</span>;
}

export function RecentOrdersTable({ data }: { data: DashboardOverview }) {
  return (
    <div className="rounded-card border border-border bg-surface p-[22px] shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-ui text-sm font-semibold text-text">Recent Orders</div>
        <Link href="/net-profit/orders" className="text-xs font-bold text-brand-500 hover:underline">
          All Orders
        </Link>
      </div>
      <div className="wpfok-table-scroll">
        <table className="wpfok-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.recentOrders.length === 0 && <TableEmptyRow colSpan={6}>No orders yet.</TableEmptyRow>}
            {data.recentOrders.map((o) => (
              <tr key={o.id}>
                <td className="font-bold text-text">#{o.orderNumber}</td>
                <td>{o.customerName}</td>
                <td>৳{Number(o.total).toLocaleString()}</td>
                <td>
                  <Pill className={o.paymentMethod === "COD" ? "bg-stat-orange-bg text-stat-orange" : "bg-stat-green-bg text-stat-green"}>
                    {o.paymentMethod}
                  </Pill>
                </td>
                <td>
                  <Pill className={STATUS_PILL[o.status] ?? "bg-surface-2 text-secondary"}>{o.status}</Pill>
                </td>
                <td>{new Date(o.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TopCustomersTable({ data }: { data: DashboardOverview }) {
  return (
    <div className="rounded-card border border-border bg-surface p-[22px] shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-ui text-sm font-semibold text-text">Top Customers</div>
        <Link href="/customers" className="text-xs font-bold text-brand-500 hover:underline">
          All Customers
        </Link>
      </div>
      <div className="wpfok-table-scroll">
        <table className="wpfok-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Orders</th>
              <th className="text-right">Total Spending</th>
            </tr>
          </thead>
          <tbody>
            {data.topCustomers.length === 0 && <TableEmptyRow colSpan={3}>No orders yet.</TableEmptyRow>}
            {data.topCustomers.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-pill bg-brand-500 text-xs font-bold text-white">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    {c.name}
                  </div>
                </td>
                <td>{c.orderCount}</td>
                <td className="text-right font-bold text-text">৳{Number(c.totalSpend).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Save as `apps/admin/src/components/overview/OverviewTables.tsx`.

- [ ] **Step 3: Rebuild the Overview page**

Replace the entire content of `apps/admin/src/app/(shell)/page.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { useDashboardOverview } from "@/hooks/useDashboard";
import { OverviewCharts } from "@/components/overview/OverviewCharts";
import { RecentOrdersTable, TopCustomersTable } from "@/components/overview/OverviewTables";

function plusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function StatCard({ label, value, sub, bg, fg, icon }: { label: string; value: string; sub?: string; bg: string; fg: string; icon: React.ReactNode }) {
  return (
    <div className="flex min-h-[118px] items-start justify-between gap-3.5 rounded-card border border-border bg-surface p-[22px] shadow-card">
      <div>
        <div className="font-ui text-[11px] font-bold tracking-wide text-secondary uppercase">{label}</div>
        <div className="mt-2 font-ui text-2xl font-extrabold text-text">{value}</div>
        {sub && <div className="mt-2 text-xs font-semibold text-muted">{sub}</div>}
      </div>
      <div className="grid h-[46px] w-[46px] flex-none place-items-center rounded-inner" style={{ background: bg, color: fg }}>
        {icon}
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: "Create Sale", href: "/orders/new", bg: "#2570eb" },
  { label: "Create Product", href: "/products/new", bg: "#ef3a3a" },
  { label: "Add Customer", href: "/customers/new", bg: "#f7941d" },
  { label: "Add Membership Tier", href: "/customers/tiers", bg: "#12b394" },
  { label: "New Discount", href: "/discounts", bg: "#7c4dff" },
  { label: "Write Blog", href: "/blog-posts/new", bg: "#3a4356" },
];

const icon = (paths: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);

export default function OverviewPage() {
  const { data, isLoading, error } = useDashboardOverview();

  if (isLoading || !data) {
    return <p className="text-sm text-muted">Loading…</p>;
  }
  if (error) {
    return <p className="text-sm text-danger">Failed to load dashboard.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3">
        <StatCard
          label="Today's Orders"
          value={String(data.today.orders)}
          sub={`${data.today.orders} Orders`}
          bg="var(--stat-green-bg)"
          fg="var(--stat-green)"
          icon={icon(<><line x1="6" y1="20" x2="6" y2="14" /><line x1="12" y1="20" x2="12" y2="8" /><line x1="18" y1="20" x2="18" y2="11" /><line x1="3" y1="20" x2="21" y2="20" /></>)}
        />
        <StatCard
          label="Lifetime Sales"
          value={`৳ ${Number(data.totalRevenue).toLocaleString()}`}
          sub={`${data.totalOrders} Orders`}
          bg="var(--stat-blue-bg)"
          fg="var(--stat-blue)"
          icon={icon(<><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>)}
        />
        <StatCard
          label="Completed Orders"
          value={`৳ ${Number(data.completed.revenue).toLocaleString()}`}
          sub={`${data.completed.orders} Orders`}
          bg="var(--stat-orange-bg)"
          fg="var(--stat-orange)"
          icon={icon(<><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>)}
        />

        <StatCard label="Total Products" value={String(data.totalProducts)} bg="var(--stat-yellow-bg)" fg="var(--stat-yellow)" icon={icon(<><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>)} />
        <StatCard label="Total Customers" value={String(data.totalCustomers)} bg="var(--stat-red-bg)" fg="var(--stat-red)" icon={icon(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>)} />
        <StatCard label="Today Revenue" value={`৳ ${Number(data.today.revenue).toLocaleString()}`} bg="var(--stat-purple-bg)" fg="var(--stat-purple)" icon={icon(<><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 6v2" /><path d="M12 16v2" /></>)} />

        <StatCard label="Average Order Value" value={`৳ ${Number(data.avgOrderValue).toLocaleString()}`} bg="var(--stat-indigo-bg)" fg="var(--stat-indigo)" icon={icon(<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6" /><path d="M9 16h6" /></>)} />
        <StatCard label="Total Revenue" value={`৳ ${Number(data.totalRevenue).toLocaleString()}`} bg="var(--stat-green-bg)" fg="var(--stat-green)" icon={icon(<><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></>)} />
        <StatCard
          label="Pending Orders"
          value={`৳ ${Number(data.pending.revenue).toLocaleString()}`}
          sub={`${data.pending.orders} Orders`}
          bg="var(--stat-teal-bg)"
          fg="var(--stat-teal)"
          icon={icon(<><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>)}
        />
      </div>

      <div className="rounded-card border border-border bg-surface p-5 lg:row-span-3">
        <div className="mb-4 font-ui text-base font-extrabold text-text">Quick Actions</div>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              style={{ background: a.bg }}
              className="flex h-[78px] flex-col items-center justify-center gap-1.5 rounded-inner text-center font-ui text-[13px] font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              {plusIcon()}
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="lg:col-span-4">
        <OverviewCharts data={data} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:col-span-4 lg:grid-cols-2">
        <RecentOrdersTable data={data} />
        <TopCustomersTable data={data} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @amader/admin exec tsc --noEmit`

Expected: exits 0.

- [ ] **Step 5: Verify visually**

Open `http://localhost:3004/` (root). Confirm: 9 stat cards with real numbers (not all
zero, assuming the dev DB has real orders/customers/products), a 6-button Quick Actions
panel that navigates correctly when clicked, a Sales Statistics bar chart, a Sales By
Source donut with a legend, and Recent Orders / Top Customers tables with real rows.
Then confirm `http://localhost:3004/net-profit` is unaffected (still its own separate
overview page, untouched).

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/app/\(shell\)/page.tsx apps/admin/src/components/overview
git commit -m "Rebuild admin Overview page with real stats, quick actions, and charts"
```

---

### Task 9: Standalone `/customers/new` page

**Files:**
- Modify: `apps/admin/src/hooks/useCustomers.ts` (add `useCreateCustomer`)
- Create: `apps/admin/src/app/(shell)/customers/new/page.tsx`

**Interfaces:**
- Consumes: `POST /admin/customers` from Task 3.

- [ ] **Step 1: Add the hook**

In `apps/admin/src/hooks/useCustomers.ts`, add this function at the end of the file:

```ts
export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { phone: string; firstName?: string; lastName?: string; email?: string }) =>
      proxyFetch<AdminCustomer>("/admin/customers", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}
```

- [ ] **Step 2: Build the page**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useCreateCustomer } from "@/hooks/useCustomers";
import { ProxyApiError } from "@/lib/api/proxy-client";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function NewCustomerPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const create = useCreateCustomer();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const customer = await create.mutateAsync({
      phone,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email || undefined,
    });
    router.push(`/customers/${customer.id}`);
  }

  return (
    <Card className="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Phone</span>
          <input required value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">First name (optional)</span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Last name (optional)</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Email (optional)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>

        {create.error && (
          <p className="text-sm text-danger">
            {create.error instanceof ProxyApiError ? create.error.message : "Failed to create customer"}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create customer"}
          </Button>
          <Link href="/customers">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
```

Save as `apps/admin/src/app/(shell)/customers/new/page.tsx`.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @amader/admin exec tsc --noEmit`

Expected: exits 0. (If `ProxyApiError` isn't exported from
`apps/admin/src/lib/api/proxy-client.ts`, check — it already is, per the class
definition at the top of that file; import as `import { ProxyApiError } from
"@/lib/api/proxy-client"`.)

- [ ] **Step 4: Verify live**

Open `http://localhost:3004/customers/new`, submit a new phone number — confirm
redirect to `/customers/{id}` and the new customer appears in the `/customers` list.
Submit the same phone again from a second tab — confirm the inline red error message
shows the "already exists" text from Task 3's `ConflictException`.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/hooks/useCustomers.ts "apps/admin/src/app/(shell)/customers/new"
git commit -m "Add standalone customer creation page"
```

---

### Task 10: Channel field on the New Order form

**Files:**
- Modify: `apps/admin/src/hooks/useOrders.ts` (add `channel` to
  `CreateManualOrderInput`)
- Modify: `apps/admin/src/app/(shell)/orders/new/page.tsx`

**Interfaces:**
- Consumes: `CreateManualOrderDto.channel` from Task 2.

- [ ] **Step 1: Extend the hook's input type**

In `apps/admin/src/hooks/useOrders.ts`, change `CreateManualOrderInput` (lines 63-70)
to:

```ts
export interface CreateManualOrderInput {
  customerId?: number;
  channel: "WHATSAPP" | "PHONE" | "MARKETPLACE" | "POS";
  shippingAddress: CreateManualOrderAddress;
  billingAddress?: CreateManualOrderAddress;
  items: { productId: number; variantId?: number; quantity: number; unitPrice?: number }[];
  paymentProvider: "COD" | "BKASH" | "NAGAD" | "ROCKET" | "UPAY";
  customerNote?: string;
}
```

(`WEBSITE` and `APP` are deliberately excluded from this admin-facing type — a
staff-entered order is never `WEBSITE` by definition, and `APP` has no reachable path
yet, per the design spec's scope.)

- [ ] **Step 2: Add the Channel field to the form**

In `apps/admin/src/app/(shell)/orders/new/page.tsx`, add this constant near the top,
right after `const PAYMENT_PROVIDERS = [...]` (line 27):

```ts
const CHANNELS = ["WHATSAPP", "PHONE", "MARKETPLACE", "POS"] as const;
const CHANNEL_LABELS: Record<(typeof CHANNELS)[number], string> = {
  WHATSAPP: "WhatsApp",
  PHONE: "Phone (Telemarketing)",
  MARKETPLACE: "Marketplace",
  POS: "In-store (POS)",
};
```

Add state inside `NewOrderForm`, right after the existing `const [paymentProvider,
setPaymentProvider] = useState<(typeof PAYMENT_PROVIDERS)[number]>("COD");` line (67):

```ts
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("WHATSAPP");
```

Add `channel,` to the `create.mutateAsync({ ... })` call (currently lines 129-136),
right after `customerId: customerId ?? undefined,`:

```ts
    const order = await create.mutateAsync({
      customerId: customerId ?? undefined,
      channel,
      shippingAddress: cleanAddress(address),
```

Add the field UI — insert a new `<Card>` right after the closing `</Card>` of the
"Customer" card (after line 198, before the "Shipping address" `<Card>`):

```tsx
        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text">Channel</h3>
          <div className="flex flex-wrap gap-4">
            {CHANNELS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-text">
                <input type="radio" name="channel" checked={channel === c} onChange={() => setChannel(c)} />
                {CHANNEL_LABELS[c]}
              </label>
            ))}
          </div>
        </Card>

```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @amader/admin exec tsc --noEmit`

Expected: exits 0.

- [ ] **Step 4: Verify live**

Open `http://localhost:3004/orders/new`, fill in a customer/address/product/payment,
select "Marketplace" for Channel, submit. Confirm the created order (visible at
`/orders/{id}` or via the same curl check as Task 2 Step 5) shows `"channel":"MARKETPLACE"`.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/hooks/useOrders.ts "apps/admin/src/app/(shell)/orders/new"
git commit -m "Add Channel field to the manual New Order form"
```

---

## Self-Review Notes

- **Spec coverage:** every section of the design spec maps to a task — tokens (5),
  Table generalization (5), AppShell/topbar (6), schema (1), checkout/manual-order
  channel (2), dashboard extension (4), Overview page (8), customer creation (3, 9),
  New Order channel field (10). `useDashboard` (7) was split out from the Overview page
  (8) since the hook is independently verifiable (curl) before any UI consumes it.
- **Deferred items are absent from every task, deliberately**: no task touches "Create
  Ticket," no task implements real cache purging, no task adds notification data — all
  three are explicitly out of scope per the design spec, not omissions.
- **Execution order matters**: Task 1 (schema) must run before Tasks 2 and 4 (both
  reference `OrderChannel`/`Order.channel`); Task 4 must run before Task 7 (hook types
  against the extended DTO); Task 7 before Task 8 (page consumes the hook). Tasks 5 and
  6 (pure frontend theming) have no backend dependency and can run any time, including
  in parallel with 1-4. Task 9 depends only on Task 3. Task 10 depends only on Task 2.
