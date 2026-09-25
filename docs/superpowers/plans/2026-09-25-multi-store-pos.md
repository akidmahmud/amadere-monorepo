# Multi-Store POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A role-gated, store-scoped POS at `pos.amadere.com` (and `/pos` inside `admin.amadere.com`) with per-store stock, stock-in/adjust/transfer, barcode labels, and sales posted to each store's accounts.

**Architecture:** New Prisma tables (`Store`, `StoreStock`, `StockMovement`, `StockTransfer`, `StockIn`, `PosHeldSale`) + three backend modules (`stores`, `stock`, `pos`). The online store's stock stays in the existing `Product.stock`/`ProductVariant.stock` columns; every other store's stock lives in `store_stock`. `StockService.move()` is the single writer for both. The POS UI is a full-screen route group `/pos` inside `apps/admin`; the `pos.` host is routed to it by `proxy.ts` and shares the admin session via a parent-domain cookie.

**Tech Stack:** NestJS 11 + Prisma + PostgreSQL, Next.js 16 (App Router) + React 19 + TanStack Query 5 + Tailwind 4, Jest (backend, Prisma mocked), `node --test` (admin pure helpers), `jsbarcode` (only new dependency).

**Spec:** `docs/superpowers/specs/2026-09-25-multi-store-pos-design.md`

## Global Constraints

- **No git.** The user owns git. Never `git add/commit/branch/init`. Each task ends with a checkpoint, not a commit.
- **Bugfix log.** At the end of each task, append its summary to `H:\Amder Project\bug-fix-and-feature-edit.md` (read the file first; `---` separator, `## <title>` heading, `**N. Title**` numbered paragraphs).
- **Ponytail.** Shortest working diff. Mark deliberate shortcuts with `// ponytail:` naming the ceiling and the upgrade path.
- Online store = the one `Store` with `isOnlineStore = true`. Its stock = existing scalar columns. **No `store_stock` rows for it.**
- Store-only products (`Product.storeId` set) are always `status = ADMIN_ONLY` — this is what hides them from the storefront (see `ContentStatus.ADMIN_ONLY` doc at `schema.prisma:557`).
- Every POS/stock/transfer/report query goes through `resolveStoreScope()`.
- Every handler: `@UseGuards(AdminJwtGuard, PermissionGuard)` + `@RequirePermission(...)` (needed for `@Can()` to work).
- Currency display `৳`. Money is `Prisma.Decimal`, never JS float arithmetic on the backend.
- Cookie domain via env `ADMIN_COOKIE_DOMAIN` (prod `.amadere.com`, unset in dev).
- POS tender → `PaymentProvider`: Cash → `CASH`, Card → `CARD`, Mobile Banking → `BKASH`.
- VAT mode constant `POS_VAT_ADDED_ON_TOP = true` (mockup adds 15% on top). **Open question to user — flip to `false` for VAT-inclusive prices.**

## Review Focus

1. **Store-only product leaking to amadere.com.** A store-only product must never appear in storefront listing/search/PDP/cart. → Task 11 test: creating with `storeId` forces `ADMIN_ONLY`; updating status of a store-only product to `PUBLISHED` is rejected.
2. **Cashier on store A reading store B data by passing `?storeId=B`.** Expect B ignored, own store used. → Task 3 `resolveStoreScope` test.
3. **Two cashiers selling the last unit simultaneously.** Expect one succeeds, the other gets "Only 0 in stock". → Task 2 test: conditional UPDATE returning 0 rows throws; online store honours `reserved_stock`.
4. **Returning a POS sale from the admin Order Manager (status → RETURNED).** Expect stock back to the sale's store, not to website stock. → Task 4 test.
5. **Receiving a transfer twice / dispatching a cancelled transfer.** Expect 400, no double stock. → Task 8 state-machine test.

---

## File Map

**Backend (`apps/backend/src`)**
- `modules/stores/` — `stores.module.ts`, `stores.service.ts`, `store-scope.ts` (+spec), `admin-stores.controller.ts`, `dto/store.dto.ts`
- `modules/stock/` — `stock.module.ts`, `stock.service.ts` (+spec), `barcode.util.ts` (+spec), `transfers.service.ts` (+spec), `stock-docs.service.ts` (stock-in + adjust, +spec), `admin-stock.controller.ts`, `dto/*.ts`
- `modules/pos/` — `pos.module.ts`, `pos-catalog.service.ts`, `pos-sale.service.ts` (+spec), `pos-reports.service.ts`, `admin-pos.controller.ts`, `dto/*.ts`
- Modify: `modules/orders/orders.service.ts` (2 stock helpers), `modules/orders/orders.module.ts`, `modules/payments/payments.service.ts`, `modules/products/products.service.ts` + DTOs, `modules/auth/admin.mapper.ts` + `dto`, `app.module.ts`

**DB** — `packages/db/prisma/schema.prisma`, new migration `packages/db/prisma/migrations/20260925090000_multi_store_pos/migration.sql`

**Shared** — `packages/shared/src/permission-catalog.ts`

**Admin (`apps/admin/src`)**
- `lib/auth-cookies.ts`, `proxy.ts`, `lib/pos-host.ts` (+ `tests/pos-host.test.mjs`), `lib/nav-config.tsx`
- `app/pos/layout.tsx`, `app/pos/page.tsx` (selling screen), `app/pos/stock-in/page.tsx`, `app/pos/adjust/page.tsx`, `app/pos/transfers/page.tsx`, `app/pos/labels/page.tsx`, `app/pos/reports/page.tsx`, `app/pos/receipt/[id]/page.tsx`
- `hooks/usePos.ts`, `components/pos/*.tsx`, `lib/pos-cart.ts` (+ `tests/pos-cart.test.mjs`)
- `app/(shell)/stores/page.tsx`

---

### Task 1: Schema, migration, permissions, AGENTS.md override

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260925090000_multi_store_pos/migration.sql` (generated, then hand-edit)
- Modify: `packages/shared/src/permission-catalog.ts`
- Modify: `apps/backend/src/modules/payments/payments.service.ts:24-37`
- Modify: `H:\Amder Project\AGENTS.md` §6

**Interfaces — Produces:** Prisma models `Store`, `StoreStock`, `StockMovement`, `StockTransfer`, `StockTransferItem`, `StockIn`, `PosHeldSale`; enums `StockMovementType`, `TransferStatus`; fields `AdminUser.storeId`, `Product.storeId`, `Product.barcode`, `Order.storeId`, `CashAccount.storeId`; `PaymentProvider.CASH`, `PaymentProvider.CARD`; permission keys listed below.

- [ ] **Step 1: Add models to `schema.prisma`** (append after `CostCentre`, and add the relation fields to existing models)

```prisma
// Physical store / outlet. Exactly one row has isOnlineStore = true: website
// orders consume ITS stock, which lives in Product.stock / ProductVariant.stock
// (not in store_stock). Every other store's stock is in store_stock.
model Store {
  id              Int      @id @default(autoincrement())
  name            String
  code            String   @unique
  address         String?
  phone           String?
  isOnlineStore   Boolean  @default(false) @map("is_online_store")
  isActive        Boolean  @default(true) @map("is_active")
  costCentreId    Int?     @unique @map("cost_centre_id")
  cashAccountId   Int?     @map("cash_account_id")
  cardAccountId   Int?     @map("card_account_id")
  mobileAccountId Int?     @map("mobile_account_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  costCentre CostCentre? @relation(fields: [costCentreId], references: [id], onDelete: SetNull)
  staff      AdminUser[]
  products   Product[]
  orders     Order[]
  stock      StoreStock[]
  movements  StockMovement[]
  stockIns   StockIn[]
  transfersOut StockTransfer[] @relation("TransferFrom")
  transfersIn  StockTransfer[] @relation("TransferTo")
  heldSales  PosHeldSale[]

  @@map("stores")
}

// Stock of one SKU at one non-online store. Written ONLY by StockService.move.
// Uniqueness is (store_id, product_id, COALESCE(variant_id, 0)) -- an
// expression index in the migration, because a plain unique treats NULLs as
// distinct.
model StoreStock {
  id                Int  @id @default(autoincrement())
  storeId           Int  @map("store_id")
  productId         Int  @map("product_id")
  variantId         Int? @map("variant_id")
  quantity          Int  @default(0)

  store   Store           @relation(fields: [storeId], references: [id], onDelete: Cascade)
  product Product         @relation(fields: [productId], references: [id], onDelete: Cascade)
  variant ProductVariant? @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@index([storeId])
  @@map("store_stock")
}

enum StockMovementType {
  OPENING
  SALE
  RETURN
  STOCK_IN
  ADJUSTMENT
  TRANSFER_OUT
  TRANSFER_IN
}

// Append-only. qty is signed (+ in, - out).
// ponytail: website checkout/cancel and admin product-form stock edits still
// write the online store's scalar directly and leave no row here, so the
// online store's movement history covers POS-originated changes only. Route
// OrdersService.commitReservations etc. through StockService if a full
// online-store ledger is ever needed.
model StockMovement {
  id          Int               @id @default(autoincrement())
  storeId     Int               @map("store_id")
  productId   Int               @map("product_id")
  variantId   Int?              @map("variant_id")
  type        StockMovementType
  qty         Int
  reason      String?
  orderId     Int?              @map("order_id")
  transferId  Int?              @map("transfer_id")
  stockInId   Int?              @map("stock_in_id")
  unitCost    Decimal?          @map("unit_cost") @db.Decimal(12, 2)
  adminUserId Int?              @map("admin_user_id")
  createdAt   DateTime          @default(now()) @map("created_at")

  store    Store          @relation(fields: [storeId], references: [id])
  product  Product        @relation(fields: [productId], references: [id], onDelete: Cascade)
  transfer StockTransfer? @relation(fields: [transferId], references: [id])
  stockIn  StockIn?       @relation(fields: [stockInId], references: [id])

  @@index([storeId, productId, variantId, createdAt])
  @@map("stock_movements")
}

enum TransferStatus {
  REQUESTED
  APPROVED
  DISPATCHED
  RECEIVED
  CANCELLED
}

model StockTransfer {
  id             Int            @id @default(autoincrement())
  number         String         @unique
  fromStoreId    Int            @map("from_store_id")
  toStoreId      Int            @map("to_store_id")
  status         TransferStatus @default(REQUESTED)
  note           String?
  requestedById  Int            @map("requested_by_id")
  approvedById   Int?           @map("approved_by_id")
  dispatchedById Int?           @map("dispatched_by_id")
  receivedById   Int?           @map("received_by_id")
  approvedAt     DateTime?      @map("approved_at")
  dispatchedAt   DateTime?      @map("dispatched_at")
  receivedAt     DateTime?      @map("received_at")
  createdAt      DateTime       @default(now()) @map("created_at")

  fromStore Store               @relation("TransferFrom", fields: [fromStoreId], references: [id])
  toStore   Store               @relation("TransferTo", fields: [toStoreId], references: [id])
  items     StockTransferItem[]
  movements StockMovement[]

  @@map("stock_transfers")
}

model StockTransferItem {
  id          Int  @id @default(autoincrement())
  transferId  Int  @map("transfer_id")
  productId   Int  @map("product_id")
  variantId   Int? @map("variant_id")
  qty         Int
  receivedQty Int? @map("received_qty")

  transfer StockTransfer @relation(fields: [transferId], references: [id], onDelete: Cascade)

  @@map("stock_transfer_items")
}

model StockIn {
  id              Int      @id @default(autoincrement())
  number          String   @unique
  storeId         Int      @map("store_id")
  supplierPartyId Int?     @map("supplier_party_id")
  note            String?
  adminUserId     Int      @map("admin_user_id")
  createdAt       DateTime @default(now()) @map("created_at")

  store     Store           @relation(fields: [storeId], references: [id])
  movements StockMovement[]

  @@map("stock_ins")
}

// A parked cart. Server-side so it survives a refresh or a second till.
model PosHeldSale {
  id          Int      @id @default(autoincrement())
  storeId     Int      @map("store_id")
  adminUserId Int      @map("admin_user_id")
  label       String
  cart        Json
  createdAt   DateTime @default(now()) @map("created_at")

  store Store @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([storeId])
  @@map("pos_held_sales")
}
```

Add to existing models (and the back-relations Prisma asks for on `Product`, `ProductVariant`, `CostCentre`):

```prisma
// model AdminUser
  /// Home store for POS. Null = no store (POS refuses unless pos.all_stores).
  storeId Int?   @map("store_id")
  store   Store? @relation(fields: [storeId], references: [id], onDelete: SetNull)

// model Product
  /// Null = shared catalogue. Set = only that store sees/sells it; such a
  /// product is always ADMIN_ONLY so the storefront never shows it.
  storeId Int?    @map("store_id")
  store   Store?  @relation(fields: [storeId], references: [id], onDelete: SetNull)
  /// Simple products only; variants keep ProductVariant.barcode.
  barcode String? @unique
  storeStock     StoreStock[]
  stockMovements StockMovement[]

// model ProductVariant
  storeStock StoreStock[]

// model Order
  storeId Int?   @map("store_id")
  store   Store? @relation(fields: [storeId], references: [id], onDelete: SetNull)
  @@index([storeId, createdAt])

// model CashAccount
  storeId Int? @map("store_id")

// model CostCentre
  store Store?

// enum PaymentProvider  -- append
  CASH
  CARD
```

- [ ] **Step 2: Generate the migration without applying**

Run: `cd packages/db && npx prisma migrate dev --create-only --name multi_store_pos`
Then rename the generated folder to `20260925090000_multi_store_pos`.

- [ ] **Step 3: Append hand-written SQL to `migration.sql`**

```sql
-- One row per (store, product, variant); variant NULL means simple product.
CREATE UNIQUE INDEX "store_stock_store_product_variant_key"
  ON "store_stock" ("store_id", "product_id", (COALESCE("variant_id", 0)));
ALTER TABLE "store_stock" ADD CONSTRAINT "store_stock_quantity_nonneg" CHECK ("quantity" >= 0);

-- Exactly one online store.
CREATE UNIQUE INDEX "stores_one_online" ON "stores" ("is_online_store") WHERE "is_online_store";

-- The existing website stock becomes the online store's stock, untouched.
INSERT INTO "stores" ("name", "code", "is_online_store", "updated_at")
VALUES ('Main Store (Online)', 'MAIN', true, now());
```

- [ ] **Step 4: Apply and generate**

Run: `cd packages/db && npx prisma migrate dev && npx prisma generate`
Expected: "Your database is now in sync with your schema."

- [ ] **Step 5: Permissions** — append to `PERMISSION_CATALOG` in `packages/shared/src/permission-catalog.ts`:

```ts
  perm('pos', 'access'),
  perm('pos', 'refund'),
  perm('pos', 'stock_in'),
  perm('pos', 'adjust'),
  perm('pos', 'transfer'),
  perm('pos', 'transfer_approve'),
  perm('pos', 'labels'),
  perm('pos', 'store_products'),
  perm('pos', 'all_stores'),
  perm('pos', 'reports'),
  perm('stores', 'manage'),
```

(`pos.reports` is added over the spec's list: reports need their own gate so a cashier doesn't see revenue.)

- [ ] **Step 6: Payment providers** — in `PaymentsService` constructor map, add (cash/card taken at the counter behave like COD: money already in hand, refund is manual):

```ts
      // POS counter tenders: money is physically in the till / on the card
      // terminal already, so the COD provider's "offline, nothing to call"
      // behaviour is exactly right.
      CASH: cod,
      CARD: cod,
```

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors (the `Record<PaymentProviderEnum, …>` type forces both keys).

- [ ] **Step 7: AGENTS.md** — under §6 next to "Full warehouse/batch/expiry/costing is Phase 2 — do not build", add:

```md
> **Override (2026-09-25):** per-store stock for the Multi-Store POS is in scope —
> see `backend/docs/superpowers/specs/2026-09-25-multi-store-pos-design.md`.
> Batch/expiry/costing remain Phase 2.
```

And update the comment at `schema.prisma:938` ("PHASE 2 HOOK … per-warehouse stock … Do not build now.") to point at `StoreStock`.

- [ ] **Step 8: Checkpoint** — `npx tsc --noEmit` clean in `apps/backend`; append Task 1 summary to the bugfix log.

---

### Task 2: StockService — the single stock writer

**Files:**
- Create: `apps/backend/src/modules/stock/stock.service.ts`, `stock.service.spec.ts`, `stock.module.ts`

**Interfaces — Produces:**
```ts
export type StockTx = Prisma.TransactionClient;
export interface StockMoveInput {
  storeId: number; productId: number; variantId: number | null;
  type: StockMovementType; qty: number;            // signed
  adminUserId: number | null;
  reason?: string; orderId?: number; transferId?: number; stockInId?: number;
  unitCost?: Prisma.Decimal;
}
class StockService {
  move(tx: StockTx, input: StockMoveInput): Promise<void>;          // throws BadRequestException on insufficient stock
  quantities(storeId: number, keys: { productId: number; variantId: number | null }[]): Promise<Map<string, number>>;
  onlineStoreId(): Promise<number>;
}
export function stockKey(productId: number, variantId: number | null): string; // `${productId}:${variantId ?? 0}`
```

- [ ] **Step 1: Write the failing tests** — `stock.service.spec.ts`

```ts
import { BadRequestException } from '@nestjs/common';
import { StockService, stockKey } from './stock.service';

function makeTx(opts: { online: boolean; affected?: number; trackInventory?: boolean; productType?: string }) {
  const tx = {
    store: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 1, name: 'Dhanmondi', isOnlineStore: opts.online }) },
    product: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 10, trackInventory: opts.trackInventory ?? true, allowBackorder: false, productType: opts.productType ?? 'PHYSICAL',
      }),
    },
    $executeRaw: jest.fn().mockResolvedValue(opts.affected ?? 1),
    stockMovement: { create: jest.fn() },
  };
  return tx;
}

