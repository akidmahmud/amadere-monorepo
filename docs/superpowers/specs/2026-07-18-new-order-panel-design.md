# New Order Panel — Design Spec

**Status:** Approved by user, ready for implementation planning.
**Follows on from:** `docs/superpowers/specs/2026-07-18-customer-panel-design.md` (shipped) — this is the
"New Order Panel" item that spec explicitly deferred as a separate future spec.

## Goal

Give staff (sales/support agents taking phone orders) a real admin screen to manually create an
order — selecting or creating a customer, adding product lines with an optional price override,
entering a shipping address, and picking a payment method — without going through the storefront
cart/checkout flow. The order must integrate with the existing Customer Panel exactly the way a
real storefront order does: auto-create/match the customer by phone, keep `completedOrderCount`
and tier accurate, and show up in that customer's order history.

## Non-goals (explicitly out of scope for this spec)

- Coupon codes / gift vouchers on manually-created orders. The per-line manual price override
  already covers ad-hoc phone-negotiated discounts; coupon/voucher redemption tracking adds real
  complexity for a case phone staff don't typically use. Can be added later if this turns out wrong.
- Fraud scoring, Blocker Manager rules, and COD-OTP verification. These exist to catch bots/fake
  storefront submissions; they don't apply when a staff member is directly on the phone with a
  verified customer.
- The store-wide "always-on" advance-payment requirement (Net Profit Payments feature). Same
  reasoning — that gate exists for storefront risk mitigation, not staff-initiated orders.
- A delivery-charge field. The existing `Order` schema has no such field today (checkout doesn't
  either) — not introducing one here keeps this consistent with the rest of the codebase.

## Architecture

A new manual-order-creation path that reuses existing infrastructure rather than duplicating it:

