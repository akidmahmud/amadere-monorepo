# New Order Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admin staff a real "create order" screen that manually places an order (customer
select-or-create, product lines with optional price override, address, payment method) and
integrates with the existing Customer Panel exactly like a real storefront order does.

**Architecture:** A new `AdminOrderCreationService` reuses existing infrastructure — stock
reservation, sale-price-aware line pricing, and the `ORDER_CREATED_EVENT` the Customer Panel's
`CustomerOrderEventListener` already subscribes to — rather than duplicating any of it. No
fraud/blocker/OTP/advance-payment gates run on this path (staff is directly handling a verified
customer, not a storefront submission).

**Tech Stack:** NestJS + Prisma (`apps/backend`), Next.js + React Query (`apps/admin`), same
`@amader/admin-ui` component set and Net Profit violet theme already used by the Customer Panel.

## Global Constraints

- **No git.** This project has no git repository and a standing no-commit rule — implement
  everything as direct file edits. No "commit" steps anywhere in this plan (adapted from the
  skill's default template, same adaptation used for the Customer Panel plan).
- **No automated test suite exists in this repo** (`apps/backend/src/**/*.spec.ts` — zero files).
  Verification throughout is live: real `curl`/Playwright calls against the real dev DB, with test
  data cleaned up afterward and cleanup confirmed via a follow-up query. Never insert test rows
  directly via SQL.
- `pnpm -r exec tsc --noEmit` (or the per-app `npx tsc --noEmit -p .`) must stay clean after every
  task — both `apps/backend` and `apps/admin`.
- Follow the existing Net Profit violet/dark theme components already in `@amader/admin-ui`
  (`PageHeader`, `Card`, `Button`, `Icon`, `Table`) — no new design-system components needed, this
  feature reuses what the Customer Panel already established.
- Spec: `docs/superpowers/specs/2026-07-18-new-order-panel-design.md` — read it in full before
  starting; this plan implements it exactly, with a few implementation-level refinements noted
  inline where they're a strict improvement (e.g. reusing `PricingService`'s existing sale-price
  logic instead of hand-rolling it, and supporting variant selection which the spec's prose glossed
  over but the product catalog requires).

---

## File Structure

**Backend (`apps/backend/src/modules/orders/`, plus two small cross-module touches):**
- `order-number.util.ts` (new) — `generateOrderNumber()`, extracted from `checkout.service.ts` so
  the new manual-order service can reuse it without duplication.
- `stock-reservation.util.ts` (new) — `reserveStock()`, extracted from `checkout.service.ts` for
  the same reason.
- `order-address.util.ts` (new) — `toOrderAddressCreate()`, extracted from `checkout.service.ts`'s
  private `toAddressCreate` for the same reason.
- `checkout.service.ts` (modify) — delete the three extracted pieces, import the utils instead. No
  behavior change to real storefront checkout.
- `dto/create-manual-order.dto.ts` (new) — `CreateManualOrderDto`, `ManualOrderItemDto`.
- `admin-order-creation.service.ts` (new) — `AdminOrderCreationService.create()`.
- `admin-orders.controller.ts` (modify) — add `POST /admin/orders`.
- `orders.module.ts` (modify) — register the new service.
- `apps/backend/src/modules/cart/pricing.service.ts` (modify) — `priceLines` goes from `private` to
  public (zero behavior change, just a visibility change so the new service can reuse the same
  sale-price-aware pricing logic instead of reimplementing it).
- `apps/backend/src/modules/products/dto/product-filter-query.dto.ts` (modify) — add `q` (free-text
  search), a real gap: no product name/SKU search exists anywhere in this codebase today, and the
  New Order Panel's product picker needs one.
- `apps/backend/src/modules/products/products.service.ts` (modify) — `buildWhere` handles `q`.
- `packages/shared/src/permission-catalog.ts` (modify) — add `perm('order', 'create')`.

**Frontend (`apps/admin/src/`):**
- `hooks/useOrders.ts` (modify) — add `useCreateManualOrder()`.
- `hooks/useProducts.ts` (modify) — add `useProductSearch(q)`.
- `lib/nav-config.tsx` (modify) — add the "New Order" nav row.
- `app/(shell)/orders/new/page.tsx` (new) — the New Order form itself.
- `components/CustomerDetailModal.tsx` (modify) — add a "New Order" button.
- `app/(shell)/customers/[id]/page.tsx` (modify) — add a "New Order" button.

---

### Task 1: Backend shared infra — extract utils, add product search, add permission

**Files:**
- Create: `apps/backend/src/modules/orders/order-number.util.ts`
- Create: `apps/backend/src/modules/orders/stock-reservation.util.ts`
- Create: `apps/backend/src/modules/orders/order-address.util.ts`
- Modify: `apps/backend/src/modules/orders/checkout.service.ts`
- Modify: `apps/backend/src/modules/cart/pricing.service.ts`
- Modify: `apps/backend/src/modules/products/dto/product-filter-query.dto.ts`
- Modify: `apps/backend/src/modules/products/products.service.ts`
- Modify: `packages/shared/src/permission-catalog.ts`