describe('StockService.move', () => {
  const svc = new StockService({ client: {} } as never);
  const base = { storeId: 1, productId: 10, variantId: null, adminUserId: 7 };

  it('records a movement when the conditional update succeeds', async () => {
    const tx = makeTx({ online: false });
    await svc.move(tx as never, { ...base, type: 'SALE', qty: -2 });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ storeId: 1, productId: 10, variantId: null, type: 'SALE', qty: -2 }),
    });
  });

  it('refuses an outflow that would go negative (last unit sold twice)', async () => {
    const tx = makeTx({ online: false, affected: 0 });
    await expect(svc.move(tx as never, { ...base, type: 'SALE', qty: -1 })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('online-store outflow also refuses when reserved stock would be oversold', async () => {
    const tx = makeTx({ online: true, affected: 0 });
    await expect(svc.move(tx as never, { ...base, type: 'SALE', qty: -1 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('skips untracked and digital products entirely', async () => {
    for (const p of [{ trackInventory: false }, { productType: 'DIGITAL' }]) {
      const tx = makeTx({ online: false, ...p });
      await svc.move(tx as never, { ...base, type: 'SALE', qty: -5 });
      expect(tx.$executeRaw).not.toHaveBeenCalled();
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    }
  });

  it('ignores qty 0', async () => {
    const tx = makeTx({ online: false });
    await svc.move(tx as never, { ...base, type: 'ADJUSTMENT', qty: 0 });
    expect(tx.store.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe('stockKey', () => {
  it('uses 0 for simple products', () => {
    expect(stockKey(5, null)).toBe('5:0');
    expect(stockKey(5, 9)).toBe('5:9');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/backend && npx jest src/modules/stock/stock.service.spec.ts`
Expected: FAIL — "Cannot find module './stock.service'".

- [ ] **Step 3: Implement `stock.service.ts`**

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StockMovementType } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';

export type StockTx = Prisma.TransactionClient;

export interface StockMoveInput {
  storeId: number;
  productId: number;
  variantId: number | null;
  type: StockMovementType;
  qty: number;
  adminUserId: number | null;
  reason?: string;
  orderId?: number;
  transferId?: number;
  stockInId?: number;
  unitCost?: Prisma.Decimal;
}

export function stockKey(productId: number, variantId: number | null): string {
  return `${productId}:${variantId ?? 0}`;
}

/**
 * The only writer of per-store stock. The online store's stock is the
 * existing Product.stock / ProductVariant.stock columns (so cart, checkout
 * and reports keep working untouched); every other store's is store_stock.
 * Outflows are a single conditional UPDATE, so two tills selling the last
 * unit at once cannot both succeed.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async onlineStoreId(): Promise<number> {
    const s = await this.prisma.client.store.findFirstOrThrow({ where: { isOnlineStore: true }, select: { id: true } });
    return s.id;
  }

  async move(tx: StockTx, input: StockMoveInput): Promise<void> {
    if (input.qty === 0) return;
    const store = await tx.store.findUniqueOrThrow({ where: { id: input.storeId } });
    const product = await tx.product.findUniqueOrThrow({ where: { id: input.productId } });
    // Same rule as reserveStock/commitReservations: no shelf, no stock.
    if (!product.trackInventory || product.productType === 'DIGITAL') return;

    const q = input.qty;
    const v = input.variantId;
    let affected: number;
    if (store.isOnlineStore) {
      // Online outflow must leave room for units already reserved by open
      // website checkouts, exactly like reserveStock does.
      affected = v
        ? await tx.$executeRaw`
            UPDATE product_variants SET stock = stock + ${q}
            WHERE id = ${v} AND (${q} > 0 OR ${product.allowBackorder} OR stock - reserved_stock + ${q} >= 0)`
        : await tx.$executeRaw`
            UPDATE products SET stock = stock + ${q}
            WHERE id = ${input.productId} AND (${q} > 0 OR allow_backorder OR stock - reserved_stock + ${q} >= 0)`;
    } else if (q > 0) {
      affected = await tx.$executeRaw`
        INSERT INTO store_stock (store_id, product_id, variant_id, quantity)
        VALUES (${input.storeId}, ${input.productId}, ${v}, ${q})
        ON CONFLICT (store_id, product_id, (COALESCE(variant_id, 0)))
        DO UPDATE SET quantity = store_stock.quantity + EXCLUDED.quantity`;
    } else {
      affected = await tx.$executeRaw`
        UPDATE store_stock SET quantity = quantity + ${q}
        WHERE store_id = ${input.storeId} AND product_id = ${input.productId}
          AND COALESCE(variant_id, 0) = ${v ?? 0} AND quantity + ${q} >= 0`;
    }
    if (affected === 0) {
      throw new BadRequestException(`Not enough stock at ${store.name} for product #${input.productId}`);
    }

    await tx.stockMovement.create({
      data: {
        storeId: input.storeId,
        productId: input.productId,
        variantId: v,
        type: input.type,
        qty: q,
        reason: input.reason,
        orderId: input.orderId,
        transferId: input.transferId,
        stockInId: input.stockInId,
        unitCost: input.unitCost,
        adminUserId: input.adminUserId,
      },
    });
  }

  /** Sellable quantity per SKU at a store, keyed by stockKey(). Missing = 0. */
  async quantities(
    storeId: number,
    keys: { productId: number; variantId: number | null }[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (keys.length === 0) return out;
    const store = await this.prisma.client.store.findUniqueOrThrow({ where: { id: storeId } });
    const productIds = [...new Set(keys.map((k) => k.productId))];
    if (store.isOnlineStore) {
      const [products, variants] = await Promise.all([
        this.prisma.client.product.findMany({ where: { id: { in: productIds } }, select: { id: true, stock: true, reservedStock: true } }),
        this.prisma.client.productVariant.findMany({ where: { productId: { in: productIds } }, select: { id: true, productId: true, stock: true, reservedStock: true } }),
      ]);
      for (const p of products) out.set(stockKey(p.id, null), p.stock - p.reservedStock);
      for (const v of variants) out.set(stockKey(v.productId, v.id), v.stock - v.reservedStock);
    } else {
      const rows = await this.prisma.client.storeStock.findMany({ where: { storeId, productId: { in: productIds } } });
      for (const r of rows) out.set(stockKey(r.productId, r.variantId), r.quantity);
    }
    return out;
  }
}
```

`stock.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { StockService } from './stock.service';

@Module({ providers: [StockService], exports: [StockService] })
export class StockModule {}
```

- [ ] **Step 4: Run tests** — `npx jest src/modules/stock/stock.service.spec.ts` → PASS.
- [ ] **Step 5: Checkpoint** — bugfix log entry.

---

### Task 3: Stores module + store scope

**Files:**
- Create: `apps/backend/src/modules/stores/store-scope.ts`, `store-scope.spec.ts`, `stores.service.ts`, `admin-stores.controller.ts`, `dto/store.dto.ts`, `stores.module.ts`
- Modify: `apps/backend/src/app.module.ts` (import `StoresModule`, `StockModule`)
- Modify: `apps/backend/src/modules/auth/admin.mapper.ts` + `AdminProfileDto` — add `storeId: number | null`

**Interfaces — Produces:**
```ts
export function resolveStoreScope(admin: { storeId: number | null }, can: PermissionCheck, requested?: number): number | null; // null = all stores
export function requireOneStore(scope: number | null): number;   // throws BadRequest('Choose a store') when null
class StoresService {
  adminStoreId(adminUserId: number): Promise<number | null>;
  scope(adminUserId: number, can: PermissionCheck, requested?: number): Promise<number | null>;
  list(): Promise<Store[]>; create(dto: UpsertStoreDto): Promise<Store>; update(id: number, dto: UpsertStoreDto): Promise<Store>;
  assignStaff(storeId: number, adminUserIds: number[]): Promise<void>;
  tenderAccountId(storeId: number, provider: PaymentProvider): Promise<number | undefined>;
}
```

- [ ] **Step 1: Failing test** — `store-scope.spec.ts`

```ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { requireOneStore, resolveStoreScope } from './store-scope';

const yes = () => true;
const no = () => false;

describe('resolveStoreScope', () => {
  it('pins a normal user to their own store, ignoring the requested one', () => {
    expect(resolveStoreScope({ storeId: 2 }, no, 5)).toBe(2);
    expect(resolveStoreScope({ storeId: 2 }, no)).toBe(2);
  });
  it('refuses a normal user with no store', () => {
    expect(() => resolveStoreScope({ storeId: null }, no)).toThrow(ForbiddenException);
  });
  it('lets an all-stores user pick, or see all', () => {
    expect(resolveStoreScope({ storeId: 2 }, yes, 5)).toBe(5);
    expect(resolveStoreScope({ storeId: null }, yes)).toBeNull();
  });
});

describe('requireOneStore', () => {
  it('throws on "all stores"', () => {
    expect(() => requireOneStore(null)).toThrow(BadRequestException);
    expect(requireOneStore(3)).toBe(3);
  });
});
```

- [ ] **Step 2:** `npx jest src/modules/stores` → FAIL (module missing).

- [ ] **Step 3: Implement `store-scope.ts`**

```ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PermissionCheck } from '../../common/auth/permission.decorator';

/** Which store a request acts on. null = every store (reports only). */
export function resolveStoreScope(
  admin: { storeId: number | null },
  can: PermissionCheck,
  requested?: number,
): number | null {
  if (can('pos.all_stores')) return requested ?? null;
  if (admin.storeId === null) throw new ForbiddenException('No store assigned — ask an admin');
  return admin.storeId;
}

export function requireOneStore(scope: number | null): number {
  if (scope === null) throw new BadRequestException('Choose a store');
  return scope;
}
```

- [ ] **Step 4: `dto/store.dto.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpsertStoreDto {
  @ApiProperty() @IsString() @Length(1, 100) name!: string;
  @ApiProperty({ example: 'DHK1' }) @Matches(/^[A-Z0-9]{2,10}$/) code!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() cashAccountId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() cardAccountId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() mobileAccountId?: number | null;
}

export class AssignStaffDto {
  @ApiProperty({ type: [Number] }) @IsArray() @ArrayUnique() @IsInt({ each: true }) adminUserIds!: number[];
}
```

- [ ] **Step 5: `stores.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PermissionCheck } from '../../common/auth/permission.decorator';
import { resolveStoreScope } from './store-scope';
import { UpsertStoreDto } from './dto/store.dto';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async adminStoreId(adminUserId: number): Promise<number | null> {
    const a = await this.prisma.client.adminUser.findUniqueOrThrow({ where: { id: adminUserId }, select: { storeId: true } });
    return a.storeId;
  }

  async scope(adminUserId: number, can: PermissionCheck, requested?: number): Promise<number | null> {
    return resolveStoreScope({ storeId: await this.adminStoreId(adminUserId) }, can, requested);
  }

  list() {
    return this.prisma.client.store.findMany({
      orderBy: [{ isOnlineStore: 'desc' }, { name: 'asc' }],
      include: { staff: { select: { id: true, name: true, email: true } } },
    });
  }

  // Each store gets its own cost centre so Accounts can split expenses by store.
  async create(dto: UpsertStoreDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const cc = await tx.costCentre.create({ data: { name: `Store: ${dto.name}`, code: dto.code } });
      return tx.store.create({ data: { ...dto, costCentreId: cc.id } });
    });
  }

  update(id: number, dto: UpsertStoreDto) {
    return this.prisma.client.store.update({ where: { id }, data: dto });
  }

  /** Makes exactly these admins the store's staff (others lose it). */
  async assignStaff(storeId: number, adminUserIds: number[]) {
    await this.prisma.client.$transaction([
      this.prisma.client.adminUser.updateMany({ where: { storeId, id: { notIn: adminUserIds } }, data: { storeId: null } }),
      this.prisma.client.adminUser.updateMany({ where: { id: { in: adminUserIds } }, data: { storeId } }),
    ]);
  }

  /** The store's cash account for a tender; undefined = fall back to the Accounts default. */
  async tenderAccountId(storeId: number, provider: PaymentProvider): Promise<number | undefined> {
    const s = await this.prisma.client.store.findUniqueOrThrow({ where: { id: storeId } });
    const id = provider === 'CASH' ? s.cashAccountId : provider === 'CARD' ? s.cardAccountId : s.mobileAccountId;
    return id ?? undefined;
  }
}
```

(Check `AdminUser` has `name`; if the field is `fullName`, use that in `list()`'s select.)

- [ ] **Step 6: `admin-stores.controller.ts`**

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequireAnyPermission, RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { StoresService } from './stores.service';
import { AssignStaffDto, UpsertStoreDto } from './dto/store.dto';

@ApiTags('admin/stores')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/stores')
export class AdminStoresController {
  constructor(private readonly stores: StoresService) {}

  // Every POS user needs the list (transfer destination picker).
  @Get()
  @RequireAnyPermission('pos.access', 'stores.manage')
  list() {
    return this.stores.list();
  }

  @Post()
  @RequirePermission('stores.manage')
  create(@Body() dto: UpsertStoreDto) {
    return this.stores.create(dto);
  }

  @Put(':id')
  @RequirePermission('stores.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpsertStoreDto) {
    return this.stores.update(id, dto);
  }

  @Put(':id/staff')
  @RequirePermission('stores.manage')
  assignStaff(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignStaffDto) {
    return this.stores.assignStaff(id, dto.adminUserIds);
  }
}
```

`stores.module.ts`: `@Module({ controllers: [AdminStoresController], providers: [StoresService], exports: [StoresService] })`. Register `StoresModule` and `StockModule` in `app.module.ts` imports next to `WholesaleModule`.

- [ ] **Step 7: `/admin/auth/me` returns `storeId`** — in `admin.mapper.ts` `toAdminProfileDto` add `storeId: admin.storeId,`; in `AdminProfileDto` add `@ApiPropertyOptional({ nullable: true }) storeId!: number | null;`.

- [ ] **Step 8:** `npx jest src/modules/stores && npx tsc --noEmit` → PASS / clean. Checkpoint + bugfix log.

---

### Task 4: Existing order & refund paths respect the sale's store

**Files:**
- Modify: `apps/backend/src/modules/orders/orders.service.ts` (`updateStatus` call sites at ~186-205, helpers `restockReturnedItems` ~712, `decrementStockOnly` ~744)
- Modify: `apps/backend/src/modules/orders/orders.module.ts` (import `StockModule`)
- Modify: `apps/backend/src/modules/payments/payments.service.ts` (`refund`)
- Test: `apps/backend/src/modules/orders/orders.service.pos-store.spec.ts`

**Why:** A POS order is created already COMPLETED (`completedAt` set), so the only paths the Order Manager can hit are `restockReturnedItems` (→ RETURNED/CANCELED) and `decrementStockOnly` (re-complete). Both currently write website stock. For an order with `storeId` of a non-online store they must go through `StockService` instead.

**Interfaces — Consumes:** `StockService.move` (Task 2), `StoresService.tenderAccountId` (Task 3).

- [ ] **Step 1: Failing test** — `orders.service.pos-store.spec.ts`. Build `OrdersService` the same way `orders.service.spec.ts` does (copy its `Test.createTestingModule` provider list), add `{ provide: StockService, useValue: stock }` where `stock = { move: jest.fn() }`, and:

```ts
it('returning a POS order restocks the sale store via StockService, not website stock', async () => {
  prisma.client.order.findUnique.mockResolvedValue({
    id: 1, status: 'COMPLETED', completedAt: new Date(), storeId: 4, deletedAt: null, assignedAdminId: 9,
    items: [{ productId: 10, variantId: null, quantity: 2, productTypeSnapshot: 'PHYSICAL' }],
  });
  prisma.client.store.findUnique.mockResolvedValue({ id: 4, isOnlineStore: false });
  await service.updateStatus(1, { status: 'RETURNED' } as never, 9);
  expect(stock.move).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    storeId: 4, productId: 10, variantId: null, type: 'RETURN', qty: 2, orderId: 1,
  }));
  expect(prisma.client.product.update).not.toHaveBeenCalled();
});

it('a website order (no storeId) still restocks website stock directly', async () => {
  prisma.client.order.findUnique.mockResolvedValue({
    id: 2, status: 'COMPLETED', completedAt: new Date(), storeId: null, deletedAt: null, assignedAdminId: 9,
    items: [{ productId: 10, variantId: null, quantity: 1, productTypeSnapshot: 'PHYSICAL' }],
  });
  await service.updateStatus(2, { status: 'RETURNED' } as never, 9);
  expect(stock.move).not.toHaveBeenCalled();
  expect(prisma.client.product.update).toHaveBeenCalled();
});
```

(Add `store: { findUnique: jest.fn() }` and whatever else `updateStatus` touches — `orderStatusHistory.create`, `order.update`, `payment.findFirst` — to the mock client.)

- [ ] **Step 2:** `npx jest orders.service.pos-store` → FAIL.

- [ ] **Step 3: Implement.** Inject `private readonly stock: StockService` into `OrdersService`. Add:

```ts
  // A POS sale's stock lives at its store. Only a non-online store needs
  // rerouting: the online store's stock IS the scalar columns these helpers
  // already write.
  private async posStoreId(tx: Prisma.TransactionClient, storeId: number | null): Promise<number | null> {
    if (storeId === null) return null;
    const store = await tx.store.findUnique({ where: { id: storeId } });
    return store && !store.isOnlineStore ? store.id : null;
  }
```

In `updateStatus`, inside the transaction, replace the two helper calls:

```ts
        if (wasEverCompleted) {
          const posStore = await this.posStoreId(tx, order.storeId);
          if (posStore) {
            for (const i of order.items) {
              if (i.productId) await this.stock.move(tx, { storeId: posStore, productId: i.productId, variantId: i.variantId, type: 'RETURN', qty: i.quantity, orderId: id, adminUserId });
            }
          } else {
            await this.restockReturnedItems(tx, order.items);
          }
        } else {
```

and

```ts
        if (wasEverCompleted) {
          const posStore = await this.posStoreId(tx, order.storeId);
          if (posStore) {
            for (const i of order.items) {
              if (i.productId) await this.stock.move(tx, { storeId: posStore, productId: i.productId, variantId: i.variantId, type: 'SALE', qty: -i.quantity, orderId: id, adminUserId });
            }
          } else {
            await this.decrementStockOnly(tx, order.items);
          }
        } else {
```

Add `StockModule` to `OrdersModule.imports`.

- [ ] **Step 4: Refund to the store's account.** In `PaymentsService.refund`, before `postRefund`:

```ts
    // A POS refund leaves the same till/terminal/wallet the sale went into.
    const order = await this.prisma.client.order.findUnique({ where: { id: orderId }, select: { storeId: true, store: true } });
    const s = order?.store;
    const accountId = s
      ? (payment.provider === 'CASH' ? s.cashAccountId : payment.provider === 'CARD' ? s.cardAccountId : s.mobileAccountId) ?? undefined
      : undefined;
```

and pass `accountId` in the `postRefund({...})` call. (Inline rather than injecting `StoresService` — `PaymentsModule` must not depend on the stores module for one lookup.)

- [ ] **Step 5:** `npx jest src/modules/orders src/modules/payments` → all PASS (existing specs included). Checkpoint + bugfix log.

---

### Task 5: POS catalog — products, barcode lookup, categories, stats

**Files:**
- Create: `apps/backend/src/modules/pos/pos-catalog.service.ts`, `pos.module.ts`, `admin-pos.controller.ts` (catalog routes only; Task 6 adds sale routes), `dto/pos-query.dto.ts`

**Interfaces — Produces (HTTP, all under `/admin/pos`, all `@RequirePermission('pos.access')`, optional `?storeId=`):**
- `GET /catalog?q=&categoryId=&sort=popular|name|price` → `PosProduct[]`
- `GET /lookup?code=` → `PosProduct` (404 if none) — barcode → variant barcode → product barcode → sku
- `GET /categories` → `{ id: number; name: string }[]`
- `GET /stats` → `{ totalProducts: number; lowStock: number; todaySales: string }`

```ts
export interface PosProduct {
  productId: number; variantId: number | null;
  name: string; variantLabel: string | null;     // e.g. "500ml"
  sku: string | null; barcode: string | null;
  price: string; salePrice: string | null;        // decimal strings
  imageUrl: string | null; categoryIds: number[];
  stock: number;                                   // sellable at this store
  storeOnly: boolean;
}
```

- [ ] **Step 1: `pos-catalog.service.ts`**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Locale, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockService, stockKey } from '../stock/stock.service';

export const POS_LOW_STOCK = 10; // same constant as ProductsService.LOW_STOCK_THRESHOLD

export interface PosProduct {
  productId: number;
  variantId: number | null;
  name: string;
  variantLabel: string | null;
  sku: string | null;
  barcode: string | null;
  price: string;
  salePrice: string | null;
  imageUrl: string | null;
  categoryIds: number[];
  stock: number;
  storeOnly: boolean;
}

const INCLUDE = {
  translations: { where: { locale: Locale.EN }, take: 1 },
  variants: { include: { attributeValues: { include: { attributeValue: true } } } },
  media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1, include: { media: true } },
  categories: { select: { categoryId: true } },
} satisfies Prisma.ProductInclude;

type Row = Prisma.ProductGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class PosCatalogService {
  constructor(private readonly prisma: PrismaService, private readonly stock: StockService) {}

  /** Shared catalogue + this store's own products; never DRAFT/ARCHIVED. */
  private visibleWhere(storeId: number): Prisma.ProductWhereInput {
    return {
      deletedAt: null,
      status: { in: ['PUBLISHED', 'ADMIN_ONLY'] },
      OR: [{ storeId: null }, { storeId }],
    };
  }

  async list(storeId: number, q?: string, categoryId?: number, sort: 'popular' | 'name' | 'price' = 'popular') {
    const where: Prisma.ProductWhereInput = { ...this.visibleWhere(storeId) };
    if (categoryId) where.categories = { some: { categoryId } };
    if (q) {
      where.AND = [{
        OR: [
          { translations: { some: { name: { contains: q, mode: 'insensitive' } } } },
          { sku: { contains: q, mode: 'insensitive' } },
          { barcode: q },
          { variants: { some: { OR: [{ sku: { contains: q, mode: 'insensitive' } }, { barcode: q }] } } },
        ],
      }];
    }
    const rows = await this.prisma.client.product.findMany({
      where,
      include: INCLUDE,
      // ponytail: "popular" = newest first until a sales-count column is worth adding
      orderBy: sort === 'price' ? { price: 'asc' } : sort === 'name' ? { slug: 'asc' } : { createdAt: 'desc' },
      take: 200,
    });
    return this.toPos(storeId, rows);
  }

  async lookup(storeId: number, code: string): Promise<PosProduct> {
    const all = await this.list(storeId, code.trim());
    const hit = all.find((p) => p.barcode === code || p.sku === code) ?? all[0];
    if (!hit) throw new NotFoundException(`No product with code "${code}"`);
    return hit;
  }

  async categories() {
    const rows = await this.prisma.client.category.findMany({
      include: { translations: { where: { locale: Locale.EN }, take: 1 } },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((c) => ({ id: c.id, name: c.translations[0]?.name ?? c.slug }));
  }

  async stats(storeId: number) {
    const items = await this.list(storeId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const sales = await this.prisma.client.order.aggregate({
      where: { storeId, channel: 'POS', createdAt: { gte: start }, status: { notIn: ['CANCELED', 'RETURNED'] } },
      _sum: { totalAmount: true },
    });
    return {
      totalProducts: items.length,
      lowStock: items.filter((p) => p.stock <= POS_LOW_STOCK).length,
      todaySales: (sales._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(2),
    };
  }

  private async toPos(storeId: number, rows: Row[]): Promise<PosProduct[]> {
    const lines = rows.flatMap((p) =>
      p.hasVariants
        ? p.variants.map((v) => ({ p, v }))
        : [{ p, v: null as Row['variants'][number] | null }],
    );
    const qty = await this.stock.quantities(storeId, lines.map(({ p, v }) => ({ productId: p.id, variantId: v?.id ?? null })));
    return lines.map(({ p, v }) => ({
      productId: p.id,
      variantId: v?.id ?? null,
      name: p.translations[0]?.name ?? p.slug,
      variantLabel: v ? v.attributeValues.map((a) => a.attributeValue.value).join(' / ') || null : null,
      sku: v?.sku ?? p.sku,
      barcode: v ? v.barcode : p.barcode,
      price: (v?.price ?? p.price ?? new Prisma.Decimal(0)).toFixed(2),
      salePrice: (v ? v.salePrice : p.salePrice)?.toFixed(2) ?? null,
      imageUrl: p.media[0]?.media.cardUrl ?? p.media[0]?.media.url ?? null,
      categoryIds: p.categories.map((c) => c.categoryId),
      stock: p.trackInventory ? qty.get(stockKey(p.id, v?.id ?? null)) ?? 0 : 9999,
      storeOnly: p.storeId !== null,
    }));
  }
}
```

(Verify field names against the schema while implementing: `Product.deletedAt`, `AttributeValue.value`, `Category.sortOrder`, `CategoryTranslation.name`. Adjust to what exists; do not add columns.)

- [ ] **Step 2: Controller (catalog part)** — `admin-pos.controller.ts`

```ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { Can, PermissionCheck, RequirePermission } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { StoresService } from '../stores/stores.service';
import { requireOneStore } from '../stores/store-scope';
import { PosCatalogService } from './pos-catalog.service';
import { PosCatalogQueryDto, PosStoreQueryDto } from './dto/pos-query.dto';

@ApiTags('admin/pos')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/pos')
export class AdminPosController {
  constructor(private readonly stores: StoresService, private readonly catalog: PosCatalogService) {}

  private async store(adminId: number, can: PermissionCheck, requested?: number) {
    return requireOneStore(await this.stores.scope(adminId, can, requested));
  }

  @Get('catalog')
  @RequirePermission('pos.access')
  async list(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Query() q: PosCatalogQueryDto) {
    return this.catalog.list(await this.store(a.id, can, q.storeId), q.q, q.categoryId, q.sort);
  }

  @Get('lookup')
  @RequirePermission('pos.access')
  async lookup(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Query() q: PosCatalogQueryDto) {
    return this.catalog.lookup(await this.store(a.id, can, q.storeId), q.code ?? '');
  }

  @Get('categories')
  @RequirePermission('pos.access')
  categories() {
    return this.catalog.categories();
  }

  @Get('stats')
  @RequirePermission('pos.access')
  async stats(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Query() q: PosStoreQueryDto) {
    return this.catalog.stats(await this.store(a.id, can, q.storeId));
  }
}
```

`dto/pos-query.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class PosStoreQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() storeId?: number;
}

export class PosCatalogQueryDto extends PosStoreQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() code?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() categoryId?: number;
  @ApiPropertyOptional({ enum: ['popular', 'name', 'price'] }) @IsOptional() @IsIn(['popular', 'name', 'price']) sort?: 'popular' | 'name' | 'price';
}
```

`pos.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { StoresModule } from '../stores/stores.module';
import { AdminPosController } from './admin-pos.controller';
import { PosCatalogService } from './pos-catalog.service';

@Module({
  imports: [StockModule, StoresModule],
  controllers: [AdminPosController],
  providers: [PosCatalogService],
})
export class PosModule {}
```

Register `PosModule` in `app.module.ts`.

- [ ] **Step 3: Verify manually** — `pnpm --filter backend dev`, log in to admin, then `curl -H "Authorization: Bearer <token>" "http://localhost:3000/admin/pos/catalog?storeId=1"` → JSON list with `stock` equal to website `stock - reservedStock`. `npx tsc --noEmit` clean.
- [ ] **Step 4:** Checkpoint + bugfix log.

---

### Task 6: POS sale, held sales, recent sales, return

**Files:**
- Create: `apps/backend/src/modules/pos/pos-sale.service.ts`, `pos-sale.service.spec.ts`, `dto/create-pos-sale.dto.ts`, `dto/held-sale.dto.ts`
- Modify: `apps/backend/src/modules/pos/admin-pos.controller.ts`, `pos.module.ts` (imports `CartModule`, `PaymentsModule`, `AccountsModule`, `OrdersModule`)

**Interfaces — Consumes:** `StockService.move`, `StoresService.tenderAccountId`, `PricingService.priceLines/price` (`modules/cart/pricing.service.ts`), `generateOrderNumber()` (`orders/order-number.util.ts`), `redeemCoupon()` (`discounts/coupon-redemption.ts`), `SalesPostingService.postPrepaidCapture`, `AccountsSettingsService.getVatSettings`, `OrdersService.updateStatus`, `PaymentsService.refund`.

**Produces (HTTP under `/admin/pos`):**
- `POST /sales` (`pos.access`) body `CreatePosSaleDto` → `{ orderId: number; orderNumber: string; total: string; change: string }`
- `GET /sales?date=YYYY-MM-DD` (`pos.access`) → recent sales for store
- `POST /sales/:id/return` (`pos.refund`) body `{ reason?: string }` → full return + refund
- `GET/POST/DELETE /held` (`pos.access`) → held carts

```ts
export const POS_VAT_ADDED_ON_TOP = true; // mockup: VAT shown and added on top. false = prices are VAT-inclusive.
export function posTotals(lines: { unitPrice: Prisma.Decimal; qty: number; vatRate: Prisma.Decimal }[], discount: Prisma.Decimal, vatOnTop: boolean):
  { subTotal: Prisma.Decimal; vat: Prisma.Decimal; total: Prisma.Decimal };
```

- [ ] **Step 1: Failing tests** — `pos-sale.service.spec.ts` (pure totals + one orchestration test)

```ts
import { Prisma } from '@amader/db';
import { posTotals } from './pos-sale.service';

const D = (n: number | string) => new Prisma.Decimal(n);

describe('posTotals', () => {
  const lines = [
    { unitPrice: D(40), qty: 2, vatRate: D(15) },   // 80
    { unitPrice: D(30), qty: 1, vatRate: D(15) },   // 30
    { unitPrice: D(120), qty: 1, vatRate: D(0) },   // 120, exempt (e.g. milk)
  ];

  it('adds VAT on top, discount spread proportionally before VAT', () => {
    const t = posTotals(lines, D(0), true);
    expect(t.subTotal.toFixed(2)).toBe('230.00');
    expect(t.vat.toFixed(2)).toBe('16.50');          // 15% of 110
    expect(t.total.toFixed(2)).toBe('246.50');
  });

  it('VAT-inclusive mode extracts VAT and leaves the total alone', () => {
    const t = posTotals(lines, D(0), false);
    expect(t.total.toFixed(2)).toBe('230.00');
    expect(t.vat.toFixed(2)).toBe('14.35');          // 110 * 15/115
  });

  it('never goes below zero with a large discount', () => {
    const t = posTotals(lines, D(1000), true);
    expect(t.total.toFixed(2)).toBe('0.00');
    expect(t.vat.toFixed(2)).toBe('0.00');
  });

  it('matches the mockup: 305 subtotal, all 15% → 45.75 VAT, 350.75 total', () => {
    const t = posTotals([{ unitPrice: D(305), qty: 1, vatRate: D(15) }], D(0), true);
    expect(t.total.toFixed(2)).toBe('350.75');
  });
});
```

Plus an orchestration test with a mocked Prisma (pattern from `admin-order-creation.service.spec.ts`): given a cart of one line, `create()` calls `stock.move` with `{type:'SALE', qty:-qty, storeId}`, creates `order` with `channel:'POS', status:'COMPLETED', storeId`, creates `payment` with `status:'CAPTURED', provider:'CASH'`, and calls `salesPosting.postPrepaidCapture` with the store's `accountId`. And: when `stock.move` rejects, `postPrepaidCapture` is not called.

- [ ] **Step 2:** `npx jest pos-sale` → FAIL.

- [ ] **Step 3: DTO** — `dto/create-pos-sale.dto.ts`

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min, ValidateNested } from 'class-validator';

export class PosSaleItemDto {
  @ApiProperty() @IsInt() productId!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() variantId?: number;
  @ApiProperty() @IsInt() @IsPositive() quantity!: number;
}

export class CreatePosSaleDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() storeId?: number;
  @ApiProperty({ type: [PosSaleItemDto] }) @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => PosSaleItemDto) items!: PosSaleItemDto[];
  @ApiPropertyOptional() @IsOptional() @IsInt() customerId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() couponCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @ApiProperty({ enum: ['CASH', 'CARD', 'MOBILE'] }) @IsIn(['CASH', 'CARD', 'MOBILE']) tender!: 'CASH' | 'CARD' | 'MOBILE';
  @ApiPropertyOptional({ description: 'Cash handed over; change = tendered - total' }) @IsOptional() @IsNumber() @Min(0) tenderedAmount?: number;
  @ApiPropertyOptional({ description: 'bKash/Nagad TrxID or card slip no.' }) @IsOptional() @IsString() transactionRef?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() heldSaleId?: number;
}
```

`dto/held-sale.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class CreateHeldSaleDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() storeId?: number;
  @ApiProperty() @IsString() @Length(1, 60) label!: string;
  @ApiProperty() @IsObject() cart!: Record<string, unknown>;
}

export class ReturnPosSaleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
```

- [ ] **Step 4: Implement `pos-sale.service.ts`**

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Locale, PaymentProvider, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { StoresService } from '../stores/stores.service';
import { PricingService } from '../cart/pricing.service';
import { SalesPostingService } from '../net-profit/accounts/ledger/sales-posting.service';
import { AccountsSettingsService } from '../net-profit/accounts/accounts-settings.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { generateOrderNumber } from '../orders/order-number.util';
import { redeemCoupon } from '../discounts/coupon-redemption';
import { CreatePosSaleDto } from './dto/create-pos-sale.dto';

const D = Prisma.Decimal;
const ZERO = new D(0);

// Mockup adds VAT on top. Flip to false if shelf prices are VAT-inclusive.
export const POS_VAT_ADDED_ON_TOP = true;

const TENDER: Record<CreatePosSaleDto['tender'], PaymentProvider> = { CASH: 'CASH', CARD: 'CARD', MOBILE: 'BKASH' };

export function posTotals(
  lines: { unitPrice: Prisma.Decimal; qty: number; vatRate: Prisma.Decimal }[],
  discount: Prisma.Decimal,
  vatOnTop: boolean,
) {
  const subTotal = lines.reduce((s, l) => s.plus(l.unitPrice.times(l.qty)), ZERO);
  const net = D.max(subTotal.minus(discount), ZERO);
  // Discount is spread across lines by value, so an exempt line keeps its share.
  const ratio = subTotal.isZero() ? ZERO : net.dividedBy(subTotal);
  const vat = lines
    .reduce((s, l) => {
      const base = l.unitPrice.times(l.qty).times(ratio);
      return s.plus(vatOnTop ? base.times(l.vatRate).dividedBy(100) : base.times(l.vatRate).dividedBy(l.vatRate.plus(100)));
    }, ZERO)
    .toDecimalPlaces(2);
  return { subTotal: subTotal.toDecimalPlaces(2), vat, total: (vatOnTop ? net.plus(vat) : net).toDecimalPlaces(2) };
}

@Injectable()
export class PosSaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly stores: StoresService,
    private readonly pricing: PricingService,
    private readonly salesPosting: SalesPostingService,
    private readonly accountsSettings: AccountsSettingsService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
  ) {}

  async create(storeId: number, dto: CreatePosSaleDto, adminId: number) {
    const products = await this.prisma.client.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) }, OR: [{ storeId: null }, { storeId }] },
      include: { translations: { where: { locale: Locale.EN }, take: 1 }, variants: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const i of dto.items) {
      if (!byId.has(i.productId)) throw new BadRequestException(`Product #${i.productId} is not sold at this store`);
    }

    const priced = await this.pricing.priceLines(dto.items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity })));
    let discount = new D(dto.discountAmount ?? 0);
    let couponUsed = false;
    if (dto.couponCode) {
      const p = await this.pricing.price(
        dto.items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity })),
        { couponCode: dto.couponCode, customerId: dto.customerId },
      );
      if (p.couponError) throw new BadRequestException(p.couponError);
      const coupon = p.discounts.find((d) => d.type === 'COUPON');
      if (coupon) { discount = discount.plus(coupon.amount); couponUsed = true; }
    }

    const vatSettings = await this.accountsSettings.getVatSettings();
    const storeRate = new D(vatSettings.enabled ? vatSettings.ratePercent : 0);
    const totals = posTotals(
      dto.items.map((i, idx) => ({
        unitPrice: priced[idx].unitPrice,
        qty: i.quantity,
        vatRate: vatSettings.enabled ? byId.get(i.productId)!.vatRatePercent ?? storeRate : ZERO,
      })),
      discount,
      POS_VAT_ADDED_ON_TOP,
    );

    const tendered = dto.tender === 'CASH' ? new D(dto.tenderedAmount ?? totals.total) : totals.total;
    if (tendered.lessThan(totals.total)) throw new BadRequestException('Cash received is less than the total');
    const provider = TENDER[dto.tender];

    const order = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          status: 'COMPLETED',
          completedAt: new Date(),
          confirmedAt: new Date(),
          channel: 'POS',
          storeId,
          customerId: dto.customerId ?? null,
          assignedAdminId: adminId,
          subTotal: totals.subTotal,
          discountAmount: D.min(discount, totals.subTotal),
          taxAmount: POS_VAT_ADDED_ON_TOP ? totals.vat : ZERO,
          codFee: ZERO,
          shippingAmount: ZERO,
          totalAmount: totals.total,
          couponCode: couponUsed ? dto.couponCode : undefined,
          items: {
            create: dto.items.map((i, idx) => {
              const p = byId.get(i.productId)!;
              const v = i.variantId ? p.variants.find((x) => x.id === i.variantId) : undefined;
              return {
                productId: p.id,
                variantId: i.variantId ?? null,
                productNameSnapshot: p.translations[0]?.name ?? p.slug,
                skuSnapshot: v?.sku ?? p.sku,
                productTypeSnapshot: p.productType,
                unitPrice: priced[idx].unitPrice,
                quantity: i.quantity,
              };
            }),
          },
          statusHistory: { create: { status: 'COMPLETED', note: 'POS sale', adminUserId: adminId } },
        },
      });
      for (const i of dto.items) {
        await this.stock.move(tx, { storeId, productId: i.productId, variantId: i.variantId ?? null, type: 'SALE', qty: -i.quantity, orderId: created.id, adminUserId: adminId });
      }
      await tx.payment.create({
        data: { orderId: created.id, provider, status: 'CAPTURED', amount: totals.total, transactionRef: dto.transactionRef },
      });
      if (couponUsed && dto.couponCode) {
        await redeemCoupon(tx, { code: dto.couponCode, orderId: created.id, customerId: dto.customerId ?? null, phone: null });
      }
      if (dto.heldSaleId) await tx.posHeldSale.deleteMany({ where: { id: dto.heldSaleId, storeId } });
      return created;
    });

    // After commit, best-effort (SalesPostingService logs, never throws).
    await this.salesPosting.postPrepaidCapture({
      orderId: order.id,
      amount: totals.total,
      capturedAt: new Date(),
      reference: dto.transactionRef,
      accountId: await this.stores.tenderAccountId(storeId, provider),
    });

    return { orderId: order.id, orderNumber: order.orderNumber, total: totals.total.toFixed(2), change: tendered.minus(totals.total).toFixed(2) };
  }

  recent(storeId: number | null, date?: string) {
    const from = date ? new Date(`${date}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = new Date(from.getTime() + 86_400_000);
    return this.prisma.client.order.findMany({
      where: { channel: 'POS', ...(storeId ? { storeId } : {}), createdAt: { gte: from, lt: to } },
      include: { items: true, payments: { take: 1, orderBy: { createdAt: 'desc' } }, store: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(storeId: number | null, id: number) {
    const o = await this.prisma.client.order.findFirst({
      where: { id, channel: 'POS', ...(storeId ? { storeId } : {}) },
      include: { items: true, payments: true, store: true, customer: true },
    });
    if (!o) throw new NotFoundException('Sale not found');
    return o;
  }

  /** Full return: stock back to the store (via OrdersService → Task 4), money back from the same account. */
  async returnSale(storeId: number | null, id: number, adminId: number, reason?: string) {
    const o = await this.get(storeId, id);
    if (o.status === 'RETURNED') throw new BadRequestException('Already returned');
    // ponytail: whole-sale return only; per-line partial returns need an
    // OrderReturn table — add when a store asks for it.
    await this.orders.updateStatus(id, { status: 'RETURNED', note: reason } as never, adminId);
    await this.payments.refund(id, o.totalAmount);
    return this.get(storeId, id);
  }

  held(storeId: number) {
    return this.prisma.client.posHeldSale.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' } });
  }
  hold(storeId: number, adminId: number, label: string, cart: object) {
    return this.prisma.client.posHeldSale.create({ data: { storeId, adminUserId: adminId, label, cart } });
  }
  async dropHeld(storeId: number, id: number) {
    await this.prisma.client.posHeldSale.deleteMany({ where: { id, storeId } });
  }
}
```

(Check `pricing.price(...).discounts` item shape in `modules/cart/pricing.service.ts` and adapt the `find` — `AdminOrderCreationService.resolveCartDiscount` is the reference.)

- [ ] **Step 5: Controller routes** — add to `AdminPosController` (inject `PosSaleService`):

```ts
  @Post('sales')
  @RequirePermission('pos.access')
  async sell(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Body() dto: CreatePosSaleDto) {
    return this.sales.create(await this.store(a.id, can, dto.storeId), dto, a.id);
  }

  @Get('sales')
  @RequirePermission('pos.access')
  async recent(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Query() q: PosStoreQueryDto & { date?: string }) {
    return this.sales.recent(await this.stores.scope(a.id, can, q.storeId), q.date);
  }

  @Get('sales/:id')
  @RequirePermission('pos.access')
  async one(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Param('id', ParseIntPipe) id: number) {
    return this.sales.get(await this.stores.scope(a.id, can), id);
  }

  @Post('sales/:id/return')
  @RequirePermission('pos.refund')
  @UseInterceptors(AuditLogInterceptor)
  async ret(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Param('id', ParseIntPipe) id: number, @Body() dto: ReturnPosSaleDto) {
    return this.sales.returnSale(await this.stores.scope(a.id, can), id, a.id, dto.reason);
  }

  @Get('held')
  @RequirePermission('pos.access')
  async held(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Query() q: PosStoreQueryDto) {
    return this.sales.held(await this.store(a.id, can, q.storeId));
  }

  @Post('held')
  @RequirePermission('pos.access')
  async hold(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Body() dto: CreateHeldSaleDto) {
    return this.sales.hold(await this.store(a.id, can, dto.storeId), a.id, dto.label, dto.cart);
  }

  @Delete('held/:id')
  @RequirePermission('pos.access')
  async dropHeld(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Param('id', ParseIntPipe) id: number, @Query() q: PosStoreQueryDto) {
    return this.sales.dropHeld(await this.store(a.id, can, q.storeId), id);
  }
```

Add `DatePosQueryDto extends PosStoreQueryDto { @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string }` to `pos-query.dto.ts` and use it instead of the intersection type above. Update `pos.module.ts` imports: `CartModule, PaymentsModule, AccountsModule, OrdersModule`, providers add `PosSaleService`.

- [ ] **Step 6:** `npx jest src/modules/pos && npx tsc --noEmit` → PASS. Checkpoint + bugfix log.

---

### Task 7: Stock-in and adjustment

**Files:**
- Create: `apps/backend/src/modules/stock/stock-docs.service.ts`, `stock-docs.service.spec.ts`, `dto/stock-docs.dto.ts`, `admin-stock.controller.ts`
- Modify: `stock.module.ts` (add controller, provider; import `StoresModule`)

**Produces (HTTP under `/admin/stock`):**
- `POST /stock-in` (`pos.stock_in`) `{ storeId?, supplierPartyId?, note?, lines: {productId, variantId?, qty>0, unitCost?}[] }` → `{ id, number }`
- `POST /adjust` (`pos.adjust`) `{ storeId?, productId, variantId?, qty (≠0, signed), reason: ADJUST_REASONS, note? }`
- `GET /movements?productId=&variantId=&storeId=` (`pos.access`) → last 200 movements

```ts
export const ADJUST_REASONS = ['DAMAGED', 'EXPIRED', 'COUNT_CORRECTION', 'LOST', 'OTHER'] as const;
export function docNumber(prefix: 'GRN' | 'TRF', storeCode: string, id: number): string; // GRN-DHK1-000042
```

- [ ] **Step 1: Failing test** — `stock-docs.service.spec.ts`

```ts
import { BadRequestException } from '@nestjs/common';
import { docNumber, StockDocsService } from './stock-docs.service';

describe('docNumber', () => {
  it('pads to 6 digits', () => expect(docNumber('GRN', 'DHK1', 42)).toBe('GRN-DHK1-000042'));
});

describe('StockDocsService.adjust', () => {
  const stock = { move: jest.fn() };
  const tx = {};
  const prisma = { client: { $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)) } };
  const svc = new StockDocsService(prisma as never, stock as never);

  it('requires a note when reason is OTHER', async () => {
    await expect(svc.adjust(1, { productId: 1, qty: -1, reason: 'OTHER' } as never, 7)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('moves stock with the reason recorded', async () => {
    await svc.adjust(1, { productId: 1, qty: -2, reason: 'DAMAGED' } as never, 7);
    expect(stock.move).toHaveBeenCalledWith(tx, expect.objectContaining({ storeId: 1, type: 'ADJUSTMENT', qty: -2, reason: 'DAMAGED' }));
  });
});
```

- [ ] **Step 2:** `npx jest stock-docs` → FAIL.

- [ ] **Step 3: DTOs** — `dto/stock-docs.dto.ts`

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min, NotEquals, ValidateNested } from 'class-validator';
import { ADJUST_REASONS } from '../stock-docs.service';

export class StockInLineDto {
  @ApiProperty() @IsInt() productId!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() variantId?: number;
  @ApiProperty() @IsInt() @IsPositive() qty!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) unitCost?: number;
}

