# Multi-Store POS — Design

**Date:** 2026-09-25
**Status:** Awaiting review
**Background:** `../../../POS_COVERAGE_GAP_ANALYSIS.md`, `../../../POS_SESSION_HANDOFF.md`
**UI reference:** the POS mockup supplied 2026-09-25 (product grid + category chips + stat cards + right-hand cart)

## 1. Goal

A point-of-sale for Amader® physical stores, reachable at `https://pos.amadere.com`
and as a **POS** entry inside `https://admin.amadere.com`, with:

- one login shared with the admin panel (no second password);
- role-gated access;
- stock counted per store; shared product catalogue plus store-only products;
- each store sees only its own sales;
- each store's sales and expenses land in the existing Accounts module.

## 2. Decisions (agreed in brainstorming)

| # | Decision |
|---|---|
| D1 | POS lives **inside `apps/admin`** under `/pos`. `pos.amadere.com` is served by the same app (Approach A). |
| D2 | Admin auth cookies get `Domain=.amadere.com` so one session covers `admin.` and `pos.`. |
| D3 | **Shared catalogue + store extras.** `Product.storeId = null` → every store; set → only that store. |
| D4 | Website orders consume stock from **one store flagged `isOnlineStore`**. |
| D5 | Each staff user belongs to **one store**. Permission `pos.all_stores` sees/switches all stores. |
| D6 | V1 scope: POS selling screen, stock-in, adjustment, inter-store transfer, barcode labels. |
| D7 | Same monorepo. No new app, no new repo. |

**This overrides AGENTS.md §6 "per-warehouse stock — Phase 2, do not build"** and the
Phase-2 hook comment at `schema.prisma:938`. AGENTS.md must be amended before merge
(see §10).

## 3. Access & login

**Hosting.** DNS `pos.amadere.com` → same server/process as `admin.amadere.com`.

**Host routing** — `apps/admin/src/proxy.ts`:
- Host `pos.*`: `/` rewrites to `/pos`; any non-`/pos`, non-`/login`, non-`/api` path
  redirects to `/pos`. The POS subdomain never shows admin pages.
- Session check is unchanged (`admin_refresh_token` present, else `/login?next=…`).
  Login page is the existing one; after login it returns to `next`.

**Cookies** — `apps/admin/src/lib/auth-cookies.ts`: add
`domain: process.env.ADMIN_COOKIE_DOMAIN` (prod `.amadere.com`, unset in dev →
host-only as today). Clearing must pass the same domain. One-time effect: existing
sessions are logged out at deploy.

**Permissions** — added to `PERMISSION_CATALOG` (`packages/shared/src/permission-catalog.ts`),
auto-synced by `RbacService`:

| Permission | Allows |
|---|---|
| `pos.access` | open POS, sell, hold, view own store's recent sales |
| `pos.refund` | refund/return a POS sale |
| `pos.stock_in` | receive stock |
| `pos.adjust` | adjust stock (reason required) |
| `pos.transfer` | create/dispatch/receive transfers |
| `pos.transfer_approve` | approve transfers |
| `pos.labels` | generate barcodes, print labels |
| `pos.store_products` | create store-only products for own store |
| `pos.all_stores` | act on any store; switch store; combined reports |
| `pos.reports` | store sales / stock reports (revenue hidden from plain cashiers) |
| `stores.manage` | CRUD stores, assign staff to stores |

Store-only products are always `ADMIN_ONLY` — the existing status that already hides a
product from listing, PDP, search, sitemap, feed and customer carts.

Admin sidebar shows **POS** only with `pos.access`. A user with `pos.access` but no
`storeId` and no `pos.all_stores` sees "No store assigned — ask an admin".

## 4. Data model (Prisma)