**Interfaces:**
- Produces (used by Task 2): `generateOrderNumber(): string`, `reserveStock(tx: Prisma.TransactionClient, productId: number, variantId: number | null, quantity: number): Promise<void>`, `toOrderAddressCreate(address: CheckoutAddressDto, type: OrderAddressType)`, and `PricingService.priceLines(lines: { productId: number; variantId: number | null; quantity: number }[]): Promise<PricedLine[]>` (now public — same `PricedLine` shape already exported from `pricing.service.ts`: `{ productId, variantId, quantity, unitPrice: Decimal, lineTotal: Decimal }`).

- [ ] **Step 1: Create the three extracted util files**

`apps/backend/src/modules/orders/order-number.util.ts`:

```typescript
import { randomBytes } from 'node:crypto';

// ORD-YYYYMMDD-<6 hex chars>, e.g. ORD-20260718-1F2A3B. Shared by real
// checkout and manual (admin-created) orders so order numbers are
// indistinguishable between the two paths.
export function generateOrderNumber(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `ORD-${ymd}-${randomBytes(3).toString('hex').toUpperCase()}`;
}
```

`apps/backend/src/modules/orders/stock-reservation.util.ts`:

```typescript
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@amader/db';

// Atomic hold: only succeeds if enough stock is actually available, so
// concurrent order creation (storefront checkout or admin manual order)
// can never oversell (AGENTS.md §6). Extracted from CheckoutService so both
// call sites share one implementation.
export async function reserveStock(
  tx: Prisma.TransactionClient,
  productId: number,
  variantId: number | null,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return;

  if (variantId) {
    const affected = await tx.$executeRaw`
      UPDATE product_variants SET reserved_stock = reserved_stock + ${quantity}
      WHERE id = ${variantId} AND stock - reserved_stock >= ${quantity}
    `;
    if (affected === 0)
      throw new ConflictException(`Insufficient stock for variant #${variantId}`);
    return;
  }

  const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  if (!product.trackInventory) return;

  const affected = await tx.$executeRaw`
    UPDATE products SET reserved_stock = reserved_stock + ${quantity}
    WHERE id = ${productId} AND (allow_backorder OR stock - reserved_stock >= ${quantity})
  `;
  if (affected === 0)
    throw new ConflictException(`Insufficient stock for "${product.slug}"`);
}
```

`apps/backend/src/modules/orders/order-address.util.ts`:

```typescript
import { OrderAddressType } from '@amader/db';
import { CheckoutAddressDto } from './dto/checkout-address.dto';