- **Stock reservation**: `CheckoutService`'s private `reserveStock()` method is extracted into a
  shared `apps/backend/src/modules/orders/stock-reservation.util.ts` (a plain exported function
  taking a `Prisma.TransactionClient`, `productId`, `variantId`, `quantity` — identical body to
  today's private method, just made reusable). Both `CheckoutService` and the new service call it.
  Real stock is reserved for manual orders exactly as it is for storefront ones — no overselling.
- **Customer auto-match/create**: the new service does **not** duplicate the phone-matching logic
  that already exists for storefront guest orders. It emits the same `ORDER_CREATED_EVENT` that
  `CheckoutService.checkout()` emits today, with `customerId` set to whatever the staff member
  selected (or `null` if they only typed a phone number with no match). The existing
  `CustomerOrderEventListener.onOrderCreated` (built for the Customer Panel, unchanged) handles the
  rest: if `customerId` is already set, it's a no-op; if `null`, it upserts a `Customer` by phone
  from the order's shipping address, exactly like a real guest checkout. Zero changes needed to
  that listener.
- **No fraud/blocker/OTP evaluation.** The new service does not call `FraudService`,
  `BlockerService`, `OtpSecurityService`, or `AdvancePaymentService` — those are storefront-only
  concerns per the Non-goals above.
- **Payment authorization**: reuses `PaymentsService.resolve(provider).authorize()` exactly as
  checkout does. For COD and the manual-wallet providers (bKash/Nagad/Rocket/Upay) this creates a
  `PENDING` `Payment` row; trx-id capture for wallet methods continues to happen through the
  existing manual-payment-verification screen (`/admin/net-profit/payments/manual`), unchanged.
- **Order lifecycle after creation** is identical to any other order — same status transitions,
  same courier/shipment flow, same profit computation, same tier recompute on COMPLETED (via the
  existing `ORDER_STATUS_CHANGED_EVENT` → `CustomerOrderEventListener.onOrderStatusChanged` path).

## Backend

### Permission

Add `perm('order', 'create')` to `packages/shared/src/permission-catalog.ts`, alongside the
existing `order.view` / `order.update` / `order.refund`.

### `stock-reservation.util.ts` (new file)

```typescript
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@amader/db';

// Atomic hold: only succeeds if enough stock is actually available, so
// concurrent order creation (storefront checkout or admin manual order)
// can never oversell. Extracted from CheckoutService so both call sites
// share one implementation.
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

`CheckoutService.reserveStock` is deleted; its two call sites (`checkout()`) call the imported
`reserveStock(tx, ...)` instead. No behavior change to storefront checkout.

### DTOs (new: `apps/backend/src/modules/orders/dto/create-manual-order.dto.ts`)

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

  @ApiPropertyOptional({ description: 'Overrides the product\'s real price for this line if set' })
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

`items` must be non-empty — enforced by `@ArrayNotEmpty()` on the DTO (above), so an empty array is
rejected as a 400 before the service method is even called.

### `AdminOrderCreationService` (new file, `admin-order-creation.service.ts`, in `modules/orders/`)

Constructor deps: `PrismaService`, `PaymentsService`, `EventEmitter2`. Single public method:

```typescript
async create(dto: CreateManualOrderDto, adminId: number): Promise<OrderDto>
```

Logic:
1. Reject if `dto.items.length === 0` (`BadRequestException`).
2. Load each `Product` (+ `ProductVariant` if `variantId` set) via `findUniqueOrThrow`, catching
   the not-found case as a `BadRequestException` naming the missing product — staff-facing errors
   need to be clear, this is a manual entry form, not a trusted internal call.
3. Resolve each line's real unit price (variant price if present, else product price) and the
   effective price (`item.unitPrice ?? realPrice`).
4. `subTotal` = Σ(realPrice × qty), `totalAmount` = Σ(effectivePrice × qty),
   `discountAmount` = `max(0, subTotal - totalAmount)`.
5. `$transaction`: reserve stock per line (via the shared util), generate an order number (same
   `generateOrderNumber()` pattern as checkout — `ORD-YYYYMMDD-<hex>`), create the `Order` with
   `customerId: dto.customerId ?? null`, `items`, `addresses` (shipping + billing-or-shipping),
   and a `statusHistory` entry `{ status: 'PENDING', note: 'Order created by staff' }`. Create the
   `Payment` row via `payments.resolve(dto.paymentProvider).authorize(order.id, totalAmount)`,
   same as checkout.
6. After the transaction commits, emit `ORDER_CREATED_EVENT` with
   `{ orderId: order.id, customerId: dto.customerId ?? null }`.
7. Return `toOrderDto(...)` via the existing `ORDER_INCLUDE` mapper (same as
   `CheckoutService.getByIdInternal`).

No fraud/blocker/OTP/advance-payment calls anywhere in this path (Non-goals above).

### Endpoint

Add to `AdminOrdersController`:

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

`AdminOrderCreationService` is injected alongside the existing `OrdersService`. Registered in
`orders.module.ts` (already imports `CustomersModule`; no new cross-module dependency needed since
this new service only talks to Prisma/Payments/EventEmitter, all already available there).

### Product search for the picker

No new backend endpoint needed — the existing `GET /admin/products` (`AdminProductsController`,
paginated, filterable) already supports the search-and-list the frontend product picker needs.

## Frontend (`apps/admin`)

### Nav

`nav-config.tsx`: add `{ key: "new-order", label: "New Order", href: "/orders/new", icon: newOrderIcon }`
as a new top-level flat entry, placed right after the existing `orders` row (`newOrderIcon` = a new
`<Icon name="add_shopping_cart" />` constant).

### Page: `apps/admin/src/app/(shell)/orders/new/page.tsx`

Single-page form (not a wizard — the whole thing is short enough to fit on one screen, matching
this app's existing pattern of single-page create forms like `/products/new`), reading an optional
`?customerId=` query param to preselect a customer. Sections top-to-bottom:

1. **Customer** — phone input with debounced search against `GET /admin/customers?q=<phone>`
   (existing endpoint from the Customer Panel). A match shows a small card (name/tier/completed
   orders) with a "use this customer" confirm; typing a name instead searches the same way. No
   match → the name/address fields below are simply filled in directly and a new customer is
   created on submit (no separate "create customer" step). If `?customerId=` was present, this
   section starts pre-filled and locked to that customer (with an "change customer" escape hatch).
2. **Shipping address** — recipientName, phone, email (optional), division, district, area
   (optional), landmark (optional), addressLine, postCode (optional) — same flat fields as
   `CheckoutAddressDto`, pre-filled from the matched customer's last order address if available.
   A "billing address same as shipping" checkbox (checked by default) toggles a second identical
   block.
3. **Products** — a search-and-add row (queries `GET /admin/products?q=`), each added line shows
   name/SKU, a quantity stepper, and an editable unit-price field (defaults to the product's real
   price, editable). Running subtotal/discount/total shown live, computed client-side with the
   same formula the backend uses (backend is the source of truth on submit; client total is just
   for staff feedback).
4. **Payment method** — a radio group: COD / bKash / Nagad / Rocket / Upay.
5. **Customer note** (optional textarea).

Submit → `POST /admin/orders` via a new `useCreateManualOrder()` hook in `useOrders.ts` (or
`useCustomers.ts` if that file already centralizes order-adjacent hooks — implementer's call,
follow whichever hook file already owns order mutations) → on success, redirect to
`/orders/[id]` (the existing order detail page) so staff immediately sees the created order.

### "New Order" button placements

- `CustomerDetailModal.tsx`: add a "New Order" button next to "Edit →", linking to
  `/orders/new?customerId={customerId}`.
- `apps/admin/src/app/(shell)/customers/[id]/page.tsx`: same button near the page header.

## Error handling

- Missing/invalid product or variant id → `BadRequestException` naming the product, shown as a
  form-level error (not silently dropped).
- Insufficient stock → the existing `ConflictException` from `reserveStock` surfaces as a
  form-level "not enough stock for X" error; the transaction rolls back, nothing is created.
- Network/validation errors on submit use the same toast/inline-error pattern already used by
  other admin create forms (e.g. `/products/new`) — no new error-UI pattern introduced.

## Testing / verification plan

Live, against the real dev DB, using real API calls — no direct SQL inserts, all test data cleaned
up afterward (matching this project's established discipline):

1. Create a manual order for an **existing** customer (selected via search) — confirm no duplicate
   `Customer` row is created, the order appears in that customer's Order History tab, stock
   decremented correctly.
2. Create a manual order for a **brand-new phone number** — confirm a new `Customer` row is
   auto-created via the same event-listener path storefront guest orders use, with the right
   name/phone from the address.
3. Create a line with a manual price override lower than the real product price — confirm
   `subTotal`/`discountAmount`/`totalAmount` on the resulting order are computed correctly.
4. Attempt to over-order a low-stock/no-backorder product — confirm a clean 409 with no partial
   order created.
5. Mark one of the test orders COMPLETED via the existing admin status-update endpoint — confirm
   `completedOrderCount`/tier recompute fires exactly as it does for storefront orders (already
   proven in Customer Panel Task 13; this just confirms the manual-order path feeds the same
   event).
6. `pnpm -r exec tsc --noEmit` clean on both `apps/backend` and `apps/admin`.
7. Clean up all test orders/customers/payments created during verification, confirmed via
   follow-up queries returning 0 rows — never touching real customer/order data.