export class CreateStockInDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() storeId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() supplierPartyId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
  @ApiProperty({ type: [StockInLineDto] }) @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => StockInLineDto) lines!: StockInLineDto[];
}

export class AdjustStockDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() storeId?: number;
  @ApiProperty() @IsInt() productId!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() variantId?: number;
  @ApiProperty() @IsInt() @NotEquals(0) qty!: number;
  @ApiProperty({ enum: ADJUST_REASONS }) @IsIn(ADJUST_REASONS as unknown as string[]) reason!: (typeof ADJUST_REASONS)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class MovementsQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() storeId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() productId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() variantId?: number;
}
```

- [ ] **Step 4: `stock-docs.service.ts`**

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockService } from './stock.service';
import type { AdjustStockDto, CreateStockInDto } from './dto/stock-docs.dto';

export const ADJUST_REASONS = ['DAMAGED', 'EXPIRED', 'COUNT_CORRECTION', 'LOST', 'OTHER'] as const;

export function docNumber(prefix: 'GRN' | 'TRF', storeCode: string, id: number): string {
  return `${prefix}-${storeCode}-${String(id).padStart(6, '0')}`;
}

@Injectable()
export class StockDocsService {
  constructor(private readonly prisma: PrismaService, private readonly stock: StockService) {}

  async stockIn(storeId: number, dto: CreateStockInDto, adminId: number) {
    return this.prisma.client.$transaction(async (tx) => {
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
      const doc = await tx.stockIn.create({
        data: { number: `tmp-${Date.now()}`, storeId, supplierPartyId: dto.supplierPartyId, note: dto.note, adminUserId: adminId },
      });
      const number = docNumber('GRN', store.code, doc.id);
      await tx.stockIn.update({ where: { id: doc.id }, data: { number } });
      for (const l of dto.lines) {
        await this.stock.move(tx, {
          storeId, productId: l.productId, variantId: l.variantId ?? null, type: 'STOCK_IN', qty: l.qty,
          stockInId: doc.id, unitCost: l.unitCost !== undefined ? new Prisma.Decimal(l.unitCost) : undefined, adminUserId: adminId,
        });
      }
      return { id: doc.id, number };
    });
  }

  async adjust(storeId: number, dto: AdjustStockDto, adminId: number) {
    if (dto.reason === 'OTHER' && !dto.note?.trim()) throw new BadRequestException('Explain the adjustment in the note');
    await this.prisma.client.$transaction((tx) =>
      this.stock.move(tx, {
        storeId, productId: dto.productId, variantId: dto.variantId ?? null, type: 'ADJUSTMENT', qty: dto.qty,
        reason: dto.note ? `${dto.reason}: ${dto.note}` : dto.reason, adminUserId: adminId,
      }),
    );
  }

  movements(storeId: number | null, productId?: number, variantId?: number) {
    return this.prisma.client.stockMovement.findMany({
      where: { ...(storeId ? { storeId } : {}), ...(productId ? { productId } : {}), ...(variantId ? { variantId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { store: { select: { name: true } } },
    });
  }
}
```