// Shared by real checkout and manual (admin-created) orders — both build an
// OrderAddress `create` payload from the same CheckoutAddressDto shape.
export function toOrderAddressCreate(address: CheckoutAddressDto, type: OrderAddressType) {
  return {
    type,
    recipientName: address.recipientName,
    phone: address.phone,
    email: address.email,
    division: address.division,
    district: address.district,
    area: address.area,
    landmark: address.landmark,
    addressLine: address.addressLine,
    postCode: address.postCode,
  };
}
```

- [ ] **Step 2: Update `checkout.service.ts` to use the extracted utils**

Remove the top-level `function generateOrderNumber() { ... }` block (currently lines 28-32) and add
to the imports at the top of the file:

```typescript
import { generateOrderNumber } from './order-number.util';
import { reserveStock } from './stock-reservation.util';
import { toOrderAddressCreate } from './order-address.util';
```

Remove the private `reserveStock` method (the block starting `private async reserveStock(` through
its closing `}`) and the private `toAddressCreate` method (`private toAddressCreate(address: CheckoutAddressDto, type: OrderAddressType) { ... }`).

Update the two call sites:
- `await this.reserveStock(tx, item.productId, item.variantId, item.quantity);` → `await reserveStock(tx, item.productId, item.variantId, item.quantity);`
- Both `this.toAddressCreate(dto.shippingAddress, OrderAddressType.SHIPPING)` and
  `this.toAddressCreate(dto.billingAddress ?? dto.shippingAddress, OrderAddressType.BILLING)` →
  drop the `this.` prefix (`toOrderAddressCreate(...)`).

No other change to `checkout.service.ts` — the real storefront checkout flow (pricing, fraud,
blocker, OTP, advance payment) is completely untouched.

- [ ] **Step 3: Make `PricingService.priceLines` public**

In `apps/backend/src/modules/cart/pricing.service.ts`, change:

```typescript
  private async priceLines(lines: CartLineInput[]): Promise<PricedLine[]> {
```

to:

```typescript
  // Public so AdminOrderCreationService (manual orders) can reuse the same
  // sale-window-aware price resolution real checkout uses, instead of
  // reimplementing effectivePrice() a second time.
  async priceLines(lines: CartLineInput[]): Promise<PricedLine[]> {
```

Also export `CartLineInput` (currently `interface CartLineInput { ... }` with no `export`) by adding
`export` in front of it — Task 2's DTO-to-line mapping needs the type name available.

- [ ] **Step 4: Add free-text product search (`q`)**

In `apps/backend/src/modules/products/dto/product-filter-query.dto.ts`, add `IsString` to the
`class-validator` import list, and add this property to `ProductFilterQueryDto` (after `sort?`):

```typescript
  @ApiPropertyOptional({ description: 'Free-text search across product name, SKU, and slug.' })
  @IsOptional()
  @IsString()
  q?: string;
```

In `apps/backend/src/modules/products/products.service.ts`, inside `buildWhere`, add this branch
(alongside the existing `brandId`/`isFeatured`/`categoryIds`/etc. spreads):

```typescript
      ...(filters.q?.trim()
        ? {
            OR: [
              { translations: { some: { name: { contains: filters.q.trim(), mode: 'insensitive' as const } } } },
              { sku: { contains: filters.q.trim(), mode: 'insensitive' as const } },
              { slug: { contains: filters.q.trim(), mode: 'insensitive' as const } },
            ],
          }
        : {}),
```

- [ ] **Step 5: Add the `order.create` permission**

In `packages/shared/src/permission-catalog.ts`, next to the existing order permissions:

```typescript
  perm('order', 'view'),
  perm('order', 'update'),
  perm('order', 'refund'),
  perm('order', 'create'),
```

- [ ] **Step 6: Typecheck and live-verify checkout still works**

Run: `cd "H:\Amder Project\backend\apps\backend" && npx tsc --noEmit -p .`
Expected: clean, no output.

Live-verify the extraction didn't break real checkout: place one real storefront order via the
existing `POST /checkout` flow (same COD-OTP-request → read code from `otps` table → `POST /checkout`
sequence used throughout this project's prior sessions) against a disposable cart, confirm it
succeeds and stock actually decremented, then cancel/clean up that test order and its OTP row —
confirm cleanup via a follow-up `SELECT` returning 0 rows.

Live-verify the new search param: `curl -s "http://localhost:3000/admin/products?q=<a real product name substring>" -H "Authorization: Bearer <token>"` — confirm it returns only matching products, and that `?q=` omitted still returns the full unfiltered list (no regression).

---

### Task 2: `AdminOrderCreationService` + `CreateManualOrderDto` + endpoint

**Files:**
- Create: `apps/backend/src/modules/orders/dto/create-manual-order.dto.ts`
- Create: `apps/backend/src/modules/orders/admin-order-creation.service.ts`
- Modify: `apps/backend/src/modules/orders/admin-orders.controller.ts`
- Modify: `apps/backend/src/modules/orders/orders.module.ts`

**Interfaces:**
- Consumes (from Task 1): `generateOrderNumber()`, `reserveStock(tx, productId, variantId, quantity)`,
  `toOrderAddressCreate(address, type)`, `PricingService.priceLines(lines)` returning
  `PricedLine[]` (`{ productId, variantId, quantity, unitPrice: Decimal, lineTotal: Decimal }`).
  Also consumes existing `ORDER_INCLUDE`/`OrderDto`/`toOrderDto` from `orders.mapper.ts`,
  `ORDER_CREATED_EVENT`/`OrderCreatedEvent` from `orders.events.ts`, `PaymentsService.resolve(provider).authorize(orderId, amount)`.
- Produces (used by Task 4's frontend hook): `POST /admin/orders` accepting `CreateManualOrderDto`,
  returning `OrderDto` — same shape the frontend's existing `AdminOrder` type already covers.

- [ ] **Step 1: Write the DTO**

`apps/backend/src/modules/orders/dto/create-manual-order.dto.ts`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@amader/db';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsPositive,
  IsString, Min, ValidateNested,
} from 'class-validator';
import { CheckoutAddressDto } from './checkout-address.dto';

export class ManualOrderItemDto {
  @ApiProperty()
  @IsInt()
  productId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  variantId?: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional({ description: "Overrides the product's real price for this line if set" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreateManualOrderDto {
  @ApiPropertyOptional({ description: 'Set when staff selected an existing customer; omit to auto-match/create by shippingAddress.phone' })
  @IsOptional()
  @IsInt()
  customerId?: number;

  @ApiProperty({ type: CheckoutAddressDto })
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  shippingAddress!: CheckoutAddressDto;

  @ApiPropertyOptional({ type: CheckoutAddressDto, description: 'Defaults to shippingAddress if omitted' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  billingAddress?: CheckoutAddressDto;

  @ApiProperty({ type: [ManualOrderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ManualOrderItemDto)
  items!: ManualOrderItemDto[];

  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  paymentProvider!: PaymentProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerNote?: string;
}
```

- [ ] **Step 2: Write `AdminOrderCreationService`**

`apps/backend/src/modules/orders/admin-order-creation.service.ts`:

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Locale, OrderAddressType, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PricingService } from '../cart/pricing.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import { generateOrderNumber } from './order-number.util';
import { reserveStock } from './stock-reservation.util';
import { toOrderAddressCreate } from './order-address.util';
import { ORDER_INCLUDE, OrderDto, toOrderDto } from './orders.mapper';
import { ORDER_CREATED_EVENT, OrderCreatedEvent } from './orders.events';

const Decimal = Prisma.Decimal;

// Staff-facing "create order over the phone" path — deliberately does not
// call FraudService/BlockerService/OtpSecurityService/AdvancePaymentService
// (docs/superpowers/specs/2026-07-18-new-order-panel-design.md, Non-goals):
// those gates exist to catch bots/fake storefront submissions, not orders a
// staff member is directly taking from a verified customer. Emits the same
// ORDER_CREATED_EVENT real checkout does, so CustomerOrderEventListener's
// existing auto-match/create-by-phone logic (Customer Panel) handles the
// customer side with zero changes to that listener.
@Injectable()
export class AdminOrderCreationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsService,
    private readonly events: EventEmitter2,
  ) {}

  async create(dto: CreateManualOrderDto, adminId: number): Promise<OrderDto> {
    const products = await this.prisma.client.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
      include: {
        translations: { where: { locale: Locale.EN }, take: 1 },
        variants: true,
      },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    for (const item of dto.items) {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Product #${item.productId} not found`);
      }
      if (item.variantId && !product.variants.some((v) => v.id === item.variantId)) {
        throw new BadRequestException(
          `Variant #${item.variantId} does not belong to product #${item.productId}`,
        );
      }
    }

    // Real, sale-window-aware price per line — same effectivePrice logic
    // storefront checkout uses (PricingService.priceLines).
    const pricedLines = await this.pricing.priceLines(
      dto.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? null,
        quantity: i.quantity,
      })),
    );

    const subTotal = pricedLines.reduce((sum, l) => sum.plus(l.lineTotal), new Decimal(0));
    const totalAmount = dto.items.reduce((sum, item, idx) => {
      const effective = item.unitPrice !== undefined ? new Decimal(item.unitPrice) : pricedLines[idx].unitPrice;
      return sum.plus(effective.times(item.quantity));
    }, new Decimal(0));
    const discountAmount = Decimal.max(subTotal.minus(totalAmount), new Decimal(0));

    const order = await this.prisma.client.$transaction(async (tx) => {
      for (const item of dto.items) {
        await reserveStock(tx, item.productId, item.variantId ?? null, item.quantity);
      }

      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId: dto.customerId ?? null,
          subTotal,
          discountAmount,
          totalAmount,
          customerNote: dto.customerNote,
          items: {
            create: dto.items.map((item, idx) => {
              const product = productsById.get(item.productId)!;
              const variant = item.variantId
                ? product.variants.find((v) => v.id === item.variantId)
                : undefined;
              const effective =
                item.unitPrice !== undefined ? new Decimal(item.unitPrice) : pricedLines[idx].unitPrice;
              return {
                productId: item.productId,
                variantId: item.variantId ?? null,
                productNameSnapshot: product.translations[0]?.name ?? product.slug,
                skuSnapshot: variant?.sku ?? product.sku,
                unitPrice: effective,
                quantity: item.quantity,
              };
            }),
          },
          addresses: {
            create: [
              toOrderAddressCreate(dto.shippingAddress, OrderAddressType.SHIPPING),
              toOrderAddressCreate(dto.billingAddress ?? dto.shippingAddress, OrderAddressType.BILLING),
            ],
          },
          statusHistory: {
            create: { status: 'PENDING', note: 'Order created by staff', adminUserId: adminId },
          },
        },
      });

      const authResult = await this.payments.resolve(dto.paymentProvider).authorize(created.id, totalAmount);
      await tx.payment.create({
        data: {
          orderId: created.id,
          provider: dto.paymentProvider,
          status: authResult.status,
          amount: totalAmount,
          transactionRef: authResult.transactionRef,
          rawResponse: (authResult.rawResponse as object) ?? undefined,
        },
      });

      return created;
    });

    this.events.emit(ORDER_CREATED_EVENT, {
      orderId: order.id,
      customerId: dto.customerId ?? null,
    } satisfies OrderCreatedEvent);

    const full = await this.prisma.client.order.findUniqueOrThrow({
      where: { id: order.id },
      include: ORDER_INCLUDE,
    });
    return toOrderDto(full);
  }
}
```

- [ ] **Step 3: Wire the endpoint into `AdminOrdersController`**

Add to the imports:

```typescript
import { AdminOrderCreationService } from './admin-order-creation.service';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
```

Change the constructor to:

```typescript
  constructor(
    private readonly orders: OrdersService,
    private readonly orderCreation: AdminOrderCreationService,
  ) {}
