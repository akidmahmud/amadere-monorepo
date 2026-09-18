# Sales Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/net-profit/reports` with the demo sales report. It shows per-order contribution, uses dated product costs and a courier rate card with bill import, has an Exceptions queue, and scopes views by permission.

**Architecture:** A pure TypeScript engine (a port of the demo's `calcOrder` / `flagsOf` / `summarize` and its tab aggregations) runs on the server. A loader turns Prisma rows into engine inputs, resolving each line's cost from a new `product_cost_history` table. A v2 controller serves one endpoint per tab. Agent-scoped responses have every money field stripped on the server. The admin page is rebuilt from focused components in `components/net-profit/sales-report/`.

**Tech Stack:** NestJS 11, Prisma 7 / PostgreSQL 15, Jest (`cross-env NODE_OPTIONS=--experimental-vm-modules jest`), Next.js 16 + React 19 + TanStack Query (admin), Tailwind.

**Spec:** `backend/docs/superpowers/specs/2026-09-18-sales-report-design.md`. Reference UI: `H:\Amder Project\amadere-sales-report-demo.html`. Where the spec is silent, the demo's behaviour is the requirement.

## Global Constraints

- **No git operations.** The owner handles git, so there are no commit steps. After each task, append a short entry to `backend/bug-fix-and-feature-edit.md` instead.
- All paths below are relative to `H:\Amder Project\backend\`.
- Backend tests: `cd apps/backend && npx cross-env NODE_OPTIONS=--experimental-vm-modules jest <path>`
- Backend typecheck: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
- Admin typecheck: `cd apps/admin && npx tsc --noEmit -p tsconfig.json`
- The app DB is **`amader_migration`** on `localhost:5433` (user `amader`), not `amader`.
- Dates in the engine are `YYYY-MM-DD` strings in **Asia/Dhaka** (UTC+6, no DST).
- **Money never reaches `net_profit_reports.view_own`-only users.** It is stripped on the server, not just hidden in the UI.
- Missing cost means the order is excluded and flagged. Never estimate a cost (spec D4).
- Colours use the admin green, not violet: `GREEN #2e7d43`, `GREEN_WASH #eaf4ec`, `LINE #e5ebe6`, `INK #1e2b22`, `MUTED #64766b`. The gain/loss/amber tones come from the demo: gain `#0D7A54`/`#E3F3EB`, loss `#B3322C`/`#FBE8E6`, amber `#93600F`/`#FCF1DC`.
- Acceptance: the demo's 01/08 orders with default settings give **contribution ৳3,438**.

## File Map

**Backend** (`apps/backend/src/`)

| File | Responsibility |
|---|---|
| `modules/net-profit/sales-report/engine/types.ts` | Engine input/output types |
| `modules/net-profit/sales-report/engine/calc.ts` | `rateFor`, `calcOrder`, `r2` |
| `modules/net-profit/sales-report/engine/summary.ts` | `flagsOf`, `summarize`, `diffDays`, `Summary` |
| `modules/net-profit/sales-report/engine/rows.ts` | Tab aggregations, `basisDate`, exception groups |
| `modules/net-profit/sales-report/engine/demo.fixture.ts` | The demo's 19 Excel-day orders + default settings (test-only) |
| `modules/net-profit/sales-report/engine/*.spec.ts` | Engine tests |
| `modules/product-cost-history/*` | New module: `ProductCostHistoryService` (single cost writer + resolver + daily sync) |
| `modules/net-profit/sales-report/report-settings.service.ts` | `sales_report` settings namespace, zones, validation |
| `modules/net-profit/sales-report/report-loader.service.ts` | Prisma → `ReportOrder[]` |
| `modules/net-profit/sales-report/report-mapping.ts` | Pure row → `ReportOrder` mapping (unit-tested) |
| `modules/net-profit/sales-report/money.ts` | `stripMoney` + `MONEY_KEYS` |
| `modules/net-profit/sales-report/sales-report-v2.service.ts` | Per-tab responses, filters, agent scope |
| `modules/net-profit/sales-report/courier-bills.ts` | Statement CSV → `{consignmentId, charge}` |
| `modules/net-profit/sales-report/courier-bills.service.ts` | Import onto `shipments` |
| `modules/net-profit/sales-report/admin-sales-report-v2.controller.ts` | `/admin/net-profit/sales-report/v2/*` |
| `modules/net-profit/sales-report/dto/report-v2-query.dto.ts` | Shared filter query DTO |
| `common/auth/permission.decorator.ts`, `common/auth/permission.guard.ts` | `RequireAnyPermission` |
| `common/csv.util.ts` | `parseCsv` (shared) |

**DB** (`packages/db/prisma/`): `schema.prisma` + migration `20260918100000_sales_report_costs_and_bills`. **Shared:** `packages/shared/src/permission-catalog.ts`.

**Admin** (`apps/admin/src/`)

| File | Responsibility |
|---|---|
| `hooks/useSalesReportV2.ts` | Types + queries + mutations |
| `components/net-profit/sales-report/format.ts` | `tk`, `pc`, `dmy`, colours, flag copy, status colours |
| `components/net-profit/sales-report/useReportFilters.ts` | URL-backed filter state |
| `components/net-profit/sales-report/exportCsv.ts` | Download current tab |
| `components/net-profit/sales-report/ReportFilters.tsx` | Two-row filter card |
| `components/net-profit/sales-report/OverviewTab.tsx` | Ledger, funnel, metric strip, channel table |
| `components/net-profit/sales-report/DailyChart.tsx` | By-day SVG |
| `components/net-profit/sales-report/OrdersTab.tsx` + `OrderDetailRow.tsx` | Orders table + expanded detail |
| `components/net-profit/sales-report/AgentsTab.tsx`, `ProductsTab.tsx`, `DistrictsTab.tsx`, `CouriersTab.tsx`, `ExceptionsTab.tsx` | Tabs |
| `components/net-profit/sales-report/RatesAndCostsTab.tsx` + `RateCardEditor.tsx`, `CostHistoryEditor.tsx`, `OtherCostsCard.tsx`, `CourierBillImport.tsx`, `LegacySettings.tsx` | Rates and costs |
| `app/(shell)/net-profit/reports/page.tsx` | Rewritten shell |
| `app/api/backend/admin/net-profit/sales-report/v2/courier-bills/route.ts` | Multipart proxy |
| `lib/nav-config.tsx`, `app/(shell)/layout.tsx` | Any-of nav permission |

---

## Part 1: Engine

### Task 1: Engine types, `calcOrder`, and the demo fixture

**Files:**
- Create: `apps/backend/src/modules/net-profit/sales-report/engine/types.ts`
- Create: `apps/backend/src/modules/net-profit/sales-report/engine/calc.ts`
- Create: `apps/backend/src/modules/net-profit/sales-report/engine/demo.fixture.ts`
- Test: `apps/backend/src/modules/net-profit/sales-report/engine/calc.spec.ts`

**Interfaces:**
- Produces: `ReportOrder`, `ReportLine`, `ReportSettings`, `CourierRate`, `ZoneRate`, `Thresholds`, `OrderCalc`, `CalcLine`, `ReportStatus`, `STATUSES`, `SHIPPED_STATUSES`, `FlagKey`; `calcOrder(o, S): OrderCalc`, `rateFor(rc, zone, w): number | null`, `r2(n)`; fixture `DEMO_EXCEL_DAY: ReportOrder[]`, `demoSettings(): ReportSettings`, `DEMO_TODAY = '2026-08-07'`.

- [ ] **Step 1: Create `engine/types.ts`**

```ts
export type ReportStatus = 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Returned' | 'Cancelled';
export const STATUSES: ReportStatus[] = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Returned', 'Cancelled'];
export const SHIPPED_STATUSES: ReportStatus[] = ['Shipped', 'Delivered', 'Returned'];
export type CustomerType = 'New' | 'Repeat';
export type FlagKey = 'loss' | 'low' | 'over' | 'nocourier' | 'stuck' | 'nobill' | 'unconf' | 'nocost';

/** One order line with its cost already resolved for the order date. */
export interface ReportLine {
  /** Groups the Products tab: `v<variantId>`, `p<productId>`, or `n:<name>` once the product is gone. */
  key: string;
  name: string;
  qty: number;
  /** Unit selling price. */
  price: number;
  /** Taka off this line (the order discount, spread by value). */
  disc: number;
  /** kg per unit; 0 when unknown. */
  unitWeight: number;
  /** Cost per unit active on the order date; null = missing. */
  unitCost: number | null;
  /** False when that cost row is unconfirmed. */
  costOk: boolean;
}

export interface ReportHistory {
  confirmed?: string;
  shipped?: string;
  delivered?: string;
  returned?: string;
  cancelled?: string;
}

export interface ReportOrder {
  id: number;
  orderNumber: string;
  /** Order date, YYYY-MM-DD in Asia/Dhaka. */
  date: string;
  status: ReportStatus;
  channel: string;
  agentId: number | null;
  agentName: string | null;
  customer: string;
  phone: string;
  ctype: CustomerType;
  district: string;
  zone: string;
  lines: ReportLine[];
  /** Delivery charge the customer paid. */
  delivery: number;
  /** Payment provider key: COD, BKASH, NAGAD... */
  payment: string;
  advance: number;
  /** Courier key (CourierProviderName) or null when not set. */
  courier: string | null;
  /** What the courier billed, from the statement import; null = no bill yet. */
  actual: number | null;
  hist: ReportHistory;
}

export interface ZoneRate {
  smallMax: number;
  small: number;
  first: number;
  extra: number;
}

export interface CourierRate {
  /** COD charge, % */
  cod: number;
  codBase: 'product' | 'collect';
  /** Return charge as % of the weight rate. */
  returnPct: number;
  zones: Record<string, ZoneRate>;
}

export interface Thresholds {
  low: number;
  over: number;
  pending: number;
  bill: number;
}

export interface ReportSettings {
  rates: Record<string, CourierRate>;
  packaging: number;
  /** % on the advance, keyed by payment provider. */
  fees: Record<string, number>;
  th: Thresholds;
}

export interface CalcLine extends ReportLine {
  gross: number;
  net: number;
  weight: number;
  cogs: number | null;
}

export interface OrderCalc {
  o: ReportOrder;
  lines: CalcLine[];
  netSales: number;
  weight: number;
  zone: string;
  collect: number;
  rate: number | null;
  cod: number;
  expected: number | null;
  shipped: boolean;
  courierCharge: number | null;
  estimated: boolean;
  overcharge: number | null;
  cogs: number | null;
  packaging: number;
  fee: number;
  contribution: number | null;
  subsidy: number | null;
  receivable: number | null;
  unconfirmed: boolean;
}
```

- [ ] **Step 2: Create `engine/demo.fixture.ts`** (the demo's `EXCEL_ORDERS`, `SKUS`, and `defaultSettings().costs`, copied verbatim)

```ts
import type { ReportOrder, ReportSettings } from './types';

// The 19 orders the demo reproduces from Daily_Sales_Data.xlsx (01/08/2026) and
// its default settings, copied from amadere-sales-report-demo.html so the engine
// is checked against the figures the owner has already seen (৳3,438).
const SKUS: Record<string, { name: string; weight: number }> = {
  JA1: { name: 'Jober Atta 1 kg', weight: 1 },
  JC1: { name: 'Jober Chatu 1 kg', weight: 1 },
  JC05: { name: 'Jober Chatu 500 g', weight: 0.5 },
  MC1: { name: 'Mixed Chatu 1 kg', weight: 1 },
  MC05: { name: 'Mixed Chatu 500 g', weight: 0.5 },
  JCH1: { name: 'Jober Chal 1 kg', weight: 1 },
  GA1: { name: 'Gomer Lal Atta 1 kg', weight: 1 },
  GA5: { name: 'Gomer Lal Atta 5 kg', weight: 5 },
  AC5: { name: 'Amon Chal Full Fiber 5 kg', weight: 5 },
  AG100: { name: 'Arjun Gura 100 g', weight: 0.1 },
};

const COSTS: Record<string, { from: string; cost: number; ok: boolean }[]> = {
  JA1: [{ from: '2026-07-01', cost: 180, ok: true }, { from: '2026-08-05', cost: 190, ok: true }],
  JC1: [{ from: '2026-07-01', cost: 220, ok: true }],
  JC05: [{ from: '2026-07-01', cost: 110, ok: true }],
  MC1: [{ from: '2026-07-01', cost: 180, ok: false }],
  MC05: [{ from: '2026-07-01', cost: 90, ok: false }],
  JCH1: [{ from: '2026-07-01', cost: 180, ok: true }],
  GA1: [{ from: '2026-07-01', cost: 70, ok: true }],
  GA5: [{ from: '2026-07-01', cost: 350, ok: true }],
  AC5: [{ from: '2026-07-01', cost: 375, ok: true }],
  AG100: [{ from: '2026-07-01', cost: 36, ok: true }],
};

const ZONE: Record<string, string> = { Dhaka: 'Inside Dhaka', Gazipur: 'Sub Dhaka', Narayanganj: 'Sub Dhaka' };
const AGENT_ID: Record<string, number> = { Jami: 1, Arafat: 2, Mim: 3, Sanowar: 4, Tahrima: 5 };

export const DEMO_TODAY = '2026-08-07';

export function demoSettings(): ReportSettings {
  const zones = () =>
    Object.fromEntries(
      ['Inside Dhaka', 'Sub Dhaka', 'Outside Dhaka'].map((z) => [z, { smallMax: 0.2, small: 80, first: 105, extra: 20 }]),
    );
  return {
    rates: Object.fromEntries(
      ['Steadfast', 'Sundarban', 'AJR'].map((c) => [c, { cod: 1, codBase: 'product' as const, returnPct: 100, zones: zones() }]),
    ),
    packaging: 0,
    fees: { COD: 0, BKASH: 0, NAGAD: 0 },
    th: { low: 50, over: 5, pending: 2, bill: 3 },
  };
}

type Item = [sku: string, qty: number, price: number, disc?: number];
interface Opt {
  payment?: string;
  advance?: number;
  courier?: string | null;
  actual?: number;
  hist?: ReportOrder['hist'];
}

let seq = 0;
function X(
  id: string,
  status: ReportOrder['status'],
  channel: string,
  agent: string | null,
  customer: string,
  ctype: ReportOrder['ctype'],
  district: string,
  items: Item[],
  delivery: number,
  opt: Opt = {},
): ReportOrder {
  const date = '2026-08-01';
  return {
    id: ++seq,
    orderNumber: `ORD-20260801-${id}`,
    date,
    status,
    channel,
    agentId: agent ? AGENT_ID[agent] : null,
    agentName: agent,
    customer,
    phone: '',
    ctype,
    district,
    zone: ZONE[district] ?? 'Outside Dhaka',
    lines: items.map(([sku, qty, price, disc]) => {
      const c = COSTS[sku].filter((h) => h.from <= date).sort((a, b) => b.from.localeCompare(a.from))[0];
      return {
        key: sku,
        name: SKUS[sku].name,
        qty,
        price,
        disc: disc ?? 0,
        unitWeight: SKUS[sku].weight,
        unitCost: c ? c.cost : null,
        costOk: c ? c.ok : false,
      };
    }),
    delivery,
    payment: opt.payment ?? 'COD',
    advance: opt.advance ?? 0,
    courier: opt.courier === undefined ? 'Steadfast' : opt.courier,
    actual: opt.actual ?? null,
    hist: opt.hist ?? {},
  };
}

const DEL = (d: string) => ({ confirmed: '2026-08-01', shipped: '2026-08-01', delivered: d });

export const DEMO_EXCEL_DAY: ReportOrder[] = [
  X('D56503', 'Pending', 'Facebook', 'Jami', 'Limon Yakin', 'New', 'Dhaka', [['JA1', 2, 350]], 100),
  X('D56504', 'Confirmed', 'Facebook', 'Jami', 'Shafiul Islam', 'New', 'Dhaka', [['JA1', 2, 350]], 100, { payment: 'BKASH', advance: 800, courier: 'AJR', hist: { confirmed: '2026-08-01' } }),
  X('D56505', 'Delivered', 'WhatsApp', 'Jami', 'Estiyak', 'New', 'Dhaka', [['MC1', 1, 350, 35]], 80, { courier: 'Sundarban', actual: 145, hist: DEL('2026-08-02') }),
  X('D56506', 'Delivered', 'Facebook', 'Arafat', 'Mozzamel Hoq', 'New', 'Dhaka', [['JC1', 1, 450]], 100, { courier: null, actual: 145, hist: DEL('2026-08-02') }),
  X('D56507', 'Confirmed', 'WhatsApp', 'Jami', 'Jannatul Ferdous', 'New', 'Gazipur', [['JC05', 1, 230]], 100, { hist: { confirmed: '2026-08-01' } }),
  X('D56508', 'Delivered', 'WhatsApp', 'Mim', 'Md. Emon', 'New', 'Gazipur', [['JA1', 2, 350]], 0, { actual: 145, hist: DEL('2026-08-02') }),
  X('D56509', 'Delivered', 'Call', 'Sanowar', 'Rashedul Haque', 'New', 'Gazipur', [['JCH1', 5, 320]], 100, { actual: 195, hist: DEL('2026-08-02') }),
  X('D56510', 'Delivered', 'WhatsApp', 'Mim', 'Kaniz Fatema Nadia', 'New', 'Rajshahi', [['GA5', 1, 500]], 100, { actual: 190, hist: DEL('2026-08-03') }),
  X('D56511', 'Delivered', 'WhatsApp', 'Mim', 'Tauhida', 'New', 'Rajshahi', [['GA1', 2, 110]], 100, { actual: 175, hist: DEL('2026-08-03') }),
  X('D56512', 'Delivered', 'Call', 'Tahrima', 'Abdullah Imam Khan', 'New', 'Rajshahi', [['JA1', 1, 350]], 100, { actual: 130, hist: DEL('2026-08-03') }),
  X('D56513', 'Delivered', 'Call', 'Arafat', 'Salma Rahman', 'Repeat', 'Rajshahi', [['AC5', 1, 550]], 100, { actual: 205, hist: DEL('2026-08-04') }),
  X('D56514', 'Delivered', 'Call', 'Arafat', 'Ruksana Sheikh', 'Repeat', 'Rajshahi', [['JA1', 2, 350]], 100, { actual: 160, hist: DEL('2026-08-03') }),
  X('D56515', 'Delivered', 'Facebook', 'Mim', 'Amina Sheikh', 'Repeat', 'Rajshahi', [['GA5', 1, 500]], 100, { actual: 190, hist: DEL('2026-08-04') }),
  X('D56516', 'Delivered', 'Call', 'Jami', 'Md. Gias Uddin', 'Repeat', 'Rajshahi', [['JC1', 4, 450]], 0, { actual: 190, hist: DEL('2026-08-03') }),
  X('D56517', 'Delivered', 'WhatsApp', 'Jami', 'Siam', 'Repeat', 'Rajshahi', [['MC1', 3, 350]], 50, { actual: 175, hist: DEL('2026-08-04') }),
  X('D56518', 'Delivered', 'Website', null, 'Md Solaiman', 'Repeat', 'Rajshahi', [['AG100', 1, 130]], 72, { actual: 145, hist: DEL('2026-08-03') }),
  X('D56519', 'Delivered', 'Website', null, 'Kusum', 'Repeat', 'Rajshahi', [['JA1', 3, 350]], 50, { actual: 190, hist: DEL('2026-08-03') }),
  X('D56520', 'Delivered', 'Website', null, 'Ahnaf', 'Repeat', 'Rajshahi', [['MC1', 3, 350]], 57, { actual: 175, hist: DEL('2026-08-04') }),
  X('D56521', 'Returned', 'Website', null, 'Sadia', 'Repeat', 'Rajshahi', [['MC05', 1, 200]], 68, { actual: 130, hist: { confirmed: '2026-08-01', shipped: '2026-08-01', returned: '2026-08-04' } }),
];

export const demoOrder = (suffix: string): ReportOrder => {
  const o = DEMO_EXCEL_DAY.find((x) => x.orderNumber.endsWith(suffix));
  if (!o) throw new Error(`no demo order ${suffix}`);
  return o;
};
```

- [ ] **Step 3: Write the failing test `engine/calc.spec.ts`**

```ts
import { calcOrder, rateFor } from './calc';
import { demoOrder, demoSettings } from './demo.fixture';

// Expected values were produced by running the demo's own engine
// (amadere-sales-report-demo.html) on the same orders.
describe('rateFor', () => {
  const rc = demoSettings().rates.Steadfast;
  it('charges the small rate up to smallMax, the first-kg rate up to 1 kg, then +extra per started kg', () => {
    expect(rateFor(rc, 'Inside Dhaka', 0.1)).toBe(80);
    expect(rateFor(rc, 'Inside Dhaka', 1)).toBe(105);
    expect(rateFor(rc, 'Inside Dhaka', 1.01)).toBe(125);
    expect(rateFor(rc, 'Inside Dhaka', 5)).toBe(185);
  });
  it('is null without a courier or a rate for the zone', () => {
    expect(rateFor(null, 'Inside Dhaka', 1)).toBeNull();
    expect(rateFor(rc, 'Mars', 1)).toBeNull();
  });
});

describe('calcOrder', () => {
  const S = demoSettings();

  it('delivered order: agreed charge, overcharge and contribution (D56505)', () => {
    const c = calcOrder(demoOrder('D56505'), S);
    expect(c).toMatchObject({
      netSales: 315, weight: 1, rate: 105, cod: 3.15, expected: 108.15, courierCharge: 145,
      overcharge: 36.85, cogs: 180, contribution: 70, subsidy: 65, receivable: 250, unconfirmed: true,
    });
  });

  it('5 kg parcel undercharged by 6 (D56509)', () => {
    const c = calcOrder(demoOrder('D56509'), S);
    expect(c).toMatchObject({ weight: 5, rate: 185, cod: 16, expected: 201, overcharge: -6, contribution: 605 });
  });

  it('a return costs the courier charge and no product cost (D56521)', () => {
    const c = calcOrder(demoOrder('D56521'), S);
    expect(c).toMatchObject({ expected: 105, courierCharge: 130, contribution: -130, receivable: -130 });
  });

  it('an order not shipped yet has no courier charge and no contribution (D56503)', () => {
    const c = calcOrder(demoOrder('D56503'), S);
    expect(c).toMatchObject({ shipped: false, courierCharge: 0, contribution: null, estimated: false });
  });

  it('a shipped order with no bill uses the estimate and says so', () => {
    const o = { ...demoOrder('D56512'), actual: null };
    const c = calcOrder(o, S);
    expect(c.estimated).toBe(true);
    expect(c.courierCharge).toBe(c.expected);
  });

  it('a missing line cost leaves contribution null but keeps the subsidy', () => {
    const base = demoOrder('D56512');
    const o = { ...base, lines: base.lines.map((l) => ({ ...l, unitCost: null })) };
    const c = calcOrder(o, S);
    expect(c.cogs).toBeNull();
    expect(c.contribution).toBeNull();
    expect(c.subsidy).not.toBeNull();
  });
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `cd apps/backend && npx cross-env NODE_OPTIONS=--experimental-vm-modules jest src/modules/net-profit/sales-report/engine/calc.spec.ts`
Expected: FAIL with `Cannot find module './calc'`.

- [ ] **Step 5: Implement `engine/calc.ts`**

```ts
import { SHIPPED_STATUSES, type CalcLine, type CourierRate, type OrderCalc, type ReportOrder, type ReportSettings } from './types';

// A line-for-line port of the demo's calcOrder (amadere-sales-report-demo.html).
// Keep the formulas identical: the owner has already reconciled them against
// Daily_Sales_Data.xlsx, and the fixture tests pin them to the demo's output.

export const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);

/** Small-parcel rate up to smallMax, first-kg rate up to 1 kg, then +extra per started kg. */
export function rateFor(rc: CourierRate | null, zone: string, w: number): number | null {
  if (!rc) return null;
  const z = rc.zones[zone];
  if (!z) return null;
  if (w <= z.smallMax + 1e-9) return z.small;
  if (w <= 1 + 1e-9) return z.first;
  return z.first + Math.ceil(w - 1 - 1e-9) * z.extra;
}

export function calcOrder(o: ReportOrder, S: ReportSettings): OrderCalc {
  const lines: CalcLine[] = o.lines.map((l) => {
    const gross = l.qty * l.price;
    return {
      ...l,
      gross,
      net: gross - l.disc,
      weight: l.qty * l.unitWeight,
      cogs: l.unitCost == null ? null : l.unitCost * l.qty,
    };
  });
  const netSales = sum(lines.map((l) => l.net));
  const weight = r2(sum(lines.map((l) => l.weight)));
  const rc = o.courier ? (S.rates[o.courier] ?? null) : null;
  const collect = Math.max(0, netSales + o.delivery - o.advance);
  const rate = rateFor(rc, o.zone, weight);
  const isRet = o.status === 'Returned';
  let cod = 0;
  if (rc && !isRet && collect > 0) cod = r2(((rc.codBase === 'product' ? netSales : collect) * rc.cod) / 100);
  const expected = rate == null || !rc ? null : isRet ? r2((rate * rc.returnPct) / 100) : r2(rate + cod);
  const shipped = SHIPPED_STATUSES.includes(o.status);
  const courierCharge = shipped ? (o.actual ?? expected) : 0;
  const estimated = shipped && o.actual == null;
  const overcharge = o.actual != null && expected != null ? r2(o.actual - expected) : null;
  const cogs = lines.some((l) => l.cogs == null) ? null : sum(lines.map((l) => l.cogs as number));
  const packaging = shipped ? S.packaging : 0;
  const fee = r2((o.advance * (S.fees[o.payment] ?? 0)) / 100);

  let contribution: number | null = null;
  let subsidy: number | null = null;
  let receivable: number | null = null;
  if (o.status === 'Delivered' && courierCharge != null) {
    if (cogs != null) contribution = r2(netSales + o.delivery - courierCharge - cogs - packaging - fee);
    subsidy = r2(courierCharge - o.delivery);
    receivable = r2(collect - courierCharge);
  }
  if (isRet && courierCharge != null) {
    contribution = r2(-courierCharge - packaging - fee);
    receivable = r2(-courierCharge);
  }
  const unconfirmed = lines.some((l) => l.unitCost != null && !l.costOk);

  return {
    o, lines, netSales, weight, zone: o.zone, collect, rate, cod, expected, shipped, courierCharge,
    estimated, overcharge, cogs, packaging, fee, contribution, subsidy, receivable, unconfirmed,
  };
}
```

- [ ] **Step 6: Run the test to confirm it passes**

Run the same command. Expected: PASS (8 tests).

- [ ] **Step 7: Log.** Append "Sales report — Task 1: engine calcOrder + demo fixture" to `backend/bug-fix-and-feature-edit.md`.

---

### Task 2: `flagsOf` and `summarize` (the ৳3,438 acceptance test)

**Files:**
- Create: `apps/backend/src/modules/net-profit/sales-report/engine/summary.ts`
- Test: `apps/backend/src/modules/net-profit/sales-report/engine/summary.spec.ts`

**Interfaces:**
- Consumes: Task 1 types, `calcOrder`.
- Produces: `diffDays(a: string, b: string): number`; `flagsOf(c: OrderCalc, S: ReportSettings, today: string): FlagKey[]`; `Summary`; `summarize(list: OrderCalc[], S: ReportSettings): Summary`.
- Summary money keys are **renamed** from the demo (`del` becomes `deliveryPaid`, `courier` becomes `courierCost`, `pack` becomes `packaging`) so that `stripMoney` (Task 10) can remove them without touching `o.courier` (the courier name).

- [ ] **Step 1: Write the failing test `engine/summary.spec.ts`**

```ts
import { calcOrder } from './calc';
import { DEMO_EXCEL_DAY, DEMO_TODAY, demoSettings } from './demo.fixture';
import { diffDays, flagsOf, summarize } from './summary';

const S = demoSettings();
const day = DEMO_EXCEL_DAY.map((o) => calcOrder(o, S));

describe('summarize — the demo\'s 01/08 Excel day', () => {
  const s = summarize(day, S);

  it('reproduces the reconciled contribution of ৳3,438', () => {
    expect(Math.round(s.contrib)).toBe(3438);
  });

  it('matches every other headline figure the demo shows', () => {
    expect(s).toMatchObject({
      n: 19, net: 10965, deliveryPaid: 1109, courierCost: 2555, cogs: 5951, retLoss: 130,
      subsidy: 1446, overN: 12, dN: 15, rN: 1, cN: 0, missing: 0, est: 0, newN: 10, repN: 9, aov: 731,
      lossRate: 0.0625,
    });
    expect(s.st).toEqual({ Pending: 1, Confirmed: 2, Shipped: 0, Delivered: 15, Returned: 1, Cancelled: 0 });
    expect(s.overPos).toBeCloseTo(330.85, 2);
    expect(s.margin).toBeCloseTo(0.31354, 4);
  });
});

describe('flagsOf', () => {
  it('raises exactly the flags the demo raises on 01/08, as of 07/08', () => {
    const flagged = day
      .map((c) => [c.o.orderNumber.slice(-6), flagsOf(c, S, DEMO_TODAY).join('|')])
      .filter(([, f]) => f);
    expect(flagged).toEqual([
      ['D56503', 'stuck'], ['D56504', 'stuck'], ['D56505', 'over|unconf'], ['D56506', 'nocourier'],
      ['D56507', 'stuck'], ['D56508', 'over'], ['D56511', 'low|over'], ['D56512', 'over'],
      ['D56513', 'over'], ['D56514', 'over'], ['D56516', 'over'], ['D56517', 'over|unconf'],
      ['D56518', 'low|over'], ['D56519', 'over'], ['D56520', 'over|unconf'], ['D56521', 'over|unconf'],
    ]);
  });

  it('flags a delivered order with a missing cost as nocost, not loss', () => {
    const base = DEMO_EXCEL_DAY[11];
    const c = calcOrder({ ...base, lines: base.lines.map((l) => ({ ...l, unitCost: null })) }, S);
    expect(flagsOf(c, S, DEMO_TODAY)).toContain('nocost');
    expect(flagsOf(c, S, DEMO_TODAY)).not.toContain('loss');
  });

  it('flags a delivered order still on its estimate after the bill threshold', () => {
    const base = DEMO_EXCEL_DAY[11]; // delivered 03/08
    const c = calcOrder({ ...base, actual: null }, S);
    expect(flagsOf(c, S, DEMO_TODAY)).toContain('nobill');
  });
});

describe('diffDays', () => {
  it('counts whole days between two dates', () => {
    expect(diffDays('2026-08-01', '2026-08-07')).toBe(6);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/backend && npx cross-env NODE_OPTIONS=--experimental-vm-modules jest src/modules/net-profit/sales-report/engine/summary.spec.ts`
Expected: FAIL, `Cannot find module './summary'`.

- [ ] **Step 3: Implement `engine/summary.ts`**

```ts
import { SHIPPED_STATUSES, STATUSES, type FlagKey, type OrderCalc, type ReportSettings, type ReportStatus } from './types';

// Port of the demo's flagsOf and summarize. The summary's money keys are
// renamed (deliveryPaid, courierCost, packaging) so stripMoney can drop them
// without touching o.courier, which is a courier NAME agents may see.

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function flagsOf(c: OrderCalc, S: ReportSettings, today: string): FlagKey[] {
  const f: FlagKey[] = [];
  const o = c.o;
  if (o.status === 'Delivered') {
    if (c.contribution == null) f.push('nocost');
    else if (c.contribution < 0) f.push('loss');
    else if (c.contribution < S.th.low) f.push('low');
  }
  if (c.overcharge != null && c.overcharge > S.th.over) f.push('over');
  if (SHIPPED_STATUSES.includes(o.status) && !o.courier) f.push('nocourier');
  if ((o.status === 'Pending' || o.status === 'Confirmed') && diffDays(o.date, today) > S.th.pending) f.push('stuck');
  if (o.status === 'Delivered' && o.actual == null && o.hist.delivered && diffDays(o.hist.delivered, today) > S.th.bill) {
    f.push('nobill');
  }
  if (c.unconfirmed && (o.status === 'Delivered' || o.status === 'Returned')) f.push('unconf');
  return f;
}

export interface Summary {
  n: number;
  st: Record<ReportStatus, number>;
  net: number;
  deliveryPaid: number;
  courierCost: number;
  cogs: number;
  packaging: number;
  fee: number;
  retLoss: number;
  contrib: number;
  subsidy: number;
  overPos: number;
  overN: number;
  dN: number;
  rN: number;
  cN: number;
  newN: number;
  repN: number;
  missing: number;
  est: number;
  grossSales: number;
  margin: number;
  aov: number;
  lossRate: number;
}

export function summarize(list: OrderCalc[], S: ReportSettings): Summary {
  const st = Object.fromEntries(STATUSES.map((x) => [x, 0])) as Record<ReportStatus, number>;
  const s: Summary = {
    n: list.length, st, net: 0, deliveryPaid: 0, courierCost: 0, cogs: 0, packaging: 0, fee: 0, retLoss: 0,
    contrib: 0, subsidy: 0, overPos: 0, overN: 0, dN: 0, rN: 0, cN: 0, newN: 0, repN: 0, missing: 0, est: 0,
    grossSales: 0, margin: 0, aov: 0, lossRate: 0,
  };
  for (const c of list) {
    const o = c.o;
    s.st[o.status]++;
    if (o.ctype === 'New') s.newN++;
    else s.repN++;
    if (c.overcharge != null && c.overcharge > 0) s.overPos += c.overcharge;
    if (c.overcharge != null && c.overcharge > S.th.over) s.overN++;
    if (o.status === 'Delivered') {
      s.grossSales += c.netSales;
      if (c.contribution == null) {
        s.missing++;
        continue;
      }
      s.dN++;
      s.net += c.netSales;
      s.deliveryPaid += o.delivery;
      s.courierCost += c.courierCharge ?? 0;
      s.cogs += c.cogs ?? 0;
      s.packaging += c.packaging;
      s.fee += c.fee;
      s.contrib += c.contribution;
      s.subsidy += c.subsidy ?? 0;
      if (c.estimated) s.est++;
    } else if (o.status === 'Returned') {
      s.rN++;
      if (c.contribution != null) {
        s.retLoss += -c.contribution;
        s.contrib += c.contribution;
      }
    } else if (o.status === 'Cancelled') {
      s.cN++;
    }
  }
  s.margin = s.net ? s.contrib / s.net : 0;
  s.aov = s.dN ? s.net / s.dN : 0;
  const closed = s.dN + s.missing + s.rN + s.cN;
  s.lossRate = closed ? (s.rN + s.cN) / closed : 0;
  return s;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run the same command. Expected: PASS (6 tests).

- [ ] **Step 5: Log.** Append "Sales report — Task 2: flags + summarize, ৳3,438 acceptance passes" to the bug-fix log.

---

### Task 3: Tab aggregations

**Files:**
- Create: `apps/backend/src/modules/net-profit/sales-report/engine/rows.ts`
- Test: `apps/backend/src/modules/net-profit/sales-report/engine/rows.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `type Basis = 'order' | 'delivered'`
  - `basisDate(o, basis): string | null`
  - `addDays(s, n): string`
  - `channelRows(set, S): { channel: string; s: Summary }[]`
  - `DayPoint { date; net; grossSales; contrib }`, `dailySeries(set, S, from, to, basis): DayPoint[]`
  - `AgentRow { agentId: number | null; agentName: string | null; s: Summary; rankSales: number; rankContrib: number }`, `agentRows(set, S): AgentRow[]`
  - `ProductRow { key; name; units; net; cogs; subsidy; other; ret; contrib; costStatus: 'confirmed' | 'unconfirmed' | 'missing' }`, `productRows(set): ProductRow[]`
  - `CourierRow { courier: string | null; n; ret; agreed; billed; over; under; overN; awaiting; awaitingAmt; collect; recv }`, `courierRows(set, S): CourierRow[]`
  - `topOvercharges(set, S, limit = 8): OrderCalc[]`
  - `DistrictRow { district; zone; s: Summary }`, `districtRows(set, S): DistrictRow[]`
  - `EXCEPTION_ORDER: FlagKey[]`, `exceptionGroups(set, S, today, allowed?: FlagKey[]): { flag: FlagKey; list: OrderCalc[] }[]`

- [ ] **Step 1: Write the failing test `engine/rows.spec.ts`** (the expected values come from the demo's formulas run on the fixture)

```ts
import { calcOrder } from './calc';
import { DEMO_EXCEL_DAY, DEMO_TODAY, demoSettings } from './demo.fixture';
import {
  agentRows, basisDate, channelRows, courierRows, dailySeries, districtRows, exceptionGroups,
  productRows, topOvercharges,
} from './rows';

const S = demoSettings();
const set = DEMO_EXCEL_DAY.map((o) => calcOrder(o, S));

it('basisDate uses the order date or the delivered/returned date', () => {
  const ret = DEMO_EXCEL_DAY[18];
  expect(basisDate(ret, 'order')).toBe('2026-08-01');
  expect(basisDate(ret, 'delivered')).toBe('2026-08-04');
  expect(basisDate(DEMO_EXCEL_DAY[0], 'delivered')).toBeNull();
});

it('channelRows: orders, delivered, net sales, contribution per channel', () => {
  const by = Object.fromEntries(channelRows(set, S).map((r) => [r.channel, [r.s.n, r.s.dN, r.s.net, r.s.contrib]]));
  expect(by).toEqual({
    Call: [5, 5, 5000, 1825], Facebook: [4, 2, 950, 245], WhatsApp: [6, 5, 2785, 715], Website: [4, 3, 2230, 653],
  });
});

it('agentRows ranks on both measures; the website bucket has no agent', () => {
  const rows = agentRows(set, S);
  const jami = rows.find((r) => r.agentName === 'Jami')!;
  expect([jami.s.n, jami.s.dN, jami.s.net, jami.s.contrib]).toEqual([6, 3, 3165, 1185]);
  const web = rows.find((r) => r.agentId === null)!;
  expect([web.s.n, web.s.contrib]).toEqual([4, 653]);
  // By contribution: Jami 1185, website 653, Sanowar 605, Arafat 535, Mim 320, Tahrima 140.
  expect(rows[0].agentName).toBe('Jami');
  expect(rows.map((r) => r.rankContrib).sort()).toEqual([1, 2, 3, 4, 5, 6]);
});

it('productRows share subsidy by weight and add back to total contribution', () => {
  const rows = productRows(set);
  const ja1 = rows.find((r) => r.key === 'JA1')!;
  expect(ja1).toMatchObject({ units: 8, net: 2800, cogs: 1440, subsidy: 375, ret: 0, contrib: 985, costStatus: 'confirmed' });
  const mc05 = rows.find((r) => r.key === 'MC05')!;
  expect(mc05).toMatchObject({ ret: 130, contrib: -130, costStatus: 'unconfirmed' });
  expect(Math.round(rows.reduce((a, r) => a + r.contrib, 0))).toBe(3438);
});

it('courierRows: agreed vs billed per courier, with the no-courier bucket', () => {
  const rows = courierRows(set, S);
  const sf = rows.find((r) => r.courier === 'Steadfast')!;
  expect(sf).toMatchObject({ n: 14, ret: 1, agreed: 2107, billed: 2395, over: 294, under: -6, overN: 11, awaiting: 0, collect: 11129, recv: 8734 });
  const none = rows.find((r) => r.courier === null)!;
  expect(none).toMatchObject({ n: 1, billed: 145, recv: 405 });
});

it('topOvercharges lists the largest first', () => {
  expect(topOvercharges(set, S, 3).map((c) => [c.o.orderNumber.slice(-6), c.overcharge])).toEqual([
    ['D56518', 63.7], ['D56511', 47.8], ['D56505', 36.85],
  ]);
});

it('districtRows summarise by district, largest net first', () => {
  const rows = districtRows(set, S);
  expect(rows[0].district).toBe('Rajshahi');
  const raj = rows[0].s;
  expect([raj.n, raj.dN, raj.net, raj.contrib, raj.deliveryPaid, raj.courierCost, raj.subsidy]).toEqual([12, 11, 7900, 2383, 829, 1925, 1096]);
});

it('dailySeries gives one point per day in range', () => {
  const pts = dailySeries(set, S, '2026-08-01', '2026-08-03', 'delivered');
  expect(pts.map((p) => p.date)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
  expect(pts[0].net).toBe(0);
});

it('exceptionGroups follow the demo order and can be restricted', () => {
  const groups = exceptionGroups(set, S, DEMO_TODAY);
  expect(groups.map((g) => g.flag)).toEqual(['over', 'stuck', 'nocourier', 'low', 'unconf']);
  expect(groups.find((g) => g.flag === 'over')!.list).toHaveLength(12);
  const agentOnly = exceptionGroups(set, S, DEMO_TODAY, ['stuck', 'nocourier']);
  expect(agentOnly.map((g) => g.flag)).toEqual(['stuck', 'nocourier']);
});
```

- [ ] **Step 2: Run the test to confirm it fails.**

Run: `cd apps/backend && npx cross-env NODE_OPTIONS=--experimental-vm-modules jest src/modules/net-profit/sales-report/engine/rows.spec.ts`
Expected: FAIL, `Cannot find module './rows'`.

- [ ] **Step 3: Implement `engine/rows.ts`**

```ts
import { r2 } from './calc';
import { flagsOf, summarize, type Summary } from './summary';
import type { FlagKey, OrderCalc, ReportOrder, ReportSettings } from './types';

// Ports of the demo's per-tab aggregations (viewOverview/viewAgents/
// productRows/viewCouriers/viewDistricts/viewExceptions), minus the HTML.

export type Basis = 'order' | 'delivered';

export function basisDate(o: ReportOrder, basis: Basis): string | null {
  return basis === 'order' ? o.date : (o.hist.delivered ?? o.hist.returned ?? null);
}

export function addDays(s: string, n: number): string {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);

export function channelRows(set: OrderCalc[], S: ReportSettings) {
  const channels = [...new Set(set.map((c) => c.o.channel))].sort();
  return channels.map((channel) => ({ channel, s: summarize(set.filter((c) => c.o.channel === channel), S) }));
}

export interface DayPoint {
  date: string;
  net: number;
  grossSales: number;
  contrib: number;
}

/** One point per day, capped at 92 days so a year-long range cannot render 365 bars. */
export function dailySeries(set: OrderCalc[], S: ReportSettings, from: string, to: string, basis: Basis): DayPoint[] {
  const out: DayPoint[] = [];
  for (let d = from; d <= to && out.length < 92; d = addDays(d, 1)) {
    const s = summarize(set.filter((c) => basisDate(c.o, basis) === d), S);
    out.push({ date: d, net: s.net, grossSales: s.grossSales, contrib: s.contrib });
  }
  return out;
}

export interface AgentRow {
  agentId: number | null;
  agentName: string | null;
  s: Summary;
  rankSales: number;
  rankContrib: number;
}

export function agentRows(set: OrderCalc[], S: ReportSettings): AgentRow[] {
  const byId = new Map<number | null, string | null>();
  for (const c of set) byId.set(c.o.agentId, c.o.agentName);
  const rows = [...byId.entries()]
    .map(([agentId, agentName]) => ({ agentId, agentName, s: summarize(set.filter((c) => c.o.agentId === agentId), S) }))
    .filter((r) => r.s.n > 0);
  const bySales = [...rows].sort((a, b) => b.s.net - a.s.net);
  const byContrib = [...rows].sort((a, b) => b.s.contrib - a.s.contrib);
  return byContrib.map((r) => ({ ...r, rankSales: bySales.indexOf(r) + 1, rankContrib: byContrib.indexOf(r) + 1 }));
}

export interface ProductRow {
  key: string;
  name: string;
  units: number;
  net: number;
  cogs: number;
  subsidy: number;
  other: number;
  ret: number;
  contrib: number;
  costStatus: 'confirmed' | 'unconfirmed' | 'missing';
}

/**
 * Delivery subsidy and return losses are shared across an order's lines by
 * weight; packaging by weight and payment fees by value — so each order's
 * parts add back to its contribution (the demo's rule).
 */
export function productRows(set: OrderCalc[]): ProductRow[] {
  const acc = new Map<string, ProductRow>();
  const get = (key: string, name: string) => {
    let r = acc.get(key);
    if (!r) {
      r = { key, name, units: 0, net: 0, cogs: 0, subsidy: 0, other: 0, ret: 0, contrib: 0, costStatus: 'confirmed' };
      acc.set(key, r);
    }
    return r;
  };
  const mark = (r: ProductRow, unitCost: number | null, costOk: boolean) => {
    if (unitCost == null) r.costStatus = 'missing';
    else if (!costOk && r.costStatus !== 'missing') r.costStatus = 'unconfirmed';
  };
  for (const c of set) {
    const n = c.lines.length || 1;
    if (c.o.status === 'Delivered') {
      if (c.contribution == null) {
        for (const l of c.lines) mark(get(l.key, l.name), l.unitCost, l.costOk);
        continue;
      }
      for (const l of c.lines) {
        const a = get(l.key, l.name);
        mark(a, l.unitCost, l.costOk);
        const ws = c.weight ? l.weight / c.weight : 1 / n;
        const vs = c.netSales ? l.net / c.netSales : 1 / n;
        const sub = (c.subsidy ?? 0) * ws;
        const other = c.packaging * ws + c.fee * vs;
        a.units += l.qty;
        a.net += l.net;
        a.cogs += l.cogs ?? 0;
        a.subsidy += sub;
        a.other += other;
        a.contrib += l.net - (l.cogs ?? 0) - sub - other;
      }
    } else if (c.o.status === 'Returned' && c.contribution != null) {
      for (const l of c.lines) {
        const a = get(l.key, l.name);
        mark(a, l.unitCost, l.costOk);
        const ws = c.weight ? l.weight / c.weight : 1 / n;
        a.ret += -c.contribution * ws;
        a.contrib += c.contribution * ws;
      }
    }
  }
  return [...acc.values()].sort((a, b) => b.contrib - a.contrib);
}

export interface CourierRow {
  courier: string | null;
  n: number;
  ret: number;
  agreed: number;
  billed: number;
  over: number;
  under: number;
  overN: number;
  awaiting: number;
  awaitingAmt: number;
  collect: number;
  recv: number;
}

export function courierRows(set: OrderCalc[], S: ReportSettings): CourierRow[] {
  const closed = set.filter((c) => c.o.status === 'Delivered' || c.o.status === 'Returned');
  const keys = [...new Set(closed.map((c) => c.o.courier).filter((k): k is string => k !== null))].sort();
  return [...keys, null]
    .map((courier) => {
      const l = closed.filter((c) => c.o.courier === courier);
      const billed = l.filter((c) => c.o.actual != null);
      const withBoth = billed.filter((c) => c.expected != null);
      const awaiting = l.filter((c) => c.o.actual == null);
      return {
        courier,
        n: l.length,
        ret: l.filter((c) => c.o.status === 'Returned').length,
        agreed: r2(sum(withBoth.map((c) => c.expected as number))),
        billed: sum(billed.map((c) => c.o.actual as number)),
        over: r2(sum(withBoth.map((c) => Math.max(0, c.overcharge as number)))),
        under: r2(sum(withBoth.map((c) => Math.min(0, c.overcharge as number)))),
        overN: withBoth.filter((c) => (c.overcharge as number) > S.th.over).length,
        awaiting: awaiting.length,
        awaitingAmt: sum(awaiting.map((c) => c.expected ?? 0)),
        collect: sum(l.filter((c) => c.o.status === 'Delivered').map((c) => c.collect)),
        recv: r2(sum(l.map((c) => c.receivable ?? 0))),
      };
    })
    .filter((r) => r.n > 0);
}

export function topOvercharges(set: OrderCalc[], S: ReportSettings, limit = 8): OrderCalc[] {
  return set
    .filter((c) => (c.o.status === 'Delivered' || c.o.status === 'Returned') && c.overcharge != null && c.overcharge > S.th.over)
    .sort((a, b) => (b.overcharge as number) - (a.overcharge as number))
    .slice(0, limit);
}

export interface DistrictRow {
  district: string;
  zone: string;
  s: Summary;
}

export function districtRows(set: OrderCalc[], S: ReportSettings): DistrictRow[] {
  const districts = [...new Set(set.map((c) => c.o.district))];
  return districts
    .map((district) => {
      const l = set.filter((c) => c.o.district === district);
      return { district, zone: l[0].zone, s: summarize(l, S) };
    })
    .sort((a, b) => b.s.net - a.s.net);
}

export const EXCEPTION_ORDER: FlagKey[] = ['loss', 'over', 'stuck', 'nocost', 'nocourier', 'nobill', 'low', 'unconf'];

export function exceptionGroups(set: OrderCalc[], S: ReportSettings, today: string, allowed?: FlagKey[]) {
  const flags = new Map(set.map((c) => [c, flagsOf(c, S, today)]));
  return EXCEPTION_ORDER.filter((f) => !allowed || allowed.includes(f))
    .map((flag) => ({ flag, list: set.filter((c) => flags.get(c)!.includes(flag)) }))
    .filter((g) => g.list.length > 0);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run the same command. Expected: PASS (9 tests).

- [ ] **Step 5: Log** the task in the bug-fix log.

---

## Part 2: Data

### Task 4: Schema, migration, backfill

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (add a model; add relation fields to `Product` and `ProductVariant`; add 3 columns to `Shipment`)
- Create: `packages/db/prisma/migrations/20260918100000_sales_report_costs_and_bills/migration.sql`

**Interfaces:**
- Produces: Prisma model `productCostHistory` with fields `id, productId, variantId, scopeKey, cost, costPriceUnit, effectiveFrom, confirmed, createdBy, createdAt`, and unique `scopeKey_effectiveFrom`. `Shipment.billedCharge`, `Shipment.billedAt`, `Shipment.billImportRef`.
- `scopeKey` is `p:<productId>` for product-level rows and `v:<variantId>` for variant rows. It exists because Postgres treats NULLs as distinct in a unique index, and Prisma can't upsert on a compound key containing a null `variantId`.

- [ ] **Step 1: Add the model to `schema.prisma`** (after `model ProductVariant { ... }`)

```prisma
/// Dated buying cost (Sales report, spec 2026-09-18 §5). One row per scope
/// (product-level `p:<id>` or variant `v:<id>`) per effective date; an order
/// uses the row active on its order date, so a new cost never rewrites past
/// reports. Product.costPerItem / ProductVariant.costPerItem mirror the row
/// active TODAY so every older screen keeps working unchanged.
model ProductCostHistory {
  id            Int            @id @default(autoincrement())
  productId     Int            @map("product_id")
  variantId     Int?           @map("variant_id")
  scopeKey      String         @map("scope_key")
  cost          Decimal        @db.Decimal(10, 2)
  costPriceUnit CostPriceUnit? @map("cost_price_unit")
  effectiveFrom DateTime       @map("effective_from") @db.Date
  confirmed     Boolean        @default(true)
  createdBy     Int?           @map("created_by")
  createdAt     DateTime       @default(now()) @map("created_at")

  product Product         @relation(fields: [productId], references: [id], onDelete: Cascade)
  variant ProductVariant? @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@unique([scopeKey, effectiveFrom])
  @@index([productId])
  @@map("product_cost_history")
}
```

Add `costHistory ProductCostHistory[]` inside `model Product { ... }` and inside `model ProductVariant { ... }`. These are relation fields only; no column changes.

Add to `model Shipment { ... }` after `settledAt`:

```prisma
  /// What the courier billed for this parcel, from a statement import
  /// (Sales report → Courier bills). Null = no bill imported yet.
  billedCharge  Decimal?  @map("billed_charge") @db.Decimal(10, 2)
  billedAt      DateTime? @map("billed_at")
  billImportRef String?   @map("bill_import_ref")
```

- [ ] **Step 2: Write `migration.sql`**

```sql
-- Sales report (spec 2026-09-18): dated product costs + per-parcel courier bills.

CREATE TABLE "product_cost_history" (
  "id" SERIAL NOT NULL,
  "product_id" INTEGER NOT NULL,
  "variant_id" INTEGER,
  "scope_key" TEXT NOT NULL,
  "cost" DECIMAL(10,2) NOT NULL,
  "cost_price_unit" "CostPriceUnit",
  "effective_from" DATE NOT NULL,
  "confirmed" BOOLEAN NOT NULL DEFAULT true,
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_cost_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_cost_history_scope_key_effective_from_key"
  ON "product_cost_history"("scope_key", "effective_from");
CREATE INDEX "product_cost_history_product_id_idx" ON "product_cost_history"("product_id");

ALTER TABLE "product_cost_history"
  ADD CONSTRAINT "product_cost_history_product_id_fkey" FOREIGN KEY ("product_id")
  REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_cost_history"
  ADD CONSTRAINT "product_cost_history_variant_id_fkey" FOREIGN KEY ("variant_id")
  REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shipments" ADD COLUMN "billed_charge" DECIMAL(10,2);
ALTER TABLE "shipments" ADD COLUMN "billed_at" TIMESTAMP(3);
ALTER TABLE "shipments" ADD COLUMN "bill_import_ref" TEXT;

-- Backfill (spec D8): every cost already entered becomes one CONFIRMED row,
-- effective from the earliest order date, so every past order finds it.
WITH first_day AS (
  SELECT COALESCE(MIN("created_at")::date, CURRENT_DATE) AS d FROM "orders"
)
INSERT INTO "product_cost_history" ("product_id", "variant_id", "scope_key", "cost", "cost_price_unit", "effective_from", "confirmed")
SELECT p."id", NULL, 'p:' || p."id", p."cost_per_item", p."cost_price_unit", first_day.d, true
FROM "products" p, first_day
WHERE p."cost_per_item" IS NOT NULL
ON CONFLICT DO NOTHING;

WITH first_day AS (
  SELECT COALESCE(MIN("created_at")::date, CURRENT_DATE) AS d FROM "orders"
)
INSERT INTO "product_cost_history" ("product_id", "variant_id", "scope_key", "cost", "effective_from", "confirmed")
SELECT v."product_id", v."id", 'v:' || v."id", v."cost_per_item", first_day.d, true
FROM "product_variants" v, first_day
WHERE v."cost_per_item" IS NOT NULL
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: Apply and generate**

Run: `cd packages/db && npx prisma migrate deploy && npx prisma generate && npx tsc -p tsconfig.json`
Expected: `1 migration applied`, the client is generated, and tsc exits 0.

- [ ] **Step 4: Verify the backfill**

Run:
```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -tAc "select (select count(*) from product_cost_history), (select count(*) from products where cost_per_item is not null) + (select count(*) from product_variants where cost_per_item is not null);"
```
Expected: the two numbers are equal.

- [ ] **Step 5: Typecheck the backend** (`npx tsc --noEmit -p tsconfig.json` in `apps/backend`). Expected: exit 0. **Log** the task.

---

### Task 5: Any-of permissions + `view_own`

**Files:**
- Modify: `packages/shared/src/permission-catalog.ts` (add `perm('net_profit_reports', 'view_own')` right after `perm('net_profit_reports', 'view')`)
- Modify: `apps/backend/src/common/auth/permission.decorator.ts`
- Modify: `apps/backend/src/common/auth/permission.guard.ts`
- Test: `apps/backend/src/common/auth/permission.guard.any.spec.ts`
- Modify: `packages/admin-ui/src/components/AppShell.tsx` (`AppNavItem.permission` type), `apps/admin/src/lib/nav-config.tsx` (reports entry), `apps/admin/src/app/(shell)/layout.tsx` (filter)

**Interfaces:**
- Produces: `RequireAnyPermission(...keys: string[])`. The guard also populates `request.adminPermissions` for it, so `@Can()` works on any-of handlers.

- [ ] **Step 1: Write the failing guard test**

```ts
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { ANY_PERMISSION_KEY, PERMISSION_KEY } from './permission.decorator';

function ctx(meta: Record<string, unknown>, request: Record<string, unknown>) {
  const handler = () => undefined;
  for (const [k, v] of Object.entries(meta)) Reflect.defineMetadata(k, v, handler);
  return { getHandler: () => handler, switchToHttp: () => ({ getRequest: () => request }) } as never;
}

function guardFor(granted: string[], isSuperAdmin = false) {
  const prisma = {
    client: {
      adminUser: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          isSuperAdmin,
          roles: [{ role: { permissions: granted.map((key) => ({ permission: { key } })) } }],
        }),
      },
    },
  };
  return new PermissionGuard(new Reflector(), prisma as never);
}

describe('PermissionGuard any-of', () => {
  it('lets through a user holding any one of the listed keys', async () => {
    const req = { adminUser: { id: 1 } } as Record<string, unknown>;
    await expect(guardFor(['net_profit_reports.view_own']).canActivate(
      ctx({ [ANY_PERMISSION_KEY]: ['net_profit_reports.view', 'net_profit_reports.view_own'] }, req),
    )).resolves.toBe(true);
    expect(req.adminPermissions).toBeDefined();
  });

  it('rejects a user holding none of them', async () => {
    await expect(guardFor(['order.view']).canActivate(
      ctx({ [ANY_PERMISSION_KEY]: ['net_profit_reports.view', 'net_profit_reports.view_own'] }, { adminUser: { id: 2 } }),
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still requires every key of RequirePermission alongside', async () => {
    await expect(guardFor(['net_profit_reports.view_own']).canActivate(
      ctx({ [PERMISSION_KEY]: ['net_profit_settings.manage'], [ANY_PERMISSION_KEY]: ['net_profit_reports.view_own'] }, { adminUser: { id: 3 } }),
    )).rejects.toBeInstanceOf(ForbiddenException);
  });
});
```

The mock matches `PermissionGuard.getPermissions`, which selects `isSuperAdmin` and `roles → role → permissions → permission.key`.

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/backend && npx cross-env NODE_OPTIONS=--experimental-vm-modules jest src/common/auth/permission.guard.any.spec.ts`
Expected: FAIL, `ANY_PERMISSION_KEY` is not exported.

- [ ] **Step 3: Implement.** In `permission.decorator.ts`, after `RequirePermission`:

```ts
export const ANY_PERMISSION_KEY = 'anyPermission';

/**
 * At least ONE listed permission is required — OR. For endpoints two tiers
 * share with different views, e.g. the Sales report: `net_profit_reports.view`
 * sees everything, `net_profit_reports.view_own` sees only their own orders
 * with money stripped. The handler branches on @Can().
 */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSION_KEY, permissions);
```

In `permission.guard.ts`, import `ANY_PERMISSION_KEY` and change `canActivate`:

```ts
    const required = meta === undefined ? [] : Array.isArray(meta) ? meta : [meta];
    const anyOf =
      this.reflector.get<string[] | undefined>(ANY_PERMISSION_KEY, context.getHandler()) ?? [];
    if (required.length === 0 && anyOf.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const resolved = await this.getPermissions(request.adminUser.id);
    const { isSuperAdmin, granted } = resolved;
    request.adminPermissions = { isSuperAdmin, granted };

    if (isSuperAdmin) return true;
    const missing = required.filter((key) => !granted.has(key));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }
    if (anyOf.length > 0 && !anyOf.some((key) => granted.has(key))) {
      throw new ForbiddenException(`Missing permission: one of ${anyOf.join(', ')}`);
    }
    return true;
```

- [ ] **Step 4: Run the test.** Expected: PASS (3). Also run `jest src/common/auth` to confirm the existing guard tests still pass.

- [ ] **Step 5: Nav any-of.** The nav entry type lives in `packages/admin-ui/src/components/AppShell.tsx` (`AppNavItem`, line ~17: `permission?: string;`). Change it to `permission?: string | string[];`. It is only read in `apps/admin/src/app/(shell)/layout.tsx`. In `apps/admin/src/lib/nav-config.tsx`, set the reports entry (`key: "net-profit-reports"`) to:

```ts
    permission: ["net_profit_reports.view", "net_profit_reports.view_own"],
```

In `apps/admin/src/app/(shell)/layout.tsx`, replace the filter predicate:

```ts
  return nav.filter((entry) => {
    if (!("permission" in entry) || !entry.permission) return true;
    const keys = Array.isArray(entry.permission) ? entry.permission : [entry.permission];
    return keys.some((k) => granted.has(k));
  });
```

- [ ] **Step 6: Typecheck** the backend and admin (both exit 0). **Log.**

---

### Task 6: `ProductCostHistoryService`

**Files:**
- Create: `apps/backend/src/modules/product-cost-history/product-cost-history.module.ts`
- Create: `apps/backend/src/modules/product-cost-history/product-cost-history.service.ts`
- Create: `apps/backend/src/modules/product-cost-history/dhaka-date.ts`
- Test: `apps/backend/src/modules/product-cost-history/product-cost-history.service.spec.ts`
- Modify: `apps/backend/src/app.module.ts` (import `ProductCostHistoryModule`)

**Interfaces:**
- Consumes: `lineUnitCost` from `modules/net-profit/order-manager/order-csv.ts`.
- Produces:
  - `dhakaDate(d: Date): string`, `dhakaDayStart(day: string): Date`, `dhakaDayEnd(day: string): Date`.
  - `CostHistoryRow { id; productId; variantId: number | null; cost: string; costPriceUnit: CostPriceUnit | null; effectiveFrom: string; confirmed: boolean; createdAt: string }`.
  - Service methods:
    - `list(productId): Promise<CostHistoryRow[]>`
    - `addCost(input: AddCostInput, adminId?: number | null): Promise<CostHistoryRow>`
    - `recordIfChanged(input: { productId: number; variantId?: number | null; cost: number; costPriceUnit?: CostPriceUnit | null }, adminId?: number | null): Promise<void>`
    - `setConfirmed(id, confirmed): Promise<CostHistoryRow>`
    - `remove(id): Promise<void>`
    - `loadResolver(productIds: number[], variantIds: number[]): Promise<CostResolver>`
    - `syncCurrent(productId, variantId | null): Promise<void>`
    - `syncDueToday(): Promise<number>` (cron)
  - `AddCostInput { productId: number; variantId?: number | null; cost: number; costPriceUnit?: CostPriceUnit | null; effectiveFrom?: string; confirmed?: boolean }`
  - `CostResolver { resolve(line: { productId: number | null; variantId: number | null; unitWeightKg: number }, date: string): { unitCost: number; ok: boolean } | null }`

- [ ] **Step 1: Write the failing tests**

```ts
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { ProductCostHistoryService } from './product-cost-history.service';
import { dhakaDate } from './dhaka-date';

const D = (v: number) => new Prisma.Decimal(v);
const row = (o: Partial<Record<string, unknown>>) => ({
  id: 1, productId: 7, variantId: null, scopeKey: 'p:7', cost: D(100), costPriceUnit: null,
  effectiveFrom: new Date('2026-07-01T00:00:00Z'), confirmed: true, createdBy: null,
  createdAt: new Date('2026-07-01T00:00:00Z'), ...o,
});

function make(rows: ReturnType<typeof row>[] = []) {
  const prisma = {
    client: {
      productCostHistory: {
        findMany: jest.fn().mockResolvedValue(rows),
        findUnique: jest.fn(),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(row({ ...create, id: 99 }))),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve(row({ ...data }))),
        delete: jest.fn(),
        count: jest.fn(),
      },
      product: { update: jest.fn() },
      productVariant: { update: jest.fn() },
    },
  };
  return { svc: new ProductCostHistoryService(prisma as never), prisma };
}

describe('dhakaDate', () => {
  it('is the calendar day in Asia/Dhaka (UTC+6)', () => {
    expect(dhakaDate(new Date('2026-08-01T18:30:00Z'))).toBe('2026-08-02');
    expect(dhakaDate(new Date('2026-08-01T17:59:00Z'))).toBe('2026-08-01');
  });
});

describe('loadResolver', () => {
  it('prefers the variant row, then the product row, active on the date', async () => {
    const { svc } = make([
      row({ id: 1, scopeKey: 'p:7', cost: D(100), effectiveFrom: new Date('2026-07-01T00:00:00Z') }),
      row({ id: 2, scopeKey: 'p:7', cost: D(120), effectiveFrom: new Date('2026-08-05T00:00:00Z'), confirmed: false }),
      row({ id: 3, scopeKey: 'v:70', variantId: 70, cost: D(55), effectiveFrom: new Date('2026-07-01T00:00:00Z') }),
    ]);
    const r = await svc.loadResolver([7], [70]);
    expect(r.resolve({ productId: 7, variantId: null, unitWeightKg: 1 }, '2026-08-04')).toEqual({ unitCost: 100, ok: true });
    expect(r.resolve({ productId: 7, variantId: null, unitWeightKg: 1 }, '2026-08-05')).toEqual({ unitCost: 120, ok: false });
    expect(r.resolve({ productId: 7, variantId: 70, unitWeightKg: 1 }, '2026-08-05')).toEqual({ unitCost: 55, ok: true });
    expect(r.resolve({ productId: 7, variantId: null, unitWeightKg: 1 }, '2026-06-30')).toBeNull();
  });

  it('scales a per-kg product rate by the line weight; null without a weight', async () => {
    const { svc } = make([row({ cost: D(800), costPriceUnit: 'PER_KG' })]);
    const r = await svc.loadResolver([7], []);
    expect(r.resolve({ productId: 7, variantId: null, unitWeightKg: 0.5 }, '2026-08-01')).toEqual({ unitCost: 400, ok: true });
    expect(r.resolve({ productId: 7, variantId: null, unitWeightKg: 0 }, '2026-08-01')).toBeNull();
  });
});

describe('recordIfChanged', () => {
  it('adds a row effective today when the cost differs from today\'s', async () => {
    const { svc, prisma } = make([row({ cost: D(100) })]);
    await svc.recordIfChanged({ productId: 7, cost: 110 });
    expect(prisma.client.productCostHistory.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scopeKey_effectiveFrom: { scopeKey: 'p:7', effectiveFrom: new Date(`${dhakaDate(new Date())}T00:00:00Z`) } },
      }),
    );
  });

  it('does nothing when the cost is unchanged', async () => {
    const { svc, prisma } = make([row({ cost: D(100) })]);
    await svc.recordIfChanged({ productId: 7, cost: 100 });
    expect(prisma.client.productCostHistory.upsert).not.toHaveBeenCalled();
  });
});

describe('remove', () => {
  it('refuses to remove the earliest row while later ones exist', async () => {
    const { svc, prisma } = make();
    prisma.client.productCostHistory.findUnique.mockResolvedValue(row({ id: 1 }));
    prisma.client.productCostHistory.count
      .mockResolvedValueOnce(0) // rows before it
      .mockResolvedValueOnce(2); // rows after it
    await expect(svc.remove(1)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('syncCurrent', () => {
  it('mirrors today\'s product-level row onto Product.costPerItem/costPriceUnit', async () => {
    const { svc, prisma } = make([row({ cost: D(130), costPriceUnit: 'PER_KG' })]);
    await svc.syncCurrent(7, null);
    expect(prisma.client.product.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { costPerItem: D(130), costPriceUnit: 'PER_KG' },
    });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/backend && npx cross-env NODE_OPTIONS=--experimental-vm-modules jest src/modules/product-cost-history`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `dhaka-date.ts`**

```ts
// Asia/Dhaka is UTC+6 all year (no DST), so a fixed offset is exact.
const OFFSET_MS = 6 * 60 * 60 * 1000;

/** The calendar day in Dhaka, YYYY-MM-DD. */
export function dhakaDate(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** 00:00:00.000 Dhaka on `day`, as a UTC instant. */
export function dhakaDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) - OFFSET_MS);
}

/** 23:59:59.999 Dhaka on `day`, as a UTC instant. */
export function dhakaDayEnd(day: string): Date {
  return new Date(Date.parse(`${day}T23:59:59.999Z`) - OFFSET_MS);
}
```

- [ ] **Step 4: Implement `product-cost-history.service.ts`**

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CostPriceUnit, Prisma } from '@amader/db';
import type { ProductCostHistory } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { lineUnitCost } from '../net-profit/order-manager/order-csv';
import { dhakaDate } from './dhaka-date';

export interface CostHistoryRow {
  id: number;
  productId: number;
  variantId: number | null;
  cost: string;
  costPriceUnit: CostPriceUnit | null;
  effectiveFrom: string;
  confirmed: boolean;
  createdAt: string;
}

export interface AddCostInput {
  productId: number;
  variantId?: number | null;
  cost: number;
  costPriceUnit?: CostPriceUnit | null;
  effectiveFrom?: string;
  confirmed?: boolean;
}

export interface CostResolver {
  resolve(
    line: { productId: number | null; variantId: number | null; unitWeightKg: number },
    date: string,
  ): { unitCost: number; ok: boolean } | null;
}

type Row = ProductCostHistory;

const scopeOf = (productId: number, variantId?: number | null) => (variantId ? `v:${variantId}` : `p:${productId}`);
const day = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (s: string) => new Date(`${s}T00:00:00Z`);

function toDto(r: Row): CostHistoryRow {
  return {
    id: r.id,
    productId: r.productId,
    variantId: r.variantId,
    cost: r.cost.toString(),
    costPriceUnit: r.costPriceUnit,
    effectiveFrom: day(r.effectiveFrom),
    confirmed: r.confirmed,
    createdAt: r.createdAt.toISOString(),
  };
}

/** The row active on `date` among rows of one scope, or undefined. */
function activeOn(rows: Row[], date: string): Row | undefined {
  let best: Row | undefined;
  for (const r of rows) {
    const from = day(r.effectiveFrom);
    if (from <= date && (!best || from > day(best.effectiveFrom))) best = r;
  }
  return best;
}

/**
 * The ONLY writer of product costs (spec §5). Every screen that edits a cost
 * calls this, so a change becomes a dated row instead of silently rewriting
 * every past report — and costPerItem stays mirrored to today's row so older
 * screens (profit, CSV export, variants tab) keep working unchanged.
 */
@Injectable()
export class ProductCostHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(productId: number): Promise<CostHistoryRow[]> {
    const rows = await this.prisma.client.productCostHistory.findMany({
      where: { productId },
      orderBy: [{ scopeKey: 'asc' }, { effectiveFrom: 'asc' }],
    });
    return rows.map(toDto);
  }

  async addCost(input: AddCostInput, adminId: number | null = null): Promise<CostHistoryRow> {
    if (!Number.isFinite(input.cost) || input.cost < 0) throw new BadRequestException('Cost must be 0 or more');
    const scopeKey = scopeOf(input.productId, input.variantId);
    const effectiveFrom = asDate(input.effectiveFrom ?? dhakaDate(new Date()));
    const data = {
      cost: new Prisma.Decimal(input.cost),
      // A rate unit only means something on a product-level cost.
      costPriceUnit: input.variantId ? null : (input.costPriceUnit ?? null),
      confirmed: input.confirmed ?? true,
    };
    const saved = await this.prisma.client.productCostHistory.upsert({
      where: { scopeKey_effectiveFrom: { scopeKey, effectiveFrom } },
      create: { productId: input.productId, variantId: input.variantId ?? null, scopeKey, effectiveFrom, createdBy: adminId, ...data },
      update: data,
    });
    await this.syncCurrent(input.productId, input.variantId ?? null);
    return toDto(saved);
  }

  /** For the old cost writers: record a new dated row only when the cost actually changed. */
  async recordIfChanged(
    input: { productId: number; variantId?: number | null; cost: number; costPriceUnit?: CostPriceUnit | null },
    adminId: number | null = null,
  ): Promise<void> {
    const rows = await this.prisma.client.productCostHistory.findMany({
      where: { scopeKey: scopeOf(input.productId, input.variantId) },
    });
    const current = activeOn(rows, dhakaDate(new Date()));
    const unit = input.variantId ? null : (input.costPriceUnit ?? null);
    if (current && Number(current.cost) === input.cost && current.costPriceUnit === unit) return;
    await this.addCost({ ...input, costPriceUnit: unit }, adminId);
  }

  async setConfirmed(id: number, confirmed: boolean): Promise<CostHistoryRow> {
    return toDto(await this.prisma.client.productCostHistory.update({ where: { id }, data: { confirmed } }));
  }

  async remove(id: number): Promise<void> {
    const r = await this.prisma.client.productCostHistory.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Cost row not found');
    const [before, after] = await Promise.all([
      this.prisma.client.productCostHistory.count({ where: { scopeKey: r.scopeKey, effectiveFrom: { lt: r.effectiveFrom } } }),
      this.prisma.client.productCostHistory.count({ where: { scopeKey: r.scopeKey, effectiveFrom: { gt: r.effectiveFrom } } }),
    ]);
    if (before === 0 && after > 0) {
      throw new BadRequestException('The earliest cost cannot be removed while later costs exist');
    }
    await this.prisma.client.productCostHistory.delete({ where: { id } });
    await this.syncCurrent(r.productId, r.variantId);
  }

  async loadResolver(productIds: number[], variantIds: number[]): Promise<CostResolver> {
    const scopes = [...productIds.map((id) => `p:${id}`), ...variantIds.map((id) => `v:${id}`)];
    const rows = scopes.length
      ? await this.prisma.client.productCostHistory.findMany({ where: { scopeKey: { in: scopes } } })
      : [];
    const byScope = new Map<string, Row[]>();
    for (const r of rows) byScope.set(r.scopeKey, [...(byScope.get(r.scopeKey) ?? []), r]);
    return {
      resolve(line, date) {
        if (line.variantId) {
          const v = activeOn(byScope.get(`v:${line.variantId}`) ?? [], date);
          if (v) return { unitCost: Number(v.cost), ok: v.confirmed };
        }
        if (!line.productId) return null;
        const p = activeOn(byScope.get(`p:${line.productId}`) ?? [], date);
        if (!p) return null;
        const cost = lineUnitCost(null, p.cost, p.costPriceUnit, line.unitWeightKg);
        return cost === null ? null : { unitCost: cost, ok: p.confirmed };
      },
    };
  }

  /** Mirror the row active today onto costPerItem (and costPriceUnit for product-level). */
  async syncCurrent(productId: number, variantId: number | null): Promise<void> {
    const rows = await this.prisma.client.productCostHistory.findMany({ where: { scopeKey: scopeOf(productId, variantId) } });
    const current = activeOn(rows, dhakaDate(new Date()));
    if (variantId) {
      await this.prisma.client.productVariant.update({
        where: { id: variantId },
        data: { costPerItem: current ? current.cost : null },
      });
    } else {
      await this.prisma.client.product.update({
        where: { id: productId },
        data: { costPerItem: current ? current.cost : null, costPriceUnit: current ? current.costPriceUnit : null },
      });
    }
  }

  /** A cost dated in the future becomes "today's" at midnight Dhaka — mirror it then. */
  @Cron('5 18 * * *') // 00:05 Asia/Dhaka
  async syncDueToday(): Promise<number> {
    const due = await this.prisma.client.productCostHistory.findMany({
      where: { effectiveFrom: asDate(dhakaDate(new Date())) },
      select: { productId: true, variantId: true },
    });
    for (const r of due) await this.syncCurrent(r.productId, r.variantId);
    return due.length;
  }
}
```

The `syncCurrent` test above expects `{ costPerItem: D(130), costPriceUnit: 'PER_KG' }`, and the implementation passes `current.cost` (a Decimal). Jest's `toHaveBeenCalledWith` compares Decimals structurally, so they match.

- [ ] **Step 5: Implement `product-cost-history.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ProductCostHistoryService } from './product-cost-history.service';

@Module({ providers: [ProductCostHistoryService], exports: [ProductCostHistoryService] })
export class ProductCostHistoryModule {}
```

Add `ProductCostHistoryModule` to `imports` in `apps/backend/src/app.module.ts`. `ScheduleModule.forRoot()` is already imported there (line ~131), so `@Cron` works.

- [ ] **Step 6: Run the tests.** Expected: PASS (7). Typecheck the backend. **Log.**

---

### Task 7: Route existing cost writers through the history

**Files:**
- Modify: `apps/backend/src/modules/products/products.service.ts` (`create` ~L556, `update` ~L676)
- Modify: `apps/backend/src/modules/products/products.module.ts` (import `ProductCostHistoryModule`)
- Modify: `apps/backend/src/modules/net-profit/profit/profit.service.ts` (`setVariantCost` L288, `setProductCost` L311, `bulkSetProductCost` L248)
- Modify: `apps/backend/src/modules/net-profit/profit/profit.module.ts` (import `ProductCostHistoryModule`)
- Modify: every spec that builds `ProductsService` or `ProfitService`. Find them with `grep -rln "ProductsService,\|ProfitService," apps/backend/src --include=*.spec.ts`.
- Test: `apps/backend/src/modules/net-profit/profit/profit.cost-history.spec.ts`

**Interfaces:**
- Consumes: `ProductCostHistoryService.recordIfChanged`.

- [ ] **Step 1: Write the failing test**

```ts
import { Test } from '@nestjs/testing';
import { Prisma } from '@amader/db';
import { ProfitService } from './profit.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { ProductCostHistoryService } from '../../product-cost-history/product-cost-history.service';

describe('ProfitService cost writers record dated history', () => {
  const history = { recordIfChanged: jest.fn() };
  const prisma = {
    client: {
      product: { update: jest.fn().mockResolvedValue({ id: 7, costPerItem: new Prisma.Decimal(90), costPriceUnit: null }), findUnique: jest.fn() },
      productVariant: { update: jest.fn().mockResolvedValue({ id: 70, productId: 7, costPerItem: new Prisma.Decimal(40) }) },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    },
  };
  let svc: ProfitService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        ProfitService,
        { provide: PrismaService, useValue: prisma },
        { provide: NetProfitSettingsService, useValue: {} },
        { provide: ProductCostHistoryService, useValue: history },
      ],
    }).compile();
    svc = mod.get(ProfitService);
  });

  it('setVariantCost records the variant cost', async () => {
    await svc.setVariantCost(70, new Prisma.Decimal(40)).catch(() => undefined);
    expect(history.recordIfChanged).toHaveBeenCalledWith({ productId: 7, variantId: 70, cost: 40 });
  });

  it('bulkSetProductCost records each product cost', async () => {
    await svc.bulkSetProductCost([{ productId: 7, costPerItem: 90 }]);
    expect(history.recordIfChanged).toHaveBeenCalledWith({ productId: 7, cost: 90, costPriceUnit: null });
  });
});
```

(`.catch` covers the method's post-update mapping queries that aren't mocked. The assertion is only about the history call.)

- [ ] **Step 2: Run it.** Expected: FAIL, since `ProductCostHistoryService` isn't a dependency and the calls aren't made.

- [ ] **Step 3: Implement.** Inject `private readonly costHistory: ProductCostHistoryService` into `ProfitService` and `ProductsService`. After each existing write:
  - `ProfitService.setVariantCost` (L288): immediately after `const v = await this.prisma.client.productVariant.update(...)` and **before** the swatch/mapping code, add `await this.costHistory.recordIfChanged({ productId: v.productId, variantId, cost: Number(costPerItem) });`
  - `ProfitService.setProductCost` (L311): immediately after its `product.update(...)`, add `await this.costHistory.recordIfChanged({ productId, cost: Number(costPerItem), costPriceUnit: <updated>.costPriceUnit });`. Assign the update result to a const if it's currently discarded.
  - `ProfitService.bulkSetProductCost` (L248) is a plain `for` loop of `product.update`. Assign each result (`const p = await ...update(...)`) and right after it add `await this.costHistory.recordIfChanged({ productId: row.productId, cost: row.costPerItem, costPriceUnit: p.costPriceUnit ?? null });`
  - `ProductsService.create`, after the product is created: `if (dto.costPerItem != null) await this.costHistory.recordIfChanged({ productId: created.id, cost: Number(dto.costPerItem), costPriceUnit: dto.costPriceUnit ?? null });`
  - `ProductsService.update`, after the update: `if (dto.costPerItem != null) await this.costHistory.recordIfChanged({ productId: id, cost: Number(dto.costPerItem), costPriceUnit: dto.costPriceUnit ?? null });`
  - Add `ProductCostHistoryModule` to the `imports` of `ProductsModule` and `ProfitModule`.
  - In every spec found by the grep above, add `{ provide: ProductCostHistoryService, useValue: { recordIfChanged: jest.fn() } }` to the providers.

- [ ] **Step 4: Run** `jest src/modules/net-profit/profit src/modules/products`. Expected: all PASS. Typecheck the backend. **Log.**

---

### Task 8: Report settings (rate card, fees, thresholds)

**Files:**
- Create: `apps/backend/src/modules/net-profit/sales-report/report-settings.service.ts`
- Test: `apps/backend/src/modules/net-profit/sales-report/report-settings.service.spec.ts`
- Modify: `sales-report.module.ts` (import `NetProfitSettingsModule` and `ShippingZonesModule`, provide `ReportSettingsService`)

**Interfaces:**
- Consumes: `NetProfitSettingsService.getNamespace/setNamespace`, `ShippingZonesService.getConfig()`, `ShippingZonesConfig`.
- Produces:
  - `zoneOf(config: ShippingZonesConfig, district: string | null | undefined): string`
  - `zoneNames(config): string[]`
  - `validateSettings(input: unknown, couriers: string[]): ReportSettings`, which throws `BadRequestException`
  - `ReportSettingsService.get(): Promise<ReportSettings>`, `.update(input): Promise<ReportSettings>`, `.zoneConfig(): Promise<ShippingZonesConfig>`
  - `REPORT_COURIERS = Object.values(CourierProviderName)`

- [ ] **Step 1: Write the failing test**

```ts
import { BadRequestException } from '@nestjs/common';
import { ReportSettingsService, validateSettings, zoneNames, zoneOf } from './report-settings.service';