```prisma
model Store {
  id            Int      @id @default(autoincrement())
  name          String
  code          String   @unique          // e.g. "DHK1", used in voucher/barcode prefixes
  address       String?
  phone         String?
  isOnlineStore Boolean  @default(false) @map("is_online_store") // exactly one true (partial unique index)
  isActive      Boolean  @default(true)  @map("is_active")
  costCentreId  Int?     @unique @map("cost_centre_id")
  cashAccountId   Int?   @map("cash_account_id")    // tender: Cash
  cardAccountId   Int?   @map("card_account_id")    // tender: Card
  mobileAccountId Int?   @map("mobile_account_id")  // tender: Mobile Banking
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  @@map("stores")
}

model StoreStock {
  id        Int  @id @default(autoincrement())
  storeId   Int  @map("store_id")
  productId Int  @map("product_id")
  variantId Int? @map("variant_id")
  quantity  Int  @default(0)
  lowStockThreshold Int? @map("low_stock_threshold")
  // unique on (storeId, productId, variantId) — via raw-SQL index with COALESCE(variant_id, 0)
  @@map("store_stock")
}

enum StockMovementType { OPENING SALE RETURN STOCK_IN ADJUSTMENT TRANSFER_OUT TRANSFER_IN }

model StockMovement {       // append-only ledger; StoreStock.quantity = running total
  id        Int               @id @default(autoincrement())
  storeId   Int               @map("store_id")
  productId Int               @map("product_id")
  variantId Int?              @map("variant_id")
  type      StockMovementType
  qty       Int               // signed: + in, − out
  reason    String?           // required for ADJUSTMENT
  orderId   Int?              @map("order_id")
  transferId Int?             @map("transfer_id")
  stockInId Int?              @map("stock_in_id")
  unitCost  Decimal?          @db.Decimal(12, 2) @map("unit_cost") // STOCK_IN only
  adminUserId Int             @map("admin_user_id")
  createdAt DateTime          @default(now()) @map("created_at")
  @@index([storeId, productId, variantId, createdAt])
  @@map("stock_movements")
}

enum TransferStatus { REQUESTED APPROVED DISPATCHED RECEIVED CANCELLED }

model StockTransfer {
  id          Int            @id @default(autoincrement())
  number      String         @unique      // TRF-<fromCode>-000123
  fromStoreId Int            @map("from_store_id")
  toStoreId   Int            @map("to_store_id")
  status      TransferStatus @default(REQUESTED)
  note        String?
  requestedById  Int       @map("requested_by_id")
  approvedById   Int?      @map("approved_by_id")
  dispatchedById Int?      @map("dispatched_by_id")
  receivedById   Int?      @map("received_by_id")
  approvedAt     DateTime? @map("approved_at")
  dispatchedAt   DateTime? @map("dispatched_at")
  receivedAt     DateTime? @map("received_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  items          StockTransferItem[]
  @@map("stock_transfers")
}

model StockTransferItem {
  id          Int  @id @default(autoincrement())
  transferId  Int  @map("transfer_id")
  productId   Int  @map("product_id")
  variantId   Int? @map("variant_id")
  qty         Int
  receivedQty Int? @map("received_qty")
  @@map("stock_transfer_items")
}

model StockIn {             // goods receipt
  id        Int      @id @default(autoincrement())
  number    String   @unique              // GRN-<storeCode>-000123
  storeId   Int      @map("store_id")
  supplierPartyId Int? @map("supplier_party_id") // existing accounts Party
  note      String?
  adminUserId Int    @map("admin_user_id")
  createdAt DateTime @default(now()) @map("created_at")
  @@map("stock_ins")
}
```

Changes to existing models:
- `AdminUser.storeId Int?` — the user's home store.
- `Product.storeId Int?` — null = shared; set = store-only.
- `Order.storeId Int?` — set for `channel = POS`.
- `CashAccount.storeId Int?` — informational grouping in Accounts screens.
- `ProductVariant.barcodeType` / `Product.barcodeType` enum `CODE128 | EAN13`, default `CODE128`.

Relations and foreign keys are omitted above for brevity; every `*Id` gets its `@relation`.

## 5. Stock rules

- **Single writer.** `StockService.move(tx, {storeId, productId, variantId, type, qty, ...})`
  inserts a `StockMovement` and updates `StoreStock.quantity` in the same transaction,
  with a conditional update (`quantity + qty >= 0`) for outflows. Nothing else writes
  `store_stock`.
- **Online store = the existing columns.** *(Revised during planning.)* The online
  store has **no** `store_stock` rows: its stock *is* `Product.stock` /
  `ProductVariant.stock`. `StockService.move` writes those columns when the store is
  the online one (honouring `reserved_stock`), and `store_stock` otherwise. Website
  checkout, cancel, wholesale and the product form keep writing the columns exactly as
  today — no website code changes, no mirror to drift. Cost: website-originated changes
  leave no `StockMovement` row (marked `ponytail:` in the schema).