Note: the test expects `reason: 'DAMAGED'` when no note — matches the ternary.

- [ ] **Step 5: `admin-stock.controller.ts`** (same guard/decorator header as `AdminPosController`, `@Controller('admin/stock')`, `@UseInterceptors(AuditLogInterceptor)` on the class):

```ts
  @Post('stock-in')
  @RequirePermission('pos.stock_in')
  async stockIn(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Body() dto: CreateStockInDto) {
    return this.docs.stockIn(requireOneStore(await this.stores.scope(a.id, can, dto.storeId)), dto, a.id);
  }

  @Post('adjust')
  @RequirePermission('pos.adjust')
  async adjust(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Body() dto: AdjustStockDto) {
    return this.docs.adjust(requireOneStore(await this.stores.scope(a.id, can, dto.storeId)), dto, a.id);
  }

  @Get('movements')
  @RequirePermission('pos.access')
  async movements(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Query() q: MovementsQueryDto) {
    return this.docs.movements(await this.stores.scope(a.id, can, q.storeId), q.productId, q.variantId);
  }
```

- [ ] **Step 6:** `npx jest src/modules/stock` → PASS. Checkpoint + bugfix log.

---

### Task 8: Inter-store transfers

**Files:**
- Create: `apps/backend/src/modules/stock/transfers.service.ts`, `transfers.service.spec.ts`, `dto/transfer.dto.ts`
- Modify: `admin-stock.controller.ts`, `stock.module.ts`