const zones = {
  showOnCheckout: false,
  zones: [{ name: { en: 'Inside Dhaka', bn: '' }, fee: 80, districts: ['Dhaka'] }],
  fallback: { name: { en: 'Outside Dhaka', bn: '' }, fee: 120 },
};

describe('zoneOf', () => {
  it('matches districts case-insensitively even when zones are hidden at checkout', () => {
    expect(zoneOf(zones, 'dhaka')).toBe('Inside Dhaka');
    expect(zoneOf(zones, 'Rajshahi')).toBe('Outside Dhaka');
    expect(zoneOf(zones, null)).toBe('Outside Dhaka');
    expect(zoneNames(zones)).toEqual(['Inside Dhaka', 'Outside Dhaka']);
  });
});

describe('ReportSettingsService.get', () => {
  it('fills every courier × zone with the demo defaults', async () => {
    const svc = new ReportSettingsService(
      { getNamespace: jest.fn().mockImplementation((_ns, d) => Promise.resolve(d)) } as never,
      { getConfig: jest.fn().mockResolvedValue(zones) } as never,
    );
    const s = await svc.get();
    expect(s.rates.STEADFAST.zones['Inside Dhaka']).toEqual({ smallMax: 0.2, small: 80, first: 105, extra: 20 });
    expect(s.rates.PATHAO.zones['Outside Dhaka']).toBeDefined();
    expect(s.rates.STEADFAST).toMatchObject({ cod: 1, codBase: 'product', returnPct: 100 });
    expect(s.th).toEqual({ low: 50, over: 5, pending: 2, bill: 3 });
  });
});