```

Add this method (placed before the existing `@Get(':id')` so the static `POST /` route isn't
shadowed by the dynamic `:id` routes — matches the existing ordering convention in this file):

```typescript
  @Post()
  @RequirePermission('order.create')
  @ApiOkResponse({ type: OrderDto })
  create(
    @Body() dto: CreateManualOrderDto,
    @CurrentAdmin() admin: { id: number },
  ): Promise<OrderDto> {
    return this.orderCreation.create(dto, admin.id);
  }
```

- [ ] **Step 4: Register the service in `orders.module.ts`**

```typescript
import { AdminOrderCreationService } from './admin-order-creation.service';
```

```typescript
  providers: [CheckoutService, OrdersService, AdminOrderCreationService],
```

(`CartModule` and `PaymentsModule` are already in `imports`, so `PricingService`/`PaymentsService`
are already available for injection — no new module import needed.)

- [ ] **Step 5: Typecheck**

Run: `cd "H:\Amder Project\backend\apps\backend" && npx tsc --noEmit -p .`
Expected: clean, no output.

- [ ] **Step 6: Live-verify via curl**

Using a real admin bearer token and real product ids from the dev DB:

1. Create an order for a **new** phone number (no `customerId`), one product line, `paymentProvider: "COD"`:
   ```
   curl -s -X POST http://localhost:3000/admin/orders \
     -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
     -d '{"shippingAddress":{"recipientName":"Test Staff Order","phone":"01700000099","division":"Dhaka","district":"Dhaka","addressLine":"Test address"},"items":[{"productId":<real id>,"quantity":1}],"paymentProvider":"COD"}'
   ```
   Expected: 200 with a real `OrderDto`. Then `SELECT * FROM customers WHERE phone='01700000099'` —
   confirm a new `Customer` row was auto-created (proves the `ORDER_CREATED_EVENT` → listener path
   fired correctly for a manual order, same as it does for a real guest checkout).
2. Repeat with `unitPrice` set lower than the product's real price on that line — confirm the
   returned order's `discountAmount`/`totalAmount` reflect the override correctly.
3. Clean up: delete the test order (and its items/addresses/payment/status-history via cascade) and
   the auto-created test customer, confirm via follow-up `SELECT`s returning 0 rows.

---

### Task 3: Regenerate admin API types

**Files:**
- Modify (generated): `apps/admin/src/lib/api/schema.d.ts`

**Interfaces:**
- Produces (used by Task 4): `components["schemas"]["CreateManualOrderDto"]`,
  `components["schemas"]["ManualOrderItemDto"]` available in the generated types.

- [ ] **Step 1: Run typegen**

Run: `cd "H:\Amder Project\backend\apps\admin" && npm run typegen`
Expected: completes without error; `schema.d.ts` is rewritten.

- [ ] **Step 2: Confirm the new types landed**

Search `apps/admin/src/lib/api/schema.d.ts` for `CreateManualOrderDto` and `ManualOrderItemDto` —
both must be present as generated interfaces. No manual edits to this file.

---

### Task 4: Frontend hooks — `useCreateManualOrder`, `useProductSearch`

**Files:**
- Modify: `apps/admin/src/hooks/useOrders.ts`
- Modify: `apps/admin/src/hooks/useProducts.ts`

**Interfaces:**
- Consumes (from Task 3): `components["schemas"]["CreateManualOrderDto"]` shape (customerId?,
  shippingAddress, billingAddress?, items, paymentProvider, customerNote?) — matches the backend
  `CreateManualOrderDto`/`ManualOrderItemDto`/`CheckoutAddressDto` field names exactly.
- Produces (used by Task 5): `useCreateManualOrder()` → a `useMutation` whose `mutateAsync(input)`
  posts to `/admin/orders` and resolves to `AdminOrder` (existing type, has `.id`).
  `useProductSearch(q: string)` → a `useQuery` resolving to `AdminProduct[]` (existing type, has
  `.id`, `.slug`, `.sku`, `.price`, `.salePrice`, `.hasVariants`, `.translations[].name`,
  `.variants[]` with `.id`/`.sku`/`.price`/`.salePrice`).

- [ ] **Step 1: Add `useCreateManualOrder` to `useOrders.ts`**

Add this type and hook (after the existing `useRefundOrder`):

```typescript
export interface CreateManualOrderAddress {
  recipientName: string;
  phone: string;
  email?: string;
  division: string;
  district: string;
  area?: string;
  landmark?: string;
  addressLine: string;
  postCode?: string;
}