**Produces:**
```ts
export const TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  REQUESTED: ['APPROVED', 'CANCELLED'], APPROVED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['RECEIVED'], RECEIVED: [], CANCELLED: [],
};
export function assertTransition(from: TransferStatus, to: TransferStatus): void; // BadRequest otherwise
```
HTTP under `/admin/stock/transfers`: `GET` (`pos.transfer`; lists where from or to = scope), `POST` create (`pos.transfer`), `POST :id/approve` (`pos.transfer_approve`), `POST :id/dispatch` (`pos.transfer`, must be from-store), `POST :id/receive` (`pos.transfer`, must be to-store, body `{ items: {id, receivedQty}[] }`), `POST :id/cancel` (`pos.transfer`).

- [ ] **Step 1: Failing tests** — `transfers.service.spec.ts`

```ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { assertTransition, TransfersService } from './transfers.service';

describe('assertTransition', () => {
  it('allows the happy path', () => {
    expect(() => assertTransition('REQUESTED', 'APPROVED')).not.toThrow();
    expect(() => assertTransition('APPROVED', 'DISPATCHED')).not.toThrow();
    expect(() => assertTransition('DISPATCHED', 'RECEIVED')).not.toThrow();
  });
  it('refuses receiving twice and dispatching a cancelled transfer', () => {
    expect(() => assertTransition('RECEIVED', 'RECEIVED')).toThrow(BadRequestException);
    expect(() => assertTransition('CANCELLED', 'DISPATCHED')).toThrow(BadRequestException);
    expect(() => assertTransition('DISPATCHED', 'CANCELLED')).toThrow(BadRequestException);
  });
});

describe('TransfersService.receive', () => {
  const stock = { move: jest.fn() };
  const transfer = {
    id: 5, status: 'DISPATCHED', fromStoreId: 1, toStoreId: 2,
    items: [{ id: 50, productId: 10, variantId: null, qty: 4 }],
  };
  const tx = {
    stockTransfer: { findUniqueOrThrow: jest.fn().mockResolvedValue(transfer), update: jest.fn() },
    stockTransferItem: { update: jest.fn() },
  };
  const prisma = { client: { $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)) } };
  const svc = new TransfersService(prisma as never, stock as never);

  it('credits only what arrived to the destination', async () => {
    await svc.receive(2, 5, [{ id: 50, receivedQty: 3 }], 9);
    expect(stock.move).toHaveBeenCalledWith(tx, expect.objectContaining({ storeId: 2, type: 'TRANSFER_IN', qty: 3, transferId: 5 }));
  });

  it('refuses when the caller is not the destination store', async () => {
    await expect(svc.receive(3, 5, [{ id: 50, receivedQty: 4 }], 9)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses receiving more than was sent', async () => {
    await expect(svc.receive(2, 5, [{ id: 50, receivedQty: 5 }], 9)).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2:** `npx jest transfers` → FAIL.

- [ ] **Step 3: DTOs** — `dto/transfer.dto.ts`

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsPositive, IsString, Min, ValidateNested } from 'class-validator';

export class TransferLineDto {
  @ApiProperty() @IsInt() productId!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() variantId?: number;
  @ApiProperty() @IsInt() @IsPositive() qty!: number;
}

export class CreateTransferDto {
  @ApiPropertyOptional({ description: 'Source store; defaults to your store' }) @IsOptional() @IsInt() fromStoreId?: number;
  @ApiProperty() @IsInt() toStoreId!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
  @ApiProperty({ type: [TransferLineDto] }) @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => TransferLineDto) items!: TransferLineDto[];
}

export class ReceiveLineDto {
  @ApiProperty() @IsInt() id!: number;
  @ApiProperty() @IsInt() @Min(0) receivedQty!: number;
}

export class ReceiveTransferDto {
  @ApiProperty({ type: [ReceiveLineDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => ReceiveLineDto) items!: ReceiveLineDto[];
}
```

- [ ] **Step 4: `transfers.service.ts`**

```ts
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { TransferStatus } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockService } from './stock.service';
import { docNumber } from './stock-docs.service';
import type { CreateTransferDto } from './dto/transfer.dto';

export const TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  REQUESTED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['RECEIVED'],
  RECEIVED: [],
  CANCELLED: [],
};

export function assertTransition(from: TransferStatus, to: TransferStatus): void {
  if (!TRANSITIONS[from].includes(to)) throw new BadRequestException(`Cannot move a ${from} transfer to ${to}`);
}

/** `scope` null = all-stores user, allowed to act for either side. */
function assertSide(scope: number | null, storeId: number) {
  if (scope !== null && scope !== storeId) throw new ForbiddenException('This step belongs to the other store');
}

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService, private readonly stock: StockService) {}

  list(scope: number | null) {
    return this.prisma.client.stockTransfer.findMany({
      where: scope ? { OR: [{ fromStoreId: scope }, { toStoreId: scope }] } : {},
      include: { items: true, fromStore: { select: { name: true } }, toStore: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async create(fromStoreId: number, dto: CreateTransferDto, adminId: number) {
    if (fromStoreId === dto.toStoreId) throw new BadRequestException('Source and destination are the same store');
    return this.prisma.client.$transaction(async (tx) => {
      const from = await tx.store.findUniqueOrThrow({ where: { id: fromStoreId } });
      const t = await tx.stockTransfer.create({
        data: {
          number: `tmp-${Date.now()}`, fromStoreId, toStoreId: dto.toStoreId, note: dto.note, requestedById: adminId,
          items: { create: dto.items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, qty: i.qty })) },
        },
      });
      return tx.stockTransfer.update({ where: { id: t.id }, data: { number: docNumber('TRF', from.code, t.id) } });
    });
  }

  async approve(id: number, adminId: number) {
    return this.prisma.client.$transaction(async (tx) => {
      const t = await tx.stockTransfer.findUniqueOrThrow({ where: { id } });
      assertTransition(t.status, 'APPROVED');
      return tx.stockTransfer.update({ where: { id }, data: { status: 'APPROVED', approvedById: adminId, approvedAt: new Date() } });
    });
  }

  async dispatch(scope: number | null, id: number, adminId: number) {
    return this.prisma.client.$transaction(async (tx) => {
      const t = await tx.stockTransfer.findUniqueOrThrow({ where: { id }, include: { items: true } });
      assertSide(scope, t.fromStoreId);
      assertTransition(t.status, 'DISPATCHED');
      for (const i of t.items) {
        await this.stock.move(tx, { storeId: t.fromStoreId, productId: i.productId, variantId: i.variantId, type: 'TRANSFER_OUT', qty: -i.qty, transferId: id, adminUserId: adminId });
      }
      return tx.stockTransfer.update({ where: { id }, data: { status: 'DISPATCHED', dispatchedById: adminId, dispatchedAt: new Date() } });
    });
  }

  async receive(scope: number | null, id: number, received: { id: number; receivedQty: number }[], adminId: number) {
    return this.prisma.client.$transaction(async (tx) => {
      const t = await tx.stockTransfer.findUniqueOrThrow({ where: { id }, include: { items: true } });
      assertSide(scope, t.toStoreId);
      assertTransition(t.status, 'RECEIVED');
      const got = new Map(received.map((r) => [r.id, r.receivedQty]));
      for (const i of t.items) {
        const qty = got.get(i.id) ?? i.qty;
        if (qty > i.qty) throw new BadRequestException(`Received more than was sent for line #${i.id}`);
        await tx.stockTransferItem.update({ where: { id: i.id }, data: { receivedQty: qty } });
        // Shortfall is recorded on the line, not re-credited to the source.
        await this.stock.move(tx, { storeId: t.toStoreId, productId: i.productId, variantId: i.variantId, type: 'TRANSFER_IN', qty, transferId: id, adminUserId: adminId });
      }
      return tx.stockTransfer.update({ where: { id }, data: { status: 'RECEIVED', receivedById: adminId, receivedAt: new Date() } });
    });
  }

  async cancel(scope: number | null, id: number) {
    return this.prisma.client.$transaction(async (tx) => {
      const t = await tx.stockTransfer.findUniqueOrThrow({ where: { id } });
      if (scope !== null && scope !== t.fromStoreId && scope !== t.toStoreId) throw new ForbiddenException('Not your transfer');
      assertTransition(t.status, 'CANCELLED');
      return tx.stockTransfer.update({ where: { id }, data: { status: 'CANCELLED' } });
    });
  }
}
```

(`StockService.move` with `qty: 0` is a no-op — a fully-lost line records `receivedQty: 0` and moves nothing.)

- [ ] **Step 5: Controller routes** in `admin-stock.controller.ts`:

```ts
  @Get('transfers')
  @RequirePermission('pos.transfer')
  async transfers(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Query() q: PosStoreQueryDto) {
    return this.transfers.list(await this.stores.scope(a.id, can, q.storeId));
  }

  @Post('transfers')
  @RequirePermission('pos.transfer')
  async createTransfer(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Body() dto: CreateTransferDto) {
    return this.transfers.create(requireOneStore(await this.stores.scope(a.id, can, dto.fromStoreId)), dto, a.id);
  }

  @Post('transfers/:id/approve')
  @RequirePermission('pos.transfer_approve')
  approve(@CurrentAdmin() a: { id: number }, @Param('id', ParseIntPipe) id: number) {
    return this.transfers.approve(id, a.id);
  }

  @Post('transfers/:id/dispatch')
  @RequirePermission('pos.transfer')
  async dispatch(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Param('id', ParseIntPipe) id: number) {
    return this.transfers.dispatch(await this.stores.scope(a.id, can), id, a.id);
  }

  @Post('transfers/:id/receive')
  @RequirePermission('pos.transfer')
  async receive(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Param('id', ParseIntPipe) id: number, @Body() dto: ReceiveTransferDto) {
    return this.transfers.receive(await this.stores.scope(a.id, can), id, dto.items, a.id);
  }

  @Post('transfers/:id/cancel')
  @RequirePermission('pos.transfer')
  async cancel(@CurrentAdmin() a: { id: number }, @Can() can: PermissionCheck, @Param('id', ParseIntPipe) id: number) {
    return this.transfers.cancel(await this.stores.scope(a.id, can), id);
  }