- **Migration / opening.** The migration inserts the online store (`MAIN`). Other
  stores start at 0 and get stock via stock-in or transfer.
- **POS orders and the Order Manager.** A POS order is created `COMPLETED`, so the only
  Order Manager paths it can hit are restock (→ RETURNED/CANCELED) and re-complete;
  both route to the sale's store via `StockService` when that store isn't the online one.
- **Negative stock:** refused at POS (error "Only N in stock at <store>").
- **Low stock:** `quantity <= coalesce(lowStockThreshold, global default 5)`;
  drives the "Low Stock Items" card and a filter in the product grid.

## 6. POS sale → Order → Accounts

- `POST /admin/pos/sales` builds an `Order` with `channel = POS`, `storeId`, status
  completed, optional customer (existing customer search/create), line items, discount
  or coupon via existing discount service, VAT at the store rate (existing
  `accounts_vat` settings).
- Same transaction: `StockService.move(SALE, −qty)` per line.
- After commit: `SalesPostingService.postPrepaidCapture({orderId, amount, accountId})`
  where `accountId` = the store's account for the tender (cash/card/mobile). One
  tender per sale in V1 (split tender deferred). New `PaymentProvider` values `CASH`,
  `CARD`; Mobile Banking = `BKASH`. VAT = product `vatRatePercent` ?? store rate,
  added on top per the mockup (`POS_VAT_ADDED_ON_TOP`, open question). Missing account → existing warn-and-skip behaviour,
  plus a visible warning banner in POS store settings.
- **Refund:** reuses existing refund flow with `RETURN` stock movement back to the
  sale's store and `SalesPostingService` refund posting to the original tender's account.
- **Expenses:** each store gets a `CostCentre` (created with the store). Expenses entered
  in Accounts pick the cost centre; a store manager's expense form defaults to theirs.
- **Store P&L:** Accounts screens get a store filter (sales by `LedgerEntry.order.storeId`
  or `CashAccount.storeId`; expenses by `costCentreId`).

## 7. Visibility (store scoping)

One helper, `resolveStoreScope(adminUser, requestedStoreId?)`:
- no `pos.all_stores` → always `adminUser.storeId` (request param ignored; 403 if null);
- with `pos.all_stores` → requested store, or all stores for reports.

Every POS/stock/transfer/report query goes through it. Products query:
`storeId IS NULL OR storeId = scope`. Sales/recent sales/hold slots: `Order.storeId = scope`.
Transfers: visible to both `fromStoreId` and `toStoreId`.

## 8. Features (V1)

**POS screen** (`/pos`) — matches the mockup:
- top bar: search (name/SKU/barcode) with scanner input (keyboard-wedge; port logic
  from `pos-pro/resources/js/barcode-scanner.js`), Hold Sale, Recent Sales, More, user menu;
  store switcher only with `pos.all_stores`.
- category chips; stat cards (Total Products, Low Stock Items, Today's Sales, Active
  Customer) for the current store; grid/list toggle, sort; product cards with per-store
  stock badge (In Stock / Low Stock / Out of Stock, Add disabled at 0).
- cart: qty steppers, remove, clear, customer search/add, discount/coupon, subtotal,
  VAT, total, tender buttons (Cash / Card / Mobile Banking; cash shows tendered + change),
  Complete Sale → receipt print (80mm, browser print).
- Hold sale: saved server-side per store (so a held sale survives refresh), resumable.
- Currency shown as ৳.

**Stock-in** (`/pos/stock-in`) — pick supplier (optional), scan/add lines with qty and
unit cost, save → GRN number, `STOCK_IN` movements.

**Adjustment** (`/pos/adjust`) — product, +/− qty, mandatory reason from a fixed list
(Damaged, Expired, Count correction, Lost, Other + note).

**Transfers** (`/pos/transfers`) — REQUESTED → APPROVED → DISPATCHED (`TRANSFER_OUT`
from source) → RECEIVED (`TRANSFER_IN` to destination, `receivedQty` may be less;
the shortfall is recorded, not re-credited). CANCELLED allowed before DISPATCHED.