describe('validateSettings', () => {
  const ok = {
    rates: { STEADFAST: { cod: 1, codBase: 'product', returnPct: 100, zones: { 'Inside Dhaka': { smallMax: 0.2, small: 80, first: 105, extra: 20 } } } },
    packaging: 0, fees: { BKASH: 1.5 }, th: { low: 50, over: 5, pending: 2, bill: 3 },
  };
  it('accepts a valid payload', () => expect(validateSettings(ok, ['STEADFAST'])).toEqual(ok));
  it('rejects negatives, unknown couriers and bad codBase', () => {
    expect(() => validateSettings({ ...ok, packaging: -1 }, ['STEADFAST'])).toThrow(BadRequestException);
    expect(() => validateSettings({ ...ok, rates: { FOO: ok.rates.STEADFAST } }, ['STEADFAST'])).toThrow(BadRequestException);
    expect(() => validateSettings({ ...ok, rates: { STEADFAST: { ...ok.rates.STEADFAST, codBase: 'x' } } }, ['STEADFAST'])).toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run it.** Expected: FAIL, module not found.

- [ ] **Step 3: Implement `report-settings.service.ts`**

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { CourierProviderName } from '@amader/db';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { ShippingZonesService } from '../../shipping-zones/shipping-zones.service';
import type { ShippingZonesConfig } from '../../shipping-zones/shipping-zones.types';
import type { CourierRate, ReportSettings, ZoneRate } from './engine/types';

const NAMESPACE = 'sales_report';
export const REPORT_COURIERS: string[] = Object.values(CourierProviderName);
const DEFAULT_ZONE: ZoneRate = { smallMax: 0.2, small: 80, first: 105, extra: 20 };
const DEFAULTS: ReportSettings = {
  rates: {},
  packaging: 0,
  fees: { COD: 0, BKASH: 0, NAGAD: 0 },
  th: { low: 50, over: 5, pending: 2, bill: 3 },
};

/** Zone name for a district — ignores showOnCheckout, which only hides the fee from customers. */
export function zoneOf(config: ShippingZonesConfig, district: string | null | undefined): string {
  const needle = district?.trim().toLowerCase();
  if (needle) {
    for (const z of config.zones) {
      if (z.districts.some((d) => d.trim().toLowerCase() === needle)) return z.name.en;
    }
  }
  return config.fallback.name.en;
}

export function zoneNames(config: ShippingZonesConfig): string[] {
  return [...config.zones.map((z) => z.name.en), config.fallback.name.en];
}

const num = (v: unknown, path: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new BadRequestException(`${path} must be a number ≥ 0`);
  return v;
};

export function validateSettings(input: unknown, couriers: string[]): ReportSettings {
  const s = input as ReportSettings;
  if (!s || typeof s !== 'object') throw new BadRequestException('Settings must be an object');
  for (const [courier, rc] of Object.entries(s.rates ?? {})) {
    if (!couriers.includes(courier)) throw new BadRequestException(`Unknown courier ${courier}`);
    num(rc.cod, `${courier} COD %`);
    num(rc.returnPct, `${courier} return %`);
    if (rc.codBase !== 'product' && rc.codBase !== 'collect') throw new BadRequestException(`${courier} COD base is invalid`);
    for (const [zone, z] of Object.entries(rc.zones ?? {})) {
      for (const k of ['smallMax', 'small', 'first', 'extra'] as const) num(z[k], `${courier} ${zone} ${k}`);
    }
  }
  num(s.packaging, 'Packaging');
  for (const [k, v] of Object.entries(s.fees ?? {})) num(v, `${k} fee`);
  for (const k of ['low', 'over', 'pending', 'bill'] as const) num(s.th?.[k], `Threshold ${k}`);
  return s;
}

@Injectable()
export class ReportSettingsService {
  constructor(
    private readonly settings: NetProfitSettingsService,
    private readonly zones: ShippingZonesService,
  ) {}

  zoneConfig(): Promise<ShippingZonesConfig> {
    return this.zones.getConfig();
  }

  /** Stored settings, with every courier × current shipping zone filled with defaults. */
  async get(): Promise<ReportSettings> {
    const [stored, config] = await Promise.all([this.settings.getNamespace(NAMESPACE, DEFAULTS), this.zoneConfig()]);
    const rates: Record<string, CourierRate> = {};
    for (const courier of REPORT_COURIERS) {
      const rc = stored.rates?.[courier];
      rates[courier] = {
        cod: rc?.cod ?? 1,
        codBase: rc?.codBase ?? 'product',
        returnPct: rc?.returnPct ?? 100,
        zones: Object.fromEntries(zoneNames(config).map((z) => [z, rc?.zones?.[z] ?? { ...DEFAULT_ZONE }])),
      };
    }
    return {
      rates,
      packaging: stored.packaging ?? 0,
      fees: { ...DEFAULTS.fees, ...stored.fees },
      th: { ...DEFAULTS.th, ...stored.th },
    };
  }

  async update(input: unknown): Promise<ReportSettings> {
    const valid = validateSettings(input, REPORT_COURIERS);
    await this.settings.setNamespace(NAMESPACE, valid);
    return this.get();
  }
}
```

Add `ShippingZonesModule` (`../../shipping-zones/shipping-zones.module`) and `NetProfitSettingsModule` (`../settings/net-profit-settings.module`) to `SalesReportModule.imports`, and `ReportSettingsService` to its providers.

- [ ] **Step 4: Run the tests.** Expected: PASS (5). **Log.**

---

### Task 9: Loader, Prisma → `ReportOrder`

**Files:**
- Create: `apps/backend/src/modules/net-profit/sales-report/report-mapping.ts` (pure)
- Create: `apps/backend/src/modules/net-profit/sales-report/report-loader.service.ts`
- Test: `apps/backend/src/modules/net-profit/sales-report/report-mapping.spec.ts`

**Interfaces:**
- Consumes: `dhakaDate`, `dhakaDayStart`, `dhakaDayEnd`, `CostResolver`, `zoneOf`, engine types.
- Produces:
  - `toReportStatus(s: OrderStatus): ReportStatus`
  - `CHANNEL_LABEL: Record<string, string>`, `channelLabel(c)`
  - `spreadDiscount(grosses: number[], discount: number): number[]`
  - `historyDates(entries: { status: OrderStatus; createdAt: Date }[], confirmedAt: Date | null): ReportHistory`
  - `LOADER_INCLUDE` (a Prisma include const), `LoaderRow` = `Prisma.OrderGetPayload<{ include: typeof LOADER_INCLUDE }>`
  - `toReportOrder(row: LoaderRow, ctx: { resolver: CostResolver; zones: ShippingZonesConfig; firstOrderAt: Map<string, Date> }): ReportOrder`
  - `ReportLoaderService.load(opts: LoadOptions): Promise<ReportOrder[]>`, where `LoadOptions { from?: string; to?: string; basis: Basis; ignoreDate?: boolean; agentId?: number }`

- [ ] **Step 1: Write the failing test `report-mapping.spec.ts`**

```ts
import { Prisma } from '@amader/db';
import { historyDates, spreadDiscount, toReportOrder, toReportStatus } from './report-mapping';

const D = (v: number) => new Prisma.Decimal(v);

describe('toReportStatus', () => {
  it('maps our statuses onto the report\'s six (spec D7)', () => {
    expect(toReportStatus('HOLD')).toBe('Confirmed');
    expect(toReportStatus('PROCESSING')).toBe('Shipped');
    expect(toReportStatus('COMPLETED')).toBe('Delivered');
    expect(toReportStatus('PARTIALLY_RETURNED')).toBe('Returned');
    expect(toReportStatus('CANCELED')).toBe('Cancelled');
  });
});

describe('spreadDiscount', () => {
  it('spreads the order discount by line value and sums back exactly', () => {
    expect(spreadDiscount([300, 100], 40)).toEqual([30, 10]);
    const parts = spreadDiscount([100, 100, 100], 10);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(10, 10);
  });
});

describe('historyDates', () => {
  it('uses the first entry into each status, in Dhaka dates', () => {
    const h = historyDates(
      [
        { status: 'CONFIRMED', createdAt: new Date('2026-08-01T05:00:00Z') },
        { status: 'PROCESSING', createdAt: new Date('2026-08-01T19:00:00Z') }, // 02/08 in Dhaka
        { status: 'COMPLETED', createdAt: new Date('2026-08-03T05:00:00Z') },
        { status: 'COMPLETED', createdAt: new Date('2026-08-05T05:00:00Z') },
      ],
      null,
    );
    expect(h).toEqual({ confirmed: '2026-08-01', shipped: '2026-08-02', delivered: '2026-08-03' });
  });
});

describe('toReportOrder', () => {
  const zones = { zones: [{ name: { en: 'Inside Dhaka', bn: '' }, fee: 80, districts: ['Dhaka'] }], fallback: { name: { en: 'Outside Dhaka', bn: '' }, fee: 120 } };
  const resolver = { resolve: jest.fn().mockReturnValue({ unitCost: 180, ok: true }) };
  const row = {
    id: 5, orderNumber: 'AM-5', status: 'COMPLETED', channel: 'FACEBOOK', customerId: 9,
    createdAt: new Date('2026-08-01T04:00:00Z'), confirmedAt: null,
    shippingAmount: D(100), discountAmount: D(0),
    assignedAdmin: { id: 3, firstName: 'Jami', lastName: '' },
    addresses: [{ recipientName: 'Limon', phone: '8801800000000', district: 'Dhaka' }],
    items: [{ productId: 1, variantId: null, productNameSnapshot: 'Jober Atta', unitPrice: D(350), quantity: 2, variant: null, product: { shippableWeight: D(1) } }],
    statusHistory: [{ status: 'COMPLETED', createdAt: new Date('2026-08-02T04:00:00Z') }],
    shipments: [{ provider: 'STEADFAST', billedCharge: D(130) }],
    payments: [],
    advancePayment: null,
  };

  it('builds the engine input', () => {
    const o = toReportOrder(row as never, { resolver, zones: zones as never, firstOrderAt: new Map([['c:9', new Date('2026-08-01T04:00:00Z')]]) });
    expect(o).toMatchObject({
      id: 5, orderNumber: 'AM-5', date: '2026-08-01', status: 'Delivered', channel: 'Facebook',
      agentId: 3, agentName: 'Jami', customer: 'Limon', ctype: 'New', district: 'Dhaka', zone: 'Inside Dhaka',
      delivery: 100, payment: 'COD', advance: 0, courier: 'STEADFAST', actual: 130, hist: { delivered: '2026-08-02' },
    });
    expect(o.lines[0]).toMatchObject({ key: 'p1', qty: 2, price: 350, disc: 0, unitWeight: 1, unitCost: 180, costOk: true });
  });

  it('marks a later order of the same customer as Repeat and a missing cost as null', () => {
    resolver.resolve.mockReturnValueOnce(null);
    const o = toReportOrder(row as never, { resolver, zones: zones as never, firstOrderAt: new Map([['c:9', new Date('2026-07-01T00:00:00Z')]]) });
    expect(o.ctype).toBe('Repeat');
    expect(o.lines[0].unitCost).toBeNull();
  });
});
```

- [ ] **Step 2: Run it.** Expected: FAIL, module not found.

- [ ] **Step 3: Implement `report-mapping.ts`**

```ts
import { OrderStatus, Prisma } from '@amader/db';
import { dhakaDate } from '../../product-cost-history/dhaka-date';
import type { CostResolver } from '../../product-cost-history/product-cost-history.service';
import type { ShippingZonesConfig } from '../../shipping-zones/shipping-zones.types';
import { zoneOf } from './report-settings.service';
import type { ReportHistory, ReportOrder, ReportStatus } from './engine/types';

export function toReportStatus(s: OrderStatus): ReportStatus {
  switch (s) {
    case 'PENDING': return 'Pending';
    case 'CONFIRMED':
    case 'HOLD': return 'Confirmed';
    case 'PROCESSING': return 'Shipped';
    case 'COMPLETED': return 'Delivered';
    case 'RETURNED':
    case 'PARTIALLY_RETURNED': return 'Returned';
    case 'CANCELED': return 'Cancelled';
  }
}

export const CHANNEL_LABEL: Record<string, string> = {
  WEBSITE: 'Website', WHATSAPP: 'WhatsApp', PHONE: 'Call', MARKETPLACE: 'Marketplace', POS: 'POS', APP: 'App',
  FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', TIKTOK: 'TikTok',
};
export const channelLabel = (c: string) =>
  CHANNEL_LABEL[c] ?? c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, ' ');

/** The order discount split across lines by value; the parts sum to the discount exactly. */
export function spreadDiscount(grosses: number[], discount: number): number[] {
  const total = grosses.reduce((a, b) => a + b, 0);
  if (!discount || !total) return grosses.map(() => 0);
  const parts = grosses.map((g) => Math.round(((discount * g) / total) * 100) / 100);
  parts[parts.length - 1] += discount - parts.reduce((a, b) => a + b, 0);
  return parts;
}

const FIRST: Partial<Record<OrderStatus, keyof ReportHistory>> = {
  CONFIRMED: 'confirmed', HOLD: 'confirmed', PROCESSING: 'shipped', COMPLETED: 'delivered',
  RETURNED: 'returned', PARTIALLY_RETURNED: 'returned', CANCELED: 'cancelled',
};

export function historyDates(entries: { status: OrderStatus; createdAt: Date }[], confirmedAt: Date | null): ReportHistory {
  const h: ReportHistory = {};
  for (const e of [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const k = FIRST[e.status];
    if (k && !h[k]) h[k] = dhakaDate(e.createdAt);
  }
  if (!h.confirmed && confirmedAt) h.confirmed = dhakaDate(confirmedAt);
  return h;
}

export const LOADER_INCLUDE = {
  assignedAdmin: { select: { id: true, firstName: true, lastName: true } },
  addresses: { where: { type: 'SHIPPING' as const }, take: 1, select: { recipientName: true, phone: true, district: true } },
  items: {
    orderBy: { id: 'asc' as const },
    select: {
      productId: true, variantId: true, productNameSnapshot: true, unitPrice: true, quantity: true,
      variant: { select: { weightOverride: true } },
      product: { select: { shippableWeight: true } },
    },
  },
  statusHistory: { select: { status: true, createdAt: true } },
  shipments: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { provider: true, billedCharge: true } },
  payments: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { provider: true } },
  advancePayment: { select: { paid: true } },
} satisfies Prisma.OrderInclude;

export type LoaderRow = Prisma.OrderGetPayload<{ include: typeof LOADER_INCLUDE }>;

/** Customer identity for New/Repeat: the account, else the shipping phone. */
export const customerKey = (customerId: number | null, phone: string | null | undefined) =>
  customerId ? `c:${customerId}` : phone ? `p:${phone}` : null;

export function toReportOrder(
  row: LoaderRow,
  ctx: { resolver: CostResolver; zones: ShippingZonesConfig; firstOrderAt: Map<string, Date> },
): ReportOrder {
  const date = dhakaDate(row.createdAt);
  const addr = row.addresses[0];
  const grosses = row.items.map((i) => Number(i.unitPrice) * i.quantity);
  const discs = spreadDiscount(grosses, Number(row.discountAmount));
  const key = customerKey(row.customerId, addr?.phone);
  const first = key ? ctx.firstOrderAt.get(key) : undefined;
  const shipment = row.shipments[0];
  const agentName = row.assignedAdmin
    ? `${row.assignedAdmin.firstName ?? ''} ${row.assignedAdmin.lastName ?? ''}`.trim()
    : null;
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    date,
    status: toReportStatus(row.status),
    channel: channelLabel(row.channel),
    agentId: row.assignedAdmin?.id ?? null,
    agentName,
    customer: addr?.recipientName ?? '',
    phone: addr?.phone ?? '',
    ctype: !first || row.createdAt.getTime() <= first.getTime() ? 'New' : 'Repeat',
    district: addr?.district ?? '',
    zone: zoneOf(ctx.zones, addr?.district),
    lines: row.items.map((i, idx) => {
      const unitWeight = Number(i.variant?.weightOverride ?? i.product?.shippableWeight ?? 0);
      const cost = ctx.resolver.resolve({ productId: i.productId, variantId: i.variantId, unitWeightKg: unitWeight }, date);
      return {
        key: i.variantId ? `v${i.variantId}` : i.productId ? `p${i.productId}` : `n:${i.productNameSnapshot}`,
        name: i.productNameSnapshot,
        qty: i.quantity,
        price: Number(i.unitPrice),
        disc: discs[idx],
        unitWeight,
        unitCost: cost ? cost.unitCost : null,
        costOk: cost ? cost.ok : false,
      };
    }),
    delivery: Number(row.shippingAmount),
    payment: row.payments[0]?.provider ?? 'COD',
    advance: row.advancePayment ? Number(row.advancePayment.paid) : 0,
    courier: shipment?.provider ?? null,
    actual: shipment?.billedCharge != null ? Number(shipment.billedCharge) : null,
    hist: historyDates(row.statusHistory, row.confirmedAt),
  };
}
```

- [ ] **Step 4: Implement `report-loader.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { dhakaDayEnd, dhakaDayStart } from '../../product-cost-history/dhaka-date';
import { ProductCostHistoryService } from '../../product-cost-history/product-cost-history.service';
import { ReportSettingsService } from './report-settings.service';
import { LOADER_INCLUDE, toReportOrder } from './report-mapping';
import type { Basis } from './engine/rows';
import type { ReportOrder } from './engine/types';

export interface LoadOptions {
  from?: string;
  to?: string;
  basis: Basis;
  /** Exceptions: every order ever, date range ignored (spec §8). */
  ignoreDate?: boolean;
  /** view_own scope. */
  agentId?: number;
}

@Injectable()
export class ReportLoaderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costs: ProductCostHistoryService,
    private readonly settings: ReportSettingsService,
  ) {}

  async load(opts: LoadOptions): Promise<ReportOrder[]> {
    const where: Prisma.OrderWhereInput = { deletedAt: null };
    if (opts.agentId !== undefined) where.assignedAdminId = opts.agentId;
    if (!opts.ignoreDate && opts.from && opts.to) {
      const range = { gte: dhakaDayStart(opts.from), lte: dhakaDayEnd(opts.to) };
      if (opts.basis === 'order') where.createdAt = range;
      else where.statusHistory = { some: { status: { in: ['COMPLETED', 'RETURNED', 'PARTIALLY_RETURNED'] }, createdAt: range } };
    }
    // ponytail: one read of every matching order; Exceptions (ignoreDate) reads all
    // orders ever — fine at ~100 orders/day, add a status/age bound if it slows.
    const rows = await this.prisma.client.order.findMany({ where, include: LOADER_INCLUDE, orderBy: { createdAt: 'desc' } });
    if (rows.length === 0) return [];

    const productIds = [...new Set(rows.flatMap((r) => r.items.map((i) => i.productId)).filter((x): x is number => x !== null))];
    const variantIds = [...new Set(rows.flatMap((r) => r.items.map((i) => i.variantId)).filter((x): x is number => x !== null))];
    const [resolver, zones, firstOrderAt] = await Promise.all([
      this.costs.loadResolver(productIds, variantIds),
      this.settings.zoneConfig(),
      this.firstOrders(rows),
    ]);
    return rows.map((row) => toReportOrder(row, { resolver, zones, firstOrderAt }));
  }

  /** Earliest non-cancelled order per customer (account, else shipping phone). */
  private async firstOrders(rows: { customerId: number | null; addresses: { phone: string | null }[] }[]): Promise<Map<string, Date>> {
    const customerIds = [...new Set(rows.map((r) => r.customerId).filter((x): x is number => x !== null))];
    const phones = [...new Set(rows.filter((r) => !r.customerId).map((r) => r.addresses[0]?.phone).filter((x): x is string => !!x))];
    const found = await this.prisma.client.$queryRaw<{ k: string; first: Date }[]>`
      SELECT CASE WHEN o.customer_id IS NOT NULL THEN 'c:' || o.customer_id ELSE 'p:' || a.phone END AS k,
             MIN(o.created_at) AS first
      FROM orders o
      LEFT JOIN order_addresses a ON a.order_id = o.id AND a.type = 'SHIPPING'
      WHERE o.deleted_at IS NULL AND o.status <> 'CANCELED'
        AND (o.customer_id = ANY(${customerIds}::int[]) OR (o.customer_id IS NULL AND a.phone = ANY(${phones}::text[])))
      GROUP BY 1`;
    // Keys follow report-mapping's customerKey: 'c:<customerId>' or 'p:<phone>'.
    return new Map(found.map((f) => [f.k, f.first]));
  }
}
```

Register `ReportLoaderService` in `SalesReportModule.providers`, and add `ProductCostHistoryModule` to its imports.

- [ ] **Step 5: Run the mapping tests.** Expected: PASS (6). Typecheck the backend. **Log.**

---

### Task 10: v2 service + controller + money stripping

**Files:**
- Create: `apps/backend/src/modules/net-profit/sales-report/money.ts`
- Create: `apps/backend/src/modules/net-profit/sales-report/dto/report-v2-query.dto.ts`
- Create: `apps/backend/src/modules/net-profit/sales-report/sales-report-v2.service.ts`
- Create: `apps/backend/src/modules/net-profit/sales-report/admin-sales-report-v2.controller.ts`
- Test: `apps/backend/src/modules/net-profit/sales-report/sales-report-v2.service.spec.ts`
- Modify: `sales-report.module.ts` (register the controller and service)

**Interfaces:**
- Consumes: Tasks 1–3, 6, 8, 9.
- Produces (HTTP, all under `/api/v1/admin/net-profit/sales-report/v2`):
  - `GET overview` → `{ summary: Summary; channels: {channel, s}[]; daily: DayPoint[]; options: FilterOptions }`
  - `GET orders` → `{ total: number; page: number; pageSize: number; rows: OrderRowDto[] }`, where `OrderRowDto = OrderCalc & { flags: FlagKey[] }`
  - `GET agents` → `{ rows: AgentRow[] }`
  - `GET products` → `{ rows: ProductRow[] }`
  - `GET couriers` → `{ rows: CourierRow[]; top: OrderRowDto[] }`
  - `GET districts` → `{ rows: DistrictRow[] }`
  - `GET exceptions` → `{ total: number; groups: { flag: FlagKey; rows: OrderRowDto[] }[] }`
  - `GET settings` → `{ settings: ReportSettings; couriers: string[]; zones: string[]; canEdit: boolean }`; `PUT settings` (body `ReportSettings`) → same
  - `GET costs?productId=` → `CostHistoryRow[]`; `POST costs` (`AddCostInput`); `PATCH costs/:id` (`{ confirmed: boolean }`); `DELETE costs/:id`
  - `FilterOptions { channels: string[]; agents: { id: number | null; name: string }[]; couriers: string[]; districts: string[] }`
  - `MONEY_KEYS`, `stripMoney<T>(v: T): T`

- [ ] **Step 1: Write the failing test**

```ts
import { stripMoney, MONEY_KEYS } from './money';
import { SalesReportV2Service } from './sales-report-v2.service';
import { DEMO_EXCEL_DAY, demoSettings } from './engine/demo.fixture';