```

(Import `PosStoreQueryDto` from `../pos/dto/pos-query.dto` — or move it to `stores/dto` to avoid stock → pos import; prefer moving it to `stores/dto/store-query.dto.ts` and re-export from pos.)

- [ ] **Step 6:** `npx jest src/modules/stock` → PASS. Checkpoint + bugfix log.

---

### Task 9: Barcode generation

**Files:**
- Create: `apps/backend/src/modules/stock/barcode.util.ts`, `barcode.util.spec.ts`
- Modify: `admin-stock.controller.ts`, `stock-docs.service.ts` (add `generateBarcodes`)

**Produces:**
```ts
export function ean13CheckDigit(first12: string): number;
export function isValidEan13(code: string): boolean;
export function internalBarcode(productId: number, variantId: number | null): string; // "AMD" + p(6) + v(5) → Code 128
```
HTTP: `POST /admin/stock/barcodes/generate` (`pos.labels`) body `{ productIds: number[] }` → `{ generated: number }` — fills only empty barcodes.

- [ ] **Step 1: Failing test** — `barcode.util.spec.ts`

```ts
import { ean13CheckDigit, internalBarcode, isValidEan13 } from './barcode.util';

describe('EAN-13', () => {
  it('computes the check digit', () => {
    expect(ean13CheckDigit('590123412345')).toBe(7); // 5901234123457
    expect(ean13CheckDigit('400638133393')).toBe(1); // 4006381333931
  });
  it('validates', () => {
    expect(isValidEan13('5901234123457')).toBe(true);
    expect(isValidEan13('5901234123458')).toBe(false);
    expect(isValidEan13('59012341234')).toBe(false);
    expect(isValidEan13('59012341234a7')).toBe(false);
  });
});

describe('internalBarcode', () => {
  it('is unique per SKU and stable', () => {
    expect(internalBarcode(12, null)).toBe('AMD00001200000');
    expect(internalBarcode(12, 3)).toBe('AMD00001200003');
    expect(internalBarcode(12, 3)).not.toBe(internalBarcode(123, null));
  });
});
```

- [ ] **Step 2:** `npx jest barcode.util` → FAIL.

- [ ] **Step 3: Implement `barcode.util.ts`**

```ts
export function ean13CheckDigit(first12: string): number {
  const sum = [...first12].reduce((s, ch, i) => s + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/** Code 128 payload for goods with no manufacturer barcode (loose atta, oil). */
export function internalBarcode(productId: number, variantId: number | null): string {
  return `AMD${String(productId).padStart(6, '0')}${String(variantId ?? 0).padStart(5, '0')}`;
}
```

- [ ] **Step 4: Generate endpoint** — `StockDocsService.generateBarcodes`:

```ts
  async generateBarcodes(productIds: number[]): Promise<{ generated: number }> {
    let generated = 0;
    const products = await this.prisma.client.product.findMany({ where: { id: { in: productIds } }, include: { variants: true } });
    for (const p of products) {
      if (p.hasVariants) {
        for (const v of p.variants.filter((x) => !x.barcode)) {
          await this.prisma.client.productVariant.update({ where: { id: v.id }, data: { barcode: internalBarcode(p.id, v.id) } });
          generated++;
        }
      } else if (!p.barcode) {
        await this.prisma.client.product.update({ where: { id: p.id }, data: { barcode: internalBarcode(p.id, null) } });
        generated++;
      }
    }
    return { generated };
  }
```

Controller: `@Post('barcodes/generate') @RequirePermission('pos.labels') generate(@Body() dto: GenerateBarcodesDto)` with `GenerateBarcodesDto { @IsArray() @ArrayNotEmpty() @IsInt({ each: true }) productIds!: number[] }`.

Also: in `products.service.ts` where variant/product barcode is written from the admin form, reject a 13-digit numeric barcode that fails `isValidEan13` with `BadRequestException('EAN-13 check digit is wrong')`. Grep `barcode` in `products.service.ts` to find the create/update spots.

- [ ] **Step 5:** `npx jest src/modules/stock src/modules/products` → PASS. Checkpoint + bugfix log.

---

### Task 10: Reports (sales, stock on hand) + CSV

**Files:**
- Create: `apps/backend/src/modules/pos/pos-reports.service.ts`, `pos-reports.service.spec.ts`
- Modify: `admin-pos.controller.ts`

**Produces (HTTP under `/admin/pos/reports`, `pos.reports`):**
- `GET /sales?from=YYYY-MM-DD&to=YYYY-MM-DD&storeId=` → `{ storeId, storeName, orders, gross, vat, returns }[]` (one row per store; all stores when scope null)
- `GET /sales.csv` → same, `text/csv`
- `GET /stock?storeId=` → `{ productId, variantId, name, sku, quantity }[]` for one store
- `GET /stock.csv`

```ts
export function toCsv(rows: Record<string, string | number | null>[]): string;
```

- [ ] **Step 1: Failing test** — `pos-reports.service.spec.ts`

```ts
import { toCsv } from './pos-reports.service';

describe('toCsv', () => {
  it('quotes commas, quotes and newlines; header from first row', () => {
    expect(toCsv([{ name: 'Atta, 1kg', qty: 3 }, { name: 'He said "hi"', qty: null }])).toBe(
      'name,qty\n"Atta, 1kg",3\n"He said ""hi""",\n',
    );
  });
  it('empty input → empty string', () => expect(toCsv([])).toBe(''));
});
```

- [ ] **Step 2:** FAIL, then implement:

```ts
import { Injectable } from '@nestjs/common';
import { Locale, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PosCatalogService } from './pos-catalog.service';

export function toCsv(rows: Record<string, string | number | null>[]): string {
  if (rows.length === 0) return '';
  const cell = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const keys = Object.keys(rows[0]);
  return [keys.join(','), ...rows.map((r) => keys.map((k) => cell(r[k])).join(','))].join('\n') + '\n';
}

@Injectable()
export class PosReportsService {
  constructor(private readonly prisma: PrismaService, private readonly catalog: PosCatalogService) {}

  async sales(scope: number | null, from: string, to: string) {
    const where: Prisma.OrderWhereInput = {
      channel: 'POS',
      ...(scope ? { storeId: scope } : {}),
      createdAt: { gte: new Date(`${from}T00:00:00`), lt: new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000) },
    };
    const [sold, returned, stores] = await Promise.all([
      this.prisma.client.order.groupBy({ by: ['storeId'], where: { ...where, status: { not: 'RETURNED' } }, _count: true, _sum: { totalAmount: true, taxAmount: true } }),
      this.prisma.client.order.groupBy({ by: ['storeId'], where: { ...where, status: 'RETURNED' }, _sum: { totalAmount: true } }),
      this.prisma.client.store.findMany({ select: { id: true, name: true } }),
    ]);
    const name = new Map(stores.map((s) => [s.id, s.name]));
    const ret = new Map(returned.map((r) => [r.storeId, r._sum.totalAmount]));
    return sold.map((r) => ({
      storeId: r.storeId,
      storeName: name.get(r.storeId!) ?? '',
      orders: r._count,
      gross: (r._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(2),
      vat: (r._sum.taxAmount ?? new Prisma.Decimal(0)).toFixed(2),
      returns: (ret.get(r.storeId) ?? new Prisma.Decimal(0)).toFixed(2),
    }));
  }

  async stock(storeId: number) {
    const items = await this.catalog.list(storeId);
    return items.map((p) => ({
      productId: p.productId, variantId: p.variantId,
      name: p.variantLabel ? `${p.name} (${p.variantLabel})` : p.name,
      sku: p.sku, quantity: p.stock,
    }));
  }
}
```

(`catalog.list` caps at 200 rows — pass a higher `take` for reports by adding an optional `take` param to `list()`, default 200, reports pass 10 000.)

Controller (add `@Res()`-free CSV via `@Header('Content-Type', 'text/csv')` + returning a string — check how an existing CSV export endpoint bypasses the `{success,data}` ResponseInterceptor, e.g. grep `text/csv` in `apps/backend/src`, and copy that exact pattern).

Query DTO: `ReportRangeDto extends PosStoreQueryDto { @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string; @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string }`.

- [ ] **Step 3:** `npx jest src/modules/pos` → PASS. Checkpoint + bugfix log.

---

### Task 11: Store-only products

**Files:**
- Modify: `apps/backend/src/modules/products/dto/*` (create + update DTOs: add `storeId?: number | null`, `barcode?: string | null`)
- Modify: `apps/backend/src/modules/products/products.service.ts` (create ~614, update ~972)
- Modify: `apps/backend/src/modules/products/admin-products.controller.ts` (pass `@CurrentAdmin()` + `@Can()` to create/update)
- Modify: admin product form (find with `grep -rn "vatRatePercent" apps/admin/src/components/products`) — add a Store select
- Test: `apps/backend/src/modules/products/products.store-only.spec.ts`

**Produces:**
```ts
export function applyStoreOnlyRules(
  dto: { storeId?: number | null; status?: ContentStatus },
  actor: { storeId: number | null; can: PermissionCheck },
  existingStoreId: number | null,
): { storeId: number | null | undefined; status: ContentStatus | undefined };
```
Rules: effective storeId = `dto.storeId !== undefined ? dto.storeId : existingStoreId`. If effective storeId is non-null: status forced to `ADMIN_ONLY` (any other requested status → `BadRequestException('A store-only product cannot be published to the website')`); actor must have `pos.all_stores` or `actor.storeId === storeId` and `pos.store_products` → else `ForbiddenException`.

- [ ] **Step 1: Failing test**

```ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { applyStoreOnlyRules } from './store-only.util';

const can = (...keys: string[]) => (k: string) => keys.includes(k);

describe('applyStoreOnlyRules', () => {
  it('shared product: untouched', () => {
    expect(applyStoreOnlyRules({ status: 'PUBLISHED' }, { storeId: null, can: can() }, null)).toEqual({ storeId: undefined, status: 'PUBLISHED' });
  });
  it('store product: forced ADMIN_ONLY', () => {
    expect(applyStoreOnlyRules({ storeId: 2 }, { storeId: 2, can: can('pos.store_products') }, null)).toEqual({ storeId: 2, status: 'ADMIN_ONLY' });
  });
  it('refuses publishing a store-only product to the website', () => {
    expect(() => applyStoreOnlyRules({ status: 'PUBLISHED' }, { storeId: 2, can: can('pos.store_products') }, 2)).toThrow(BadRequestException);
  });
  it('a manager cannot create for another store', () => {
    expect(() => applyStoreOnlyRules({ storeId: 3 }, { storeId: 2, can: can('pos.store_products') }, null)).toThrow(ForbiddenException);
  });
  it('an all-stores admin can', () => {
    expect(applyStoreOnlyRules({ storeId: 3 }, { storeId: null, can: can('pos.all_stores') }, null).storeId).toBe(3);
  });
});
```

- [ ] **Step 2:** FAIL → implement `apps/backend/src/modules/products/store-only.util.ts`:

```ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ContentStatus } from '@amader/db';
import type { PermissionCheck } from '../../common/auth/permission.decorator';

/** A store-only product is ADMIN_ONLY by definition: that status is what keeps it off the storefront. */
export function applyStoreOnlyRules(
  dto: { storeId?: number | null; status?: ContentStatus },
  actor: { storeId: number | null; can: PermissionCheck },
  existingStoreId: number | null,
): { storeId: number | null | undefined; status: ContentStatus | undefined } {
  const storeId = dto.storeId !== undefined ? dto.storeId : existingStoreId;
  if (storeId === null) return { storeId: dto.storeId, status: dto.status };
  if (dto.status && dto.status !== 'ADMIN_ONLY') {
    throw new BadRequestException('A store-only product cannot be published to the website');
  }
  const allowed = actor.can('pos.all_stores') || (actor.can('pos.store_products') && actor.storeId === storeId);
  if (!allowed) throw new ForbiddenException('You can only add products for your own store');
  return { storeId: dto.storeId, status: 'ADMIN_ONLY' };
}
```

- [ ] **Step 3: Wire it** — in `ProductsService.create(dto, actor)` / `update(id, dto, actor)` call `applyStoreOnlyRules` first and spread the result into the Prisma `data`. Controller passes `{ storeId: await stores.adminStoreId(admin.id), can }` (import `StoresModule` into `ProductsModule`). Existing callers that don't have an actor (imports, seeds) pass `{ storeId: null, can: () => true }`.

- [ ] **Step 4: Admin form** — add a "Store" `<select>` (options: "All stores (shared)" = null, plus `/admin/stores` list) visible when `me.isSuperAdmin || me.permissions.includes('pos.all_stores') || me.permissions.includes('pos.store_products')`. When a store is chosen, set status to `ADMIN_ONLY`, disable the status select, show hint "Store-only products are never shown on amadere.com". Also add the Barcode input for simple products next to SKU.

- [ ] **Step 5:** `npx jest src/modules/products` → PASS (existing specs must still pass — update their calls with the actor arg). Checkpoint + bugfix log.

---

### Task 12: Shared login and `pos.` host routing

**Files:**
- Create: `apps/admin/src/lib/pos-host.ts`, `apps/admin/tests/pos-host.test.mjs`
- Modify: `apps/admin/src/proxy.ts`, `apps/admin/src/lib/auth-cookies.ts`
- Modify: deployment env docs (wherever `NEXT_PUBLIC_API_BASE_URL` is documented for admin — grep `.env.example` in `apps/admin`)

**Produces:**
```ts
export function isPosHost(host: string | null): boolean;          // "pos.amadere.com", "pos.localhost:3004"
export function posRoute(pathname: string): { rewrite?: string; redirect?: string } | null; // decision for pos host
```

- [ ] **Step 1: Failing test** — `tests/pos-host.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPosHost, posRoute } from "../src/lib/pos-host.ts";

test("isPosHost", () => {
  assert.equal(isPosHost("pos.amadere.com"), true);
  assert.equal(isPosHost("pos.localhost:3004"), true);
  assert.equal(isPosHost("admin.amadere.com"), false);
  assert.equal(isPosHost(null), false);
});

test("posRoute: root rewrites to /pos, admin pages redirect to /pos, pos/login/api pass", () => {
  assert.deepEqual(posRoute("/"), { rewrite: "/pos" });
  assert.deepEqual(posRoute("/orders"), { redirect: "/pos" });
  assert.equal(posRoute("/pos"), null);
  assert.equal(posRoute("/pos/transfers"), null);
  assert.equal(posRoute("/login"), null);
  assert.equal(posRoute("/api/backend/x"), null);
});
```

- [ ] **Step 2:** `cd apps/admin && node --test tests/pos-host.test.mjs` → FAIL.

- [ ] **Step 3: `lib/pos-host.ts`**

```ts
export function isPosHost(host: string | null): boolean {
  return !!host && host.split(":")[0].startsWith("pos.");
}

/** On the pos. host, only the POS, login and API exist. */
export function posRoute(pathname: string): { rewrite?: string; redirect?: string } | null {
  if (pathname === "/") return { rewrite: "/pos" };
  if (pathname === "/pos" || pathname.startsWith("/pos/") || pathname === "/login" || pathname.startsWith("/api/")) return null;
  return { redirect: "/pos" };
}
```

- [ ] **Step 4: `proxy.ts`** — replace the function body:

```ts
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next/")) return NextResponse.next();

  // pos.amadere.com is this same app showing only /pos (spec D1).
  if (isPosHost(req.headers.get("host"))) {
    const route = posRoute(pathname);
    if (route?.redirect) return NextResponse.redirect(new URL(route.redirect, req.url));
    if (route?.rewrite) {
      if (!req.cookies.has("admin_refresh_token")) return toLogin(req, route.rewrite);
      return NextResponse.rewrite(new URL(route.rewrite, req.url));
    }
  }

  if (pathname === "/login" || pathname.startsWith("/api/")) return NextResponse.next();
  if (!req.cookies.has("admin_refresh_token")) return toLogin(req, pathname);
  return NextResponse.next();
}

