# Sales Report (Net Profit → Reports) — Design

**Date:** 2026-09-18
**Status:** Approved in brainstorming, awaiting spec review
**Reference:** `H:\Amder Project\amadere-sales-report-demo.html` (the demo). Where this
spec is silent, the demo's behaviour is the requirement.

## 1. Goal

Replace `/net-profit/reports` with the demo's sales report: orders, delivery cost and
per-order **contribution**, with a courier overcharge check, dated product costs and an
Exceptions queue. The report is built on real data and scoped by permissions.

The build has four parts, all in scope, in this order:

1. Report shell + engine on current data
2. Dated, confirmable product cost history
3. Courier rate card + per-parcel bill import
4. Exceptions + permission-scoped views

## 2. Decisions (from brainstorming)

| # | Decision |
|---|---|
| D1 | The new report **replaces** the page. The old Dashboard and P&L tabs are removed. The old settings cards (marketing costs, fraud, fallback profit, hourly slots) move **unchanged** into "Rates and costs". The old product cost editor is superseded by the cost-history editor. |
| D2 | All four parts are in scope. |
| D3 | The real per-parcel courier charge comes from a **CSV upload** of the courier's statement, matched by consignment ID. |
| D4 | A delivered order with any line missing a cost is **left out of contribution and flagged**. No fallback estimate is used. |
| D5 | Views are scoped by permission. The demo's "View as" switch is dropped. |
| D6 | The engine runs **on the server**, as a pure module. Nothing is snapshotted. |
| D7 | Status mapping: PARTIALLY_RETURNED counts as Returned (the whole order), and HOLD counts as Confirmed. |
| D8 | Existing costs are migrated as **Confirmed** history rows. |
| D9 | The rate card is keyed by **courier × existing Shipping Zones** (the same zones checkout uses). |
| D10 | Layout and components follow the demo. Colours use the **admin green** palette and font, not violet. |

## 3. Data mapping

| Demo concept | Source |
|---|---|
| Pending / Confirmed / Shipped / Delivered / Returned / Cancelled | `OrderStatus` PENDING / CONFIRMED+HOLD / PROCESSING / COMPLETED / RETURNED+PARTIALLY_RETURNED / CANCELED |
| Order date | `Order.createdAt` |
| Delivered / returned / confirmed / shipped / cancelled dates | First `OrderStatusHistory` entry into that status (fallback `Order.confirmedAt` for confirmed) |
| Channel | `Order.channel` (enum labels) |
| Agent / "confirmed by" | `Order.assignedAdmin` (null = "Website (no agent)") |
| New / Repeat | New = this is the customer's (or, with no customer, the phone's) earliest non-cancelled order |
| Customer, phone, district | Shipping `OrderAddress` |
| Zone | `resolveZoneFee(shippingZonesConfig, district).name` |
| Line weight | `variant.weightOverride ?? product.shippableWeight` × qty (same as the order CSV export) |
| Line price / discount | `OrderItem.unitPrice` × qty. Order lines have no discount of their own; the order-level `discountAmount` is spread across lines by value, so line net sales sum to the order's net sales |
| Delivery paid by customer | `Order.shippingAmount` |
| Advance, payment method | `AdvancePayment.paid` (0 when none); method = latest `Payment.provider`, COD when none |
| Courier | latest `Shipment.provider` (none = "Courier not set") |
| Courier billed | `Shipment.billedCharge` (new, from import) |
| Unit cost | cost history active on the order date (§5) |

Net sales for an order = Σ(line gross) − order discount (the same figure as
`Order.subTotal − discountAmount`).

## 4. Engine (`net-profit/sales-report/engine/`)

A pure, dependency-free TypeScript module that ports the demo's `calcOrder`, `flagsOf`,
`summarize`, `productRows` and per-dimension summaries. It takes a normalized
`ReportOrder` (built by a loader from Prisma rows) and a `ReportSettings` (rate card,
packaging, fees, thresholds), plus a resolver for costs by date. It returns plain objects.

- `calcOrder(order, settings, costs)` → netSales, weight, zone, collect, rate, cod,
  expected, shipped, courierCharge, estimated, overcharge, cogs, packaging, fee,
  contribution, subsidy, receivable, unconfirmed. The formulas are **identical to the
  demo** (§ `calcOrder` in the demo file).