**Barcodes & labels** (`/pos/labels`) — "Generate" fills empty barcodes as Code 128
(`AMD` + zero-padded variant/product id), respecting existing uniqueness check; EAN-13
entry validates the check digit. Label sheet 40×30mm: name, pack size, barcode,
human-readable code, price, Amader®. Single, bulk (qty per product), reprint. Browser
print; barcode SVG rendered with `jsbarcode` (only new dependency).

**Store admin** (`/stores` in admin, `stores.manage`) — CRUD stores, pick the three
tender accounts and cost centre, assign staff.

**Store product** — in the product form, a Store field (visible with
`pos.store_products` / `pos.all_stores`); store managers can only set their own store.

**Reports** (V1 minimum) — Today's sales, sales by date range per store, stock on
hand per store, movement history per product. CSV export. Combined view with
`pos.all_stores`.

## 9. Out of scope (V1)

Offline mode · physical stock-count sessions · purchase orders · nearest-store
fulfilment · TSPL/ZPL direct printing · cash-register open/close with variance ·
loyalty. Each is additive on `StockMovement` / `Order` later.

## 10. Risks & prerequisites

1. **AGENTS.md §6 override** — amend to record that per-store stock is now in scope.
2. **Online-store bridge is the risky part.** Every existing writer of
   `Product.stock`/`ProductVariant.stock` (checkout, cancellation restock, admin
   product edit, imports) must route through `StockService`. Plan task 1 is to list
   them all; regression tests on checkout/cancel before and after.
3. **Botble POS Pro licence** — we port *behaviour* of the scanner logic, not code,
   unless licence sign-off is obtained.
4. **Cookie domain change** logs everyone out once; do it in a quiet hour.
5. **Bangla keyboard** breaks scanner input — cashier guide note; POS search field sets
   `lang="en"` and `inputMode="text"` (does not fully prevent it).

## 11. Testing

- Unit: `StockService.move` (conservation, no-negative, online-store bridge keeps
  scalar equal to `StoreStock`), `resolveStoreScope`, transfer state machine, EAN-13
  check digit, Code 128 generator uniqueness.
- Integration (existing Jest + test DB): POS sale → order + movements + ledger entry
  in correct account; refund reverses both; store A user cannot read store B sale (403/empty);
  website checkout still decrements the online store.
- Manual: login on admin → open `pos.amadere.com` with no prompt; logged-out direct
  visit → login page → back to POS; role without `pos.access` sees no menu and gets 403.

---

## 12. Phase 1.1 — Settings, invoices, Accounts link, hardening, exports (approved 2026-09-25)

Decisions: one VAT setting for all stores; the customer sheet lists customers who bought at that store.

### 12.1 POS Settings (`/pos/settings`, permission `pos.settings`)
- **VAT** is stored in the existing `settings` key/value table under the key `pos.vat`, as `{ enabled: boolean, ratePercent: number, pricesIncludeVat: boolean }`.
  - Default is `{ enabled: true, ratePercent: 15, pricesIncludeVat: false }`, which matches current behaviour.
  - It replaces the `POS_VAT_ADDED_ON_TOP` constant: `posTotals(…, vatOnTop = !pricesIncludeVat)`.
  - With `enabled: false`, VAT is 0.
  - A product's `vatRatePercent` still overrides the rate (0 = exempt).
  - The website's Accounts VAT settings are untouched and no longer read by the POS.
- **Endpoints:** `GET/PUT /admin/pos/settings/vat`. GET is open to `pos.access` (the till needs it); PUT needs `pos.settings`.

### 12.2 Per-store invoice templates (`/pos/settings` › Invoices)
- **Table** `pos_invoice_templates`: `{ id, storeId Int? @unique, html Text, updatedAt, updatedById }`. `storeId null` is the Default template. A store without its own row prints the Default. With no rows at all, the built-in 80mm template in code is used.
- **Tags:** raw HTML with `{{tag}}` substitution, the same convention as the admin invoice template.
  - Tags: `storeName storeAddress storePhone receiptNo date time cashier customerName customerPhone itemsRows itemCount subtotal discountRow vatRow vatLabel total paidBy tendered change changeRow trxRef status`.
  - Row tags (`itemsRows`, `discountRow`, `vatRow`, `changeRow`) are pre-rendered `<tr>` fragments.
  - Item lines include the variant label.