function toLogin(req: NextRequest, next: string) {
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}
```

(Keep the existing comment block above the function; add `import { isPosHost, posRoute } from "@/lib/pos-host";`.)

- [ ] **Step 5: `auth-cookies.ts`** — one shared session across `admin.` and `pos.`:

```ts
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  // ".amadere.com" in production so admin. and pos. share one login.
  // Unset in dev → host-only, as before.
  ...(process.env.ADMIN_COOKIE_DOMAIN ? { domain: process.env.ADMIN_COOKIE_DOMAIN } : {}),
};
```

and `clearAuthCookies` must delete with the same domain, or the parent-domain cookie survives logout:

```ts
export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  for (const name of ["admin_access_token", "admin_refresh_token"]) {
    store.set(name, "", { ...COOKIE_OPTS, maxAge: 0 });
  }
}
```

Also check `lib/auth-proxy.ts` — if it sets cookies on refresh, it must use `COOKIE_OPTS` (export it from `auth-cookies.ts` if needed).

- [ ] **Step 6: Login redirect safety** — in `app/login/page.tsx:88`, the `next` param is pushed to the router. Guard it: `const next = (raw && raw.startsWith("/") && !raw.startsWith("//")) ? raw : "/";`.

- [ ] **Step 7:** `node --test tests/pos-host.test.mjs` → PASS. Manual (dev): add `127.0.0.1 pos.localhost` if needed; visit `http://pos.localhost:3004/` logged-out → `/login?next=/pos` → log in → POS. Visit `http://pos.localhost:3004/orders` → redirected to `/pos`. Checkpoint + bugfix log.

**Deploy notes (write into the bugfix-log entry):** DNS `pos.amadere.com` → same server as `admin.amadere.com`; reverse-proxy vhost for `pos.amadere.com` → admin Next process (port 3002); TLS cert covers `pos.`; set `ADMIN_COOKIE_DOMAIN=.amadere.com`; all admins are logged out once.

---

### Task 13: POS selling screen (the mockup)

**Files:**
- Create: `apps/admin/src/lib/pos-cart.ts`, `apps/admin/tests/pos-cart.test.mjs`
- Create: `apps/admin/src/hooks/usePos.ts`
- Create: `apps/admin/src/app/pos/layout.tsx`, `app/pos/page.tsx`
- Create: `apps/admin/src/components/pos/PosTopBar.tsx`, `ProductGrid.tsx`, `CartPanel.tsx`, `StatCards.tsx`, `useScanner.ts`

**Interfaces — Consumes:** HTTP from Tasks 5, 6. **Produces:** `PosProduct` TS type mirror; `cartReducer`.

- [ ] **Step 1: Failing test** — `tests/pos-cart.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { cartReducer, cartSubtotal } from "../src/lib/pos-cart.ts";

const coke = { productId: 1, variantId: null, name: "Coca-Cola", price: "40.00", salePrice: null, stock: 3 };

test("add merges same SKU and caps at stock", () => {
  let c = cartReducer([], { type: "add", product: coke });
  c = cartReducer(c, { type: "add", product: coke });
  assert.equal(c.length, 1);
  assert.equal(c[0].qty, 2);
  c = cartReducer(c, { type: "setQty", key: "1:0", qty: 99 });
  assert.equal(c[0].qty, 3);
});

test("setQty 0 removes; sale price wins", () => {
  let c = cartReducer([], { type: "add", product: { ...coke, salePrice: "35.00" } });
  assert.equal(cartSubtotal(c), 35);
  c = cartReducer(c, { type: "setQty", key: "1:0", qty: 0 });
  assert.equal(c.length, 0);
});

test("out of stock is not added", () => {
  const c = cartReducer([], { type: "add", product: { ...coke, stock: 0 } });
  assert.equal(c.length, 0);
});
```

- [ ] **Step 2:** `node --test tests/pos-cart.test.mjs` → FAIL.

- [ ] **Step 3: `lib/pos-cart.ts`**

```ts
export interface PosProduct {
  productId: number;
  variantId: number | null;
  name: string;
  variantLabel?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price: string;
  salePrice: string | null;
  imageUrl?: string | null;
  categoryIds?: number[];
  stock: number;
  storeOnly?: boolean;
}

export interface CartLine extends PosProduct {
  key: string;
  qty: number;
}

export type CartAction =
  | { type: "add"; product: PosProduct }
  | { type: "setQty"; key: string; qty: number }
  | { type: "remove"; key: string }
  | { type: "load"; lines: CartLine[] }
  | { type: "clear" };

export const lineKey = (p: { productId: number; variantId: number | null }) => `${p.productId}:${p.variantId ?? 0}`;
export const unitPrice = (p: PosProduct) => Number(p.salePrice ?? p.price);

export function cartReducer(cart: CartLine[], a: CartAction): CartLine[] {
  switch (a.type) {
    case "add": {
      if (a.product.stock <= 0) return cart;
      const key = lineKey(a.product);
      const hit = cart.find((l) => l.key === key);
      if (!hit) return [...cart, { ...a.product, key, qty: 1 }];
      return cartReducer(cart, { type: "setQty", key, qty: hit.qty + 1 });
    }
    case "setQty":
      return cart
        .map((l) => (l.key === a.key ? { ...l, qty: Math.min(Math.max(0, Math.floor(a.qty)), l.stock) } : l))
        .filter((l) => l.qty > 0);
    case "remove":
      return cart.filter((l) => l.key !== a.key);
    case "load":
      return a.lines;
    case "clear":
      return [];
  }
}

/** Display-only; the server recomputes every total. */
export const cartSubtotal = (cart: CartLine[]) => cart.reduce((s, l) => s + unitPrice(l) * l.qty, 0);
export const cartCount = (cart: CartLine[]) => cart.reduce((s, l) => s + l.qty, 0);
export const taka = (n: number | string) => `৳ ${Number(n).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
```

- [ ] **Step 4: `hooks/usePos.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { PosProduct } from "@/lib/pos-cart";

const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export function usePosCatalog(storeId: number | undefined, q: string, categoryId: number | undefined, sort: string) {
  return useQuery({
    queryKey: ["pos-catalog", storeId, q, categoryId, sort],
    queryFn: () => proxyFetch<PosProduct[]>(`/admin/pos/catalog${qs({ storeId, q, categoryId, sort })}`),
  });
}

export const usePosCategories = () =>
  useQuery({ queryKey: ["pos-categories"], queryFn: () => proxyFetch<{ id: number; name: string }[]>("/admin/pos/categories") });

export const usePosStats = (storeId?: number) =>
  useQuery({
    queryKey: ["pos-stats", storeId],
    queryFn: () => proxyFetch<{ totalProducts: number; lowStock: number; todaySales: string }>(`/admin/pos/stats${qs({ storeId })}`),
  });

export const usePosStores = () =>
  useQuery({ queryKey: ["stores"], queryFn: () => proxyFetch<{ id: number; name: string; code: string; isOnlineStore: boolean }[]>("/admin/stores") });

export const posLookup = (code: string, storeId?: number) =>
  proxyFetch<PosProduct>(`/admin/pos/lookup${qs({ code, storeId })}`);

export interface SaleBody {
  storeId?: number;
  items: { productId: number; variantId?: number; quantity: number }[];
  customerId?: number;
  couponCode?: string;
  tender: "CASH" | "CARD" | "MOBILE";
  tenderedAmount?: number;
  transactionRef?: string;
  heldSaleId?: number;
}

export function useCompleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaleBody) =>
      proxyFetch<{ orderId: number; orderNumber: string; total: string; change: string }>("/admin/pos/sales", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-catalog"] });
      qc.invalidateQueries({ queryKey: ["pos-stats"] });
      qc.invalidateQueries({ queryKey: ["pos-held"] });
      qc.invalidateQueries({ queryKey: ["pos-recent"] });
    },
  });
}

export interface HeldSale { id: number; label: string; cart: { lines: unknown[] }; createdAt: string }

export const usePosHeld = (storeId?: number) =>
  useQuery({ queryKey: ["pos-held", storeId], queryFn: () => proxyFetch<HeldSale[]>(`/admin/pos/held${qs({ storeId })}`) });

export function useHoldSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { storeId?: number; label: string; cart: object }) => proxyFetch("/admin/pos/held", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-held"] }),
  });
}

export const usePosRecent = (storeId?: number) =>
  useQuery({ queryKey: ["pos-recent", storeId], queryFn: () => proxyFetch<Array<{ id: number; orderNumber: string; totalAmount: string; status: string; createdAt: string }>>(`/admin/pos/sales${qs({ storeId })}`) });
```

- [ ] **Step 5: `components/pos/useScanner.ts`** — keyboard-wedge capture (behaviour ported, not code copied, from the Botble scanner — see spec §10.3):

```ts
import { useEffect, useRef } from "react";

/**
 * A USB scanner "types" the code fast then presses Enter. Keys arriving
 * < 35ms apart and ending in Enter with >= 4 chars are a scan. Typing in an
 * input still works because a human is slower than the threshold.
 * ponytail: timing heuristic only; add camera (ZXing) scanning if a store
 * has no hardware scanner.
 */
export function useScanner(onScan: (code: string) => void) {
  const buf = useRef("");
  const last = useRef(0);
  const cooldown = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const now = performance.now();
      if (now - last.current > 35) buf.current = "";
      last.current = now;
      if (e.key === "Enter") {
        const code = buf.current;
        buf.current = "";
        if (code.length < 4) return;
        // Same label read twice within 1.5s = one scan.
        if (code === cooldown.current.code && now - cooldown.current.at < 1500) return;
        cooldown.current = { code, at: now };
        e.preventDefault();
        onScan(code);
      } else if (e.key.length === 1) {
        buf.current += e.key;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onScan]);
}
```

- [ ] **Step 6: `app/pos/layout.tsx`** — full-screen, no admin shell; permission gate:

```tsx
"use client";

import { useAdminMe } from "@/hooks/useAdminAuth";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useAdminMe();
  if (isLoading || !me) return <div className="grid h-screen place-items-center text-gray-500">Loading…</div>;
  const can = (k: string) => me.isSuperAdmin || me.permissions.includes(k);
  if (!can("pos.access")) {
    return <div className="grid h-screen place-items-center text-gray-700">You don&apos;t have access to the POS. Ask an admin for the POS role.</div>;
  }
  if (!me.storeId && !can("pos.all_stores")) {
    return <div className="grid h-screen place-items-center text-gray-700">No store assigned — ask an admin.</div>;
  }
  return <div lang="en" className="min-h-screen bg-[#f6f8f7] text-gray-900">{children}</div>;
}
```

(`QueryProvider` must wrap `/pos` — check `app/layout.tsx`; if the provider lives in `(shell)/layout.tsx`, wrap `children` here in `<QueryProvider>` too, plus `ToastProvider`.)

- [ ] **Step 7: `app/pos/page.tsx`** — composes the mockup. Brand green `#1f7a4d` (sample the mockup; match `DESIGN_SYSTEM.md` tokens if a green exists there).