- `flagsOf(calc, settings, today)` → loss, low, over, nocourier, stuck, nobill, unconf,
  nocost (the demo's rules and thresholds).
- `summarize(calcs)` → the demo's summary object (status counts, net, del, courier,
  cogs, pack, fee, retLoss, contrib, subsidy, overPos, overN, margin, aov, lossRate,
  new/repeat, missing, est).
- `productRows`, `agentRows`, `courierRows`, `districtRows`, `channelRows`, `dailySeries`.

"Today" is passed in, never read inside the engine. That keeps the demo's fixtures
testable.

## 5. Product cost history (new table)

```
model ProductCostHistory {
  id            Int            @id @default(autoincrement())
  productId     Int            @map("product_id")
  variantId     Int?           @map("variant_id")   // null = product-level cost
  cost          Decimal        @db.Decimal(10, 2)
  costPriceUnit CostPriceUnit? @map("cost_price_unit") // product-level rate unit, as today
  effectiveFrom DateTime       @map("effective_from") @db.Date
  confirmed     Boolean        @default(true)
  createdBy     Int?           @map("created_by")
  createdAt     DateTime       @default(now()) @map("created_at")
  @@unique([productId, variantId, effectiveFrom])
  @@index([productId])
  @@map("product_cost_history")
}
```

This adds a table and does not change the Product table (AGENTS.md rule 5: approved here).

- **Resolution for a line on date D:** the variant row with the greatest
  `effectiveFrom ≤ D`. If there is none, the product row with the greatest
  `effectiveFrom ≤ D`, scaled by weight when that row has a `costPriceUnit` (the
  existing `lineUnitCost` rule). If there is none, the cost is **missing**.
  - A line is **unconfirmed** when its resolved row has `confirmed = false`.
- **Single writer:** `ProductCostHistoryService.addCost / setConfirmed / remove`.
  - Every existing cost writer calls it: the product form (`costPerItem`,
    `costPriceUnit`), the variant cost cell, `bulkSetProductCost`, and product import.
  - Saving a different cost adds a row **effective today**; it does not overwrite.
  - Setting a cost on an existing date replaces that row.
- **Keeping `costPerItem` in sync:** `Product.costPerItem`, `costPriceUnit` and
  `ProductVariant.costPerItem` are kept equal to the row active **today**. This happens
  after every write and on a daily job for rows dated in the future. As a result the
  profit screens, the CSV export and the variants tab work unchanged.
- **Migration:** every non-null existing cost becomes one row, effective from the
  earliest order date, marked `confirmed = true`.
- **Removing rows:** the earliest row of a product/variant can't be removed while later
  rows exist (as in the demo).

## 6. Courier rate card and bill import

**Settings** live in the NetProfitSettings namespace `sales_report` (JSON, no new table):

```
rates: { [courier: CourierProviderName]: {
  cod: number,                        // %
  codBase: 'product' | 'collect',
  returnPct: number,                  // % of rate
  zones: { [zoneName]: { smallMax, small, first, extra } } } }
packaging: number
fees: { bKash: number, Nagad: number, COD: 0 }   // % on advance
th: { low: 50, over: 5, pending: 2, bill: 3 }
```

- **Defaults** (every courier, every zone): smallMax 0.2, small 80, first 105, extra 20,
  cod 1, codBase product, returnPct 100, packaging 0, fees 0.
- **Missing zone:** a zone that exists in Shipping Zones but not in the rate card gets
  the defaults when first shown. An order whose zone has no rate has `expected = null`.

**Bill import** adds three nullable columns to `shipments`: `billed_charge
Decimal(10,2)`, `billed_at DateTime`, `bill_import_ref String`.

- `POST /admin/net-profit/sales-report/courier-bills` takes `multipart` (courier + CSV).
  - The parser matches rows by consignment ID.
  - It returns `{ rows, matched, unmatched[], updated }`.
  - Re-importing a statement overwrites earlier values.
- The Steadfast column mapping is fixed from a **real sample file supplied by the owner**.
  This is the only step that blocks on an external input; everything else is built first.