function svc() {
  const loader = { load: jest.fn().mockResolvedValue(DEMO_EXCEL_DAY) };
  const settings = { get: jest.fn().mockResolvedValue(demoSettings()) };
  return { s: new SalesReportV2Service(loader as never, settings as never), loader };
}
const q = { basis: 'order' as const, from: '2026-08-01', to: '2026-08-01' };

const keysDeep = (v: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysDeep(x, out); }
  return out;
};

describe('SalesReportV2Service', () => {
  it('overview reproduces the ৳3,438 day', async () => {
    const r = await svc().s.overview(q, {});
    expect(Math.round(r.summary.contrib)).toBe(3438);
    expect(r.options.channels).toEqual(['Call', 'Facebook', 'Website', 'WhatsApp']);
  });

  it('filters by channel, courier "none" and status', async () => {
    const { s } = svc();
    expect((await s.orders({ ...q, channel: 'Website' }, {})).total).toBe(4);
    expect((await s.orders({ ...q, courier: 'none' }, {})).total).toBe(1);
    expect((await s.orders({ ...q, status: 'Returned' }, {})).total).toBe(1);
  });

  it('an agent scope loads only that agent\'s orders and returns no money anywhere', async () => {
    const { s, loader } = svc();
    const r = await s.overview(q, { agentId: 1 });
    expect(loader.load).toHaveBeenCalledWith(expect.objectContaining({ agentId: 1 }));
    const leaked = [...keysDeep(r)].filter((k) => MONEY_KEYS.has(k));
    expect(leaked).toEqual([]);
  });

  it('agent exceptions are limited to stuck and nocourier', async () => {
    const r = await svc().s.exceptions(q, { agentId: 1 });
    expect(r.groups.map((g) => g.flag).every((f) => f === 'stuck' || f === 'nocourier')).toBe(true);
  });
});

describe('stripMoney', () => {
  it('removes money keys at any depth and keeps the rest', () => {
    expect(stripMoney({ o: { courier: 'STEADFAST', delivery: 100 }, lines: [{ name: 'x', unitCost: 5 }], contribution: 1 }))
      .toEqual({ o: { courier: 'STEADFAST' }, lines: [{ name: 'x' }] });
  });
});
```

The expected "Scope" type is `{ agentId?: number }`. An empty object means the full view.

- [ ] **Step 2: Run it.** Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `money.ts`**

```ts
/**
 * Every field that carries a cost, a margin or a courier charge. Agents
 * (`net_profit_reports.view_own` only) must never receive these — stripped
 * server-side, so hiding a column in the UI is not the only barrier.
 * Sales figures (netSales, grossSales, collect, advance) are NOT here: the
 * demo shows them to agents.
 */
export const MONEY_KEYS = new Set([
  'delivery', 'actual', 'courierCharge', 'expected', 'rate', 'cod', 'overcharge', 'cogs', 'unitCost',
  'costOk', 'packaging', 'fee', 'contribution', 'subsidy', 'receivable', 'estimated', 'unconfirmed',
  'net', 'deliveryPaid', 'courierCost', 'retLoss', 'contrib', 'overPos', 'overN', 'margin', 'aov',
]);

export function stripMoney<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => stripMoney(x)) as T;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).filter(([k]) => !MONEY_KEYS.has(k)).map(([k, x]) => [k, stripMoney(x)]),
    ) as T;
  }
  return v;
}
```

- [ ] **Step 4: Implement `dto/report-v2-query.dto.ts`**

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ReportV2QueryDto {
  @ApiPropertyOptional({ enum: ['order', 'delivered'] })
  @IsOptional() @IsIn(['order', 'delivered'])
  basis: 'order' | 'delivered' = 'order';

  @ApiPropertyOptional({ description: 'YYYY-MM-DD, Asia/Dhaka' })
  @IsOptional() @Matches(DAY)
  from?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD, Asia/Dhaka' })
  @IsOptional() @Matches(DAY)
  to?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() channel?: string;
  @ApiPropertyOptional({ description: 'Admin id, or "none" for no agent' }) @IsOptional() @IsString() agent?: string;
  @ApiPropertyOptional({ description: 'Courier key, or "none"' }) @IsOptional() @IsString() courier?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() district?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Returned', 'Cancelled']) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional({ enum: ['newest', 'contrib', 'sales', 'over'] })
  @IsOptional() @IsIn(['newest', 'contrib', 'sales', 'over']) sort?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}
```