- **Where rendering happens:** client-side, in one pure function `renderPosInvoice(html, data)` in the admin app (unit-tested), used by both the receipt page and the live preview.
- **Sanitising:** the HTML is cleaned server-side on save with `isomorphic-dompurify`: `<script>`, `on*` handlers and `javascript:` URLs are removed, and `<style>` is kept. Tag values are HTML-escaped before substitution.
- **Editor:** a store picker ("Default" + each store), the tag list with descriptions above the editor, a textarea, a live preview with sample data, Save, and "Reset to default", which deletes that store's row.
- **Endpoints:** `GET /admin/pos/invoice-templates` (list), `GET /admin/pos/invoice-templates/resolve?storeId=` (`pos.access`, used by the receipt), `PUT /admin/pos/invoice-templates/:storeId|default`, `DELETE …` (`pos.settings`).

### 12.3 Accounts link
- **Store profit** (a POS Reports tab, `pos.reports`): per store for [from, to] in Dhaka days.
  - Gross sales (POS orders completed in range).
  - Returns (by `returnedAt` in range).
  - VAT.
  - Net sales = gross − returns − VAT.
  - Expenses (non-voided `Expense` rows with `costCentreId` = the store's cost centre, and `expenseDate` in range).
  - Profit = net sales − expenses.
  - CSV/Excel export.
- **Expense default:** the Accounts expense form pre-selects the current admin's store cost centre (from `/admin/auth/me` storeId and the stores list) when creating a new expense.

### 12.4 Hardening (the deferred minors)
1. **Dhaka days:** every "today", recent-sales date and report range uses `dhakaDayStart`/`dhakaDayEnd` (from `product-cost-history/dhaka-date.ts`).
2. **Returns can't race:** `returnSale` claims the order with `updateMany where status = COMPLETED` → `RETURNED` (and sets `returnedAt`) before the restock and refund. The loser gets 409.
3. **Return date:** new `Order.returnedAt` column, also set when the Order Manager moves an order to RETURNED. Reports count returns by `returnedAt`.
4. **Tendered cash:** new `Order.tenderedAmount` column, stored for cash sales. The receipt shows tendered and change.
5. **Inactive stores** can't sell, stock in, adjust, request or receive transfers, or be picked in the switcher (the server refuses with 400).
6. **Transfer approval** is scoped: without `pos.all_stores`, only a user at the source or destination store can approve.
7. **CSV safety:** `toCsv` prefixes cells starting with `= + - @` (or tab/CR) with `'`.
8. **Store list privacy:** `GET /admin/stores` returns staff only to `stores.manage`/`pos.all_stores`; everyone else gets staff counts.
9. **Quantity box:** an empty quantity input keeps the line (it is treated as 1 on blur); only the × button or the − at 1 removes it.
10. **Held baskets:**
    - Holding a resumed basket replaces the old held row instead of duplicating it.
    - Resuming restores the customer.
    - Resuming while the cart is not empty asks for confirmation.
11. **Duplicating a store-only product** keeps its `storeId` and `ADMIN_ONLY`.
12. **Product form:** `storeId` is sent only when it changed, so catalog editors without POS permissions can still edit store products.
13. **Barcode lookup** is exact-match only (barcode or SKU); no fuzzy fallback.
14. **Stock actions** (stock-in, adjust, transfer lines) refuse another store's store-only product.
15. **Re-completing an order** (COMPLETED → PROCESSING → COMPLETED) no longer decrements stock twice: `decrementStockOnly` runs only when the order passed through CANCELED/RETURNED since it last completed.

### 12.5 Per-store Excel exports (POS Reports, `pos.reports`, date range, store-scoped)
- **Sales sheet** `GET /admin/pos/reports/sales-lines.csv`: one row per sale line. Columns: date, time, receipt no, store, cashier, customer name, customer phone, product, variant, SKU, qty, unit price, line total, sale total, payment method, trx ref, status.
- **Customer sheet** `GET /admin/pos/reports/customers.csv`: one row per customer who bought at the store in range. Columns: name, phone, email, purchases, items, total spent, first purchase, last purchase.
- Both download as .xlsx through `downloadCsvAsXlsx`.

### 12.6 Data changes (one migration)
- `pos_invoice_templates` table.
- `orders.returned_at`, `orders.tendered_amount`.
- Permission `pos.settings`.
- The `pos.vat` setting is created on first read, with defaults.