export interface CreateManualOrderInput {
  customerId?: number;
  shippingAddress: CreateManualOrderAddress;
  billingAddress?: CreateManualOrderAddress;
  items: { productId: number; variantId?: number; quantity: number; unitPrice?: number }[];
  paymentProvider: "COD" | "BKASH" | "NAGAD" | "ROCKET" | "UPAY";
  customerNote?: string;
}

export function useCreateManualOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateManualOrderInput) =>
      proxyFetch<AdminOrder>("/admin/orders", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
```

- [ ] **Step 2: Add `useProductSearch` to `useProducts.ts`**

Add this hook (after the existing `useProducts`):

```typescript
export function useProductSearch(q: string) {
  return useQuery({
    queryKey: [...KEY, "search", q],
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminProduct>>(`/admin/products?pageSize=20&q=${encodeURIComponent(q)}`);
      return res.items ?? [];
    },
    enabled: q.trim().length > 0,
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `cd "H:\Amder Project\backend\apps\admin" && npx tsc --noEmit -p .`
Expected: clean, no output.

---

### Task 5: `/orders/new` page + nav entry

**Files:**
- Modify: `apps/admin/src/lib/nav-config.tsx`
- Create: `apps/admin/src/app/(shell)/orders/new/page.tsx`

**Interfaces:**
- Consumes (existing, from the Customer Panel): `useCustomers({ q?, pageSize? })` from
  `@/hooks/useCustomers` → `{ items: AdminCustomerListItem[]; total: number }` where each item has
  `.id`, `.name`, `.phone`, `.completedOrderCount`, `.tier`. `useCustomer(id)` →  `AdminCustomer`
  with the same fields plus `.dob`/`.createdAt`/`.orders`/`.notes`.
- Consumes (from Task 4): `useProductSearch(q)`, `useCreateManualOrder()`, `CreateManualOrderInput`.
- Produces: the `/orders/new` route, reachable from the nav and from `?customerId=` deep links
  (used by Task 6).

- [ ] **Step 1: Add the nav entry**

In `apps/admin/src/lib/nav-config.tsx`, add near the other icon constants:

```typescript
const newOrderIcon = <Icon name="add_shopping_cart" />;
```

And add this row to `adminNav` immediately after the existing `orders` row:

```typescript
  { key: "orders", label: "Orders", href: "/orders", icon: ordersIcon },
  { key: "new-order", label: "New Order", href: "/orders/new", icon: newOrderIcon },
```

- [ ] **Step 2: Write the page**

`apps/admin/src/app/(shell)/orders/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import { useCustomer, useCustomers } from "@/hooks/useCustomers";
import { useProductSearch } from "@/hooks/useProducts";
import { useCreateManualOrder, type CreateManualOrderAddress } from "@/hooks/useOrders";

const newOrderIcon = <Icon name="add_shopping_cart" />;

const EMPTY_ADDRESS: CreateManualOrderAddress = {
  recipientName: "",
  phone: "",
  email: "",
  division: "",
  district: "",
  area: "",
  landmark: "",
  addressLine: "",
  postCode: "",
};

type Line = { productId: number; variantId?: number; name: string; sku: string | null; quantity: number; unitPrice: number };

const PAYMENT_PROVIDERS = ["COD", "BKASH", "NAGAD", "ROCKET", "UPAY"] as const;

function AddressFields({ value, onChange }: { value: CreateManualOrderAddress; onChange: (a: CreateManualOrderAddress) => void }) {
  function set(key: keyof CreateManualOrderAddress, v: string) {
    onChange({ ...value, [key]: v });
  }
  const cls = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
  return (
    <div className="grid grid-cols-2 gap-3">
      <input value={value.recipientName} onChange={(e) => set("recipientName", e.target.value)} placeholder="Recipient name" className={cls} />
      <input value={value.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone" className={cls} />
      <input value={value.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="Email (optional)" className={cls} />
      <input value={value.division} onChange={(e) => set("division", e.target.value)} placeholder="Division" className={cls} />
      <input value={value.district} onChange={(e) => set("district", e.target.value)} placeholder="District" className={cls} />
      <input value={value.area ?? ""} onChange={(e) => set("area", e.target.value)} placeholder="Area/Thana (optional)" className={cls} />
      <input value={value.landmark ?? ""} onChange={(e) => set("landmark", e.target.value)} placeholder="Landmark (optional)" className={cls} />
      <input value={value.postCode ?? ""} onChange={(e) => set("postCode", e.target.value)} placeholder="Post code (optional)" className={cls} />
      <input value={value.addressLine} onChange={(e) => set("addressLine", e.target.value)} placeholder="Address line" className={`col-span-2 ${cls}`} />
    </div>
  );
}

export default function NewOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("customerId");
  const { data: preselected } = useCustomer(preselectedId ? Number(preselectedId) : NaN);

  const [customerId, setCustomerId] = useState<number | null>(preselectedId ? Number(preselectedId) : null);
  const [customerQuery, setCustomerQuery] = useState("");
  const { data: customerResults } = useCustomers({ q: customerQuery || undefined, pageSize: 5 });

  const [address, setAddress] = useState<CreateManualOrderAddress>(EMPTY_ADDRESS);
  const [sameBilling, setSameBilling] = useState(true);
  const [billingAddress, setBillingAddress] = useState<CreateManualOrderAddress>(EMPTY_ADDRESS);

  const [productQuery, setProductQuery] = useState("");
  const { data: productResults } = useProductSearch(productQuery);
  const [lines, setLines] = useState<Line[]>([]);

  const [paymentProvider, setPaymentProvider] = useState<(typeof PAYMENT_PROVIDERS)[number]>("COD");
  const [customerNote, setCustomerNote] = useState("");

  const create = useCreateManualOrder();

  const selectedCustomer =
    preselected && preselected.id === customerId ? preselected : customerResults?.items.find((c) => c.id === customerId);

  function selectCustomer(id: number, name: string, phone: string | null) {
    setCustomerId(id);
    setCustomerQuery("");
    setAddress((a) => ({ ...a, recipientName: name, phone: phone ?? a.phone }));
  }

  function addLine(item: { productId: number; variantId?: number; name: string; sku: string | null; price: string | null }) {
    setLines((ls) => {
      const idx = ls.findIndex((l) => l.productId === item.productId && l.variantId === item.variantId);
      if (idx >= 0) {
        const copy = [...ls];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...ls, { productId: item.productId, variantId: item.variantId, name: item.name, sku: item.sku, quantity: 1, unitPrice: Number(item.price ?? 0) }];
    });
    setProductQuery("");
  }

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number) {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  }

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) return;
    const order = await create.mutateAsync({
      customerId: customerId ?? undefined,
      shippingAddress: address,
      billingAddress: sameBilling ? undefined : billingAddress,
      items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice })),
      paymentProvider,
      customerNote: customerNote || undefined,
    });
    router.push(`/orders/${order.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={newOrderIcon} title="New Order" subtitle="Manually create an order for a phone/in-person sale." />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text">Customer</h3>
          {selectedCustomer ? (
            <div className="flex items-center justify-between rounded-sm border border-border bg-surface-2 px-3 py-2">
              <div className="text-sm text-text">
                <div className="font-semibold">{selectedCustomer.name}</div>
                <div className="text-xs text-muted">
                  {selectedCustomer.phone ?? "no phone"} · {selectedCustomer.completedOrderCount} completed orders
                  {selectedCustomer.tier ? ` · ${selectedCustomer.tier}` : ""}
                </div>
              </div>
              <Button type="button" variant="ghost" onClick={() => setCustomerId(null)}>
                Change
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Search by phone or name — leave blank to create a new customer"
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
              {customerQuery.trim() && customerResults && customerResults.items.length > 0 && (
                <div className="flex flex-col gap-1">
                  {customerResults.items.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c.id, c.name, c.phone)}
                      className="rounded-sm border border-border px-3 py-2 text-left text-sm text-text hover:border-brand-500"
                    >
                      {c.name} — {c.phone ?? "no phone"}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted">No match? Fill in the shipping address below — a new customer is created automatically.</p>
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text">Shipping address</h3>
          <AddressFields value={address} onChange={setAddress} />
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={sameBilling} onChange={(e) => setSameBilling(e.target.checked)} />
            Billing address same as shipping
          </label>
          {!sameBilling && (
            <>
              <h3 className="text-sm font-semibold text-text">Billing address</h3>
              <AddressFields value={billingAddress} onChange={setBillingAddress} />
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text">Products</h3>
          <input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Search products by name or SKU…"
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
          {productResults && productResults.length > 0 && (
            <div className="flex flex-col gap-1">
              {productResults.flatMap((p) =>
                p.hasVariants
                  ? p.variants.map((v) => (
                      <button
                        key={`${p.id}-${v.id}`}
                        type="button"
                        onClick={() =>
                          addLine({
                            productId: p.id,
                            variantId: v.id,
                            name: `${p.translations[0]?.name ?? p.slug} — ${v.sku ?? `Variant #${v.id}`}`,
                            sku: v.sku,
                            price: v.salePrice ?? v.price,
                          })
                        }
                        className="rounded-sm border border-border px-3 py-2 text-left text-sm text-text hover:border-brand-500"
                      >
                        {p.translations[0]?.name ?? p.slug} — {v.sku ?? `Variant #${v.id}`} — ৳{v.salePrice ?? v.price ?? "0"}
                      </button>
                    ))
                  : [
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          addLine({
                            productId: p.id,
                            name: p.translations[0]?.name ?? p.slug,
                            sku: p.sku,
                            price: p.salePrice ?? p.price,
                          })
                        }
                        className="rounded-sm border border-border px-3 py-2 text-left text-sm text-text hover:border-brand-500"
                      >
                        {p.translations[0]?.name ?? p.slug} — ৳{p.salePrice ?? p.price ?? "0"} {p.sku ? `(${p.sku})` : ""}
                      </button>,
                    ],
              )}
            </div>
          )}
          {lines.length > 0 && (
            <div className="flex flex-col gap-2">
              {lines.map((l, idx) => (
                <div key={`${l.productId}-${l.variantId ?? "base"}`} className="flex items-center gap-3 rounded-sm border border-border px-3 py-2">
                  <span className="flex-1 text-sm text-text">
                    {l.name}
                    {l.sku ? ` (${l.sku})` : ""}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => updateLine(idx, { quantity: Math.max(1, Number(e.target.value)) })}
                    className="num h-9 w-16 rounded-sm border border-border bg-surface px-2 text-sm text-text"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.unitPrice}
                    onChange={(e) => updateLine(idx, { unitPrice: Math.max(0, Number(e.target.value)) })}
                    className="num h-9 w-24 rounded-sm border border-border bg-surface px-2 text-sm text-text"
                  />
                  <Button type="button" variant="ghost" onClick={() => removeLine(idx)}>
                    Remove
                  </Button>
                </div>
              ))}
              <p className="num text-right text-sm font-semibold text-text">Total: ৳{total.toFixed(2)}</p>
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text">Payment</h3>
          <div className="flex flex-wrap gap-4">
            {PAYMENT_PROVIDERS.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm text-text">
                <input type="radio" name="paymentProvider" checked={paymentProvider === p} onChange={() => setPaymentProvider(p)} />
                {p}
              </label>
            ))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Note (optional)</span>
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              rows={2}
              className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
        </Card>

        {create.error && <p className="text-sm text-danger">{create.error instanceof Error ? create.error.message : "Failed to create order"}</p>}

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending || lines.length === 0}>
            {create.isPending ? "Creating…" : "Create order"}
          </Button>
          <Link href="/orders">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd "H:\Amder Project\backend\apps\admin" && npx tsc --noEmit -p .`
Expected: clean, no output.

- [ ] **Step 4: Live-verify via Playwright**

Navigate to `http://localhost:3004/orders/new`. Confirm the "New Order" nav row appears in the
sidebar. Search for a real existing customer by phone, confirm the match card appears and clicking
it locks in that customer. Search for a real product, confirm it appears in results and clicking it
adds a line with the real price pre-filled. Change the quantity and the price, confirm the "Total"
updates live. Fill in a disposable shipping address, select COD, submit. Confirm redirect to
`/orders/<new id>` and that the created order's detail page shows the right customer/items/total.
Clean up the test order in the DB afterward (same cleanup discipline as Task 2's curl test).

---

### Task 6: "New Order" button on the Customer Panel

**Files:**
- Modify: `apps/admin/src/components/CustomerDetailModal.tsx`
- Modify: `apps/admin/src/app/(shell)/customers/[id]/page.tsx`

**Interfaces:**
- Consumes: the `/orders/new?customerId=` route from Task 5 (already reads that query param).

- [ ] **Step 1: Add the button to `CustomerDetailModal.tsx`**

In the footer `<div className="flex justify-end gap-3 border-t border-border pt-4">`, add a "New
Order" link/button before the existing Close/Edit buttons:

```tsx
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Link href={`/orders/new?customerId=${customerId}`}>
              <Button type="button" variant="ghost">
                New Order
              </Button>
            </Link>
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Link href={`/customers/${customerId}`}>
              <Button type="button" variant="primary">
                Edit →
              </Button>
            </Link>
          </div>
```

(`Link` is already imported in this file.)

- [ ] **Step 2: Add the button to `/customers/[id]/page.tsx`**

Change the existing header block:

```tsx
      <PageHeader
        icon={customerIcon}
        title={customer.name}
        subtitle={`${customer.phone ?? "no phone"} · ${customer.email ?? "no email"}`}
        badge={customer.tier ?? undefined}
      />
```

to:

```tsx
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          icon={customerIcon}
          title={customer.name}
          subtitle={`${customer.phone ?? "no phone"} · ${customer.email ?? "no email"}`}
          badge={customer.tier ?? undefined}
        />
        <Link href={`/orders/new?customerId=${customer.id}`}>
          <Button type="button" variant="primary">
            New Order
          </Button>
        </Link>
      </div>
```

(`Link` and `Button` are already imported in this file.)

- [ ] **Step 3: Typecheck**

Run: `cd "H:\Amder Project\backend\apps\admin" && npx tsc --noEmit -p .`
Expected: clean, no output.

- [ ] **Step 4: Live-verify via Playwright**

Open a real customer's detail modal from `/customers`, confirm the "New Order" button appears and
navigates to `/orders/new?customerId=<id>` with that customer already selected and locked. Repeat
from the `/customers/[id]` full profile page's header button.

---

### Task 7: Full end-to-end verification pass

**Files:** none (verification only, run directly — not delegated to an implementer subagent, same
as the Customer Panel plan's final Task 13).

- [ ] **Step 1: Manual order for an existing customer**

Pick a real existing customer with a known phone number. Create a manual order for them through the
real `/orders/new` UI, selecting them via search (not `?customerId=`). Confirm: no duplicate
`Customer` row created, the order appears in that customer's Order History tab, stock decremented
for the ordered product/variant.

- [ ] **Step 2: Manual order for a brand-new phone number**

Through the UI, create a manual order with a phone number that matches no existing customer. Confirm
a new `Customer` row is auto-created (same `CustomerOrderEventListener` path real guest checkout
orders use), with the right name/phone taken from the address fields.

- [ ] **Step 3: Price override correctness**

Create a manual order with one line's price manually lowered below the product's real price. Confirm
the resulting order's `subTotal`/`discountAmount`/`totalAmount` are computed correctly (subTotal at
real price, discountAmount = the difference, totalAmount = the overridden total).

- [ ] **Step 4: Stock conflict**

Attempt to order a quantity exceeding available stock for a non-backorder product/variant. Confirm a
clean error is shown in the UI (the 409 from `reserveStock`) and no partial order is created (check
the DB — no new `Order` row, stock unchanged).

- [ ] **Step 5: Tier recompute via a manual order**

Mark one of the test orders from Step 1/2 as `COMPLETED` via the existing admin order-status
endpoint. Confirm `completedOrderCount`/tier on that customer updates exactly as it does for
storefront orders — this proves the manual-order path feeds `ORDER_STATUS_CHANGED_EVENT` →
`CustomerOrderEventListener.onOrderStatusChanged` identically (already proven for storefront orders
in the Customer Panel's Task 13; this step confirms the manual path shares the same wiring).

- [ ] **Step 6: Full typecheck**

Run: `cd "H:\Amder Project\backend" && pnpm -r exec tsc --noEmit` (or run it separately for
`apps/backend` and `apps/admin` if the monorepo script isn't set up for a single combined run).
Expected: clean across both apps.

- [ ] **Step 7: Clean up all test data**

Delete every test order (and its cascaded items/addresses/payments/status-history), every
auto-created test customer, from Steps 1-5. Confirm via follow-up `SELECT`s that each returns 0
rows. Never touch real customer/order data created outside this verification pass.

- [ ] **Step 8: Update the progress ledger**

Append a new dated section to `docs/superpowers/plans/2026-07-18-customer-panel-progress.md` (or a
new `docs/superpowers/plans/2026-07-18-new-order-panel-progress.md`, implementer/reviewer's call)
recording each task's status and any findings, following the same no-git ledger format already
established for the Customer Panel work.