- **Courier charge used by the engine:** `billedCharge` when present, otherwise the
  rate-card `expected` (marked estimated). The existing dispatch-time `Shipment.cost` is
  untouched.

## 7. API

All endpoints are under `/admin/net-profit/sales-report/v2` and share one filter query:
`basis (order|delivered), from, to, channel, agentId|none, courier|none, district, status`.

| Endpoint | Returns |
|---|---|
| `GET overview` | summary, channelRows, dailySeries |
| `GET orders?q&sort&page` | calc rows with lines, flags, timeline |
| `GET agents` | agentRows + both ranks |
| `GET products` | productRows + cost status |
| `GET couriers` | courierRows + top overcharges |
| `GET districts` | districtRows |
| `GET exceptions` | flag groups (date range ignored; other filters apply) + total count |
| `GET/PUT settings` | §6 settings |
| `GET/POST/PATCH/DELETE costs` | cost history rows |
| `POST courier-bills` | import result |

**Permissions:**

- `net_profit_reports.view` gives every read endpoint with money.
- `net_profit_settings.manage` is required for settings, costs and bills writes.
- The new permission **`net_profit_reports.view_own`** (added to the permission
  catalog) forces `agentId = me` on the server. It also allows only overview, orders
  and exceptions, and removes **every money field** from those responses before they
  are serialised: delivery paid, courier charge, contribution, cost, and ledger figures.
  - An agent's exceptions are limited to `stuck` and `nocourier`.
  - A user with both permissions gets the full view.

## 8. Admin UI (`/net-profit/reports`)

The page is rebuilt from focused components in `components/net-profit/sales-report/`:
`ReportFilters`, `ReportTabs`, `OverviewTab` (`LedgerPanel`, `FunnelPanel`,
`MetricStrip`, `DailyChart`, `ChannelTable`), `OrdersTab` (+ `OrderDetailRow`),
`AgentsTab`, `ProductsTab`, `CouriersTab`, `DistrictsTab`, `ExceptionsTab`,
`RatesAndCostsTab` (`RateCardEditor`, `CostHistoryEditor`, `OtherCostsCard`,
`CourierBillImport`, then the four existing settings cards moved unchanged).

- **Look:** the demo's layout, spacing and components, recoloured to the admin
  palette: violet becomes green `#2e7d43`; gain, loss and amber tones stay as in the
  demo. The admin font is used.
- **Behaviour** matches the demo:
  - Quick ranges are Today, Yesterday, Last 7 days, Last 30 days and This month.
  - The Exceptions tab shows a count badge.
  - Clicking an order row expands its detail.
  - Exception rows jump to that order in Orders.
  - Rank-by toggle on Agents.
  - Export CSV exports the current tab.
  - Filters are hidden on Rates and costs.
- The filter state lives in the URL query, so a view can be shared by link.

## 9. Error handling

- Missing cost, rate or courier never throws. The value is null, the order is flagged,
  and it is excluded from totals as the demo does.
- A settings PUT is validated: non-negative numbers, known couriers, known zones.
- Bill import rejects a file without a consignment column. Unmatched rows are reported,
  never silently dropped.
- The "not delivered yet" states show the demo's explanatory text.

## 10. Testing

- **Engine tests with the demo's own data:** the 19 Excel orders of 01/08 with the
  default settings must give **contribution ৳3,438**. The demo's other figures must
  also match: loss rate, subsidy, and the "cancelled with courier charge = return"
  case. Each flag rule and threshold is covered.
- **Cost resolution:** variant over product, date boundaries, per-kg scaling, missing,
  unconfirmed.
- **Cost history service:** add-today versus same-date replace, sync of `costPerItem`,
  and the "can't remove the earliest" rule.
- **Bill import:** match, unmatched, re-import overwrite.
- **Permissions:** a `view_own` user's responses contain no money keys, anywhere.
- **Live check** against the local DB for each tab.

## 11. Out of scope

- Partial-return item accounting.
- Ad-spend attribution in contribution.
- Courier bill import for couriers the owner hasn't supplied a statement sample for.
- Changing `OrderProfit` snapshots or the other profit screens.