```tsx
"use client";

import { useCallback, useReducer, useState } from "react";
import { useAdminMe } from "@/hooks/useAdminAuth";
import { posLookup, usePosCatalog, usePosCategories, usePosStats, usePosStores } from "@/hooks/usePos";
import { cartReducer } from "@/lib/pos-cart";
import { PosTopBar } from "@/components/pos/PosTopBar";
import { StatCards } from "@/components/pos/StatCards";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { CartPanel } from "@/components/pos/CartPanel";
import { useScanner } from "@/components/pos/useScanner";
import { useToast } from "@/components/ToastProvider";

export default function PosPage() {
  const { data: me } = useAdminMe();
  const allStores = !!me && (me.isSuperAdmin || me.permissions.includes("pos.all_stores"));
  const { data: stores } = usePosStores();
  const [pickedStore, setPickedStore] = useState<number | undefined>();
  const storeId = allStores ? pickedStore ?? stores?.[0]?.id : undefined; // undefined → server uses the user's own store

  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [sort, setSort] = useState("popular");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [cart, dispatch] = useReducer(cartReducer, []);
  const [customer, setCustomer] = useState<{ id: number; name: string } | null>(null);
  const [heldSaleId, setHeldSaleId] = useState<number | undefined>();

  const catalog = usePosCatalog(storeId, q, categoryId, sort);
  const { data: categories = [] } = usePosCategories();
  const { data: stats } = usePosStats(storeId);
  const toast = useToast();

  const onScan = useCallback(
    async (code: string) => {
      try {
        dispatch({ type: "add", product: await posLookup(code, storeId) });
      } catch {
        toast.error(`Barcode ${code} not found. If the keyboard is in Bangla mode, switch to English.`);
      }
    },
    [storeId, toast],
  );
  useScanner(onScan);

  return (
    <div className="flex h-screen flex-col">
      <PosTopBar
        q={q} onQ={setQ} onEnter={onScan}
        stores={allStores ? stores ?? [] : null} storeId={storeId} onStore={setPickedStore}
        storeIdForHeld={storeId}
        cart={cart}
        onHold={() => dispatch({ type: "clear" })}
        onResume={(lines, id) => { dispatch({ type: "load", lines }); setHeldSaleId(id); }}
        me={me}
      />
      <div className="flex min-h-0 flex-1 gap-5 p-5">
        <main className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto">
          <CategoryChips categories={categories} value={categoryId} onChange={setCategoryId} />
          <StatCards stats={stats} activeCustomer={customer ? 1 : 0} />
          <ProductGrid
            items={catalog.data ?? []} loading={catalog.isLoading}
            sort={sort} onSort={setSort} view={view} onView={setView}
            onAdd={(p) => dispatch({ type: "add", product: p })}
          />
        </main>
        <CartPanel
          cart={cart} dispatch={dispatch} storeId={storeId}
          customer={customer} onCustomer={setCustomer}
          heldSaleId={heldSaleId}
          onDone={() => { dispatch({ type: "clear" }); setCustomer(null); setHeldSaleId(undefined); }}
        />
      </div>
    </div>
  );
}

function CategoryChips({ categories, value, onChange }: { categories: { id: number; name: string }[]; value?: number; onChange: (v?: number) => void }) {
  const chip = (active: boolean) =>
    `flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-medium ${active ? "border-[#1f7a4d] bg-[#1f7a4d] text-white" : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"}`;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button className={chip(value === undefined)} onClick={() => onChange(undefined)}>All Products</button>
      {categories.map((c) => (
        <button key={c.id} className={chip(value === c.id)} onClick={() => onChange(c.id)}>{c.name}</button>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Components.** Build each to match the mockup exactly (spacing, rounded-2xl white cards on `#f6f8f7`, green pill "Add" buttons, stock dot green/orange/red):
  - `StatCards.tsx` — 4 cards: Total Products, Low Stock Items (red icon), Today's Sales (`taka(todaySales)`), Active Customer. Icons: Material Symbols via existing `Icon` component (`inventory_2`, `warning`, `bar_chart`, `person`).
  - `ProductGrid.tsx` — header "Products" + sort `<select>` (Popular / Name / Price) + grid/list toggle; card: image (`object-contain h-24`), name, `variantLabel` in gray, price `taka(salePrice ?? price)` (strike-through `price` when on sale), stock line: `stock <= 0` → red "Out of Stock" and disabled Add; `stock <= 10` → orange "Low Stock (n)"; else green "In Stock (n)"; store-only products get a small "Store item" badge. Grid `grid-cols-[repeat(auto-fill,minmax(170px,1fr))]`.
  - `PosTopBar.tsx` — logo tile + "POS"; search input (`placeholder="Search products by name, SKU or barcode..."`, `lang="en"`, Enter → `onEnter(value)`) with the barcode icon; buttons Hold Sale (prompts label via `window.prompt`, posts `{label, cart:{lines: cart}}`, then `onHold()`), Recent Sales (popover listing `usePosRecent` with "Receipt" → `/pos/receipt/{id}` and — with `pos.refund` — "Return" → `POST /admin/pos/sales/{id}/return` after `ConfirmDialog`), Held (popover from `usePosHeld`, Resume → `onResume(lines, id)` then `DELETE` it on sale via `heldSaleId`), More (menu: Stock In, Adjust, Transfers, Labels, Reports — each shown only with its permission, links to `/pos/...`; "Back to admin" → `https://admin.amadere.com` when on the pos host else `/`); store `<select>` only when `stores !== null`; avatar with user initial.
  - `CartPanel.tsx` — right column `w-[440px]`: header "Current Sale" + count badge + red "Clear Cart"; lines with image, name, `taka(unit)`, − qty + stepper (input editable), line total, ×; Customer (Optional) + "Add Customer" (reuse the existing customer search endpoint used by the New Order panel — grep `useCustomerSearch` / `admin/customers?search=` in `apps/admin/src/hooks`); Discount / Coupon input + Apply (stores code, server validates on sale; show server error in toast); summary: Subtotal (n items), Discount, VAT (15%) — display estimate `subtotal * 0.15` labelled "VAT (est.)" (server total is authoritative and shown after sale); Total Amount; tender buttons Cash / Card / Mobile Banking (selected = green); Cash → "Cash received" number input + live change; Card/Mobile → "Transaction / slip no." input; big green "Complete Sale ৳ total →" button (disabled when cart empty or pending). On success: toast `Sale ${orderNumber} — change ৳${change}`, `window.open('/pos/receipt/' + orderId)`, `onDone()`.

- [ ] **Step 9: Verify** — `node --test tests/pos-cart.test.mjs` PASS; `pnpm --filter admin exec tsc --noEmit` clean; run admin + backend dev, open `/pos`: products load with stock, scan (type a barcode fast + Enter) adds, complete a cash sale, stock drops by the sold qty, Today's Sales increases, the ledger (Accounts) shows a SALE entry in the store's cash account. Compare side by side with the mockup screenshot. Checkpoint + bugfix log.

---

### Task 14: Receipt + stock-in, adjust, transfers pages

**Files:**
- Create: `apps/admin/src/app/pos/receipt/[id]/page.tsx`, `app/pos/stock-in/page.tsx`, `app/pos/adjust/page.tsx`, `app/pos/transfers/page.tsx`, `components/pos/ProductPicker.tsx`, `components/pos/PosSubHeader.tsx`

**Consumes:** Tasks 6-8 HTTP.

- [ ] **Step 1: Receipt** — `GET /admin/pos/sales/:id`; 80mm layout (`@page { size: 80mm auto; margin: 0 }`, body `width: 72mm; font: 12px monospace`), store name/address/phone, order number, date, cashier, lines (name × qty = total), subtotal, discount, VAT, total, tender, change (if cash), "Thank you — Amader®". `useEffect(() => { if (data) window.print(); }, [data])`. Reprint = open the same URL.
- [ ] **Step 2: `ProductPicker.tsx`** — search box reusing `usePosCatalog(storeId, q, undefined, "name")` + `useScanner` → `onPick(PosProduct)`. Shared by the three pages below.
- [ ] **Step 3: `PosSubHeader.tsx`** — `← POS` link + title + store name; used by every `/pos/*` sub-page.
- [ ] **Step 4: Stock-in page** — permission `pos.stock_in` (else message). Supplier (optional, search the Accounts parties endpoint — grep `admin/accounts/parties` in `apps/admin/src/hooks`), note, lines table (product, qty > 0, unit cost), Save → `POST /admin/stock/stock-in` → toast `GRN-… saved`, clear form.
- [ ] **Step 5: Adjust page** — permission `pos.adjust`. Product (picker), current stock shown, direction (Add / Remove), qty, reason select (Damaged, Expired, Count correction, Lost, Other), note (required for Other — client-side check mirrors the server), Save → `POST /admin/stock/adjust`. Below: last movements for the chosen product (`GET /admin/stock/movements?productId=`).
- [ ] **Step 6: Transfers page** — permission `pos.transfer`. "New transfer": destination store select (from `/admin/stores`, excluding own), lines, note → `POST /admin/stock/transfers`. List table: number, from → to, status chip, date, actions by status and side: REQUESTED → Approve (`pos.transfer_approve`) / Cancel; APPROVED → Dispatch (source side) / Cancel; DISPATCHED → Receive (destination side; opens a dialog with per-line received qty defaulting to sent qty).
- [ ] **Step 7: Verify** manually end to end: stock-in 10 at store B → B shows 10; transfer 4 B→Main, approve, dispatch (B = 6), receive 3 (Main +3, line shows short 1); adjust −1 Damaged at B (B = 5); a second receive click → error toast. `tsc --noEmit` clean. Checkpoint + bugfix log.

---

### Task 15: Barcode labels

**Files:**
- Create: `apps/admin/src/app/pos/labels/page.tsx`, `components/pos/Label.tsx`
- Modify: `apps/admin/package.json` — add `jsbarcode`

- [ ] **Step 1:** `pnpm --filter admin add jsbarcode` (the only new dependency; it renders Code 128 / EAN-13 to SVG).
- [ ] **Step 2: `Label.tsx`** — 40×30mm:

```tsx
"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { taka, type PosProduct } from "@/lib/pos-cart";

export function Label({ p }: { p: PosProduct }) {
  const svg = useRef<SVGSVGElement>(null);
  const code = p.barcode ?? "";
  useEffect(() => {
    if (!svg.current || !code) return;
    JsBarcode(svg.current, code, {
      format: /^\d{13}$/.test(code) ? "EAN13" : "CODE128",
      height: 32, width: 1.2, margin: 0, fontSize: 9, displayValue: true,
    });
  }, [code]);
  return (
    <div className="pos-label flex flex-col items-center justify-between overflow-hidden text-black" style={{ width: "40mm", height: "30mm", padding: "1mm", breakAfter: "page" }}>
      <div className="w-full truncate text-center text-[8pt] font-semibold leading-tight">{p.name}</div>
      <div className="flex w-full justify-between text-[7pt] leading-none">
        <span>{p.variantLabel ?? ""}</span>
        <span className="font-bold">{taka(p.salePrice ?? p.price)}</span>
      </div>
      {code ? <svg ref={svg} /> : <div className="text-[7pt] text-red-600">No barcode — generate first</div>}
      <div className="text-[6pt] leading-none">Amader®</div>
    </div>
  );
}
```

- [ ] **Step 3: Labels page** — permission `pos.labels`. Product picker → queue rows `{ product, copies }`; "Generate missing barcodes" → `POST /admin/stock/barcodes/generate { productIds }` then refetch; "Print" renders `copies` × `<Label>` inside a print-only container with:

```css
@media print {
  @page { size: 40mm 30mm; margin: 0; }
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area { position: absolute; inset: 0; }
}
```

Reprint = same page, same queue. Bangla product names render with the browser's font — confirm on the real TSC/Xprinter (spec §10, hardware §6 of the handoff).
- [ ] **Step 4: Verify** — print preview in Chrome shows one 40×30mm label per page; a phone barcode-scanner app reads the printed/preview barcode as the product's barcode. Checkpoint + bugfix log.

---

### Task 16: Reports page, Stores admin page, admin nav entry

**Files:**
- Create: `apps/admin/src/app/pos/reports/page.tsx`, `apps/admin/src/app/(shell)/stores/page.tsx`
- Modify: `apps/admin/src/lib/nav-config.tsx`, `apps/admin/src/lib/page-title.ts`

- [ ] **Step 1: Reports page** — permission `pos.reports`. Date range (default today), store select when `pos.all_stores` ("All stores" option), table from `GET /admin/pos/reports/sales` (Store, Orders, Gross, VAT, Returns) with a totals row; "Stock on hand" tab from `/reports/stock` (one store). Export buttons use the existing `downloadCsvAsXlsx('/api/backend/admin/pos/reports/sales.csv?…', …, reportTitle('POS Sales', {from,to}))` helper.
- [ ] **Step 2: Stores page** — permission `stores.manage`. Table of stores (name, code, online badge, staff count, active); create/edit dialog: name, code, address, phone, active, and three account selects (Cash / Card / Mobile Banking) fed by the Accounts cash-accounts endpoint (grep `cash-accounts` in `apps/admin/src/hooks`); "Staff" dialog: multi-select of admin users (`/admin/staff` list) → `PUT /admin/stores/:id/staff`. Warn inline when a store has no cash account: "Sales at this store won't reach Accounts until a cash account is set."
- [ ] **Step 3: Nav** — in `nav-config.tsx` add, near Wholesale:

```tsx
const posIcon = <Icon name="point_of_sale" />;
const storesIcon = <Icon name="storefront" />;
// ...
  label("pos-label", "Point of Sale"),
  { key: "pos", label: "POS", href: "/pos", icon: posIcon, permission: "pos.access" },
  { key: "stores", label: "Stores", href: "/stores", icon: storesIcon, permission: "stores.manage" },
```

and `page-title.ts` entries for `/stores`.
- [ ] **Step 4: Verify** — a role with only `pos.access` sees "POS" and not "Stores"; a role without `pos.access` sees neither and `/admin/pos/catalog` returns 403. `tsc --noEmit` clean. Checkpoint + bugfix log.

---

### Task 17: Whole-feature verification

- [ ] **Step 1:** `cd apps/backend && npx jest` → all suites pass (report the real counts).
- [ ] **Step 2:** `cd apps/admin && npm test` and `npx tsc --noEmit` → pass.
- [ ] **Step 3:** `cd apps/backend && npx tsc --noEmit` and `pnpm lint` → clean.
- [ ] **Step 4: Scenario run** (dev, two stores Main + Dhanmondi, a cashier user assigned to Dhanmondi with a "Cashier" role = `pos.access` only):
  1. Admin logged in on `admin.` → open `pos.` → no login prompt (prod) / `/pos` (dev).
  2. Cashier logs in fresh via `pos.` → POS for Dhanmondi, no store switcher, no Stock-in in More menu.
  3. Cashier calls `/admin/pos/sales?storeId=<Main>` → only Dhanmondi sales returned.
  4. Store-only product created for Dhanmondi → visible in Dhanmondi POS, absent from Main POS, absent from storefront search and PDP (404).
  5. Website checkout of a product still decrements website stock as before; POS sale at Main decrements the same number.
  6. Return a Dhanmondi sale from the Order Manager → Dhanmondi stock restored, website stock unchanged.
  7. Accounts ledger: POS sales appear under the store's Cash/Card/bKash accounts; refund posts OUT from the same account.
- [ ] **Step 5:** Final bugfix-log entry with deploy notes (Task 12) and the open VAT question. Report results to the user with real outputs.