- [ ] **Step 5: Implement `sales-report-v2.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { calcOrder } from './engine/calc';
import { flagsOf, summarize } from './engine/summary';
import {
  agentRows, basisDate, channelRows, courierRows, dailySeries, districtRows, exceptionGroups, productRows, topOvercharges,
} from './engine/rows';
import type { FlagKey, OrderCalc, ReportSettings } from './engine/types';
import { ReportLoaderService } from './report-loader.service';
import { ReportSettingsService } from './report-settings.service';
import { stripMoney } from './money';
import { dhakaDate } from '../../product-cost-history/dhaka-date';
import type { ReportV2QueryDto } from './dto/report-v2-query.dto';

export interface Scope {
  /** Set for a view_own-only user: their orders only, money stripped. */
  agentId?: number;
}

const PAGE_SIZE = 50;
const AGENT_FLAGS: FlagKey[] = ['stuck', 'nocourier'];

@Injectable()
export class SalesReportV2Service {
  constructor(
    private readonly loader: ReportLoaderService,
    private readonly settings: ReportSettingsService,
  ) {}

  private range(q: ReportV2QueryDto) {
    const today = dhakaDate(new Date());
    return { from: q.from ?? today, to: q.to ?? today };
  }

  private async calcs(q: ReportV2QueryDto, scope: Scope, ignoreDate = false): Promise<{ set: OrderCalc[]; S: ReportSettings }> {
    const { from, to } = this.range(q);
    const [orders, S] = await Promise.all([
      this.loader.load({ from, to, basis: q.basis, ignoreDate, agentId: scope.agentId }),
      this.settings.get(),
    ]);
    const set = orders
      .map((o) => calcOrder(o, S))
      .filter(({ o }) => {
        if (!ignoreDate) {
          const d = basisDate(o, q.basis);
          if (!d || d < from || d > to) return false;
        }
        if (q.channel && o.channel !== q.channel) return false;
        if (q.agent && String(o.agentId ?? 'none') !== q.agent) return false;
        if (q.courier && (o.courier ?? 'none') !== q.courier) return false;
        if (q.district && o.district !== q.district) return false;
        if (q.status && o.status !== q.status) return false;
        return true;
      });
    return { set, S };
  }

  private out<T>(v: T, scope: Scope): T {
    return scope.agentId !== undefined ? stripMoney(v) : v;
  }

  private withFlags(list: OrderCalc[], S: ReportSettings, scope: Scope) {
    const today = dhakaDate(new Date());
    return list.map((c) => ({
      ...c,
      flags: flagsOf(c, S, today).filter((f) => scope.agentId === undefined || AGENT_FLAGS.includes(f)),
    }));
  }

  async overview(q: ReportV2QueryDto, scope: Scope) {
    const { set, S } = await this.calcs(q, scope);
    const { from, to } = this.range(q);
    const agents = new Map<number | null, string>();
    for (const c of set) agents.set(c.o.agentId, c.o.agentName ?? 'Website (no agent)');
    return this.out(
      {
        summary: summarize(set, S),
        channels: channelRows(set, S),
        daily: dailySeries(set, S, from, to, q.basis),
        options: {
          channels: [...new Set(set.map((c) => c.o.channel))].sort(),
          agents: [...agents.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
          couriers: [...new Set(set.map((c) => c.o.courier).filter((x): x is string => !!x))].sort(),
          districts: [...new Set(set.map((c) => c.o.district).filter(Boolean))].sort(),
        },
      },
      scope,
    );
  }

  async orders(q: ReportV2QueryDto, scope: Scope) {
    const { set, S } = await this.calcs(q, scope);
    const needle = q.q?.trim().toLowerCase();
    const list = needle ? set.filter((c) => [c.o.orderNumber, c.o.customer, c.o.phone].join(' ').toLowerCase().includes(needle)) : set;
    const sorters: Record<string, (a: OrderCalc, b: OrderCalc) => number> = {
      newest: (a, b) => (b.o.date + b.o.orderNumber).localeCompare(a.o.date + a.o.orderNumber),
      contrib: (a, b) => (a.contribution ?? 1e9) - (b.contribution ?? 1e9),
      sales: (a, b) => b.netSales - a.netSales,
      over: (a, b) => (b.overcharge ?? -1e9) - (a.overcharge ?? -1e9),
    };
    // Agents can't sort by money they can't see.
    const sort = scope.agentId !== undefined && (q.sort === 'contrib' || q.sort === 'over') ? 'newest' : (q.sort ?? 'newest');
    list.sort(sorters[sort]);
    const page = q.page ?? 1;
    const rows = this.withFlags(list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), S, scope);
    return this.out({ total: list.length, page, pageSize: PAGE_SIZE, rows }, scope);
  }

  async agents(q: ReportV2QueryDto) {
    const { set, S } = await this.calcs(q, {});
    return { rows: agentRows(set, S) };
  }

  async products(q: ReportV2QueryDto) {
    const { set } = await this.calcs(q, {});
    return { rows: productRows(set) };
  }

  async couriers(q: ReportV2QueryDto) {
    const { set, S } = await this.calcs(q, {});
    return { rows: courierRows(set, S), top: this.withFlags(topOvercharges(set, S), S, {}) };
  }

  async districts(q: ReportV2QueryDto) {
    const { set, S } = await this.calcs(q, {});
    return { rows: districtRows(set, S) };
  }

  /** Date range ignored so nothing old is missed; other filters still apply. */
  async exceptions(q: ReportV2QueryDto, scope: Scope) {
    const { set, S } = await this.calcs(q, scope, true);
    const today = dhakaDate(new Date());
    const groups = exceptionGroups(set, S, today, scope.agentId !== undefined ? AGENT_FLAGS : undefined);
    const flagged = new Set(groups.flatMap((g) => g.list));
    return this.out(
      { total: flagged.size, groups: groups.map((g) => ({ flag: g.flag, rows: this.withFlags(g.list, S, scope) })) },
      scope,
    );
  }
}
```

- [ ] **Step 6: Implement `admin-sales-report-v2.controller.ts`**

```ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { Can, RequireAnyPermission, RequirePermission, type PermissionCheck } from '../../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { ProductCostHistoryService, type AddCostInput } from '../../product-cost-history/product-cost-history.service';
import { SalesReportV2Service, type Scope } from './sales-report-v2.service';
import { REPORT_COURIERS, ReportSettingsService, zoneNames } from './report-settings.service';
import { ReportV2QueryDto } from './dto/report-v2-query.dto';

const VIEW = 'net_profit_reports.view';
const VIEW_OWN = 'net_profit_reports.view_own';
const MANAGE = 'net_profit_settings.manage';

/** Full view with `view`; otherwise (view_own only) scoped to the caller's own orders. */
const scopeFor = (adminId: number, can: PermissionCheck): Scope => (can(VIEW) ? {} : { agentId: adminId });

@ApiTags('admin/net-profit/sales-report')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/sales-report/v2')
export class AdminSalesReportV2Controller {
  constructor(
    private readonly report: SalesReportV2Service,
    private readonly settings: ReportSettingsService,
    private readonly costs: ProductCostHistoryService,
  ) {}

  @Get('overview')
  @RequireAnyPermission(VIEW, VIEW_OWN)
  overview(@Query() q: ReportV2QueryDto, @CurrentAdmin() admin: { id: number }, @Can() can: PermissionCheck) {
    return this.report.overview(q, scopeFor(admin.id, can));
  }

  @Get('orders')
  @RequireAnyPermission(VIEW, VIEW_OWN)
  orders(@Query() q: ReportV2QueryDto, @CurrentAdmin() admin: { id: number }, @Can() can: PermissionCheck) {
    return this.report.orders(q, scopeFor(admin.id, can));
  }

  @Get('exceptions')
  @RequireAnyPermission(VIEW, VIEW_OWN)
  exceptions(@Query() q: ReportV2QueryDto, @CurrentAdmin() admin: { id: number }, @Can() can: PermissionCheck) {
    return this.report.exceptions(q, scopeFor(admin.id, can));
  }

  @Get('agents') @RequirePermission(VIEW)
  agents(@Query() q: ReportV2QueryDto) { return this.report.agents(q); }

  @Get('products') @RequirePermission(VIEW)
  products(@Query() q: ReportV2QueryDto) { return this.report.products(q); }

  @Get('couriers') @RequirePermission(VIEW)
  couriers(@Query() q: ReportV2QueryDto) { return this.report.couriers(q); }

  @Get('districts') @RequirePermission(VIEW)
  districts(@Query() q: ReportV2QueryDto) { return this.report.districts(q); }

  @Get('settings') @RequirePermission(VIEW)
  async getSettings(@Can() can: PermissionCheck) {
    const [settings, zones] = await Promise.all([this.settings.get(), this.settings.zoneConfig()]);
    return { settings, couriers: REPORT_COURIERS, zones: zoneNames(zones), canEdit: can(MANAGE) };
  }

  @Put('settings') @RequirePermission(MANAGE)
  async putSettings(@Body() body: unknown) {
    const [settings, zones] = await Promise.all([this.settings.update(body), this.settings.zoneConfig()]);
    return { settings, couriers: REPORT_COURIERS, zones: zoneNames(zones), canEdit: true };
  }

  @Get('costs') @RequirePermission(VIEW)
  listCosts(@Query('productId', ParseIntPipe) productId: number) { return this.costs.list(productId); }

  @Post('costs') @RequirePermission(MANAGE)
  addCost(@Body() body: AddCostInput, @CurrentAdmin() admin: { id: number }) { return this.costs.addCost(body, admin.id); }

  @Patch('costs/:id') @RequirePermission(MANAGE)
  confirmCost(@Param('id', ParseIntPipe) id: number, @Body() body: { confirmed: boolean }) {
    return this.costs.setConfirmed(id, body.confirmed === true);
  }

  @Delete('costs/:id') @RequirePermission(MANAGE)
  async removeCost(@Param('id', ParseIntPipe) id: number) { await this.costs.remove(id); return { id }; }
}
```

Validate the `POST costs` body with a DTO instead of the `AddCostInput` interface: create `dto/add-cost.dto.ts` with the fields productId (`@IsInt`), variantId (`@IsOptional() @IsInt()`), cost (`@IsNumber() @Min(0)`), costPriceUnit (`@IsOptional() @IsEnum(CostPriceUnit)`), effectiveFrom (`@IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)`) and confirmed (`@IsOptional() @IsBoolean()`). Use it as the `@Body()` type. Do the same for `PATCH costs/:id` with `{ @IsBoolean() confirmed }`.

Register `AdminSalesReportV2Controller` and `SalesReportV2Service` in `SalesReportModule`.

- [ ] **Step 7: Run the tests.** Expected: PASS (5). Typecheck the backend.

- [ ] **Step 8: Live check.** Restart the API (or let watch mode reload), mint a local admin token as in the earlier wholesale checks (HS256 with `ADMIN_JWT_ACCESS_SECRET`, `{sub:1, tokenType:'access'}`), and run:

```bash
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/v1/admin/net-profit/sales-report/v2/overview?from=2026-08-01&to=2026-09-18" | head -c 600
```
Expected: `success:true`, with a `summary` whose `n` is greater than 0. **Log.**

---

### Task 11: Courier bill import

**Files:**
- Create: `apps/backend/src/common/csv.util.ts`
- Create: `apps/backend/src/modules/net-profit/sales-report/courier-bills.ts`
- Create: `apps/backend/src/modules/net-profit/sales-report/courier-bills.service.ts`
- Test: `apps/backend/src/modules/net-profit/sales-report/courier-bills.spec.ts`
- Modify: `admin-sales-report-v2.controller.ts` (add `POST courier-bills`)
- Create: `apps/admin/src/app/api/backend/admin/net-profit/sales-report/v2/courier-bills/route.ts`

**Interfaces:**
- Produces:
  - `parseCsv(text: string): string[][]`
  - `parseCourierBill(csv: string): { rows: { consignmentId: string; charge: number }[]; skipped: number }`, which throws `BadRequestException` when there is no ID column or no charge column
  - `CourierBillsService.import(provider: CourierProviderName, csv: string, ref: string): Promise<BillImportResult>`, where `BillImportResult { rows: number; matched: number; updated: number; unmatched: string[] }`
  - HTTP `POST courier-bills` (multipart `file`, field `provider`) → `BillImportResult`

**External dependency:** the column names below are best guesses at Steadfast's merchant-portal export. **When the owner supplies a real statement CSV:** save it as `courier-bills.steadfast.sample.csv` next to the spec, add a test that parses it, and adjust `ID_HEADERS`/`CHARGE_HEADERS` so it passes. Until then the parser accepts the aliases below.

- [ ] **Step 1: Write the failing test**

```ts
import { BadRequestException } from '@nestjs/common';
import { parseCourierBill } from './courier-bills';
import { CourierBillsService } from './courier-bills.service';

describe('parseCourierBill', () => {
  it('uses a total-charge column when present', () => {
    const r = parseCourierBill('Consignment ID,COD Amount,Total Charge\n12345,500,135.50\n');
    expect(r.rows).toEqual([{ consignmentId: '12345', charge: 135.5 }]);
  });

  it('otherwise sums delivery + COD + return charge columns', () => {
    const r = parseCourierBill('consignment_id,delivery_charge,cod_charge,return_charge\n"777",105,3.15,0\n');
    expect(r.rows).toEqual([{ consignmentId: '777', charge: 108.15 }]);
  });

  it('skips rows without an id or with a non-numeric charge', () => {
    const r = parseCourierBill('CID,Delivery Charge\n,100\n9,abc\n10,90\n');
    expect(r.rows).toEqual([{ consignmentId: '10', charge: 90 }]);
    expect(r.skipped).toBe(2);
  });

  it('rejects a file with no consignment or charge column', () => {
    expect(() => parseCourierBill('Name,Phone\nA,1\n')).toThrow(BadRequestException);
  });
});

describe('CourierBillsService.import', () => {
  it('writes the billed charge onto matching shipments and reports the rest', async () => {
    const prisma = {
      client: {
        shipment: {
          findMany: jest.fn().mockResolvedValue([{ id: 1, consignmentId: '12345' }]),
          update: jest.fn(),
        },
      },
    };
    const svc = new CourierBillsService(prisma as never);
    const r = await svc.import('STEADFAST', 'Consignment ID,Total Charge\n12345,135\n999,80\n', 'bill-01.csv');
    expect(r).toEqual({ rows: 2, matched: 1, updated: 1, unmatched: ['999'] });
    expect(prisma.client.shipment.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ billImportRef: 'bill-01.csv' }),
    });
  });
});
```

- [ ] **Step 2: Run it.** Expected: FAIL, module not found.

- [ ] **Step 3: Implement `common/csv.util.ts`.** Copy `parseCsv` verbatim from `modules/net-profit/blocker/blocker.service.ts` (the `function parseCsv(text: string): string[][]` at ~L440) and `export` it. Leave the blocker and recovery copies as they are.

- [ ] **Step 4: Implement `courier-bills.ts`**

```ts
import { BadRequestException } from '@nestjs/common';
import { parseCsv } from '../../../common/csv.util';

// Header aliases, lower-cased. Adjust against a real statement file
// (see the plan's Task 11 external-dependency note).
const ID_HEADERS = ['consignment id', 'consignment_id', 'consignmentid', 'cid', 'tracking id', 'tracking_code', 'tracking code'];
const TOTAL_HEADERS = ['total charge', 'total_charge', 'total charges', 'charge'];
const PART_HEADERS = ['delivery charge', 'delivery_charge', 'cod charge', 'cod_charge', 'return charge', 'return_charge'];

export function parseCourierBill(csv: string): { rows: { consignmentId: string; charge: number }[]; skipped: number } {
  const [head, ...body] = parseCsv(csv.replace(/^\uFEFF/, ''));
  const cols = (head ?? []).map((h) => h.trim().toLowerCase());
  const idCol = cols.findIndex((c) => ID_HEADERS.includes(c));
  const totalCol = cols.findIndex((c) => TOTAL_HEADERS.includes(c));
  const partCols = cols.map((c, i) => (PART_HEADERS.includes(c) ? i : -1)).filter((i) => i >= 0);
  if (idCol < 0) throw new BadRequestException('No consignment ID column found');
  if (totalCol < 0 && partCols.length === 0) throw new BadRequestException('No charge column found');

  const rows: { consignmentId: string; charge: number }[] = [];
  let skipped = 0;
  for (const r of body) {
    const consignmentId = (r[idCol] ?? '').trim();
    const cells = totalCol >= 0 ? [r[totalCol]] : partCols.map((i) => r[i]);
    const nums = cells.map((v) => Number(String(v ?? '').replace(/[৳,\s]/g, '')));
    if (!consignmentId || nums.some((n) => !Number.isFinite(n))) {
      skipped++;
      continue;
    }
    rows.push({ consignmentId, charge: Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100 });
  }
  return { rows, skipped };
}
```

- [ ] **Step 5: Implement `courier-bills.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { CourierProviderName, Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { parseCourierBill } from './courier-bills';

export interface BillImportResult {
  rows: number;
  matched: number;
  updated: number;
  unmatched: string[];
}

/** Courier statement → shipments.billed_charge. Re-importing overwrites (latest statement wins). */
@Injectable()
export class CourierBillsService {
  constructor(private readonly prisma: PrismaService) {}

  async import(provider: CourierProviderName, csv: string, ref: string): Promise<BillImportResult> {
    const { rows } = parseCourierBill(csv);
    const shipments = await this.prisma.client.shipment.findMany({
      where: { provider, consignmentId: { in: rows.map((r) => r.consignmentId) } },
      select: { id: true, consignmentId: true },
    });
    const byId = new Map(shipments.map((s) => [s.consignmentId, s.id]));
    const unmatched: string[] = [];
    let updated = 0;
    const now = new Date();
    for (const r of rows) {
      const id = byId.get(r.consignmentId);
      if (!id) {
        unmatched.push(r.consignmentId);
        continue;
      }
      await this.prisma.client.shipment.update({
        where: { id },
        data: { billedCharge: new Prisma.Decimal(r.charge), billedAt: now, billImportRef: ref },
      });
      updated++;
    }
    return { rows: rows.length, matched: rows.length - unmatched.length, updated, unmatched };
  }
}
```

- [ ] **Step 6: Controller endpoint.** Add to `AdminSalesReportV2Controller`, and inject `CourierBillsService` (register it in the module):

```ts
  @Post('courier-bills')
  @RequirePermission(MANAGE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  importBills(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('provider') provider: string,
  ) {
    if (!file) throw new BadRequestException('Attach the courier statement CSV');
    if (!REPORT_COURIERS.includes(provider)) throw new BadRequestException('Unknown courier');
    return this.bills.import(provider as CourierProviderName, file.buffer.toString('utf8'), file.originalname);
  }
```

Imports: `FileInterceptor` from `@nestjs/platform-express`, `memoryStorage` from `multer`, `UploadedFile` and `BadRequestException` from `@nestjs/common`, `CourierProviderName` from `@amader/db`. These are the same as the wholesale customer import.

- [ ] **Step 7: Next multipart route.** Copy `apps/admin/src/app/api/backend/admin/wholesale/customers/import/route.ts` to `apps/admin/src/app/api/backend/admin/net-profit/sales-report/v2/courier-bills/route.ts`. Change the fetch URL to `${BACKEND_URL}/api/v1/admin/net-profit/sales-report/v2/courier-bills` and drop `${req.nextUrl.search}`.

- [ ] **Step 8: Run the tests.** Expected: PASS (5). Typecheck the backend and admin. **Log** the task, noting that the column mapping awaits a real sample.

---

## Part 3: Admin UI

### Task 12: Hooks, formatting, filter state, export

**Files:**
- Create: `apps/admin/src/hooks/useSalesReportV2.ts`
- Create: `apps/admin/src/components/net-profit/sales-report/format.ts`
- Create: `apps/admin/src/components/net-profit/sales-report/useReportFilters.ts`
- Create: `apps/admin/src/components/net-profit/sales-report/exportCsv.ts`
- Test: `apps/admin/tests/sales-report-format.test.mjs` (the admin runs `node --test tests/*.test.mjs`)

**Interfaces:**
- Produces:
  - Types mirroring the backend: `Summary`, `OrderRow`, `DayPoint`, `AgentRow`, `ProductRow`, `CourierRow`, `DistrictRow`, `ExceptionsResponse`, `ReportSettings`, `SettingsResponse`, `CostHistoryRow`, `ReportFilters`, `FlagKey`.
  - Hooks: `useReportOverview(f)`, `useReportOrders(f, extra)`, `useReportAgents(f)`, `useReportProducts(f)`, `useReportCouriers(f)`, `useReportDistricts(f)`, `useReportExceptions(f)`, `useReportSettings()`, `useSaveReportSettings()`, `useCostHistory(productId)`, `useAddCost()`, `useConfirmCost()`, `useRemoveCost()`, `importCourierBill(provider, file)`.
  - Formatting: `tk(n, signed?)`, `pc(n)`, `dmy(s)`, `COLORS`, `STATUS_COLOR`, `FLAG`, `COURIER_LABEL`.
  - `useReportFilters(): { f: ReportFilters; set(p: Partial<ReportFilters>): void; reset(): void }`
  - `downloadCsv(name: string, rows: (string | number | null)[][])`

- [ ] **Step 1: Write the failing formatting test** `apps/admin/tests/sales-report-format.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { tk, pc, dmy, csvText } from "../src/components/net-profit/sales-report/format.ts";

test("tk formats taka with a true minus and optional plus", () => {
  assert.equal(tk(3438), "৳3,438");
  assert.equal(tk(-130), "−৳130");
  assert.equal(tk(12, true), "+৳12");
  assert.equal(tk(null), "-");
});

test("pc and dmy", () => {
  assert.equal(pc(0.31354), "31.4%");
  assert.equal(dmy("2026-08-01"), "01/08/2026");
});

test("csvText quotes cells that need it", () => {
  assert.equal(csvText([["a", 'b"c', 1]]), 'a,"b""c",1');
});
```

This imports the `.ts` file directly. The machine runs Node v25.9.0, which strips TypeScript types natively (Node ≥ 23.6), and `format.ts` only has a type-only import. So no loader is needed. The existing admin tests read sources as text; this is the first one that imports a module.

- [ ] **Step 2: Run it.** Command: `cd apps/admin && node --test tests/sales-report-format.test.mjs`. Expected: FAIL, the module isn't found.

- [ ] **Step 3: Implement `format.ts`**

```ts
import type { FlagKey } from "@/hooks/useSalesReportV2";

// Admin palette (spec D10): the demo's layout, green instead of violet.
export const COLORS = {
  green: "#2e7d43",
  greenDeep: "#1d5230",
  greenWash: "#eaf4ec",
  greenLine: "#cfe3d4",
  ink: "#1e2b22",
  ink2: "#374840",
  muted: "#64766b",
  line: "#e5ebe6",
  paper: "#f6f8f6",
  gain: "#0D7A54",
  gainWash: "#E3F3EB",
  loss: "#B3322C",
  lossWash: "#FBE8E6",
  amber: "#93600F",
  amberWash: "#FCF1DC",
  slate: "#475569",
  slateWash: "#EEF1F5",
  blue: "#3B4FC4",
  blueWash: "#ECEEFC",
  barIn: "#A7D3B3",
  barOut: "#E9B7A9",
} as const;

export const STATUS_COLOR: Record<string, string> = {
  Pending: "#E4B45E", Confirmed: "#7F8CE0", Shipped: "#94A3B8", Delivered: "#3DA57D", Returned: "#D96A62", Cancelled: "#BDB8C9",
};

export const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  Pending: { bg: COLORS.amberWash, fg: COLORS.amber },
  Confirmed: { bg: COLORS.blueWash, fg: COLORS.blue },
  Shipped: { bg: COLORS.slateWash, fg: COLORS.slate },
  Delivered: { bg: COLORS.gainWash, fg: COLORS.gain },
  Returned: { bg: COLORS.lossWash, fg: COLORS.loss },
  Cancelled: { bg: "#F1F0F4", fg: COLORS.muted },
};

export const FLAG: Record<FlagKey, { label: string; tone: "loss" | "amber" | "info"; action: string }> = {
  loss: { label: "Loss on order", tone: "loss", action: "Check price, discount and delivery charge before repeating this offer." },
  low: { label: "Low contribution", tone: "amber", action: "Small or heavy orders: consider a minimum order or weight-based delivery fee." },
  over: { label: "Courier overcharge", tone: "loss", action: "Raise with the courier and claim the difference in the next settlement." },
  nocourier: { label: "Courier not set", tone: "amber", action: "Set the courier so the agreed rate can be checked." },
  stuck: { label: "Stuck before shipping", tone: "amber", action: "Call the customer, then ship or cancel." },
  nobill: { label: "Courier bill missing", tone: "amber", action: "Import the courier settlement so the real charge replaces the estimate." },
  unconf: { label: "Unconfirmed product cost", tone: "info", action: "Confirm the cost in Rates and costs so profit is final." },
  nocost: { label: "Product cost missing", tone: "loss", action: "Add the cost in Rates and costs; this order is left out of profit." },
};

export const TAG_STYLE: Record<"loss" | "amber" | "info" | "plain", { border: string; bg: string; fg: string }> = {
  loss: { border: "#F0C4BE", bg: COLORS.lossWash, fg: COLORS.loss },
  amber: { border: "#EED9AE", bg: COLORS.amberWash, fg: COLORS.amber },
  info: { border: COLORS.greenLine, bg: COLORS.greenWash, fg: COLORS.greenDeep },
  plain: { border: COLORS.line, bg: "#fff", fg: COLORS.ink2 },
};

export const COURIER_LABEL: Record<string, string> = { STEADFAST: "Steadfast", PATHAO: "Pathao", REDX: "RedX", ECOURIER: "eCourier" };
export const courierLabel = (c: string | null) => (c ? (COURIER_LABEL[c] ?? c) : "Not set");

export function tk(n: number | null | undefined, signed = false): string {
  if (n == null || Number.isNaN(n)) return "-";
  const v = Math.round(n);
  const s = "৳" + Math.abs(v).toLocaleString("en-IN");
  if (v < 0) return "−" + s;
  return signed && v > 0 ? "+" + s : s;
}

export const pc = (n: number) => (!Number.isFinite(n) ? "-" : (Math.round(n * 1000) / 10).toFixed(1) + "%");
export const dmy = (s?: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "");
export const agentLabel = (name: string | null) => name || "Website (no agent)";

export function csvText(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) => r.map((v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(","))
    .join("\n");
}
```

- [ ] **Step 4: Implement `exportCsv.ts`**

```ts
import { csvText } from "./format";

export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const blob = new Blob(["\ufeff" + csvText(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `amadere-${name}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 5: Implement `useSalesReportV2.ts`**

```ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type FlagKey = "loss" | "low" | "over" | "nocourier" | "stuck" | "nobill" | "unconf" | "nocost";
export type Status = "Pending" | "Confirmed" | "Shipped" | "Delivered" | "Returned" | "Cancelled";

export interface ReportFilters {
  basis: "order" | "delivered";
  from: string;
  to: string;
  channel: string;
  agent: string;
  courier: string;
  district: string;
  status: string;
}

// Money fields are optional: the server strips them for view_own-only users.
export interface Summary {
  n: number;
  st: Record<Status, number>;
  grossSales: number;
  newN: number;
  repN: number;
  dN: number;
  rN: number;
  cN: number;
  missing: number;
  est: number;
  lossRate: number;
  net?: number;
  deliveryPaid?: number;
  courierCost?: number;
  cogs?: number;
  packaging?: number;
  fee?: number;
  retLoss?: number;
  contrib?: number;
  subsidy?: number;
  overPos?: number;
  overN?: number;
  margin?: number;
  aov?: number;
}

export interface OrderLine { key: string; name: string; qty: number; price: number; disc: number; gross: number; weight: number; unitCost?: number | null; costOk?: boolean; net?: number; cogs?: number | null }
export interface OrderRow {
  o: {
    id: number; orderNumber: string; date: string; status: Status; channel: string; agentId: number | null; agentName: string | null;
    customer: string; phone: string; ctype: "New" | "Repeat"; district: string; zone: string; payment: string; advance: number;
    courier: string | null; delivery?: number; actual?: number | null;
    hist: { confirmed?: string; shipped?: string; delivered?: string; returned?: string; cancelled?: string };
  };
  lines: OrderLine[];
  netSales: number; weight: number; zone: string; collect: number; shipped: boolean;
  rate?: number | null; cod?: number; expected?: number | null; courierCharge?: number | null; estimated?: boolean;
  overcharge?: number | null; cogs?: number | null; packaging?: number; fee?: number; contribution?: number | null;
  subsidy?: number | null; receivable?: number | null; unconfirmed?: boolean;
  flags: FlagKey[];
}
export interface DayPoint { date: string; net?: number; grossSales: number; contrib?: number }
export interface FilterOptions { channels: string[]; agents: { id: number | null; name: string }[]; couriers: string[]; districts: string[] }
export interface OverviewResponse { summary: Summary; channels: { channel: string; s: Summary }[]; daily: DayPoint[]; options: FilterOptions }
export interface OrdersResponse { total: number; page: number; pageSize: number; rows: OrderRow[] }
export interface AgentRow { agentId: number | null; agentName: string | null; s: Summary; rankSales: number; rankContrib: number }
export interface ProductRow { key: string; name: string; units: number; net: number; cogs: number; subsidy: number; other: number; ret: number; contrib: number; costStatus: "confirmed" | "unconfirmed" | "missing" }
export interface CourierRow { courier: string | null; n: number; ret: number; agreed: number; billed: number; over: number; under: number; overN: number; awaiting: number; awaitingAmt: number; collect: number; recv: number }
export interface DistrictRow { district: string; zone: string; s: Summary }
export interface ExceptionsResponse { total: number; groups: { flag: FlagKey; rows: OrderRow[] }[] }
export interface ZoneRate { smallMax: number; small: number; first: number; extra: number }
export interface CourierRate { cod: number; codBase: "product" | "collect"; returnPct: number; zones: Record<string, ZoneRate> }
export interface ReportSettings { rates: Record<string, CourierRate>; packaging: number; fees: Record<string, number>; th: { low: number; over: number; pending: number; bill: number } }
export interface SettingsResponse { settings: ReportSettings; couriers: string[]; zones: string[]; canEdit: boolean }
export interface CostHistoryRow { id: number; productId: number; variantId: number | null; cost: string; costPriceUnit: string | null; effectiveFrom: string; confirmed: boolean; createdAt: string }
export interface BillImportResult { rows: number; matched: number; updated: number; unmatched: string[] }

const BASE = "/admin/net-profit/sales-report/v2";
const KEY = ["sales-report-v2"];

export function reportParams(f: ReportFilters, extra: Record<string, string | number | undefined> = {}) {
  const p = new URLSearchParams();
  const all: Record<string, string | number | undefined> = { ...f, ...extra };
  for (const [k, v] of Object.entries(all)) if (v !== undefined && v !== "" && v !== "all") p.set(k, String(v));
  return p.toString();
}

function useTab<T>(tab: string, f: ReportFilters, extra: Record<string, string | number | undefined> = {}, enabled = true) {
  return useQuery({
    queryKey: [...KEY, tab, f, extra],
    queryFn: () => proxyFetch<T>(`${BASE}/${tab}?${reportParams(f, extra)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export const useReportOverview = (f: ReportFilters) => useTab<OverviewResponse>("overview", f);
export const useReportOrders = (f: ReportFilters, extra: { q?: string; sort?: string; page?: number }) => useTab<OrdersResponse>("orders", f, extra);
export const useReportAgents = (f: ReportFilters) => useTab<{ rows: AgentRow[] }>("agents", f);
export const useReportProducts = (f: ReportFilters) => useTab<{ rows: ProductRow[] }>("products", f);
export const useReportCouriers = (f: ReportFilters) => useTab<{ rows: CourierRow[]; top: OrderRow[] }>("couriers", f);
export const useReportDistricts = (f: ReportFilters) => useTab<{ rows: DistrictRow[] }>("districts", f);
export const useReportExceptions = (f: ReportFilters) => useTab<ExceptionsResponse>("exceptions", f);

export function useReportSettings() {
  return useQuery({ queryKey: [...KEY, "settings"], queryFn: () => proxyFetch<SettingsResponse>(`${BASE}/settings`) });
}

export function useSaveReportSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: ReportSettings) => proxyFetch<SettingsResponse>(`${BASE}/settings`, { method: "PUT", body: JSON.stringify(s) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCostHistory(productId: number | null) {
  return useQuery({
    queryKey: [...KEY, "costs", productId],
    queryFn: () => proxyFetch<CostHistoryRow[]>(`${BASE}/costs?productId=${productId}`),
    enabled: productId !== null,
  });
}

function useCostMutation<I>(fn: (i: I) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}

export const useAddCost = () =>
  useCostMutation((i: { productId: number; variantId?: number | null; cost: number; effectiveFrom: string; costPriceUnit?: string | null }) =>
    proxyFetch(`${BASE}/costs`, { method: "POST", body: JSON.stringify(i) }));
export const useConfirmCost = () =>
  useCostMutation((i: { id: number; confirmed: boolean }) =>
    proxyFetch(`${BASE}/costs/${i.id}`, { method: "PATCH", body: JSON.stringify({ confirmed: i.confirmed }) }));
export const useRemoveCost = () => useCostMutation((id: number) => proxyFetch(`${BASE}/costs/${id}`, { method: "DELETE" }));

/** Multipart goes through the dedicated Next route, not proxyFetch. */
export async function importCourierBill(provider: string, file: File): Promise<BillImportResult> {
  const fd = new FormData();
  fd.set("provider", provider);
  fd.set("file", file);
  const res = await fetch(`/api/backend${BASE}/courier-bills`, { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json?.error?.message ?? "Import failed");
  return json.data as BillImportResult;
}
```

`proxyFetch<T>` already unwraps the `{ success, data }` envelope and returns `data`, as every existing hook relies on (for example `useWholesaleCustomers` reads `res.items`).

- [ ] **Step 6: Implement `useReportFilters.ts`** (URL-backed state; the default range is the last 7 days)

```ts
"use client";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReportFilters } from "@/hooks/useSalesReportV2";

const todayDhaka = () => new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function defaultFilters(): ReportFilters {
  const t = todayDhaka();
  return { basis: "order", from: addDays(t, -6), to: t, channel: "all", agent: "all", courier: "all", district: "all", status: "all" };
}

export function quickRanges() {
  const t = todayDhaka();
  const monthStart = `${t.slice(0, 8)}01`;
  return [
    { key: "today", label: "Today", from: t, to: t },
    { key: "yday", label: "Yesterday", from: addDays(t, -1), to: addDays(t, -1) },
    { key: "7d", label: "Last 7 days", from: addDays(t, -6), to: t },
    { key: "30d", label: "Last 30 days", from: addDays(t, -29), to: t },
    { key: "month", label: "This month", from: monthStart, to: t },
  ];
}

/** Filters live in the URL so a view can be shared by link (spec §8). */
export function useReportFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const f = useMemo<ReportFilters>(() => {
    const d = defaultFilters();
    const g = (k: keyof ReportFilters) => params.get(k) ?? d[k];
    return {
      basis: g("basis") === "delivered" ? "delivered" : "order",
      from: g("from"), to: g("to"), channel: g("channel"), agent: g("agent"),
      courier: g("courier"), district: g("district"), status: g("status"),
    };
  }, [params]);

  const set = useCallback(
    (p: Partial<ReportFilters> & { tab?: string; q?: string; open?: string }) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(p)) {
        if (v === undefined || v === "all" || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      if (next.get("from") && next.get("to") && next.get("from")! > next.get("to")!) {
        if ("from" in p) next.set("to", next.get("from")!);
        else next.set("from", next.get("to")!);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, router, pathname],
  );

  const reset = useCallback(
    () => set({ channel: "all", agent: "all", courier: "all", district: "all", status: "all" }),
    [set],
  );
  return { f, set, reset, tab: params.get("tab") ?? "overview", q: params.get("q") ?? "", open: Number(params.get("open")) || null };
}
```

- [ ] **Step 7: Run the format test** (expected PASS) and typecheck the admin. **Log.**

---

### Task 13: Page shell, filters, tabs; legacy settings moved

**Files:**
- Create: `apps/admin/src/components/net-profit/sales-report/ReportFilters.tsx`
- Create: `apps/admin/src/components/net-profit/sales-report/LegacySettings.tsx`
- Rewrite: `apps/admin/src/app/(shell)/net-profit/reports/page.tsx`
- Create (stub, replaced by later tasks): `OverviewTab.tsx`, `OrdersTab.tsx`, `AgentsTab.tsx`, `ProductsTab.tsx`, `CouriersTab.tsx`, `DistrictsTab.tsx`, `ExceptionsTab.tsx`, `RatesAndCostsTab.tsx`. Each exports `export function XTab(_p: TabProps) { return null; }`.

**Interfaces:**
- Produces: `TabProps { f: ReportFilters; setFilters: (p: Partial<ReportFilters> & { tab?: string; q?: string; open?: string }) => void; money: boolean; onExport: (name: string, rows: (string | number | null | undefined)[][] | null) => void }`, exported from `ReportFilters.tsx`.

- [ ] **Step 1: Move the legacy settings.** Create `LegacySettings.tsx` with `"use client";`. Move these from the current `page.tsx` **verbatim**:
  - `function FallbackProfitCard() { ... }` (starts at the line `function FallbackProfitCard() {`)
  - `function SettingsTab() { ... }` (ends just before `export default function SalesReportPage`)
  - Any helpers they use (`SectionHeader`, and the `GREEN`/`LINE`/`INK`/`MUTED`/`TEXT`/`FAINT` constants if referenced)

  Rename `SettingsTab` to `export function LegacySettings()`. Copy only the imports those functions use: `useState`, the `@amader/admin-ui` components (`Card`, `Icon`, `SettingsCard`, `ToggleSwitch`, `RangeSlider`, `Button` as referenced), `useFallbackProfitSettings`/`useUpdateFallbackProfitSettings` from `@/hooks/useProfit`, the marketing-cost hooks, the fraud hooks, and the hourly-slot hooks. Run the admin typecheck and let it tell you any missing import.

- [ ] **Step 2: Write `ReportFilters.tsx`**

```tsx
"use client";
import type { ReportFilters as F, FilterOptions } from "@/hooks/useSalesReportV2";
import { COLORS, courierLabel, dmy } from "./format";
import { quickRanges } from "./useReportFilters";

export interface TabProps {
  f: F;
  setFilters: (p: Partial<F> & { tab?: string; q?: string; open?: string }) => void;
  money: boolean;
  onExport: (name: string, rows: (string | number | null | undefined)[][] | null) => void;
}

const STATUSES = ["Pending", "Confirmed", "Shipped", "Delivered", "Returned", "Cancelled"];
const ctl = "min-h-[34px] rounded-[7px] border bg-white px-2 text-sm";

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-white p-0.5" style={{ borderColor: COLORS.line }}>
      {options.map(([k, l]) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className="whitespace-nowrap rounded-md px-3 py-1 text-sm"
          style={value === k ? { background: COLORS.green, color: "#fff" } : { color: COLORS.ink2 }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function ReportFilters({ f, set, reset, options, showAgent }: {
  f: F;
  set: (p: Partial<F>) => void;
  reset: () => void;
  options?: FilterOptions;
  showAgent: boolean;
}) {
  const select = (key: keyof F, label: string, opts: [string, string][]) => (
    <select aria-label={label} className={`${ctl} min-w-[128px]`} style={{ borderColor: COLORS.line }} value={f[key]} onChange={(e) => set({ [key]: e.target.value })}>
      <option value="all">{label}</option>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  return (
    <section aria-label="Filters" className="grid gap-2.5 rounded-xl border bg-white px-3.5 py-3" style={{ borderColor: COLORS.line }}>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px]" style={{ color: COLORS.muted }}>Count orders by</span>
          <Seg value={f.basis} options={[["order", "Order date"], ["delivered", "Delivered date"]]} onChange={(v) => set({ basis: v })} />
        </div>
        <span className="hidden w-px self-stretch md:block" style={{ background: COLORS.line }} />
        <div className="flex flex-wrap gap-1.5">
          {quickRanges().map((r) => {
            const on = f.from === r.from && f.to === r.to;
            return (
              <button key={r.key} type="button" onClick={() => set({ from: r.from, to: r.to })}
                className="rounded-full border px-3 py-0.5 text-[13.5px]"
                style={on ? { borderColor: COLORS.green, color: COLORS.green, background: COLORS.greenWash } : { borderColor: COLORS.line, color: COLORS.ink2 }}>
                {r.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="text-[13px]" style={{ color: COLORS.muted }} htmlFor="rf-from">From</label>
          <input id="rf-from" type="date" className={ctl} style={{ borderColor: COLORS.line }} value={f.from} onChange={(e) => set({ from: e.target.value })} />
          <label className="text-[13px]" style={{ color: COLORS.muted }} htmlFor="rf-to">to</label>
          <input id="rf-to" type="date" className={ctl} style={{ borderColor: COLORS.line }} value={f.to} onChange={(e) => set({ to: e.target.value })} />
          <span className="text-[13px]" style={{ color: COLORS.muted }}>{dmy(f.from)} to {dmy(f.to)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
        {select("channel", "All channels", (options?.channels ?? []).map((c) => [c, c]))}
        {showAgent && select("agent", "All agents", (options?.agents ?? []).map((a) => [String(a.id ?? "none"), a.name]))}
        {select("courier", "All couriers", [...(options?.couriers ?? []).map((c): [string, string] => [c, courierLabel(c)]), ["none", "No courier set"]])}
        {select("district", "All districts", (options?.districts ?? []).map((d) => [d, d]))}
        {select("status", "All statuses", STATUSES.map((s) => [s, s]))}
        <button type="button" onClick={reset} className="text-sm" style={{ color: COLORS.green }}>Clear filters</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Rewrite `page.tsx`**

```tsx
"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { useCan } from "@/hooks/useAdminAuth";
import { useReportExceptions, useReportOverview } from "@/hooks/useSalesReportV2";
import { COLORS } from "@/components/net-profit/sales-report/format";
import { downloadCsv } from "@/components/net-profit/sales-report/exportCsv";
import { ReportFilters, type TabProps } from "@/components/net-profit/sales-report/ReportFilters";
import { useReportFilters } from "@/components/net-profit/sales-report/useReportFilters";
import { OverviewTab } from "@/components/net-profit/sales-report/OverviewTab";
import { OrdersTab } from "@/components/net-profit/sales-report/OrdersTab";
import { AgentsTab } from "@/components/net-profit/sales-report/AgentsTab";
import { ProductsTab } from "@/components/net-profit/sales-report/ProductsTab";
import { CouriersTab } from "@/components/net-profit/sales-report/CouriersTab";
import { DistrictsTab } from "@/components/net-profit/sales-report/DistrictsTab";
import { ExceptionsTab } from "@/components/net-profit/sales-report/ExceptionsTab";
import { RatesAndCostsTab } from "@/components/net-profit/sales-report/RatesAndCostsTab";

const ALL_TABS = [
  ["overview", "Overview"], ["orders", "Orders"], ["agents", "Agents"], ["products", "Products"],
  ["couriers", "Couriers"], ["districts", "Districts"], ["exceptions", "Exceptions"], ["settings", "Rates and costs"],
] as const;
const AGENT_TABS = ["overview", "orders", "exceptions"];

function SalesReport() {
  const { f, set, reset, tab: urlTab } = useReportFilters();
  // Full view with `view`; an agent (view_own only) sees money-free tabs of their own orders.
  const money = useCan("net_profit_reports.view");
  const tabs = ALL_TABS.filter(([k]) => money || AGENT_TABS.includes(k));
  const tab = tabs.some(([k]) => k === urlTab) ? urlTab : "overview";
  const overview = useReportOverview(f);
  const exceptions = useReportExceptions(f);
  const exportRef = useRef<{ name: string; rows: (string | number | null | undefined)[][] } | null>(null);
  const [canExport, setCanExport] = useState(false);
  const onExport = useCallback<TabProps["onExport"]>((name, rows) => {
    exportRef.current = rows ? { name, rows } : null;
    setCanExport(!!rows);
  }, []);

  const props: TabProps = { f, setFilters: set, money, onExport };

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px]" style={{ color: COLORS.muted }}>Net Profit / Reports</div>
          <h1 className="text-[1.6rem] font-extrabold tracking-tight" style={{ color: COLORS.ink }}>Sales report</h1>
          <p className="text-sm" style={{ color: COLORS.ink2 }}>Orders, delivery cost and contribution for Amader eBuy Ltd.</p>
        </div>
        <button
          type="button"
          disabled={!canExport}
          onClick={() => exportRef.current && downloadCsv(`${exportRef.current.name}-${f.from}-to-${f.to}`, exportRef.current.rows)}
          className="rounded-lg border px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: COLORS.green, borderColor: COLORS.green }}
        >
          Export CSV
        </button>
      </header>

      {tab !== "settings" && (
        <ReportFilters f={f} set={set} reset={reset} options={overview.data?.options} showAgent={money} />
      )}

      <nav aria-label="Report sections" className="flex flex-wrap gap-2">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            onClick={() => set({ tab: k })}
            className="rounded-[9px] border px-3.5 py-1.5 text-[14.5px] font-medium"
            style={tab === k ? { background: COLORS.green, borderColor: COLORS.green, color: "#fff" } : { borderColor: COLORS.line, color: COLORS.ink2, background: "#fff" }}
          >
            {l}
            {k === "exceptions" && (exceptions.data?.total ?? 0) > 0 && (
              <span className="ml-1.5 inline-block rounded-full px-1.5 text-xs leading-[18px]"
                style={tab === k ? { background: "#fff", color: COLORS.green } : { background: COLORS.loss, color: "#fff" }}>
                {exceptions.data?.total}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main>
        {tab === "overview" && <OverviewTab {...props} />}
        {tab === "orders" && <OrdersTab {...props} />}
        {tab === "agents" && <AgentsTab {...props} />}
        {tab === "products" && <ProductsTab {...props} />}
        {tab === "couriers" && <CouriersTab {...props} />}
        {tab === "districts" && <DistrictsTab {...props} />}
        {tab === "exceptions" && <ExceptionsTab {...props} />}
        {tab === "settings" && <RatesAndCostsTab {...props} />}
      </main>
    </div>
  );
}

export default function SalesReportPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <SalesReport />
    </Suspense>
  );
}
```

- [ ] **Step 4: Remove dead code.** Run `grep -rn "ReportsFilterBar\|ReportsStatsStrip\|ProductPnlTab" apps/admin/src`. Delete each of those three component files that no longer has an importer.

- [ ] **Step 5: Typecheck the admin** (exit 0). Open http://localhost:3004/net-profit/reports. The header, filters and tabs render, and switching tabs updates the URL. **Log.**

---

### Task 14: Overview tab

**Files:**
- Replace the stub: `apps/admin/src/components/net-profit/sales-report/OverviewTab.tsx`
- Create: `apps/admin/src/components/net-profit/sales-report/DailyChart.tsx`

- [ ] **Step 1: Implement `DailyChart.tsx`** (a port of the demo's `trendPanel` SVG)

```tsx
import type { DayPoint } from "@/hooks/useSalesReportV2";
import { COLORS, tk } from "./format";

export function DailyChart({ data, money }: { data: DayPoint[]; money: boolean }) {
  const W = 560, H = 210, pad = 30;
  const bw = (W - pad - 10) / Math.max(1, data.length);
  const val = (x: DayPoint) => (money ? (x.net ?? 0) : x.grossSales);
  const max = Math.max(1, ...data.map((x) => Math.max(val(x), money ? (x.contrib ?? 0) : 0)));
  const min = Math.min(0, ...data.map((x) => (money ? (x.contrib ?? 0) : 0)));
  const Y = (v: number) => 10 + ((max - v) / (max - min)) * (H - 40);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Daily net sales and contribution">
      {[max, max / 2, 0].map((v) => (
        <g key={v}>
          <line x1={pad} x2={W - 4} y1={Y(v)} y2={Y(v)} stroke={COLORS.line} />
          <text x={pad - 4} y={Y(v) + 4} textAnchor="end" fontSize={11} fill={COLORS.muted}>
            {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
          </text>
        </g>
      ))}
      {data.map((x, i) => {
        const X0 = pad + i * bw + bw * 0.14, w = bw * 0.72, c = x.contrib ?? 0;
        const showLabel = data.length <= 10 || i % Math.ceil(data.length / 10) === 0;
        return (
          <g key={x.date}>
            <rect x={X0} y={Y(val(x))} width={w} height={Math.max(0, Y(0) - Y(val(x)))} fill={COLORS.barIn} rx={2}>
              <title>{`${x.date} net sales ${tk(val(x))}`}</title>
            </rect>
            {money && (
              <rect x={X0 + w * 0.22} y={Y(Math.max(0, c))} width={w * 0.56} height={Math.max(0, Y(Math.min(0, c)) - Y(Math.max(0, c)))}
                fill={c < 0 ? COLORS.loss : COLORS.gain} rx={2}>
                <title>{`${x.date} contribution ${tk(c)}`}</title>
              </rect>
            )}
            {showLabel && (
              <text x={X0 + w / 2} y={H - 10} textAnchor="middle" fontSize={12} fill={COLORS.muted}>
                {`${x.date.slice(8, 10)}/${x.date.slice(5, 7)}`}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Implement `OverviewTab.tsx`.** This is a port of the demo's `viewOverview`, `ledgerPanel`, `agentPanel`, `funnelPanel`, `metricStrip` and `channelPanel`, with the same text and layout.

```tsx
"use client";
import { useEffect } from "react";
import { useReportOverview, type Summary } from "@/hooks/useSalesReportV2";
import { COLORS, STATUS_COLOR, pc, tk } from "./format";
import { DailyChart } from "./DailyChart";
import type { TabProps } from "./ReportFilters";

const STATUSES = ["Pending", "Confirmed", "Shipped", "Delivered", "Returned", "Cancelled"] as const;

export function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-white px-4.5 py-4" style={{ borderColor: COLORS.line }}>
      <h2 className="text-lg font-semibold" style={{ color: COLORS.ink }}>{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-[13.5px]" style={{ color: COLORS.muted }}>{hint}</p>}
      {children}
    </section>
  );
}

function Ledger({ s, basis }: { s: Summary; basis: string }) {
  const steps: [string, number][] = [
    ["Net sales", s.net ?? 0], ["Delivery charged to customers", s.deliveryPaid ?? 0], ["Courier charges", -(s.courierCost ?? 0)],
    ["Product cost", -(s.cogs ?? 0)], ["Packaging and payment fees", -((s.packaging ?? 0) + (s.fee ?? 0))], ["Returned order losses", -(s.retLoss ?? 0)],
  ];
  let run = 0;
  const pts = [0, ...steps.map(([, v]) => (run += v))];
  const lo = Math.min(0, ...pts), hi = Math.max(1, ...pts);
  const P = (x: number) => ((x - lo) / (hi - lo)) * 100;
  run = 0;
  const c = s.contrib ?? 0;
  const track = { background: `repeating-linear-gradient(90deg,transparent 0 calc(25% - 1px),${COLORS.line} calc(25% - 1px) 25%)` };
  const Row = ({ label, a, b, kind, value, total }: { label: React.ReactNode; a: number; b: number; kind: string; value: number; total?: boolean }) => {
    const left = P(Math.min(a, b));
    const width = Math.max(P(Math.max(a, b)) - left, value ? 0.5 : 0);
    const bg = kind === "in" ? COLORS.barIn : kind === "out" ? COLORS.barOut : value < 0 ? COLORS.loss : COLORS.gain;
    return (
      <div className={`grid items-center gap-3 ${total ? "mt-1 border-t pt-2.5" : ""}`} style={{ gridTemplateColumns: "minmax(150px,210px) 1fr 104px", borderColor: COLORS.line }}>
        <span className="text-[14.5px]" style={{ color: total ? COLORS.ink : COLORS.ink2, fontWeight: total ? 600 : 400 }}>{label}</span>
        <span className="relative h-[22px]" style={track}>
          <i className="absolute bottom-[3px] top-[3px] rounded-[3px]" style={{ left: `${left}%`, width: `${width}%`, background: bg }} />
        </span>
        <span className="text-right tabular-nums" style={{ color: value < 0 ? COLORS.loss : total ? COLORS.gain : COLORS.ink, fontSize: total ? 19 : 15, fontWeight: total ? 700 : 400 }}>
          {tk(value)}
        </span>
      </div>
    );
  };
  return (
    <Panel title="Where the money went" hint={`${s.dN} delivered and ${s.rN} returned order(s), ${basis === "order" ? "booked" : "closed"} in this period`}>
      <div className="mt-1.5 grid gap-[7px]">
        {steps.map(([label, v]) => { const a = run, b = (run += v); return <Row key={label} label={label} a={a} b={b} kind={v >= 0 ? "in" : "out"} value={v} />; })}
        <Row label={<>Gross contribution<div className="text-[13px] font-normal" style={{ color: COLORS.muted }}>{pc(s.margin ?? 0)} of net sales</div></>} a={Math.min(0, c)} b={Math.max(0, c)} kind="res" value={c} total />
      </div>
      <div className="mt-3.5 flex flex-wrap items-baseline gap-3 rounded-lg px-3 py-2 text-sm" style={{ background: COLORS.amberWash, color: COLORS.amber }}>
        Delivery subsidy <b className="text-[17px] tabular-nums">{tk(s.subsidy ?? 0)}</b>
        <span>Couriers charged {tk(s.courierCost ?? 0)}, customers paid {tk(s.deliveryPaid ?? 0)}. That is {pc(c ? (s.subsidy ?? 0) / c : 0)} of contribution.</span>
      </div>
      {s.missing > 0 && <div className="mt-2 text-[13px]" style={{ color: COLORS.loss }}>{s.missing} delivered order(s) have no product cost and are left out. See Exceptions.</div>}
      {s.est > 0 && <div className="mt-1.5 text-[13px]" style={{ color: COLORS.muted }}>{s.est} courier charge(s) are estimates from the rate card until the courier bill is imported.</div>}
    </Panel>
  );
}

function AgentPanel({ s, basis }: { s: Summary; basis: string }) {
  const Metric = ({ k, v, d }: { k: string; v: string | number; d?: string }) => (
    <div className="px-4 py-3"><div className="text-[13.5px]" style={{ color: COLORS.muted }}>{k}</div><div className="text-[21px] font-semibold tabular-nums">{v}</div>{d && <div className="text-[13px]" style={{ color: COLORS.ink2 }}>{d}</div>}</div>
  );
  return (
    <Panel title="Your sales" hint={`Orders assigned to you, ${basis === "order" ? "booked" : "closed"} in this period`}>
      <div className="grid grid-cols-1 sm:grid-cols-3">
        <Metric k="Delivered sales" v={tk(s.grossSales)} d={`${s.st.Delivered} orders`} />
        <Metric k="Average order" v={tk(s.st.Delivered ? s.grossSales / s.st.Delivered : 0)} />
        <Metric k="Still to deliver" v={s.st.Pending + s.st.Confirmed + s.st.Shipped} d="pending, confirmed or shipped" />
      </div>
      <p className="mt-2.5 text-[13px]" style={{ color: COLORS.muted }}>Costs, courier charges and contribution are visible to managers and admins only.</p>
    </Panel>
  );
}

function Funnel({ s, basis }: { s: Summary; basis: string }) {
  const max = Math.max(1, ...STATUSES.map((x) => s.st[x]));
  return (
    <Panel title={`${basis === "order" ? "Orders booked" : "Orders closed"}: ${s.n}`} hint={basis === "order" ? "Where each order booked in this period stands now" : "Delivered or returned in this period"}>
      <div className="mt-1.5 grid gap-2">
        {STATUSES.map((x) => (
          <div key={x} className="grid items-center gap-2.5 text-[14.5px]" style={{ gridTemplateColumns: "86px 1fr 38px" }}>
            <span>{x}</span>
            <span className="relative h-3 overflow-hidden rounded-[3px]" style={{ background: COLORS.slateWash }}>
              <i className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${(s.st[x] / max) * 100}%`, background: STATUS_COLOR[x] }} />
            </span>
            <span className="text-right tabular-nums">{s.st[x]}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t pt-2.5 text-sm" style={{ borderColor: COLORS.line, color: COLORS.ink2 }}>
        Cancelled or returned: <b>{pc(s.lossRate)}</b> of closed orders<br />New customers {s.newN}, repeat {s.repN}
      </div>
    </Panel>
  );
}

function MetricStrip({ s, overTolerance }: { s: Summary; overTolerance?: number }) {
  const items: [string, string, string, boolean?][] = [
    ["Average delivered order", tk(s.aov ?? 0), "net sales per order"],
    ["Contribution per order", tk(s.dN ? (s.contrib ?? 0) / s.dN : 0), "after courier and product cost", s.dN > 0 && (s.contrib ?? 0) < 0],
    ["Subsidy per order", tk(s.dN ? (s.subsidy ?? 0) / s.dN : 0), "courier charge minus delivery paid"],
    ["Courier overcharge", tk(s.overPos ?? 0), `${s.overN ?? 0} order(s) above ৳${overTolerance ?? 5} tolerance`, (s.overPos ?? 0) > 0],
  ];
  return (
    <div className="grid rounded-xl border bg-white" style={{ borderColor: COLORS.line, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
      {items.map(([k, v, d, neg]) => (
        <div key={k} className="border-r px-4 py-3 last:border-r-0" style={{ borderColor: COLORS.line }}>
          <div className="text-[13.5px]" style={{ color: COLORS.muted }}>{k}</div>
          <div className="text-[21px] font-semibold tabular-nums" style={{ color: neg ? COLORS.loss : COLORS.ink }}>{v}</div>
          <div className="text-[13px]" style={{ color: COLORS.ink2 }}>{d}</div>
        </div>
      ))}
    </div>
  );
}

export function OverviewTab({ f, money, onExport }: TabProps) {
  const { data, isLoading } = useReportOverview(f);
  useEffect(() => {
    if (!data) return onExport("sales-by-channel", null);
    onExport("sales-by-channel", [
      ["Channel", "Orders booked", "Delivered", "Net sales", ...(money ? ["Contribution", "Margin"] : [])],
      ...data.channels.map((r) => [r.channel, r.s.n, r.s.dN, Math.round(money ? (r.s.net ?? 0) : r.s.grossSales), ...(money ? [Math.round(r.s.contrib ?? 0), pc(r.s.margin ?? 0)] : [])]),
    ]);
  }, [data, money, onExport]);
  if (isLoading || !data) return <div className="p-7 text-center" style={{ color: COLORS.ink2 }}>Loading…</div>;
  const s = data.summary;
  const tot = s;
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        {money ? <Ledger s={s} basis={f.basis} /> : <AgentPanel s={s} basis={f.basis} />}
        <Funnel s={s} basis={f.basis} />
      </div>
      {money && <MetricStrip s={s} />}
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="By day" hint={`Delivered net sales${money ? " and contribution" : ""}, by ${f.basis === "order" ? "order" : "delivered"} date. Recent booking days fill in as orders are delivered.`}>
          <div className="mb-1 flex gap-3.5 text-[13px]" style={{ color: COLORS.ink2 }}>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: COLORS.barIn }} />Net sales</span>
            {money && <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: COLORS.gain }} />Contribution</span>}
          </div>
          <DailyChart data={data.daily} money={money} />
        </Panel>
        <Panel title="By channel" hint="Revenue rank and contribution rank are often different">
          <table className="w-full border-collapse text-[14.5px]">
            <thead><tr className="text-left text-[13.5px]" style={{ color: COLORS.muted }}>
              <th className="py-2 font-medium">Channel</th><th className="text-right font-medium">Orders</th><th className="text-right font-medium">Delivered</th><th className="text-right font-medium">Net sales</th>
              {money && <><th className="text-right font-medium">Contribution</th><th className="text-right font-medium">Margin</th></>}
            </tr></thead>
            <tbody>
              {data.channels.map((r) => (
                <tr key={r.channel} className="border-t" style={{ borderColor: COLORS.line }}>
                  <td className="py-2">{r.channel}</td><td className="text-right tabular-nums">{r.s.n}</td><td className="text-right tabular-nums">{r.s.st.Delivered}</td>
                  <td className="text-right tabular-nums">{tk(money ? (r.s.net ?? 0) : r.s.grossSales)}</td>
                  {money && <><td className="text-right tabular-nums" style={{ color: (r.s.contrib ?? 0) < 0 ? COLORS.loss : undefined }}>{tk(r.s.contrib ?? 0)}</td><td className="text-right tabular-nums">{r.s.net ? pc(r.s.margin ?? 0) : "-"}</td></>}
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t font-semibold" style={{ borderColor: COLORS.line }}>
              <td className="py-2">Total</td><td className="text-right tabular-nums">{tot.n}</td><td className="text-right tabular-nums">{tot.st.Delivered}</td>
              <td className="text-right tabular-nums">{tk(money ? (tot.net ?? 0) : tot.grossSales)}</td>
              {money && <><td className="text-right tabular-nums">{tk(tot.contrib ?? 0)}</td><td className="text-right tabular-nums">{pc(tot.margin ?? 0)}</td></>}
            </tr></tfoot>
          </table>
        </Panel>
      </div>
    </div>
  );
}
```

Tailwind has no `px-4.5` by default. If the admin's Tailwind config lacks it, use `px-[18px]`.

- [ ] **Step 3: Typecheck the admin.** Load the Overview in the browser for the last 30 days and check: the ledger total equals the "Gross contribution" row, the funnel counts add up to "Orders booked", and the channel table's total row matches. **Log.**

---

### Task 15: Orders tab + detail row

**Files:**
- Replace the stub: `apps/admin/src/components/net-profit/sales-report/OrdersTab.tsx`
- Create: `apps/admin/src/components/net-profit/sales-report/OrderDetailRow.tsx`
- Create: `apps/admin/src/components/net-profit/sales-report/Tags.tsx`

- [ ] **Step 1: Implement `Tags.tsx`** (shared badges)

```tsx
import type { FlagKey } from "@/hooks/useSalesReportV2";
import { FLAG, STATUS_BADGE, TAG_STYLE } from "./format";

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status];
  return <span className="inline-block whitespace-nowrap rounded-[5px] px-[7px] text-[12.5px] font-medium leading-5" style={{ background: s?.bg, color: s?.fg }}>{status}</span>;
}

export function Tag({ tone = "plain", children }: { tone?: "loss" | "amber" | "info" | "plain"; children: React.ReactNode }) {
  const t = TAG_STYLE[tone];
  return <span className="mr-[3px] my-px inline-block whitespace-nowrap rounded-[5px] border px-1.5 text-xs leading-[18px]" style={{ borderColor: t.border, background: t.bg, color: t.fg }}>{children}</span>;
}

export const FlagTag = ({ flag }: { flag: FlagKey }) => <Tag tone={FLAG[flag].tone}>{FLAG[flag].label}</Tag>;
```

- [ ] **Step 2: Implement `OrderDetailRow.tsx`.** This is a port of the demo's `orderDetail`, with the same three columns and text.

```tsx
import type { OrderRow } from "@/hooks/useSalesReportV2";
import { COLORS, FLAG, agentLabel, courierLabel, dmy, tk } from "./format";
import { FlagTag } from "./Tags";

const Kv = ({ rows }: { rows: [React.ReactNode, React.ReactNode, boolean?][] }) => (
  <div className="grid gap-x-3 gap-y-[3px] text-sm" style={{ gridTemplateColumns: "1fr auto" }}>
    {rows.map(([k, v, total], i) => (
      <div key={i} className="contents">
        <span className={total ? "border-t pt-1 font-semibold" : ""} style={{ borderColor: COLORS.line }}>{k}</span>
        <span className={`text-right tabular-nums ${total ? "border-t pt-1 font-semibold" : ""}`} style={{ borderColor: COLORS.line }}>{v}</span>
      </div>
    ))}
  </div>
);

export function OrderDetail({ c, money, overTolerance = 5 }: { c: OrderRow; money: boolean; overTolerance?: number }) {
  const o = c.o;
  const neg = (n: number | null | undefined) => <span style={{ color: COLORS.loss }}>{tk(n == null ? null : -n)}</span>;
  let moneyBlock: React.ReactNode = null;
  if (money) {
    const contrib =
      o.status === "Delivered" ? (
        <><h3 className="mb-1.5 text-[14.5px] font-semibold">Contribution</h3>
          <Kv rows={[
            ["Net sales", tk(c.netSales)], ["Delivery paid by customer", tk(o.delivery ?? 0)],
            [`Courier charge${c.estimated ? " (estimate)" : ""}`, neg(c.courierCharge)],
            ["Product cost", c.cogs == null ? <span style={{ color: COLORS.loss }}>missing</span> : neg(c.cogs)],
            ["Packaging", tk(-(c.packaging ?? 0))], ["Payment fee", tk(-(c.fee ?? 0))],
            ["Contribution", <span key="c" style={{ color: (c.contribution ?? 0) < 0 ? COLORS.loss : COLORS.gain }}>{c.contribution == null ? "-" : tk(c.contribution)}</span>, true],
          ]} /></>
      ) : o.status === "Returned" ? (
        <><h3 className="mb-1.5 text-[14.5px] font-semibold">Contribution</h3>
          <Kv rows={[["Sale reversed", tk(0)], ["Courier charge on return", neg(c.courierCharge)], ["Packaging", tk(-(c.packaging ?? 0))], ["Contribution", <span key="c" style={{ color: COLORS.loss }}>{tk(c.contribution ?? 0)}</span>, true]]} />
          <p className="text-[13px]" style={{ color: COLORS.muted }}>Product goes back to stock, so product cost is not charged.</p></>
      ) : (
        <><h3 className="mb-1.5 text-[14.5px] font-semibold">Contribution</h3>
          <p className="text-[13px]" style={{ color: COLORS.muted }}>Not counted yet. {o.status === "Cancelled" ? "Cancelled before shipping, so nothing to count." : "Contribution is counted when the order is delivered."}</p></>
      );
    moneyBlock = (
      <>{contrib}
        <h3 className="mb-1.5 mt-3 text-[14.5px] font-semibold">Courier check</h3>
        <Kv rows={[
          ["Courier, zone", <>{o.courier ? courierLabel(o.courier) : <span style={{ color: COLORS.loss }}>not set</span>}, {c.zone}</>],
          [`Rate card (${c.weight} kg)`, c.rate == null ? "-" : tk(c.rate)],
          ["COD charge", c.rate == null ? "-" : (c.cod ?? 0).toFixed(2)],
          ["Agreed total", c.expected == null ? "-" : c.expected.toFixed(2)],
          ["Courier billed", o.actual == null ? <span style={{ color: COLORS.muted }}>no bill yet</span> : tk(o.actual)],
          ["Difference", <span key="d" style={{ color: (c.overcharge ?? 0) > overTolerance ? COLORS.loss : undefined }}>{c.overcharge == null ? "-" : `${c.overcharge > 0 ? "+" : ""}${c.overcharge.toFixed(2)}`}</span>, true],
          ...(c.receivable != null ? [["Net receivable from courier", tk(c.receivable)] as [string, string]] : []),
        ]} /></>
    );
  }
  const h = o.hist;
  const timeline: [string, string | undefined][] = [["Booked", o.date], ["Confirmed", h.confirmed], ["Shipped", h.shipped], ["Delivered", h.delivered], ["Returned", h.returned], ["Cancelled", h.cancelled]];
  return (
    <div className="grid gap-4.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <h3 className="mb-1.5 text-[14.5px] font-semibold">Items</h3>
        <table className="w-full overflow-hidden rounded-lg border text-[13.5px]" style={{ borderColor: COLORS.line }}>
          <thead><tr style={{ color: COLORS.muted }}><th className="px-2 py-1 text-left font-medium">Item</th><th className="text-right font-medium">Qty</th><th className="text-right font-medium">Price</th><th className="text-right font-medium">Discount</th><th className="text-right font-medium">Net</th>{money && <th className="px-2 text-right font-medium">Unit cost</th>}</tr></thead>
          <tbody>
            {c.lines.map((l) => (
              <tr key={l.key} className="border-t" style={{ borderColor: COLORS.line }}>
                <td className="px-2 py-1">{l.name}</td><td className="text-right tabular-nums">{l.qty}</td><td className="text-right tabular-nums">{tk(l.price)}</td>
                <td className="text-right tabular-nums">{l.disc ? tk(-l.disc) : "-"}</td><td className="text-right tabular-nums">{tk(l.qty * l.price - l.disc)}</td>
                {money && <td className="px-2 text-right tabular-nums">{l.unitCost == null ? <span style={{ color: COLORS.loss }}>missing</span> : <>{tk(l.unitCost)}{!l.costOk && <span className="ml-1 text-[11.5px]" style={{ color: COLORS.amber }}>unconfirmed</span>}</>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2.5"><Kv rows={[["Payment", `${o.payment}${o.advance ? `, advance ${tk(o.advance)}` : ""}`], ["Courier collects", tk(c.collect)], ["Weight", `${c.weight} kg`]]} /></div>
      </div>
      <div>{moneyBlock ?? <><h3 className="mb-1.5 text-[14.5px] font-semibold">Delivery</h3><p className="text-[13px]" style={{ color: COLORS.muted }}>Courier {courierLabel(o.courier)}, {c.zone}.</p></>}</div>
      <div>
        <h3 className="mb-1.5 text-[14.5px] font-semibold">Timeline</h3>
        <ul className="mt-2.5 list-none p-0 text-sm">
          {timeline.filter(([, d]) => d).map(([k, d]) => (
            <li key={k} className="flex justify-between border-l-2 pb-[5px] pl-2.5 pt-px" style={{ borderColor: COLORS.greenLine }}><span>{k}</span><span>{dmy(d)}</span></li>
          ))}
        </ul>
        {c.flags.length > 0 && <div className="mt-2.5 text-[13.5px]">{c.flags.map((fl) => <div key={fl} className="mb-[3px]"><FlagTag flag={fl} /> {FLAG[fl].action}</div>)}</div>}
        <p className="mt-2.5 text-[13px]" style={{ color: COLORS.muted }}>Confirmed by {agentLabel(o.agentName)}.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement `OrdersTab.tsx`**

```tsx
"use client";
import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useReportOrders } from "@/hooks/useSalesReportV2";
import { COLORS, FLAG, agentLabel, dmy, tk } from "./format";
import { FlagTag, StatusBadge } from "./Tags";
import { OrderDetail } from "./OrderDetailRow";
import type { TabProps } from "./ReportFilters";

export function OrdersTab({ f, money, onExport }: TabProps) {
  // q/open arrive in the URL when Exceptions jumps to an order; read once at mount.
  const params = useSearchParams();
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(() => Number(params.get("open")) || null);
  const { data } = useReportOrders(f, { q: q || undefined, sort, page });
  const rows = data?.rows ?? [];

  useEffect(() => {
    onExport("orders", data ? [
      ["Order ID", "Order date", "Status", "Channel", "Agent", "Customer", "Type", "District", "Items", "Net sales",
        ...(money ? ["Delivery paid", "Courier", "Courier charge", "Estimated", "Agreed charge", "Overcharge", "Product cost", "Contribution"] : []), "Flags"],
      ...rows.map((c) => [c.o.orderNumber, dmy(c.o.date), c.o.status, c.o.channel, agentLabel(c.o.agentName), c.o.customer, c.o.ctype, c.o.district,
        c.lines.map((l) => `${l.name} x ${l.qty}`).join("; "), c.netSales,
        ...(money ? [c.o.delivery ?? "", c.o.courier ?? "", c.shipped ? (c.courierCharge ?? "") : "", c.estimated ? "yes" : "", c.expected ?? "", c.overcharge ?? "", c.cogs ?? "", c.contribution ?? ""] : []),
        c.flags.map((fl) => FLAG[fl].label).join("; ")]),
    ] : null);
  }, [data, rows, money, onExport]);

  const cols = money ? 11 : 8;
  const sorts: [string, string][] = [["newest", "Newest first"], ["sales", "Highest net sales first"], ...(money ? [["contrib", "Lowest contribution first"], ["over", "Biggest courier overcharge first"]] as [string, string][] : [])];
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <input type="search" aria-label="Search orders" placeholder="Search order ID, customer or phone" value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); setOpen(null); }}
          className="min-h-[34px] min-w-0 flex-1 rounded-[7px] border bg-white px-2 text-sm sm:min-w-[320px] sm:flex-none" style={{ borderColor: COLORS.line }} />
        <select aria-label="Sort" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="min-h-[34px] rounded-[7px] border bg-white px-2 text-sm" style={{ borderColor: COLORS.line }}>
          {sorts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span className="flex-1" />
        <span className="text-[13px]" style={{ color: COLORS.muted }}>{data?.total ?? 0} order(s)</span>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: COLORS.line }}>
        {rows.length === 0 ? (
          <div className="p-7 text-center" style={{ color: COLORS.ink2 }}>No orders match these filters. Widen the date range or clear filters.</div>
        ) : (
          <table className="w-full border-collapse text-[14.5px]">
            <thead><tr className="text-left text-[13.5px]" style={{ color: COLORS.muted, background: "#fbfcfb" }}>
              {["Order", "Status", "Channel", "Customer", "District", "Items"].map((h) => <th key={h} className="border-b px-3 py-2 font-medium" style={{ borderColor: COLORS.line }}>{h}</th>)}
              <th className="border-b px-3 text-right font-medium" style={{ borderColor: COLORS.line }}>Net sales</th>
              {money && ["Delivery paid", "Courier charge", "Contribution"].map((h) => <th key={h} className="border-b px-3 text-right font-medium" style={{ borderColor: COLORS.line }}>{h}</th>)}
              <th className="border-b px-3 font-medium" style={{ borderColor: COLORS.line }}>Flags</th>
            </tr></thead>
            <tbody>
              {rows.map((c) => {
                const isOpen = open === c.o.id;
                return (
                  <Fragment key={c.o.id}>
                    <tr tabIndex={0} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.o.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(isOpen ? null : c.o.id); } }}
                      className="cursor-pointer align-top hover:bg-[#fbfcfb]" style={isOpen ? { background: COLORS.greenWash } : undefined}>
                      <td className="whitespace-nowrap border-b px-3 py-2" style={{ borderColor: COLORS.line }}><b>{c.o.orderNumber}</b><div className="text-[13px]" style={{ color: COLORS.muted }}>{dmy(c.o.date)}</div></td>
                      <td className="border-b px-3 py-2" style={{ borderColor: COLORS.line }}><StatusBadge status={c.o.status} /></td>
                      <td className="border-b px-3 py-2" style={{ borderColor: COLORS.line }}>{c.o.channel}<div className="text-[13px]" style={{ color: COLORS.muted }}>{agentLabel(c.o.agentName)}</div></td>
                      <td className="min-w-[150px] border-b px-3 py-2" style={{ borderColor: COLORS.line }}>{c.o.customer}<div className="text-[13px]" style={{ color: COLORS.muted }}>{c.o.ctype}, {c.o.phone}</div></td>
                      <td className="border-b px-3 py-2" style={{ borderColor: COLORS.line }}>{c.o.district}<div className="text-[13px]" style={{ color: COLORS.muted }}>{c.zone}</div></td>
                      <td className="min-w-[170px] border-b px-3 py-2" style={{ borderColor: COLORS.line }}>{c.lines[0] ? `${c.lines[0].name} × ${c.lines[0].qty}` : "-"}{c.lines.length > 1 && <div className="text-[13px]" style={{ color: COLORS.muted }}>+ {c.lines.length - 1} more</div>}</td>
                      <td className="border-b px-3 py-2 text-right tabular-nums" style={{ borderColor: COLORS.line }}>{tk(c.netSales)}</td>
                      {money && <>
                        <td className="border-b px-3 py-2 text-right tabular-nums" style={{ borderColor: COLORS.line }}>{tk(c.o.delivery ?? 0)}</td>
                        <td className="border-b px-3 py-2 text-right tabular-nums" style={{ borderColor: COLORS.line }}>{c.shipped ? <>{tk(c.courierCharge)}{c.estimated && <span className="ml-1 text-[11.5px]" style={{ color: COLORS.amber }}>est.</span>}</> : <span style={{ color: COLORS.muted }}>-</span>}</td>
                        <td className="border-b px-3 py-2 text-right tabular-nums" style={{ borderColor: COLORS.line, color: c.contribution == null ? COLORS.muted : c.contribution < 0 ? COLORS.loss : COLORS.gain }}>{c.contribution == null ? "-" : tk(c.contribution)}</td>
                      </>}
                      <td className="border-b px-3 py-2" style={{ borderColor: COLORS.line }}>{c.flags.map((fl) => <FlagTag key={fl} flag={fl} />)}</td>
                    </tr>
                    {isOpen && <tr><td colSpan={cols} className="border-b px-4 pb-4.5 pt-3.5" style={{ background: "#fbfcfb", borderColor: COLORS.line }}><OrderDetail c={c} money={money} /></td></tr>}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {data && data.total > data.pageSize && (
        <div className="mt-2.5 flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-2 py-0.5 disabled:opacity-40" style={{ borderColor: COLORS.line }}>Previous</button>
          <span>Page {page} of {Math.ceil(data.total / data.pageSize)}</span>
          <button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)} className="rounded border px-2 py-0.5 disabled:opacity-40" style={{ borderColor: COLORS.line }}>Next</button>
        </div>
      )}
    </div>
  );
}
```

The Exceptions tab (Task 17) links here by setting `?tab=orders&q=<orderNumber>&open=<id>`. `useSearchParams` (not `window`) keeps this safe during server rendering.

- [ ] **Step 4: Typecheck the admin.** In the browser: expand a row, check the three detail columns, search by order number, and change the sort. **Log.**

---

### Task 16: Agents, Products, Districts tabs

**Files:** replace the stubs `AgentsTab.tsx`, `ProductsTab.tsx`, `DistrictsTab.tsx`, and create `Table.tsx`.

- [ ] **Step 1: Implement `Table.tsx`** (a shared plain table matching the demo's `.tablewrap`)

```tsx
import { COLORS } from "./format";

export type Col = { h: string; num?: boolean };

export function ReportTable({ cols, rows, foot, empty }: { cols: Col[]; rows: React.ReactNode[][]; foot?: React.ReactNode[]; empty?: string }) {
  const cell = (num?: boolean) => `border-b px-3 py-2 align-top ${num ? "text-right tabular-nums whitespace-nowrap" : ""}`;
  if (rows.length === 0) return <div className="rounded-xl border bg-white p-7 text-center" style={{ borderColor: COLORS.line, color: COLORS.ink2 }}>{empty ?? "Nothing in this period."}</div>;
  return (
    <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: COLORS.line }}>
      <table className="w-full border-collapse text-[14.5px]">
        <thead><tr style={{ background: "#fbfcfb", color: COLORS.muted }}>{cols.map((c) => <th key={c.h} className={`${cell(c.num)} text-[13.5px] font-medium ${c.num ? "" : "text-left"}`} style={{ borderColor: COLORS.line }}>{c.h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={cell(cols[j]?.num)} style={{ borderColor: COLORS.line }}>{v}</td>)}</tr>)}</tbody>
        {foot && <tfoot><tr className="font-semibold" style={{ background: "#fbfcfb" }}>{foot.map((v, j) => <td key={j} className={cell(cols[j]?.num)} style={{ borderColor: COLORS.line }}>{v}</td>)}</tr></tfoot>}
      </table>
    </div>
  );
}

export const Small = ({ children }: { children: React.ReactNode }) => <div className="text-[13px]" style={{ color: COLORS.muted }}>{children}</div>;
```

- [ ] **Step 2: `AgentsTab.tsx`** (a port of `viewAgents`, with the "Rank by" toggle)

```tsx
"use client";
import { useEffect, useState } from "react";
import { useReportAgents } from "@/hooks/useSalesReportV2";
import { COLORS, agentLabel, pc, tk } from "./format";
import { Seg, type TabProps } from "./ReportFilters";
import { ReportTable } from "./Table";

export function AgentsTab({ f, onExport }: TabProps) {
  const { data } = useReportAgents(f);
  const [rankBy, setRankBy] = useState<"contribution" | "sales">("contribution");
  const rows = [...(data?.rows ?? [])].sort((a, b) => (rankBy === "sales" ? a.rankSales - b.rankSales : a.rankContrib - b.rankContrib));
  useEffect(() => {
    onExport("agents", data ? [
      ["Agent", "Booked", "Delivered", "Cancelled or returned", "Net sales", "Contribution", "Margin", "Average order", "New", "Repeat", "Rank by sales", "Rank by contribution"],
      ...rows.map((r) => [agentLabel(r.agentName), r.s.n, r.s.dN, pc(r.s.lossRate), Math.round(r.s.net ?? 0), Math.round(r.s.contrib ?? 0), pc(r.s.margin ?? 0), Math.round(r.s.aov ?? 0), r.s.newN, r.s.repN, r.rankSales, r.rankContrib]),
    ] : null);
  }, [data, rows, onExport]);
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <span className="text-[13px]" style={{ color: COLORS.muted }}>Rank by</span>
        <Seg value={rankBy} options={[["contribution", "Contribution"], ["sales", "Net sales"]]} onChange={setRankBy} />
        <span className="text-[13px]" style={{ color: COLORS.muted }}>The rank columns show where each agent sits on both measures.</span>
      </div>
      <ReportTable
        cols={[{ h: "Agent" }, { h: "Booked", num: true }, { h: "Delivered", num: true }, { h: "Cancelled or returned", num: true }, { h: "Net sales", num: true }, { h: "Contribution", num: true }, { h: "Margin", num: true }, { h: "Average order", num: true }, { h: "New / repeat", num: true }, { h: "Rank: sales", num: true }, { h: "Rank: contribution", num: true }]}
        rows={rows.map((r) => [
          agentLabel(r.agentName), r.s.n, r.s.dN, pc(r.s.lossRate), tk(r.s.net ?? 0),
          <span key="c" style={{ color: (r.s.contrib ?? 0) < 0 ? COLORS.loss : undefined }}>{tk(r.s.contrib ?? 0)}</span>,
          r.s.net ? pc(r.s.margin ?? 0) : "-", tk(r.s.aov ?? 0), `${r.s.newN} / ${r.s.repN}`, r.rankSales,
          <span key="r">{r.rankContrib}{r.rankContrib !== r.rankSales && <span className="ml-1 text-[13px]" style={{ color: r.rankContrib < r.rankSales ? COLORS.gain : COLORS.loss }}>{r.rankContrib < r.rankSales ? "up" : "down"} {Math.abs(r.rankContrib - r.rankSales)}</span>}</span>,
        ])}
      />
    </div>
  );
}
```

- [ ] **Step 3: `ProductsTab.tsx`** (a port of `viewProducts`)

```tsx
"use client";
import { useEffect } from "react";
import { useReportProducts } from "@/hooks/useSalesReportV2";
import { COLORS, pc, tk } from "./format";
import type { TabProps } from "./ReportFilters";
import { ReportTable } from "./Table";
import { Tag } from "./Tags";

export function ProductsTab({ f, onExport }: TabProps) {
  const { data } = useReportProducts(f);
  const rows = data?.rows ?? [];
  const tot = rows.reduce((t, r) => ({ units: t.units + r.units, net: t.net + r.net, cogs: t.cogs + r.cogs, subsidy: t.subsidy + r.subsidy, other: t.other + r.other, ret: t.ret + r.ret, contrib: t.contrib + r.contrib }),
    { units: 0, net: 0, cogs: 0, subsidy: 0, other: 0, ret: 0, contrib: 0 });
  useEffect(() => {
    onExport("products", data ? [
      ["Product", "Units", "Net sales", "Product cost", "Delivery subsidy", "Packaging and fees", "Return losses", "Contribution", "Margin", "Cost status"],
      ...rows.map((r) => [r.name, r.units, Math.round(r.net), Math.round(r.cogs), Math.round(r.subsidy), Math.round(r.other), Math.round(r.ret), Math.round(r.contrib), pc(r.net ? r.contrib / r.net : 0), r.costStatus]),
    ] : null);
  }, [data, rows, onExport]);
  const costTag = (s: string) => s === "missing" ? <Tag tone="loss">Missing</Tag> : s === "unconfirmed" ? <Tag tone="info">Unconfirmed</Tag> : <Tag>Confirmed</Tag>;
  return (
    <div>
      <p className="mb-2.5 text-[13px]" style={{ color: COLORS.muted }}>Delivery subsidy and return losses are shared across items in an order by weight. Packaging and payment fees by value. Each order&apos;s parts add back to its contribution.</p>
      <ReportTable
        cols={[{ h: "Product" }, { h: "Units", num: true }, { h: "Net sales", num: true }, { h: "Product cost", num: true }, { h: "Delivery subsidy", num: true }, { h: "Packaging and fees", num: true }, { h: "Return losses", num: true }, { h: "Contribution", num: true }, { h: "Margin", num: true }, { h: "Cost" }]}
        rows={rows.map((r) => [r.name, r.units, tk(r.net), tk(-r.cogs), tk(-r.subsidy), tk(-r.other), tk(-r.ret),
          <span key="c" style={{ color: r.contrib < 0 ? COLORS.loss : undefined }}>{tk(r.contrib)}</span>, r.net ? pc(r.contrib / r.net) : "-", costTag(r.costStatus)])}
        foot={["Total", tot.units, tk(tot.net), tk(-tot.cogs), tk(-tot.subsidy), tk(-tot.other), tk(-tot.ret), tk(tot.contrib), pc(tot.net ? tot.contrib / tot.net : 0), ""]}
      />
    </div>
  );
}
```

- [ ] **Step 4: `DistrictsTab.tsx`** (a port of `viewDistricts`)

```tsx
"use client";
import { useEffect } from "react";
import { useReportDistricts, type Summary } from "@/hooks/useSalesReportV2";
import { pc, tk } from "./format";
import type { TabProps } from "./ReportFilters";
import { ReportTable } from "./Table";

const per = (s: Summary, v: number | undefined) => (s.dN ? (v ?? 0) / s.dN : 0);

export function DistrictsTab({ f, onExport }: TabProps) {
  const { data } = useReportDistricts(f);
  const rows = data?.rows ?? [];
  useEffect(() => {
    onExport("districts", data ? [
      ["District", "Zone", "Booked", "Delivered", "Net sales", "Delivery paid per order", "Courier charge per order", "Subsidy per order", "Cancelled or returned", "Contribution per order"],
      ...rows.map((r) => [r.district, r.zone, r.s.n, r.s.dN, Math.round(r.s.net ?? 0), Math.round(per(r.s, r.s.deliveryPaid)), Math.round(per(r.s, r.s.courierCost)), Math.round(per(r.s, r.s.subsidy)), pc(r.s.lossRate), Math.round(per(r.s, r.s.contrib))]),
    ] : null);
  }, [data, rows, onExport]);
  return (
    <ReportTable
      cols={[{ h: "District" }, { h: "Zone" }, { h: "Booked", num: true }, { h: "Delivered", num: true }, { h: "Net sales", num: true }, { h: "Delivery paid per order", num: true }, { h: "Courier charge per order", num: true }, { h: "Subsidy per order", num: true }, { h: "Cancelled or returned", num: true }, { h: "Contribution per order", num: true }]}
      rows={rows.map((r) => [r.district || "-", r.zone, r.s.n, r.s.dN, tk(r.s.net ?? 0), tk(per(r.s, r.s.deliveryPaid)), tk(per(r.s, r.s.courierCost)), tk(per(r.s, r.s.subsidy)), pc(r.s.lossRate), tk(per(r.s, r.s.contrib))])}
    />
  );
}
```

- [ ] **Step 5: Typecheck the admin.** Check each tab in the browser. The Products total contribution must equal the Overview's gross contribution for the same filters. **Log.**

---

### Task 17: Couriers + Exceptions tabs

**Files:** replace the stubs `CouriersTab.tsx` and `ExceptionsTab.tsx`.

- [ ] **Step 1: `CouriersTab.tsx`** (a port of `viewCouriers`)

```tsx
"use client";
import { useEffect } from "react";
import { useReportCouriers } from "@/hooks/useSalesReportV2";
import { COLORS, courierLabel, tk } from "./format";
import { Panel } from "./OverviewTab";
import type { TabProps } from "./ReportFilters";
import { ReportTable, Small } from "./Table";

export function CouriersTab({ f, onExport }: TabProps) {
  const { data } = useReportCouriers(f);
  const rows = data?.rows ?? [];
  useEffect(() => {
    onExport("couriers", data ? [
      ["Courier", "Parcels", "Returned", "Agreed charge", "Billed", "Overcharged", "Undercharged", "Orders over tolerance", "Awaiting bill", "COD collected", "Net receivable"],
      ...rows.map((r) => [r.courier ? courierLabel(r.courier) : "No courier set", r.n, r.ret, r.agreed, r.billed, r.over, r.under, r.overN, r.awaiting, r.collect, r.recv]),
    ] : null);
  }, [data, rows, onExport]);
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[13px]" style={{ color: COLORS.muted }}>Delivered and returned parcels in this period. Agreed charge comes from the rate card in Rates and costs. Billed is what the courier deducted in its settlement.</p>
      <ReportTable
        cols={[{ h: "Courier" }, { h: "Parcels", num: true }, { h: "Returned", num: true }, { h: "Agreed charge", num: true }, { h: "Billed", num: true }, { h: "Overcharged", num: true }, { h: "Undercharged", num: true }, { h: "Awaiting bill", num: true }, { h: "COD collected", num: true }, { h: "Net receivable", num: true }]}
        rows={rows.map((r) => [
          r.courier ? courierLabel(r.courier) : <span key="n" style={{ color: COLORS.loss }}>No courier set</span>,
          r.n, r.ret, r.courier ? tk(r.agreed) : "-", tk(r.billed),
          <span key="o" style={{ color: r.over > 0 ? COLORS.loss : undefined }}>{tk(r.over)}<Small>{r.overN} over tolerance</Small></span>,
          tk(r.under), <span key="a">{r.awaiting}{r.awaiting > 0 && <Small>est. {tk(r.awaitingAmt)}</Small>}</span>, tk(r.collect), tk(r.recv),
        ])}
      />
      <Panel title="Largest overcharges" hint="Claim these back in the next settlement">
        <ReportTable
          empty="No overcharges above tolerance in this period."
          cols={[{ h: "Order" }, { h: "Courier" }, { h: "District" }, { h: "Weight", num: true }, { h: "Agreed", num: true }, { h: "Billed", num: true }, { h: "Difference", num: true }]}
          rows={(data?.top ?? []).map((c) => [c.o.orderNumber, courierLabel(c.o.courier), c.o.district, `${c.weight} kg`, (c.expected ?? 0).toFixed(2), tk(c.o.actual ?? 0),
            <span key="d" style={{ color: COLORS.loss }}>+{(c.overcharge ?? 0).toFixed(2)}</span>])}
        />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: `ExceptionsTab.tsx`** (a port of `viewExceptions`; order links jump to the Orders tab)

```tsx
"use client";
import { useEffect } from "react";
import { useReportExceptions, type FlagKey, type OrderRow } from "@/hooks/useSalesReportV2";
import { COLORS, FLAG, agentLabel, courierLabel, dmy, tk } from "./format";
import type { TabProps } from "./ReportFilters";
import { ReportTable, Small } from "./Table";
import { StatusBadge } from "./Tags";

function detail(f: FlagKey, c: OrderRow, money: boolean): string {
  switch (f) {
    case "loss": case "low": return `${c.lines.map((l) => `${l.name} × ${l.qty}`).join(", ")}${money ? `; delivery paid ${tk(c.o.delivery ?? 0)}, courier ${tk(c.courierCharge)}` : ""}`;
    case "over": return `Agreed ${(c.expected ?? 0).toFixed(2)} for ${c.weight} kg, billed ${tk(c.o.actual ?? 0)}`;
    case "stuck": return `${c.o.status} since ${dmy(c.o.date)}`;
    case "nobill": return `Delivered ${dmy(c.o.hist.delivered)}, using estimate ${tk(c.expected)}`;
    case "unconf": return c.lines.filter((l) => l.costOk === false && l.unitCost != null).map((l) => `${l.name} at ${tk(l.unitCost)}`).join(", ");
    case "nocost": return c.lines.filter((l) => l.unitCost == null).map((l) => l.name).join(", ");
    case "nocourier": return money ? `Billed ${tk(c.o.actual ?? 0)} with no courier to check against` : "Courier not set on a shipped order";
  }
}

function amount(f: FlagKey, c: OrderRow, money: boolean): string {
  if (!money) return "-";
  if (f === "loss" || f === "low") return tk(c.contribution);
  if (f === "over") return `+${(c.overcharge ?? 0).toFixed(2)}`;
  if (f === "stuck") return tk(c.netSales);
  if (f === "nobill") return tk(c.expected);
  return "-";
}

export function ExceptionsTab({ f, setFilters, money, onExport }: TabProps) {
  const { data } = useReportExceptions(f);
  const groups = data?.groups ?? [];
  useEffect(() => {
    onExport("exceptions", data ? [
      ["Issue", "Order ID", "Order date", "Status", "Agent", "Courier", "Amount", "Action"],
      ...groups.flatMap((g) => g.rows.map((c) => [FLAG[g.flag].label, c.o.orderNumber, dmy(c.o.date), c.o.status, agentLabel(c.o.agentName), c.o.courier ?? "", amount(g.flag, c, money), FLAG[g.flag].action])),
    ] : null);
  }, [data, groups, money, onExport]);

  // Jump to the order in Orders: widen the date range to include it, search for it, open it.
  const goto = (c: OrderRow) =>
    setFilters({
      tab: "orders",
      basis: "order",
      from: c.o.date < f.from ? c.o.date : f.from,
      to: c.o.date > f.to ? c.o.date : f.to,
      q: c.o.orderNumber,
      open: String(c.o.id),
    });

  if (!groups.length) {
    return <div className="rounded-xl border bg-white p-7 text-center" style={{ borderColor: COLORS.line, color: COLORS.ink2 }}>Nothing needs attention. Every order has a courier, a confirmed cost and a bill within tolerance.</div>;
  }
  return (
    <div>
      <p className="mb-3 text-[13px]" style={{ color: COLORS.muted }}>Exceptions ignore the date range so nothing old is missed. Other filters still apply. Thresholds are set in Rates and costs.</p>
      {groups.map((g) => (
        <div key={g.flag} className="mb-3.5">
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2.5">
            <h3 className="text-base font-semibold">{FLAG[g.flag].label} <span className="text-[13px] font-normal" style={{ color: COLORS.muted }}>{g.rows.length}</span></h3>
            <span className="text-[13.5px]" style={{ color: COLORS.ink2 }}>{FLAG[g.flag].action}</span>
          </div>
          <ReportTable
            cols={[{ h: "Order" }, { h: "Status" }, { h: "Agent" }, { h: "Courier" }, { h: "Detail" }, { h: "Amount", num: true }]}
            rows={g.rows.map((c) => [
              <span key="o"><button type="button" className="text-sm" style={{ color: COLORS.green }} onClick={() => goto(c)}>{c.o.orderNumber}</button><Small>{dmy(c.o.date)}</Small></span>,
              <StatusBadge key="s" status={c.o.status} />, agentLabel(c.o.agentName),
              c.o.courier ? courierLabel(c.o.courier) : <span key="c" style={{ color: COLORS.loss }}>not set</span>,
              detail(g.flag, c, money), amount(g.flag, c, money),
            ])}
          />
        </div>
      ))}
    </div>
  );
}
```

`OrdersTab` reads `q` and `open` from the URL at mount. `goto` changes `tab` in the same URL update, which unmounts Exceptions and mounts Orders with the new values, so the order opens.

- [ ] **Step 3: Typecheck the admin.** In the browser: the Exceptions badge count matches the number of flagged orders, and an order link opens that order in Orders. **Log.**

---

### Task 18: Rates and costs tab

**Files:**
- Replace the stub: `RatesAndCostsTab.tsx`
- Create: `RateCardEditor.tsx`, `CostHistoryEditor.tsx`, `OtherCostsCard.tsx`, `CourierBillImport.tsx`

- [ ] **Step 1: `RateCardEditor.tsx`**

```tsx
"use client";
import type { ReportSettings } from "@/hooks/useSalesReportV2";
import { COLORS, courierLabel } from "./format";

const inp = "w-[88px] rounded-md border bg-white px-1.5 py-0.5 text-right text-sm disabled:bg-[#f6f8f6]";

export function NumInput({ value, step = 1, disabled, label, onChange }: { value: number; step?: number; disabled: boolean; label: string; onChange: (v: number) => void }) {
  return (
    <input type="number" step={step} min={0} aria-label={label} disabled={disabled} className={inp} style={{ borderColor: COLORS.line }}
      defaultValue={value} key={value}
      onBlur={(e) => { const v = parseFloat(e.target.value); if (Number.isNaN(v) || v < 0) e.target.value = String(value); else if (v !== value) onChange(v); }} />
  );
}

export function RateCardEditor({ s, couriers, zones, disabled, onChange }: {
  s: ReportSettings; couriers: string[]; zones: string[]; disabled: boolean; onChange: (next: ReportSettings) => void;
}) {
  const setRate = (courier: string, patch: Partial<ReportSettings["rates"][string]>) =>
    onChange({ ...s, rates: { ...s.rates, [courier]: { ...s.rates[courier], ...patch } } });
  const setZone = (courier: string, zone: string, key: string, v: number) =>
    setRate(courier, { zones: { ...s.rates[courier].zones, [zone]: { ...s.rates[courier].zones[zone], [key]: v } } });
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[14.5px]">
        <thead><tr className="text-[13.5px]" style={{ color: COLORS.muted }}>
          <th className="px-3 py-2 text-left font-medium">Zone</th><th className="px-3 text-right font-medium">Small parcel up to</th><th className="px-3 text-right font-medium">Small parcel rate ৳</th><th className="px-3 text-right font-medium">First kg ৳</th><th className="px-3 text-right font-medium">Each extra kg ৳</th>
        </tr></thead>
        <tbody>
          {couriers.map((c) => {
            const rc = s.rates[c];
            return [
              <tr key={c} style={{ background: "#fbfcfb" }}>
                <td colSpan={5} className="border-t px-3 py-2 font-semibold" style={{ borderColor: COLORS.line }}>
                  {courierLabel(c)}
                  <span className="ml-3 text-[13px] font-normal" style={{ color: COLORS.muted }}>
                    COD <NumInput value={rc.cod} step={0.01} disabled={disabled} label={`${c} COD %`} onChange={(v) => setRate(c, { cod: v })} /> % on{" "}
                    <select aria-label={`${c} COD base`} disabled={disabled} value={rc.codBase} onChange={(e) => setRate(c, { codBase: e.target.value as "product" | "collect" })} className="rounded-md border px-1 text-sm" style={{ borderColor: COLORS.line }}>
                      <option value="product">product value</option><option value="collect">amount collected</option>
                    </select>
                    <span className="ml-3">Return charge <NumInput value={rc.returnPct} disabled={disabled} label={`${c} return %`} onChange={(v) => setRate(c, { returnPct: v })} /> % of rate</span>
                  </span>
                </td>
              </tr>,
              ...zones.map((z) => (
                <tr key={`${c}-${z}`} className="border-t" style={{ borderColor: COLORS.line }}>
                  <td className="px-3 py-1.5">{z}</td>
                  <td className="px-3 text-right"><NumInput value={rc.zones[z].smallMax} step={0.05} disabled={disabled} label={`${c} ${z} small max`} onChange={(v) => setZone(c, z, "smallMax", v)} /> kg</td>
                  <td className="px-3 text-right"><NumInput value={rc.zones[z].small} disabled={disabled} label={`${c} ${z} small`} onChange={(v) => setZone(c, z, "small", v)} /></td>
                  <td className="px-3 text-right"><NumInput value={rc.zones[z].first} disabled={disabled} label={`${c} ${z} first`} onChange={(v) => setZone(c, z, "first", v)} /></td>
                  <td className="px-3 text-right"><NumInput value={rc.zones[z].extra} disabled={disabled} label={`${c} ${z} extra`} onChange={(v) => setZone(c, z, "extra", v)} /></td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: `OtherCostsCard.tsx`**

```tsx
"use client";
import type { ReportSettings } from "@/hooks/useSalesReportV2";
import { COLORS } from "./format";
import { NumInput } from "./RateCardEditor";

export function OtherCostsCard({ s, disabled, onChange }: { s: ReportSettings; disabled: boolean; onChange: (next: ReportSettings) => void }) {
  const rows: [string, number, (v: number) => ReportSettings, string, string, number?][] = [
    ["Packaging cost per shipped order", s.packaging, (v) => ({ ...s, packaging: v }), "৳", ""],
    ["bKash fee on advance", s.fees.BKASH ?? 0, (v) => ({ ...s, fees: { ...s.fees, BKASH: v } }), "", "%", 0.01],
    ["Nagad fee on advance", s.fees.NAGAD ?? 0, (v) => ({ ...s, fees: { ...s.fees, NAGAD: v } }), "", "%", 0.01],
    ["Flag low contribution below", s.th.low, (v) => ({ ...s, th: { ...s.th, low: v } }), "৳", ""],
    ["Courier overcharge tolerance", s.th.over, (v) => ({ ...s, th: { ...s.th, over: v } }), "৳", ""],
    ["Flag pending or confirmed orders older than", s.th.pending, (v) => ({ ...s, th: { ...s.th, pending: v } }), "", "days"],
    ["Flag missing courier bill after delivery", s.th.bill, (v) => ({ ...s, th: { ...s.th, bill: v } }), "", "days"],
  ];
  return (
    <table className="w-full border-collapse text-[14.5px]">
      <tbody>
        {rows.map(([label, value, apply, pre, post, step]) => (
          <tr key={label} className="border-t first:border-t-0" style={{ borderColor: COLORS.line }}>
            <td className="py-1.5">{label}</td>
            <td className="text-right">{pre} <NumInput value={value} step={step} disabled={disabled} label={label} onChange={(v) => onChange(apply(v))} /> {post}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: `CostHistoryEditor.tsx`.** It lists products through the existing `useProductCosts(search)` and variants through `useVariantCosts(productId)`, and shows each scope's history with Confirm/Unconfirm, Remove, and "Add cost from [date]".

```tsx
"use client";
import { useState } from "react";
import { useProductCosts, useVariantCosts } from "@/hooks/useProfit";
import { useAddCost, useConfirmCost, useCostHistory, useRemoveCost, type CostHistoryRow } from "@/hooks/useSalesReportV2";
import { COLORS, dmy, tk } from "./format";
import { Tag } from "./Tags";
import { addDays } from "./useReportFilters";

function History({ rows, canEdit }: { rows: CostHistoryRow[]; canEdit: boolean }) {
  const confirm = useConfirmCost();
  const remove = useRemoveCost();
  const today = new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
  const current = [...rows].filter((r) => r.effectiveFrom <= today).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if (!rows.length) return <span className="text-[13px]" style={{ color: COLORS.loss }}>No cost yet</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map((r, i) => (
        <span key={r.id} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-px text-[13.5px]"
          style={r === current ? { borderColor: COLORS.greenLine, background: COLORS.greenWash } : { borderColor: COLORS.line, background: "#fff" }}>
          from {dmy(r.effectiveFrom)}: <b>{tk(Number(r.cost))}</b>{r.costPriceUnit && <span className="text-xs" style={{ color: COLORS.muted }}>{r.costPriceUnit.replace("PER_", "per ").toLowerCase()}</span>}
          {r.confirmed ? <Tag>Confirmed</Tag> : <Tag tone="info">Unconfirmed</Tag>}
          {canEdit && <button type="button" className="text-sm" style={{ color: COLORS.green }} onClick={() => confirm.mutate({ id: r.id, confirmed: !r.confirmed })}>{r.confirmed ? "Mark unconfirmed" : "Confirm"}</button>}
          {canEdit && i > 0 && <button type="button" aria-label="Remove cost" className="text-sm" style={{ color: COLORS.green }} onClick={() => remove.mutate(r.id)}>remove</button>}
        </span>
      ))}
    </div>
  );
}

function AddCost({ productId, variantId }: { productId: number; variantId: number | null }) {
  const add = useAddCost();
  const tomorrow = addDays(new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10), 1);
  const [from, setFrom] = useState(tomorrow);
  const [cost, setCost] = useState("");
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input type="date" aria-label="New cost from" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border px-1.5 py-0.5 text-sm" style={{ borderColor: COLORS.line }} />
      <input type="number" min={0} aria-label="New cost" placeholder="৳" value={cost} onChange={(e) => setCost(e.target.value)} className="w-[88px] rounded-md border px-1.5 py-0.5 text-right text-sm" style={{ borderColor: COLORS.line }} />
      <button type="button" disabled={add.isPending || cost === "" || Number(cost) < 0}
        onClick={() => add.mutate({ productId, variantId, cost: Number(cost), effectiveFrom: from }, { onSuccess: () => setCost("") })}
        className="rounded-lg border px-3 py-0.5 text-sm font-medium disabled:opacity-40" style={{ borderColor: COLORS.line }}>Add cost</button>
    </span>
  );
}

function ProductCosts({ productId, canEdit }: { productId: number; canEdit: boolean }) {
  const history = useCostHistory(productId);
  const variants = useVariantCosts(productId);
  const rows = history.data ?? [];
  const scope = (variantId: number | null) => rows.filter((r) => r.variantId === variantId);
  return (
    <div className="grid gap-2 py-2">
      <div className="flex flex-wrap items-center gap-3"><span className="w-40 text-[13px]" style={{ color: COLORS.muted }}>Product level</span><History rows={scope(null)} canEdit={canEdit} />{canEdit && <AddCost productId={productId} variantId={null} />}</div>
      {(variants.data ?? []).map((v) => (
        <div key={v.id} className="flex flex-wrap items-center gap-3"><span className="w-40 text-[13px]" style={{ color: COLORS.muted }}>{v.sku ?? `Variant ${v.id}`}</span><History rows={scope(v.id)} canEdit={canEdit} />{canEdit && <AddCost productId={productId} variantId={v.id} />}</div>
      ))}
    </div>
  );
}

export function CostHistoryEditor({ canEdit }: { canEdit: boolean }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const products = useProductCosts(search);
  const items = products.data?.items ?? [];
  return (
    <div>
      <input type="search" aria-label="Search products" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)}
        className="mb-2.5 min-h-[34px] w-full rounded-[7px] border bg-white px-2 text-sm sm:w-80" style={{ borderColor: COLORS.line }} />
      <div className="divide-y rounded-xl border" style={{ borderColor: COLORS.line }}>
        {items.map((p) => (
          <div key={p.id} className="px-3 py-2">
            <button type="button" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)} className="flex w-full items-center justify-between text-left">
              <span>{p.name}<span className="ml-2 text-[13px]" style={{ color: COLORS.muted }}>{p.price ? `sells at ${tk(Number(p.price))}` : ""}{p.variantCount ? `, ${p.variantCount} variants` : ""}</span></span>
              <span className="text-sm" style={{ color: COLORS.green }}>{open === p.id ? "Hide" : "Costs"}</span>
            </button>
            {open === p.id && <ProductCosts productId={p.id} canEdit={canEdit} />}
          </div>
        ))}
      </div>
    </div>
  );
}
```

`useProductCosts(search)` returns `Paginated<ProductCostRow>` (first 50, `{ items, total }`), and `ProductCostRow` has `id, name, price, variantCount`.

- [ ] **Step 4: `CourierBillImport.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { importCourierBill, type BillImportResult } from "@/hooks/useSalesReportV2";
import { COLORS, courierLabel } from "./format";

export function CourierBillImport({ couriers }: { couriers: string[] }) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState(couriers[0] ?? "STEADFAST");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BillImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <select aria-label="Courier" value={provider} onChange={(e) => setProvider(e.target.value)} className="min-h-[34px] rounded-[7px] border px-2 text-sm" style={{ borderColor: COLORS.line }}>
          {couriers.map((c) => <option key={c} value={c}>{courierLabel(c)}</option>)}
        </select>
        <input type="file" accept=".csv,text/csv" aria-label="Courier statement CSV" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        <button type="button" disabled={!file || busy}
          onClick={async () => {
            if (!file) return;
            setBusy(true); setError(null); setResult(null);
            try { setResult(await importCourierBill(provider, file)); qc.invalidateQueries({ queryKey: ["sales-report-v2"] }); }
            catch (e) { setError(e instanceof Error ? e.message : "Import failed"); }
            finally { setBusy(false); }
          }}
          className="rounded-lg border px-3.5 py-1 text-sm font-semibold text-white disabled:opacity-40" style={{ background: COLORS.green, borderColor: COLORS.green }}>
          {busy ? "Importing…" : "Import statement"}
        </button>
      </div>
      {error && <p className="rounded-lg px-3 py-2 text-sm" style={{ background: COLORS.lossWash, color: COLORS.loss }}>{error}</p>}
      {result && (
        <p className="rounded-lg px-3 py-2 text-sm" style={{ background: COLORS.gainWash, color: COLORS.gain }}>
          {result.rows} parcel(s) in the file, {result.updated} matched and updated.
          {result.unmatched.length > 0 && <span style={{ color: COLORS.amber }}> {result.unmatched.length} not found: {result.unmatched.slice(0, 10).join(", ")}{result.unmatched.length > 10 ? "…" : ""}</span>}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: `RatesAndCostsTab.tsx`** (edits are held locally and saved together)

```tsx
"use client";
import { useEffect, useState } from "react";
import { useReportSettings, useSaveReportSettings, type ReportSettings } from "@/hooks/useSalesReportV2";
import { COLORS } from "./format";
import { Panel } from "./OverviewTab";
import type { TabProps } from "./ReportFilters";
import { RateCardEditor } from "./RateCardEditor";
import { OtherCostsCard } from "./OtherCostsCard";
import { CostHistoryEditor } from "./CostHistoryEditor";
import { CourierBillImport } from "./CourierBillImport";
import { LegacySettings } from "./LegacySettings";

export function RatesAndCostsTab({ onExport }: TabProps) {
  const { data } = useReportSettings();
  const save = useSaveReportSettings();
  const [draft, setDraft] = useState<ReportSettings | null>(null);
  useEffect(() => { onExport("rates-and-costs", null); }, [onExport]);
  useEffect(() => { if (data) setDraft(data.settings); }, [data]);
  if (!data || !draft) return <div className="p-7 text-center" style={{ color: COLORS.ink2 }}>Loading…</div>;
  const ro = !data.canEdit;
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);
  return (
    <div className="grid gap-3.5">
      {ro && <div className="rounded-lg px-3 py-2 text-[13.5px]" style={{ background: COLORS.amberWash, color: COLORS.amber }}>Managers can view rates and costs. Only admins can change them.</div>}
      {!ro && (dirty || save.isError) && (
        <div className="sticky top-2 z-10 flex items-center gap-3 rounded-lg border bg-white px-3 py-2 shadow-sm" style={{ borderColor: COLORS.line }}>
          <span className="text-sm">Unsaved changes to rates, fees or thresholds.</span>
          {save.isError && <span className="text-sm" style={{ color: COLORS.loss }}>{(save.error as Error).message}</span>}
          <span className="flex-1" />
          <button type="button" onClick={() => setDraft(data.settings)} className="text-sm" style={{ color: COLORS.muted }}>Discard</button>
          <button type="button" disabled={save.isPending} onClick={() => save.mutate(draft)} className="rounded-lg px-3.5 py-1 text-sm font-semibold text-white disabled:opacity-40" style={{ background: COLORS.green }}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      )}
      <Panel title="Courier rate card" hint="Agreed charge = rate for the parcel weight + COD charge. Zones are your Shipping Zones. Change a value and save to see every report update.">
        <RateCardEditor s={draft} couriers={data.couriers} zones={data.zones} disabled={ro} onChange={setDraft} />
      </Panel>
      <Panel title="Product costs" hint="Each order uses the cost active on its order date, so adding a new cost never changes past reports.">
        <CostHistoryEditor canEdit={!ro} />
      </Panel>
      <Panel title="Other costs and alerts" hint="Payment fees apply to advance amounts. Enter your merchant rates.">
        <OtherCostsCard s={draft} disabled={ro} onChange={setDraft} />
      </Panel>
      {!ro && (
        <Panel title="Courier bills" hint="Upload the courier's per-parcel statement CSV. Parcels are matched by consignment ID; the billed charge replaces the rate-card estimate.">
          <CourierBillImport couriers={data.couriers} />
        </Panel>
      )}
      <LegacySettings />
    </div>
  );
}
```

- [ ] **Step 6: Typecheck the admin.** In the browser:
  - Change the Steadfast "First kg" for a zone and save. The Overview courier figures move.
  - Add a cost dated tomorrow. Today's reports don't change.
  - Confirm, then unconfirm, a cost. The Unconfirmed tag toggles.
  - A manager-only account (`net_profit_reports.view` without `net_profit_settings.manage`) sees the page read-only.

  **Log.**

---

### Task 19: End-to-end verification

**Files:** `backend/bug-fix-and-feature-edit.md` (final entry)

- [ ] **Step 1: Full backend tests**

Run: `cd apps/backend && npx cross-env NODE_OPTIONS=--experimental-vm-modules jest src/modules/net-profit src/modules/product-cost-history src/modules/products src/common/auth`
Expected: all pass. Note any failure in a test file you didn't touch and investigate it before claiming done.

- [ ] **Step 2: Typecheck both apps** (exit 0) and run `cd apps/admin && node --test tests/*.test.mjs`.

- [ ] **Step 3: Live checks against local data** (admin token as in Task 10, Step 8):
  1. Overview for the last 30 days: `summary.n` equals the order count for the same range, from `select count(*) from orders where deleted_at is null and created_at >= <from Dhaka>`.
  2. Orders `?courier=none` returns only orders with no shipment.
  3. **Agent scope:** create a role with only `net_profit_reports.view_own` and assign it to a test staff user. Mint that user's token and call `overview`, `orders` and `exceptions`. Confirm (with a JSON key scan) that no `MONEY_KEYS` appear and that `agents`/`products` return 403. Delete the test role and user afterwards.
  4. Courier bill import with a 2-row hand-made CSV (one real consignment ID from `select consignment_id from shipments limit 1` and one fake). Expect `matched: 1, unmatched: [fake]`, then confirm that order's Courier check shows "Courier billed". Reset that shipment's `billed_charge` to NULL afterwards.
- [ ] **Step 4: Browser pass** over all 8 tabs at desktop and phone width (no horizontal page scroll except inside tables).
- [ ] **Step 5: Log** a final summary entry: what shipped, the ৳3,438 acceptance result, and the open item: **the Steadfast statement column mapping is waiting on a real sample file.**
