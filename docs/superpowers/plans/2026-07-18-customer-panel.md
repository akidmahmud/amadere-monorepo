# Customer Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, working Customer Panel admin module — automatic
customer creation/matching from orders, an admin-configurable loyalty tier
system, notes/feedback, call logs, a computed activity timeline, CSV import,
and a stubbed "Call" button — as its own top-level admin sidebar section
styled with Net Profit's violet/dark design system.

**Architecture:** Backend follows the existing NestJS module conventions
exactly (admin controller + service + Prisma, deferred-provider pattern for
the call integration, `EventEmitter2`-based decoupling from
checkout/order-status flows — no changes to `checkout.service.ts` or
`orders.service.ts` needed at all, since both already emit the events this
plugs into). Frontend follows the existing Next.js admin app conventions
(`@amader/admin-ui` components, `proxyFetch`, React Query hooks, a
`(shell)/customers/*` route tree wrapped in `.wpfok-scope`).

**Tech Stack:** NestJS, Prisma, PostgreSQL, Next.js (App Router), React
Query, `@amader/admin-ui`, `@nestjs/event-emitter`.

## Global Constraints

- **No git operations of any kind** — this project has a standing rule to
  never run `git commit`, `git add`, or any other git command. Every task
  below ends at local-file-verification, not a commit step.
- **No automated test suite exists in this codebase** (`apps/backend/src`
  has zero `.spec.ts` files) — the established verification convention
  project-wide is: real API calls (curl) + real admin UI checks (Playwright)
  + cleanup of any test data created. Every task's verification step follows
  this convention instead of jest/TDD steps.
- Every new admin endpoint requires `AdminJwtGuard` + `PermissionGuard`,
  matching every existing admin controller.
- New permission keys must be added to
  `packages/shared/src/permission-catalog.ts` and picked up by re-running
  `packages/db/prisma/seed.ts` (idempotent — safe to re-run against the live
  dev DB).
- Currency/money-like fields aren't relevant to this module — no new
  `Decimal` handling needed.
- Match existing naming: `Admin*Controller`, `*Service`, `*.mapper.ts`,
  `use*` hooks, `proxyFetch`, kebab-case file names.

---

## Task 1: Schema — CustomerTier, CustomerNote, CustomerCallLog

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `packages/db/prisma/seed.ts`
- Modify: `packages/shared/src/permission-catalog.ts`

**Interfaces:**
- Produces: `CustomerTier` model (`id`, `label`, `minCompletedOrders`
  unique, `sortOrder`), `Customer.completedOrderCount`, `Customer.tierId`,
  `CustomerNoteType` enum, `CustomerNote` model, `CallOutcome` enum,
  `CustomerCallLog` model. These are the types every later backend task
  imports from `@amader/db`.

- [ ] **Step 1: Add the new models to the schema**

In `packages/db/prisma/schema.prisma`, find the `Customer` model (starts at
line 232) and add these two fields right after `legacyId`:

```prisma
  completedOrderCount Int      @default(0) @map("completed_order_count")
  tierId               Int?     @map("tier_id")
```

Add `tier CustomerTier? @relation(fields: [tierId], references: [id])` and
`notes CustomerNote[]` and `callLogs CustomerCallLog[]` to the relations
block (after `wishlistItems  WishlistItem[]`):

```prisma
  tier           CustomerTier?        @relation(fields: [tierId], references: [id])
  notes          CustomerNote[]
  callLogs       CustomerCallLog[]
```

Now add these new models directly after the `Customer` model (before
`model CustomerAddress {`):

```prisma
// Admin-configurable loyalty tiers (thresholds and labels editable via
// /admin/customer-tiers — not a hardcoded enum, so adding/renaming tiers
// never needs a migration). "Current tier" = the row with the highest
// minCompletedOrders that a customer's completedOrderCount meets or exceeds.
model CustomerTier {
  id                 Int      @id @default(autoincrement())
  label              String
  minCompletedOrders Int      @unique @map("min_completed_orders")
  sortOrder          Int      @default(0) @map("sort_order")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  customers Customer[]

  @@map("customer_tiers")
}

enum CustomerNoteType {
  CUSTOMER_FEEDBACK
  INTERNAL_NOTE
  REMARK
}

// Append-only — no edit/delete in this phase. Covers customer feedback,
// internal sales-team notes, and follow-up remarks in one type-tagged model.
model CustomerNote {
  id            Int              @id @default(autoincrement())
  customerId    Int              @map("customer_id")
  type          CustomerNoteType
  body          String
  authorAdminId Int              @map("author_admin_id")
  createdAt     DateTime         @default(now()) @map("created_at")

  customer Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  author   AdminUser @relation(fields: [authorAdminId], references: [id])

  @@map("customer_notes")
}

enum CallOutcome {
  CONNECTED
  NO_ANSWER
  VOICEMAIL
  WRONG_NUMBER
  DECLINED
}

// Logged manually by the agent after a call. providerCallId stays null
// until a real CallProvider exists (see Task 4).
model CustomerCallLog {
  id             Int         @id @default(autoincrement())
  customerId     Int         @map("customer_id")
  phoneCalled    String      @map("phone_called")
  outcome        CallOutcome
  notes          String?
  authorAdminId  Int         @map("author_admin_id")
  providerCallId String?     @map("provider_call_id")
  createdAt      DateTime    @default(now()) @map("created_at")

  customer Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  author   AdminUser @relation(fields: [authorAdminId], references: [id])

  @@map("customer_call_logs")
}
```

Find the `AdminUser` model (line 132) and add these two lines to its
relations block (after `blogPosts    BlogPost[]`):

```prisma
  customerNotes    CustomerNote[]
  customerCallLogs CustomerCallLog[]
```

- [ ] **Step 2: Run the migration**

```bash
cd "H:\Amder Project\backend\packages\db"
npx prisma migrate dev --name add_customer_panel
npm run build
```

Expected: migration applies cleanly, `npm run build` ends with
`✔ Generated Prisma Client`.

- [ ] **Step 3: Seed the 4 default tiers**

In `packages/db/prisma/seed.ts`, add this block right after the permission
seeding loop (after the closing `}` of the `for (const permission of
PERMISSION_CATALOG)` loop, before `console.log('Seeding Super Admin
role...')`):

```typescript
  console.log('Seeding default customer tiers...');
  const defaultTiers = [
    { label: 'Group B', minCompletedOrders: 2, sortOrder: 1 },
    { label: 'Group A', minCompletedOrders: 3, sortOrder: 2 },
    { label: 'Gold', minCompletedOrders: 5, sortOrder: 3 },
    { label: 'Platinum', minCompletedOrders: 7, sortOrder: 4 },
  ];
  for (const tier of defaultTiers) {
    await prisma.customerTier.upsert({
      where: { minCompletedOrders: tier.minCompletedOrders },
      create: tier,
      update: { label: tier.label, sortOrder: tier.sortOrder },
    });
  }
```

- [ ] **Step 4: Add permission catalog entries**

In `packages/shared/src/permission-catalog.ts`, add these two lines at the
end of the `PERMISSION_CATALOG` array (right before the closing `];`):

```typescript
  perm('customer', 'view'),
  perm('customer', 'manage'),
```

- [ ] **Step 5: Rebuild shared package and re-run seed**

```bash
cd "H:\Amder Project\backend\packages\shared"
npm run build
cd "H:\Amder Project\backend\packages\db"
npx tsx prisma/seed.ts
```

Expected output includes `Seeding default customer tiers...` and
`Seeding 2 permissions...` growing to include `customer.view`/`customer.manage`
in the total count. No errors.

- [ ] **Step 6: Verify via direct query**

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT label, min_completed_orders FROM customer_tiers ORDER BY sort_order;"
```

Expected: 4 rows — Group B/2, Group A/3, Gold/5, Platinum/7.

---

## Task 2: Backend — CustomerTiersService + tier settings endpoint

**Files:**
- Create: `apps/backend/src/modules/customers/customer-tiers.service.ts`
- Create: `apps/backend/src/modules/customers/dto/update-customer-tiers.dto.ts`
- Create: `apps/backend/src/modules/customers/admin-customer-tiers.controller.ts`
- Modify: `apps/backend/src/modules/customers/customers.module.ts`

**Interfaces:**
- Consumes: `Customer`, `CustomerTier` from `@amader/db`; `PrismaService`
  from `../../common/prisma/prisma.service`; `AdminJwtGuard`,
  `PermissionGuard`, `RequirePermission` from `../../common/auth/*`.
- Produces: `CustomerTiersService` with `recomputeForCustomer(customerId:
  number): Promise<void>`, `recomputeAll(): Promise<void>`,
  `list(): Promise<CustomerTierDto[]>`,
  `replace(tiers: UpdateCustomerTiersDto['tiers']): Promise<CustomerTierDto[]>`.
  Task 3's event listener calls `recomputeForCustomer`.

- [ ] **Step 1: Write the DTO**

Create `apps/backend/src/modules/customers/dto/update-customer-tiers.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

export class CustomerTierItemDto {
  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  minCompletedOrders!: number;

  @ApiProperty()
  @IsInt()
  sortOrder!: number;
}

export class UpdateCustomerTiersDto {
  @ApiProperty({ type: [CustomerTierItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerTierItemDto)
  tiers!: CustomerTierItemDto[];
}
```

- [ ] **Step 2: Write CustomerTiersService**

Create `apps/backend/src/modules/customers/customer-tiers.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateCustomerTiersDto } from './dto/update-customer-tiers.dto';

export class CustomerTierDto {
  id!: number;
  label!: string;
  minCompletedOrders!: number;
  sortOrder!: number;
}

// Tier thresholds are admin-editable (Task 2's endpoint) rather than a
// hardcoded enum — recomputeForCustomer/recomputeAll always read the
// current rows, never a cached list, so an edited threshold takes effect
// immediately for every customer.
@Injectable()
export class CustomerTiersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CustomerTierDto[]> {
    return this.prisma.client.customerTier.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  // Full replace — the settings page always submits the complete tier set.
  // Existing rows not present in the new list are deleted; customers
  // pointing at a deleted tier get recomputed onto whatever tier now fits.
  async replace(tiers: UpdateCustomerTiersDto['tiers']): Promise<CustomerTierDto[]> {
    await this.prisma.client.$transaction(async (tx) => {
      await tx.customerTier.deleteMany({});
      await tx.customerTier.createMany({ data: tiers });
    });
    await this.recomputeAll();
    return this.list();
  }

  async recomputeForCustomer(customerId: number): Promise<void> {
    const completedOrderCount = await this.prisma.client.order.count({
      where: { customerId, status: 'COMPLETED' },
    });
    const tiers = await this.prisma.client.customerTier.findMany({
      orderBy: { minCompletedOrders: 'desc' },
    });
    const tier = tiers.find((t) => completedOrderCount >= t.minCompletedOrders) ?? null;
    await this.prisma.client.customer.update({
      where: { id: customerId },
      data: { completedOrderCount, tierId: tier?.id ?? null },
    });
  }

  async recomputeAll(): Promise<void> {
    const customers = await this.prisma.client.customer.findMany({ select: { id: true } });
    for (const c of customers) {
      await this.recomputeForCustomer(c.id);
    }
  }
}
```

- [ ] **Step 3: Write the controller**

Create `apps/backend/src/modules/customers/admin-customer-tiers.controller.ts`:

```typescript
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CustomerTiersService, CustomerTierDto } from './customer-tiers.service';
import { UpdateCustomerTiersDto } from './dto/update-customer-tiers.dto';

@ApiTags('admin/customer-tiers')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/customer-tiers')
export class AdminCustomerTiersController {
  constructor(private readonly tiers: CustomerTiersService) {}

  @Get()
  @RequirePermission('customer.view')
  @ApiOkResponse({ type: [CustomerTierDto] })
  list(): Promise<CustomerTierDto[]> {
    return this.tiers.list();
  }

  @Put()
  @RequirePermission('customer.manage')
  @ApiOkResponse({ type: [CustomerTierDto] })
  replace(@Body() dto: UpdateCustomerTiersDto): Promise<CustomerTierDto[]> {
    return this.tiers.replace(dto.tiers);
  }
}
```

- [ ] **Step 4: Wire into the module**

Modify `apps/backend/src/modules/customers/customers.module.ts` to match:

```typescript
import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomerAddressesController } from './customer-addresses.controller';
import { WishlistController } from './wishlist.controller';
import { AdminCustomerTiersController } from './admin-customer-tiers.controller';
import { CustomersService } from './customers.service';
import { WishlistService } from './wishlist.service';
import { CustomerTiersService } from './customer-tiers.service';

@Module({
  controllers: [
    CustomersController,
    CustomerAddressesController,
    WishlistController,
    AdminCustomerTiersController,
  ],
  providers: [CustomersService, WishlistService, CustomerTiersService],
  exports: [CustomerTiersService],
})
export class CustomersModule {}
```

(`CustomerTiersService` is exported because Task 3's event listener, which
lives in this same module, needs it — and because `OrdersModule` will need
it indirectly once it imports `CustomersModule` in Task 3.)

- [ ] **Step 5: Typecheck**

```bash
cd "H:\Amder Project\backend\apps\backend"
npx tsc --noEmit -p .
```

Expected: no output (clean).

- [ ] **Step 6: Verify live**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/admin/auth/login -H "Content-Type: application/json" -d '{"email":"admin@amadere.com","password":"ChangeMe123!"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.accessToken))")
curl -s http://localhost:3000/api/v1/admin/customer-tiers -H "Authorization: Bearer $TOKEN"
```

Expected: JSON array of 4 tiers (Group B, Group A, Gold, Platinum), each
with `id`, `label`, `minCompletedOrders`, `sortOrder`.

---

## Task 3: Backend — auto-matching + tier recompute event listener

**Files:**
- Create: `apps/backend/src/modules/customers/customer-order-event.listener.ts`
- Modify: `apps/backend/src/modules/customers/customers.module.ts`
- Modify: `apps/backend/src/modules/orders/orders.module.ts`

**Interfaces:**
- Consumes: `ORDER_CREATED_EVENT`, `ORDER_STATUS_CHANGED_EVENT`,
  `OrderCreatedEvent`, `OrderStatusChangedEvent` from
  `../orders/orders.events`; `CustomerTiersService.recomputeForCustomer`
  from Task 2.
- Produces: nothing new consumed elsewhere — this is a terminal listener,
  the actual behavior the whole feature's auto-linking/tiering promise
  rests on.

- [ ] **Step 1: Write the listener**

Create `apps/backend/src/modules/customers/customer-order-event.listener.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CustomerTiersService } from './customer-tiers.service';
import {
  ORDER_CREATED_EVENT,
  ORDER_STATUS_CHANGED_EVENT,
} from '../orders/orders.events';
import type {
  OrderCreatedEvent,
  OrderStatusChangedEvent,
} from '../orders/orders.events';

// Same "subscribe to existing domain events" shape as SmsEventListener —
// zero changes needed to checkout.service.ts or orders.service.ts, both of
// which already emit exactly what this needs.
@Injectable()
export class CustomerOrderEventListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tiers: CustomerTiersService,
  ) {}

  // Every order (guest or logged-in) ends up linked to a Customer. If the
  // checkout was already made by a logged-in customer, event.customerId is
  // already set — nothing to do. Otherwise, match by phone or create a new
  // Customer (no password, same as existing OTP/social-only accounts).
  @OnEvent(ORDER_CREATED_EVENT)
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    if (event.customerId) return;

    const order = await this.prisma.client.order.findUnique({
      where: { id: event.orderId },
      include: { addresses: { where: { type: 'SHIPPING' }, take: 1 } },
    });
    const address = order?.addresses[0];
    if (!address?.phone) return;

    const [firstName, ...rest] = address.recipientName.trim().split(/\s+/);
    const customer = await this.prisma.client.customer.upsert({
      where: { phone: address.phone },
      update: {},
      create: {
        phone: address.phone,
        firstName: firstName || address.recipientName,
        lastName: rest.length ? rest.join(' ') : null,
      },
    });

    await this.prisma.client.order.update({
      where: { id: event.orderId },
      data: { customerId: customer.id },
    });
  }

  // Only COMPLETED-related transitions can change a tier, so anything else
  // is a no-op — cheap to check before touching the DB again.
  @OnEvent(ORDER_STATUS_CHANGED_EVENT)
  async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (event.from !== 'COMPLETED' && event.to !== 'COMPLETED') return;

    const order = await this.prisma.client.order.findUnique({
      where: { id: event.orderId },
      select: { customerId: true },
    });
    if (!order?.customerId) return;

    await this.tiers.recomputeForCustomer(order.customerId);
  }
}
```

- [ ] **Step 2: Register the listener as a provider**

Modify `apps/backend/src/modules/customers/customers.module.ts` — add the
import and add it to `providers`:

```typescript
import { CustomerOrderEventListener } from './customer-order-event.listener';
```

```typescript
  providers: [CustomersService, WishlistService, CustomerTiersService, CustomerOrderEventListener],
```

- [ ] **Step 3: Import CustomersModule into OrdersModule**

Modify `apps/backend/src/modules/orders/orders.module.ts` — add the import
and add `CustomersModule` to the `imports` array (same reason `SmsModule` is
already imported there — guarantees the listener module is instantiated):

```typescript
import { CustomersModule } from '../customers/customers.module';
```

```typescript
  imports: [CartModule, PaymentsModule, FraudModule, BlockerModule, AdvancePaymentModule, OtpSecurityModule, SmsModule, CustomersModule],
```

- [ ] **Step 4: Typecheck**

```bash
cd "H:\Amder Project\backend\apps\backend"
npx tsc --noEmit -p .
```

Expected: no output. (If circular-import errors appear, verify
`CustomersModule` does not import `OrdersModule` anywhere — it shouldn't;
the dependency is one-directional.)

- [ ] **Step 5: Verify live — guest checkout auto-creates a Customer**

Restart the backend dev server first so the new listener is loaded (find
and stop the existing `nest start --watch` process, then):

```bash
cd "H:\Amder Project\backend\apps\backend"
nohup npm run dev > "<scratchpad>/backend-dev-customers.log" 2>&1 &
```

Wait for `Nest application successfully started` in the log, then place a
real guest checkout order with a phone that has never been used before
(check `docker exec backend-postgres-1 psql -U amader -d amader_migration -c
"SELECT phone FROM customers WHERE phone = '01711112222';"` returns 0 rows
first). Use the real storefront checkout flow (cart → checkout API) or
directly:

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT id FROM customers WHERE phone = '01711112222';"
```

Expected before: 0 rows. After completing a real checkout with that phone
in the shipping address: 1 row, and
`SELECT customer_id FROM orders WHERE id = <the new order id>;` shows the
same customer id (not null).

- [ ] **Step 6: Verify live — tier recomputes on COMPLETED**

Using an existing test order's id (`ORDER_ID`) linked to the customer from
Step 5, and `TOKEN` from Task 2 Step 6:

```bash
curl -s -X PATCH "http://localhost:3000/api/v1/admin/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"COMPLETED"}'
```

Then:

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT completed_order_count, tier_id FROM customers WHERE phone = '01711112222';"
```

Expected: `completed_order_count = 1`, `tier_id` is `null` (1 completed
order doesn't reach Group B's threshold of 2 — confirms the ladder logic,
not just that a recompute ran at all).

- [ ] **Step 7: Clean up test data**

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "DELETE FROM order_status_history WHERE order_id = $ORDER_ID;" -c "DELETE FROM orders WHERE id = $ORDER_ID;" -c "DELETE FROM customers WHERE phone = '01711112222';"
```

(Only delete the order/customer created for this test — never touch
pre-existing data. Confirm the phone number used is one you created, not a
real customer's.)

---

## Task 4: Backend — phone normalization + deferred CallProvider

**Files:**
- Create: `apps/backend/src/common/phone.util.ts`
- Create: `apps/backend/src/modules/customers/providers/call-provider.interface.ts`
- Create: `apps/backend/src/modules/customers/providers/unconfigured-call-provider.ts`
- Modify: `apps/backend/src/modules/customers/customers.module.ts`

**Interfaces:**
- Produces: `toE164Bd(phone: string): string | null`; `CALL_PROVIDER`
  DI token; `CallProvider` interface with
  `dial(phoneNumber: string, customerId: number): Promise<{ providerCallId: string }>`.
  Task 5's controller injects `CALL_PROVIDER`.

- [ ] **Step 1: Write the phone util**

Create `apps/backend/src/common/phone.util.ts`:

```typescript
// Normalizes any of the common BD phone input shapes (01XXXXXXXXX,
// 8801XXXXXXXXX, +8801XXXXXXXXX) to E.164 for the "Call" button. Returns
// null for anything that isn't a valid 11-digit BD mobile number.
export function toE164Bd(phone: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^1[3-9]\d{8}$/.test(digits)) return null;
  return `+880${digits}`;
}
```

- [ ] **Step 2: Write the CallProvider interface**

Create `apps/backend/src/modules/customers/providers/call-provider.interface.ts`:

```typescript
export const CALL_PROVIDER = Symbol('CALL_PROVIDER');

export interface CallProvider {
  dial(phoneNumber: string, customerId: number): Promise<{ providerCallId: string }>;
}
```

- [ ] **Step 3: Write the unconfigured stub**

Create `apps/backend/src/modules/customers/providers/unconfigured-call-provider.ts`:

```typescript
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CallProvider } from './call-provider.interface';

// Same deferred-provider pattern as UnconfiguredCourierProvider /
// GoogleSocialLoginVerifier's Facebook branch — real telephony API details
// arrive later; this always throws until a real provider replaces it in
// customers.module.ts.
@Injectable()
export class UnconfiguredCallProvider implements CallProvider {
  async dial(): Promise<never> {
    await Promise.resolve();
    throw new ServiceUnavailableException('Calling is not configured yet');
  }
}
```

- [ ] **Step 4: Register the provider**

Modify `apps/backend/src/modules/customers/customers.module.ts` — add the
imports and register the DI-token provider:

```typescript
import { CALL_PROVIDER } from './providers/call-provider.interface';
import { UnconfiguredCallProvider } from './providers/unconfigured-call-provider';
```

```typescript
  providers: [
    CustomersService,
    WishlistService,
    CustomerTiersService,
    CustomerOrderEventListener,
    { provide: CALL_PROVIDER, useClass: UnconfiguredCallProvider },
  ],
```

- [ ] **Step 5: Typecheck**

```bash
cd "H:\Amder Project\backend\apps\backend"
npx tsc --noEmit -p .
```

Expected: no output.

(No standalone runtime verification for this task — `toE164Bd` and
`CALL_PROVIDER` get exercised together with the rest of the admin API in
Task 5's verification.)

---

## Task 5: Backend — AdminCustomersController (list/get/patch/notes/calls/dial)

**Files:**
- Create: `apps/backend/src/modules/customers/admin-customer.mapper.ts`
- Create: `apps/backend/src/modules/customers/dto/update-customer.dto.ts`
- Create: `apps/backend/src/modules/customers/dto/create-customer-note.dto.ts`
- Create: `apps/backend/src/modules/customers/dto/create-customer-call-log.dto.ts`
- Create: `apps/backend/src/modules/customers/dto/admin-customer-query.dto.ts`
- Create: `apps/backend/src/modules/customers/admin-customers.controller.ts`
- Modify: `apps/backend/src/modules/customers/customers.service.ts`
- Modify: `apps/backend/src/modules/customers/customers.module.ts`

**Interfaces:**
- Consumes: `CALL_PROVIDER`/`CallProvider` (Task 4), `toE164Bd` (Task 4),
  `CustomerTierDto` (Task 2), `paginationArgs`/`toPaginatedResult` from
  `../../common/pagination.util`, `PaginatedResult` from `@amader/shared`.
- Produces: `GET/PATCH /admin/customers`, `/admin/customers/:id`,
  `/admin/customers/:id/notes`, `/admin/customers/:id/calls`,
  `/admin/customers/:id/calls/dial` — the core admin API Task 8's frontend
  hooks call directly.

- [ ] **Step 1: Write the DTOs**

Create `apps/backend/src/modules/customers/dto/update-customer.dto.ts`:

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Birthday, ISO date' })
  @IsOptional()
  @IsDateString()
  dob?: string;
}
```

Create `apps/backend/src/modules/customers/dto/create-customer-note.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { CustomerNoteType } from '@amader/db';
import { IsEnum, IsString } from 'class-validator';

export class CreateCustomerNoteDto {
  @ApiProperty({ enum: CustomerNoteType })
  @IsEnum(CustomerNoteType)
  type!: CustomerNoteType;

  @ApiProperty()
  @IsString()
  body!: string;
}
```

Create `apps/backend/src/modules/customers/dto/create-customer-call-log.dto.ts`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CallOutcome } from '@amader/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateCustomerCallLogDto {
  @ApiProperty({ enum: CallOutcome })
  @IsEnum(CallOutcome)
  outcome!: CallOutcome;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
```

Create `apps/backend/src/modules/customers/dto/admin-customer-query.dto.ts`:

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class AdminCustomerQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tierId?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;
}
```

- [ ] **Step 2: Write the mapper**

Create `apps/backend/src/modules/customers/admin-customer.mapper.ts`:

```typescript
import { Prisma } from '@amader/db';

export const ADMIN_CUSTOMER_LIST_INCLUDE = {
  tier: true,
} as const;

export type CustomerWithTier = Prisma.CustomerGetPayload<{
  include: typeof ADMIN_CUSTOMER_LIST_INCLUDE;
}>;

export const ADMIN_CUSTOMER_DETAIL_INCLUDE = {
  tier: true,
  notes: { orderBy: { createdAt: 'desc' as const } },
  callLogs: { orderBy: { createdAt: 'desc' as const } },
  orders: {
    orderBy: { createdAt: 'desc' as const },
    include: { statusHistory: { orderBy: { createdAt: 'asc' as const } } },
  },
} as const;

export type CustomerWithDetail = Prisma.CustomerGetPayload<{
  include: typeof ADMIN_CUSTOMER_DETAIL_INCLUDE;
}>;

export class AdminCustomerListItemDto {
  id!: number;
  name!: string;
  phone!: string | null;
  email!: string | null;
  tier!: string | null;
  completedOrderCount!: number;
  createdAt!: Date;
}

function fullName(c: { firstName: string | null; lastName: string | null }): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || '(no name)';
}

export function toAdminCustomerListItemDto(c: CustomerWithTier): AdminCustomerListItemDto {
  return {
    id: c.id,
    name: fullName(c),
    phone: c.phone,
    email: c.email,
    tier: c.tier?.label ?? null,
    completedOrderCount: c.completedOrderCount,
    createdAt: c.createdAt,
  };
}

export class AdminCustomerNoteDto {
  id!: number;
  type!: string;
  body!: string;
  authorAdminId!: number;
  createdAt!: Date;
}

export class AdminCustomerCallLogDto {
  id!: number;
  phoneCalled!: string;
  outcome!: string;
  notes!: string | null;
  authorAdminId!: number;
  createdAt!: Date;
}

export class AdminCustomerOrderSummaryDto {
  id!: number;
  orderNumber!: string;
  status!: string;
  totalAmount!: string;
  createdAt!: Date;
}

// Internal-only shape used while building the timeline — NOT the DTO field
// type. NestJS Swagger generates schemas from `@ApiProperty()`-decorated
// class fields via reflection; a plain TS union type has no runtime
// metadata to reflect, so it would come out wrong (or missing) in the
// generated OpenAPI doc Task 7's typegen reads from. `AdminCustomerDto.activity`
// below is typed as `Record<string, unknown>[]` instead — same pattern
// already used for other free-form JSON fields in this codebase (e.g.
// `PublicProductDetailDto.structuredData`). The frontend narrows on `.type`
// at render time (see Task 10's ActivityTab).
type ActivityEntry =
  | { type: 'ORDER'; orderId: number; orderNumber: string; status: string; occurredAt: Date }
  | { type: 'NOTE'; noteId: number; noteType: string; body: string; occurredAt: Date }
  | { type: 'CALL'; callId: number; outcome: string; occurredAt: Date };

export class AdminCustomerDto {
  id!: number;
  name!: string;
  phone!: string | null;
  email!: string | null;
  dob!: Date | null;
  tier!: string | null;
  completedOrderCount!: number;
  createdAt!: Date;
  orders!: AdminCustomerOrderSummaryDto[];
  notes!: AdminCustomerNoteDto[];
  callLogs!: AdminCustomerCallLogDto[];
  activity!: Record<string, unknown>[];
}

export function toAdminCustomerDto(c: CustomerWithDetail): AdminCustomerDto {
  const activity: ActivityEntry[] = [
    ...c.orders.flatMap((o) =>
      o.statusHistory.map((h) => ({
        type: 'ORDER' as const,
        orderId: o.id,
        orderNumber: o.orderNumber,
        status: h.status,
        occurredAt: h.createdAt,
      })),
    ),
    ...c.notes.map((n) => ({
      type: 'NOTE' as const,
      noteId: n.id,
      noteType: n.type,
      body: n.body,
      occurredAt: n.createdAt,
    })),
    ...c.callLogs.map((call) => ({
      type: 'CALL' as const,
      callId: call.id,
      outcome: call.outcome,
      occurredAt: call.createdAt,
    })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  return {
    id: c.id,
    name: fullName(c),
    phone: c.phone,
    email: c.email,
    dob: c.dob,
    tier: c.tier?.label ?? null,
    completedOrderCount: c.completedOrderCount,
    createdAt: c.createdAt,
    orders: c.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalAmount: o.totalAmount.toString(),
      createdAt: o.createdAt,
    })),
    notes: c.notes.map((n) => ({
      id: n.id,
      type: n.type,
      body: n.body,
      authorAdminId: n.authorAdminId,
      createdAt: n.createdAt,
    })),
    callLogs: c.callLogs.map((call) => ({
      id: call.id,
      phoneCalled: call.phoneCalled,
      outcome: call.outcome,
      notes: call.notes,
      authorAdminId: call.authorAdminId,
      createdAt: call.createdAt,
    })),
    activity,
  };
}
```

- [ ] **Step 3: Extend CustomersService**

Read `apps/backend/src/modules/customers/customers.service.ts` first to see
its current shape, then add these methods to the class (constructor already
takes `PrismaService` — reuse it; if the existing constructor doesn't have
it, add `private readonly prisma: PrismaService` the same way every other
service in this codebase does):

```typescript
  async adminList(query: AdminCustomerQueryDto): Promise<PaginatedResult<AdminCustomerListItemDto>> {
    const where: Prisma.CustomerWhereInput = {
      ...(query.tierId ? { tierId: query.tierId } : {}),
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.customer.findMany({
        where,
        include: ADMIN_CUSTOMER_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(query.page, query.pageSize),
      }),
      this.prisma.client.customer.count({ where }),
    ]);
    return toPaginatedResult(items.map(toAdminCustomerListItemDto), total, query.page, query.pageSize);
  }

  async adminGet(id: number): Promise<AdminCustomerDto> {
    const customer = await this.prisma.client.customer.findUnique({
      where: { id },
      include: ADMIN_CUSTOMER_DETAIL_INCLUDE,
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return toAdminCustomerDto(customer);
  }

  async adminUpdate(id: number, dto: UpdateCustomerDto): Promise<AdminCustomerDto> {
    await this.prisma.client.customer.update({
      where: { id },
      data: { firstName: dto.firstName, lastName: dto.lastName, dob: dto.dob },
    });
    return this.adminGet(id);
  }

  async addNote(customerId: number, dto: CreateCustomerNoteDto, authorAdminId: number): Promise<AdminCustomerNoteDto> {
    const note = await this.prisma.client.customerNote.create({
      data: { customerId, type: dto.type, body: dto.body, authorAdminId },
    });
    return { id: note.id, type: note.type, body: note.body, authorAdminId: note.authorAdminId, createdAt: note.createdAt };
  }

  async listNotes(customerId: number): Promise<AdminCustomerNoteDto[]> {
    const notes = await this.prisma.client.customerNote.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return notes.map((n) => ({ id: n.id, type: n.type, body: n.body, authorAdminId: n.authorAdminId, createdAt: n.createdAt }));
  }

  async logCall(customerId: number, dto: CreateCustomerCallLogDto, authorAdminId: number): Promise<AdminCustomerCallLogDto> {
    const customer = await this.prisma.client.customer.findUniqueOrThrow({ where: { id: customerId } });
    const call = await this.prisma.client.customerCallLog.create({
      data: {
        customerId,
        phoneCalled: customer.phone ?? '',
        outcome: dto.outcome,
        notes: dto.notes,
        authorAdminId,
      },
    });
    return {
      id: call.id,
      phoneCalled: call.phoneCalled,
      outcome: call.outcome,
      notes: call.notes,
      authorAdminId: call.authorAdminId,
      createdAt: call.createdAt,
    };
  }

  async listCalls(customerId: number): Promise<AdminCustomerCallLogDto[]> {
    const calls = await this.prisma.client.customerCallLog.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return calls.map((call) => ({
      id: call.id,
      phoneCalled: call.phoneCalled,
      outcome: call.outcome,
      notes: call.notes,
      authorAdminId: call.authorAdminId,
      createdAt: call.createdAt,
    }));
  }

  async dial(customerId: number): Promise<{ providerCallId: string }> {
    const customer = await this.prisma.client.customer.findUniqueOrThrow({ where: { id: customerId } });
    const e164 = customer.phone ? toE164Bd(customer.phone) : null;
    if (!e164) throw new BadRequestException('Customer has no valid phone number to call');
    return this.callProvider.dial(e164, customerId);
  }
```

`customers.service.ts` currently starts with this import block (lines 1-17)
and this constructor (line 21) — do not duplicate `BadRequestException`,
`Injectable`, `NotFoundException`, or `PrismaService`, which already exist:

```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SuccessResponseDto } from '../../common/dto/success-response.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashPassword, verifyPassword } from '../../common/auth/password.util';
import {
  CustomerProfileDto,
  toCustomerProfileDto,
} from '../auth/customer.mapper';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressDto, toAddressDto } from './address.mapper';
```

Change the first import to add `Inject`:

```typescript
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
```

Add these new imports directly after the existing `import { AddressDto,
toAddressDto } from './address.mapper';` line:

```typescript
import { Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { paginationArgs, toPaginatedResult } from '../../common/pagination.util';
import { toE164Bd } from '../../common/phone.util';
import { CALL_PROVIDER } from './providers/call-provider.interface';
import type { CallProvider } from './providers/call-provider.interface';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerNoteDto } from './dto/create-customer-note.dto';
import { CreateCustomerCallLogDto } from './dto/create-customer-call-log.dto';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto';
import {
  ADMIN_CUSTOMER_LIST_INCLUDE,
  ADMIN_CUSTOMER_DETAIL_INCLUDE,
  AdminCustomerDto,
  AdminCustomerListItemDto,
  AdminCustomerNoteDto,
  AdminCustomerCallLogDto,
  toAdminCustomerListItemDto,
  toAdminCustomerDto,
} from './admin-customer.mapper';
```

Change the constructor from:

```typescript
  constructor(private readonly prisma: PrismaService) {}
```

to:

```typescript
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CALL_PROVIDER) private readonly callProvider: CallProvider,
  ) {}
```

- [ ] **Step 4: Write the controller**

Create `apps/backend/src/modules/customers/admin-customers.controller.ts`:

```typescript
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerNoteDto } from './dto/create-customer-note.dto';
import { CreateCustomerCallLogDto } from './dto/create-customer-call-log.dto';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto';
import { AdminCustomerDto, AdminCustomerListItemDto } from './admin-customer.mapper';

@ApiTags('admin/customers')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission('customer.view')
  @ApiPaginatedResponse(AdminCustomerListItemDto)
  list(@Query() query: AdminCustomerQueryDto): Promise<PaginatedResult<AdminCustomerListItemDto>> {
    return this.customers.adminList(query);
  }

  @Get(':id')
  @RequirePermission('customer.view')
  @ApiOkResponse({ type: AdminCustomerDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminCustomerDto> {
    return this.customers.adminGet(id);
  }

  @Patch(':id')
  @RequirePermission('customer.manage')
  @ApiOkResponse({ type: AdminCustomerDto })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto): Promise<AdminCustomerDto> {
    return this.customers.adminUpdate(id, dto);
  }

  @Get(':id/notes')
  @RequirePermission('customer.view')
  listNotes(@Param('id', ParseIntPipe) id: number) {
    return this.customers.listNotes(id);
  }

  @Post(':id/notes')
  @RequirePermission('customer.manage')
  addNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCustomerNoteDto,
    @CurrentAdmin() admin: { id: number },
  ) {
    return this.customers.addNote(id, dto, admin.id);
  }

  @Get(':id/calls')
  @RequirePermission('customer.view')
  listCalls(@Param('id', ParseIntPipe) id: number) {
    return this.customers.listCalls(id);
  }

  @Post(':id/calls')
  @RequirePermission('customer.manage')
  logCall(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCustomerCallLogDto,
    @CurrentAdmin() admin: { id: number },
  ) {
    return this.customers.logCall(id, dto, admin.id);
  }

  @Post(':id/calls/dial')
  @RequirePermission('customer.manage')
  dial(@Param('id', ParseIntPipe) id: number) {
    return this.customers.dial(id);
  }
}
```

- [ ] **Step 5: Wire into the module**

Modify `apps/backend/src/modules/customers/customers.module.ts` — add
`AdminCustomersController` to `controllers`:

```typescript
import { AdminCustomersController } from './admin-customers.controller';
```

```typescript
  controllers: [
    CustomersController,
    CustomerAddressesController,
    WishlistController,
    AdminCustomerTiersController,
    AdminCustomersController,
  ],
```

- [ ] **Step 6: Typecheck**

```bash
cd "H:\Amder Project\backend\apps\backend"
npx tsc --noEmit -p .
```

Expected: no output. If `AdminCustomerQueryDto`'s `Type(() => Number)`
transform causes an unused-import warning anywhere, double check the DTO's
imports match exactly what's used.

- [ ] **Step 7: Verify live end-to-end**

Restart the backend dev server (new controller needs the reload). Using
`TOKEN` from earlier and the test customer created in Task 3 (or create a
fresh one the same way):

```bash
curl -s http://localhost:3000/api/v1/admin/customers -H "Authorization: Bearer $TOKEN"
```

Expected: paginated list including the test customer, with `tier: null`
(0-1 completed orders) or `"Group B"` etc. if you completed 2+ test orders.

```bash
CUSTOMER_ID=<id from the list above>
curl -s -X POST "http://localhost:3000/api/v1/admin/customers/$CUSTOMER_ID/notes" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"INTERNAL_NOTE","body":"Test note — verify plan Task 5"}'
```

Expected: 201 with the created note.

```bash
curl -s -X POST "http://localhost:3000/api/v1/admin/customers/$CUSTOMER_ID/calls/dial" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: a 503 error response with message `"Calling is not configured
yet"` — confirms the deferred provider is wired correctly (this is the
CORRECT result for this task, not a bug).

```bash
curl -s "http://localhost:3000/api/v1/admin/customers/$CUSTOMER_ID" -H "Authorization: Bearer $TOKEN"
```

Expected: full profile including the note just added, in both `notes` and
`activity`.

- [ ] **Step 8: Clean up test note**

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "DELETE FROM customer_notes WHERE body = 'Test note — verify plan Task 5';"
```

---

## Task 6: Backend — CSV import

**Files:**
- Modify: `apps/backend/src/modules/customers/customers.service.ts`
- Modify: `apps/backend/src/modules/customers/admin-customers.controller.ts`

**Interfaces:**
- Produces: `POST /admin/customers/import` (multipart) →
  `{ imported: number; skipped: number }`. Task 9's frontend upload page
  and proxy route call this.

- [ ] **Step 1: Add importCsv to CustomersService**

Add this method to `customers.service.ts` (same class as Task 5's methods):

```typescript
  // Rows with a phone that already exists as a Customer are skipped, not
  // merged/overwritten — importing a bad file must never silently corrupt
  // an existing customer's data. Columns: name,phone,email,dob (dob
  // optional, YYYY-MM-DD).
  async importCsv(csvText: string): Promise<{ imported: number; skipped: number }> {
    const rows = parseCsv(csvText);
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const [name, phone, email, dob] = row;
      if (!phone || phone.toLowerCase() === 'phone') continue;
      const existing = await this.prisma.client.customer.findUnique({ where: { phone } });
      if (existing) {
        skipped++;
        continue;
      }
      const [firstName, ...rest] = (name || '').trim().split(/\s+/).filter(Boolean);
      try {
        await this.prisma.client.customer.create({
          data: {
            phone,
            email: email || undefined,
            firstName: firstName || undefined,
            lastName: rest.length ? rest.join(' ') : undefined,
            dob: dob ? new Date(dob) : undefined,
          },
        });
        imported++;
      } catch {
        skipped++;
      }
    }
    return { imported, skipped };
  }
```

Add this local CSV parser at the bottom of `customers.service.ts` (outside
the class, same technique as `blocker.service.ts`'s `parseCsv` — kept local
rather than shared since it's an unrelated module):

```typescript
function parseCsv(text: string): string[][] {
  return text
    .split(/\r\n|\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const fields: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            cur += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      fields.push(cur);
      return fields.map((f) => f.trim());
    });
}
```

- [ ] **Step 2: Add the import endpoint**

Add these imports to `admin-customers.controller.ts`:

```typescript
import { MaxFileSizeValidator, ParseFilePipe, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
```

Add this endpoint to the controller class (placement doesn't matter, e.g.
right after `list()`):

```typescript
  @Post('import')
  @RequirePermission('customer.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  import(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 })] }))
    file: Express.Multer.File,
  ): Promise<{ imported: number; skipped: number }> {
    return this.customers.importCsv(file.buffer.toString('utf-8'));
  }
```

- [ ] **Step 3: Typecheck**

```bash
cd "H:\Amder Project\backend\apps\backend"
npx tsc --noEmit -p .
```

Expected: no output.

- [ ] **Step 4: Verify live**

```bash
cd "<scratchpad>"
cat > test-customers-import.csv << 'EOF'
name,phone,email,dob
Test Import One,01755501001,importtest1@example.com,1990-05-15
Test Import Two,01755501002,importtest2@example.com,
EOF
curl -s -X POST http://localhost:3000/api/v1/admin/customers/import \
  -H "Authorization: Bearer $TOKEN" -F "file=@test-customers-import.csv"
```

Expected: `{"success":true,"data":{"imported":2,"skipped":0}}`. Re-running
the exact same curl command a second time should return
`{"imported":0,"skipped":2}` (both phones now exist).

- [ ] **Step 5: Clean up test data**

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "DELETE FROM customers WHERE phone IN ('01755501001','01755501002');"
```

---

## Task 7: Regenerate admin API types

**Files:**
- Modify: `apps/admin/src/lib/api/schema.d.ts` (generated, not hand-edited)

**Interfaces:**
- Consumes: the running backend's live OpenAPI doc (all of Tasks 1-6 must
  be complete and the backend dev server running with the latest code).
- Produces: `components["schemas"]["AdminCustomerDto"]`, etc. — every
  frontend hook in Tasks 8-12 imports these types.

- [ ] **Step 1: Regenerate**

```bash
cd "H:\Amder Project\backend\apps\admin"
npm run typegen
```

Expected: `🚀 http://localhost:3000/api/docs-json → src/lib/api/schema.d.ts`
with no errors.

- [ ] **Step 2: Confirm the new types landed**

```bash
grep -c "AdminCustomerDto\|CustomerTierDto" "H:\Amder Project\backend\apps\admin\src\lib\api\schema.d.ts"
```

Expected: a nonzero count.

---

## Task 8: Frontend — nav entry, layout scope, and hooks

**Files:**
- Modify: `apps/admin/src/lib/nav-config.tsx`
- Create: `apps/admin/src/app/(shell)/customers/layout.tsx`
- Create: `apps/admin/src/hooks/useCustomers.ts`

**Interfaces:**
- Consumes: `AdminCustomerListItemDto`, `AdminCustomerDto`,
  `CustomerTierDto` types from `@/lib/api/schema` (Task 7); `proxyFetch`
  from `@/lib/api/proxy-client`.
- Produces: `useCustomers`, `useCustomer`, `useUpdateCustomer`,
  `useCustomerNotes`, `useAddCustomerNote`, `useCustomerCalls`,
  `useLogCustomerCall`, `useDialCustomer`, `useCustomerTiers`,
  `useUpdateCustomerTiers` hooks — every page in Tasks 9-12 imports from
  this one file.

- [ ] **Step 1: Add the nav entry**

Modify `apps/admin/src/lib/nav-config.tsx` — add an icon constant near the
other icon constants (after `const newsletterIcon = <Icon name="mail" />;`):

```typescript
const customersIcon = <Icon name="people" />;
const customerTiersIcon = <Icon name="military_tech" />;
const customerImportIcon = <Icon name="upload_file" />;
```

Add a new top-level entry to the `adminNav` array, right after the
`net-profit` entry's closing `},` (before the `content` group):

```typescript
  {
    key: "customers",
    label: "Customers",
    icon: customersIcon,
    children: [
      { key: "customers-list", label: "All Customers", href: "/customers", icon: customersIcon },
      { key: "customers-tiers", label: "Tiers", href: "/customers/tiers", icon: customerTiersIcon },
      { key: "customers-import", label: "Import CSV", href: "/customers/import", icon: customerImportIcon },
    ],
  },
```

- [ ] **Step 2: Add the violet-scope layout**

Create `apps/admin/src/app/(shell)/customers/layout.tsx`:

```typescript
// Wraps every /customers/* page in the same violet WPFOK-parity design
// scope Net Profit uses (see packages/admin-ui/src/globals.css's
// `.wpfok-scope`) — matches net-profit/layout.tsx exactly.
export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return <div className="wpfok-scope">{children}</div>;
}
```

- [ ] **Step 3: Write the hooks**

Create `apps/admin/src/hooks/useCustomers.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type AdminCustomer = components["schemas"]["AdminCustomerDto"];
export type AdminCustomerListItem = components["schemas"]["AdminCustomerListItemDto"];
export type CustomerTier = components["schemas"]["CustomerTierDto"];
export type CustomerNote = components["schemas"]["AdminCustomerNoteDto"];
export type CustomerCallLog = components["schemas"]["AdminCustomerCallLogDto"];

export interface CustomerListFilters {
  q?: string;
  tierId?: number;
  page?: number;
  pageSize?: number;
}

const LIST_KEY = ["customers"];
const TIERS_KEY = ["customer-tiers"];

function toQueryString(filters: CustomerListFilters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useCustomers(filters: CustomerListFilters = {}) {
  return useQuery({
    queryKey: [...LIST_KEY, filters],
    queryFn: () =>
      proxyFetch<{ items: AdminCustomerListItem[]; total: number }>(`/admin/customers${toQueryString(filters)}`),
  });
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: [...LIST_KEY, id],
    queryFn: () => proxyFetch<AdminCustomer>(`/admin/customers/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useUpdateCustomer(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { firstName?: string; lastName?: string; dob?: string }) =>
      proxyFetch<AdminCustomer>(`/admin/customers/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: (data) => qc.setQueryData([...LIST_KEY, id], data),
  });
}

export function useAddCustomerNote(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: string; body: string }) =>
      proxyFetch<CustomerNote>(`/admin/customers/${id}/notes`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...LIST_KEY, id] }),
  });
}

export function useLogCustomerCall(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { outcome: string; notes?: string }) =>
      proxyFetch<CustomerCallLog>(`/admin/customers/${id}/calls`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...LIST_KEY, id] }),
  });
}

export function useDialCustomer(id: number) {
  return useMutation({
    mutationFn: () => proxyFetch<{ providerCallId: string }>(`/admin/customers/${id}/calls/dial`, { method: "POST" }),
  });
}

export function useCustomerTiers() {
  return useQuery({
    queryKey: TIERS_KEY,
    queryFn: () => proxyFetch<CustomerTier[]>("/admin/customer-tiers"),
  });
}

export function useUpdateCustomerTiers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tiers: { label: string; minCompletedOrders: number; sortOrder: number }[]) =>
      proxyFetch<CustomerTier[]>("/admin/customer-tiers", { method: "PUT", body: JSON.stringify({ tiers }) }),
    onSuccess: (data) => {
      qc.setQueryData(TIERS_KEY, data);
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
```

- [ ] **Step 4: Typecheck**

```bash
cd "H:\Amder Project\backend\apps\admin"
npx tsc --noEmit -p .
```

Expected: no output. If `components["schemas"]["AdminCustomerDto"]` etc.
don't resolve, re-check Task 7's typegen actually ran against a backend
that has Task 5/6's controllers loaded (restart the backend dev server
first if needed, then re-run typegen).

---

## Task 9: Frontend — /customers list page

**Files:**
- Create: `apps/admin/src/app/(shell)/customers/page.tsx`

**Interfaces:**
- Consumes: `useCustomers`, `useCustomerTiers` from Task 8's
  `@/hooks/useCustomers`; `PageHeader`, `StatCard`, `Table`,
  `TableEmptyRow`, `Icon` from `@amader/admin-ui`.

- [ ] **Step 1: Write the page**

Create `apps/admin/src/app/(shell)/customers/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, PageHeader, StatCard, Table, TableEmptyRow } from "@amader/admin-ui";
import { useCustomers, useCustomerTiers } from "@/hooks/useCustomers";

const customersIcon = <Icon name="people" />;

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [tierId, setTierId] = useState<number | undefined>(undefined);
  const { data: tiers } = useCustomerTiers();
  const { data } = useCustomers({ q: q || undefined, tierId, pageSize: 50 });
  const { data: allCustomers } = useCustomers({ pageSize: 1000 });

  const tierCounts = (tiers ?? []).map((tier) => ({
    tier,
    count: (allCustomers?.items ?? []).filter((c) => c.tier === tier.label).length,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={customersIcon} title="Customers" subtitle="Every customer, auto-created from orders." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard variant="dark" icon={customersIcon} label="Total Customers" value={String(allCustomers?.total ?? 0)} />
        {tierCounts.map(({ tier, count }) => (
          <StatCard key={tier.id} variant="primary" icon={customersIcon} label={tier.label} value={String(count)} />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, phone, or email…"
            className="h-10 w-64 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Tier</span>
          <select
            value={tierId ?? ""}
            onChange={(e) => setTierId(e.target.value ? Number(e.target.value) : undefined)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            <option value="">All</option>
            {(tiers ?? []).map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Tier</th>
            <th>Completed Orders</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {(data?.items ?? []).length === 0 && <TableEmptyRow colSpan={6}>No customers found.</TableEmptyRow>}
          {(data?.items ?? []).map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/customers/${c.id}`} className="font-semibold text-brand-500 hover:underline">
                  {c.name}
                </Link>
              </td>
              <td className="num text-text">{c.phone ?? "—"}</td>
              <td className="text-xs text-muted">{c.email ?? "—"}</td>
              <td>
                {c.tier ? (
                  <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{c.tier}</span>
                ) : (
                  "—"
                )}
              </td>
              <td className="num text-text">{c.completedOrderCount}</td>
              <td className="text-xs text-muted">{new Date(c.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "H:\Amder Project\backend\apps\admin"
npx tsc --noEmit -p .
```

Expected: no output.

- [ ] **Step 3: Verify live**

Restart the admin dev server if it doesn't hot-reload the new route (Next
dev server usually does — only restart if the page 404s). Navigate to
`http://localhost:3004/customers` and screenshot via Playwright. Expected:
dark-gradient `PageHeader` titled "Customers", a `StatCard` row (Total +
one per tier), a search/tier filter row, and a table listing every real
customer in the dev DB (including any test customers left over from
earlier tasks — if any test rows are still present, this is a good moment
to confirm Task 3/5/6's cleanup steps actually ran).

---

## Task 10: Frontend — /customers/[id] profile page

**Files:**
- Create: `apps/admin/src/app/(shell)/customers/[id]/page.tsx`

**Interfaces:**
- Consumes: `useCustomer`, `useUpdateCustomer`, `useAddCustomerNote`,
  `useLogCustomerCall`, `useDialCustomer` from Task 8; `PageHeader`,
  `Card`, `Tabs`, `Button`, `Icon` from `@amader/admin-ui`.

- [ ] **Step 1: Write the page**

Create `apps/admin/src/app/(shell)/customers/[id]/page.tsx`:

```typescript
"use client";

import { use, useState } from "react";
import { Button, Card, Icon, PageHeader, Tabs } from "@amader/admin-ui";
import {
  useAddCustomerNote,
  useCustomer,
  useDialCustomer,
  useLogCustomerCall,
} from "@/hooks/useCustomers";

const customerIcon = <Icon name="person" />;

const NOTE_TYPES = ["CUSTOMER_FEEDBACK", "INTERNAL_NOTE", "REMARK"] as const;
const CALL_OUTCOMES = ["CONNECTED", "NO_ANSWER", "VOICEMAIL", "WRONG_NUMBER", "DECLINED"] as const;

function NotesTab({ customerId, notes }: { customerId: number; notes: { id: number; type: string; body: string; createdAt: string }[] }) {
  const addNote = useAddCustomerNote(customerId);
  const [type, setType] = useState<string>(NOTE_TYPES[1]);
  const [body, setBody] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            addNote.mutate({ type, body: body.trim() }, { onSuccess: () => setBody("") });
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            >
              {NOTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Note</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <Button type="submit" variant="primary" disabled={addNote.isPending} className="self-start">
            {addNote.isPending ? "Adding…" : "Add note"}
          </Button>
        </form>
      </Card>
      <div className="flex flex-col gap-2.5">
        {notes.length === 0 && <p className="text-sm text-muted">No notes yet.</p>}
        {notes.map((n) => (
          <Card key={n.id} className="flex flex-col gap-1">
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary self-start">{n.type}</span>
            <p className="text-sm text-text">{n.body}</p>
            <span className="text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CallLogTab({
  customerId,
  calls,
}: {
  customerId: number;
  calls: { id: number; outcome: string; notes: string | null; createdAt: string }[];
}) {
  const logCall = useLogCustomerCall(customerId);
  const dial = useDialCustomer(customerId);
  const [outcome, setOutcome] = useState<string>(CALL_OUTCOMES[0]);
  const [notes, setNotes] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <Button
          type="button"
          variant="primary"
          className="self-start"
          disabled={dial.isPending}
          onClick={() =>
            dial.mutate(undefined, {
              onError: (err) => alert(err instanceof Error ? err.message : "Call failed"),
            })
          }
        >
          {dial.isPending ? "Dialing…" : "Call"}
        </Button>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            logCall.mutate({ outcome, notes: notes.trim() || undefined }, { onSuccess: () => setNotes("") });
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Outcome</span>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            >
              {CALL_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <Button type="submit" variant="ghost" disabled={logCall.isPending} className="self-start">
            {logCall.isPending ? "Logging…" : "Log call outcome"}
          </Button>
        </form>
      </Card>
      <div className="flex flex-col gap-2.5">
        {calls.length === 0 && <p className="text-sm text-muted">No calls logged yet.</p>}
        {calls.map((c) => (
          <Card key={c.id} className="flex flex-col gap-1">
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary self-start">{c.outcome}</span>
            {c.notes && <p className="text-sm text-text">{c.notes}</p>}
            <span className="text-xs text-muted">{new Date(c.createdAt).toLocaleString()}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function OrderHistoryTab({ orders }: { orders: { id: number; orderNumber: string; status: string; totalAmount: string; createdAt: string }[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {orders.length === 0 && <p className="text-sm text-muted">No orders yet.</p>}
      {orders.map((o) => (
        <Card key={o.id} className="flex items-center justify-between">
          <div>
            <p className="font-ui text-sm font-semibold text-text">{o.orderNumber}</p>
            <p className="text-xs text-muted">{new Date(o.createdAt).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{o.status}</span>
            <p className="num mt-1 text-sm text-text">৳{o.totalAmount}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ActivityTab({
  activity,
}: {
  activity: { type: string; occurredAt: string; [key: string]: unknown }[];
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {activity.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
      {activity.map((entry, i) => (
        <Card key={i} className="flex items-center justify-between">
          <div>
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{entry.type}</span>
            <p className="mt-1 text-sm text-text">
              {entry.type === "ORDER" && `Order ${entry.orderNumber} → ${entry.status}`}
              {entry.type === "NOTE" && `Note (${entry.noteType}): ${entry.body}`}
              {entry.type === "CALL" && `Call: ${entry.outcome}`}
            </p>
          </div>
          <span className="text-xs text-muted">{new Date(entry.occurredAt).toLocaleString()}</span>
        </Card>
      ))}
    </div>
  );
}

export default function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const customerId = Number(id);
  const { data: customer, isLoading } = useCustomer(customerId);
  const [tab, setTab] = useState("notes");

  if (isLoading || !customer) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={customerIcon}
        title={customer.name}
        subtitle={`${customer.phone ?? "no phone"} · ${customer.email ?? "no email"}`}
        badge={customer.tier ?? undefined}
      />
      <Card className="flex gap-8">
        <div>
          <p className="text-xs font-semibold text-secondary">Completed Orders</p>
          <p className="num text-lg font-bold text-text">{customer.completedOrderCount}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-secondary">Birthday</p>
          <p className="text-sm text-text">{customer.dob ? new Date(customer.dob).toLocaleDateString() : "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-secondary">Customer Since</p>
          <p className="text-sm text-text">{new Date(customer.createdAt).toLocaleDateString()}</p>
        </div>
      </Card>

      <Tabs
        variant="pill"
        options={[
          { value: "notes", label: "Notes" },
          { value: "calls", label: "Call Log" },
          { value: "orders", label: "Order History" },
          { value: "activity", label: "Activity Timeline" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "notes" && <NotesTab customerId={customerId} notes={customer.notes} />}
      {tab === "calls" && <CallLogTab customerId={customerId} calls={customer.callLogs} />}
      {tab === "orders" && <OrderHistoryTab orders={customer.orders} />}
      {tab === "activity" && <ActivityTab activity={customer.activity} />}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "H:\Amder Project\backend\apps\admin"
npx tsc --noEmit -p .
```

Expected: no output. If `customer.notes`/`.callLogs`/`.orders`/`.activity`
show type errors, check the generated schema types from Task 7 actually
include these fields — the `AdminCustomerDto` swagger type must have picked
up every field defined in Task 5's mapper.

- [ ] **Step 3: Verify live**

Navigate to `/customers/<a real customer id from Task 9's list>`. Expected:
`PageHeader` with the customer's name and tier badge, the stat row, pill
tabs, and the Notes tab active by default with the add-note form working.
Click "Call" and confirm the alert shows "Calling is not configured yet"
(same 503 from Task 5's verification, now surfaced in the actual UI).

---

## Task 11: Frontend — /customers/tiers settings page

**Files:**
- Create: `apps/admin/src/app/(shell)/customers/tiers/page.tsx`

**Interfaces:**
- Consumes: `useCustomerTiers`, `useUpdateCustomerTiers` from Task 8.

- [ ] **Step 1: Write the page**

Create `apps/admin/src/app/(shell)/customers/tiers/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Button, Icon, PageHeader, SettingsCard } from "@amader/admin-ui";
import { useCustomerTiers, useUpdateCustomerTiers } from "@/hooks/useCustomers";

const tiersIcon = <Icon name="military_tech" />;

interface TierForm {
  label: string;
  minCompletedOrders: number;
  sortOrder: number;
}

export default function CustomerTiersPage() {
  const { data, isLoading } = useCustomerTiers();
  const update = useUpdateCustomerTiers();
  const [form, setForm] = useState<TierForm[] | null>(null);

  useEffect(() => {
    if (data && !form) {
      setForm(data.map((t) => ({ label: t.label, minCompletedOrders: t.minCompletedOrders, sortOrder: t.sortOrder })));
    }
  }, [data, form]);

  if (isLoading || !form) return <p className="text-sm text-muted">Loading…</p>;

  function patchTier(i: number, patch: Partial<TierForm>) {
    setForm((prev) => prev!.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function addTier() {
    setForm((prev) => [...(prev ?? []), { label: "New Tier", minCompletedOrders: 1, sortOrder: (prev?.length ?? 0) + 1 }]);
  }

  function removeTier(i: number) {
    setForm((prev) => prev!.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={tiersIcon} title="Customer Tiers" subtitle="Order-count thresholds that decide each customer's tier." />

      <SettingsCard icon={tiersIcon} title="Tier thresholds">
        <div className="flex flex-col gap-4">
          {form.map((tier, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3 rounded-inner border border-border p-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Label</span>
                <input
                  value={tier.label}
                  onChange={(e) => patchTier(i, { label: e.target.value })}
                  className="h-9 rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Min completed orders</span>
                <input
                  type="number"
                  min={1}
                  value={tier.minCompletedOrders}
                  onChange={(e) => patchTier(i, { minCompletedOrders: Number(e.target.value) })}
                  className="h-9 rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Sort order</span>
                <input
                  type="number"
                  value={tier.sortOrder}
                  onChange={(e) => patchTier(i, { sortOrder: Number(e.target.value) })}
                  className="h-9 rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <Button type="button" variant="ghost" onClick={() => removeTier(i)}>
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" className="self-start" onClick={addTier}>
            Add tier
          </Button>
        </div>
      </SettingsCard>

      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending}
        onClick={() => update.mutate(form, { onSuccess: (saved) => setForm(saved.map((t) => ({ label: t.label, minCompletedOrders: t.minCompletedOrders, sortOrder: t.sortOrder }))) })}
      >
        {update.isPending ? "Saving…" : "Save tiers"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "H:\Amder Project\backend\apps\admin"
npx tsc --noEmit -p .
```

Expected: no output.

- [ ] **Step 3: Verify live**

Navigate to `/customers/tiers`. Expected: the 4 seeded tiers pre-filled.
Change "Group B"'s threshold from 2 to 99, save, then check via curl that a
test customer with `completed_order_count = 1` (or 2) now has `tier_id:
null` (since 99 is now unreachable) — confirming `replace()`'s
`recomputeAll()` actually ran. Then change it back to 2 and save again to
restore the real default before moving on.

---

## Task 12: Frontend — /customers/import CSV upload page

**Files:**
- Create: `apps/admin/src/app/api/backend/admin/customers/import/route.ts`
- Create: `apps/admin/src/app/(shell)/customers/import/page.tsx`

**Interfaces:**
- Consumes: none from earlier frontend tasks (multipart uploads bypass
  `proxyFetch`, same reason `blocker/import/route.ts` does).
- Produces: nothing consumed elsewhere — this is the last piece.

- [ ] **Step 1: Write the proxy route**

Create `apps/admin/src/app/api/backend/admin/customers/import/route.ts`
(copy `apps/admin/src/app/api/backend/admin/net-profit/blocker/import/route.ts`
exactly, changing only the backend URL path):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "@/lib/auth-cookies";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// Dedicated route, not the [...path] catch-all — a multipart CSV body must
// stay FormData all the way through (same reason as the blocker import
// route this is copied from).
async function refreshAccessToken(): Promise<string | undefined> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return undefined;

  const res = await fetch(`${BACKEND_URL}/api/v1/admin/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    await clearAuthCookies();
    return undefined;
  }
  await setAuthCookies(json.data.accessToken, json.data.refreshToken);
  return json.data.accessToken as string;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  async function call(token: string | undefined) {
    return fetch(`${BACKEND_URL}/api/v1/admin/customers/import`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  }

  try {
    let accessToken = await getAccessToken();
    let res = await call(accessToken);

    if (res.status === 401) {
      accessToken = await refreshAccessToken();
      if (accessToken) res = await call(accessToken);
    }

    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "backend_unreachable", message: "Backend is unreachable" } },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 2: Write the page**

Create `apps/admin/src/app/(shell)/customers/import/page.tsx`:

```typescript
"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";

const importIcon = <Icon name="upload_file" />;

export default function CustomerImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/backend/admin/customers/import", { method: "POST", body: form });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Import failed");
      setResult(body.data);
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={importIcon} title="Import Customers" subtitle="Bulk-add existing customers from a CSV file." />

      <Card className="flex flex-col gap-4">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="primary" onClick={() => fileRef.current?.click()} disabled={pending}>
            {pending ? "Importing…" : "Choose CSV file"}
          </Button>
          <p className="mt-2 text-xs text-muted">Columns: name,phone,email,dob (dob optional, YYYY-MM-DD). Rows with a phone that already exists are skipped.</p>
        </div>
        {result && (
          <p className="text-sm text-success">
            Imported {result.imported}, skipped {result.skipped}.
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd "H:\Amder Project\backend\apps\admin"
npx tsc --noEmit -p .
```

Expected: no output.

- [ ] **Step 4: Verify live**

Navigate to `/customers/import`. Upload the same
`test-customers-import.csv` from Task 6 Step 4 (re-create it if it was
deleted). Expected: "Imported 2, skipped 0" (or "Imported 0, skipped 2" if
Task 6's cleanup didn't run — in that case, clean up first, then retry).
Confirm the two test customers now appear on `/customers`.

- [ ] **Step 5: Clean up test data**

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "DELETE FROM customers WHERE phone IN ('01755501001','01755501002');"
```

---

## Task 13: Full end-to-end verification pass

**Files:** none (verification only).

**Interfaces:** none — this task exercises everything built in Tasks 1-12
together as a single realistic scenario.

- [ ] **Step 1: Fresh guest checkout → auto-created customer**

Place a real order through the actual storefront checkout flow (not curl)
using a brand-new phone number, e.g. `01799990001`. Confirm on
`/customers` (admin) that a new customer with that phone appears with
`completedOrderCount: 0` and no tier badge.

- [ ] **Step 2: Progress the order to COMPLETED, confirm tier stays null**

In the admin Orders page, move that order's status to `COMPLETED`. Refresh
the customer's profile page — `completedOrderCount` should now show `1`,
still no tier (1 < Group B's 2).

- [ ] **Step 3: Second order, same phone, confirm tier appears**

Place a second real checkout with the same phone number, mark it
`COMPLETED` too. Refresh the customer profile — `completedOrderCount: 2`,
tier badge now shows "Group B". Confirm the Order History tab lists both
orders and the Activity Timeline shows both order status entries.

- [ ] **Step 4: Add a note and a call log through the real UI**

On the profile page, add one note (any type) and log one call outcome
through the actual form (not curl). Confirm both appear in their tabs and
in the Activity Timeline, correctly interleaved by time with the order
events.

- [ ] **Step 5: Confirm the Call button's honest failure**

Click "Call" on this profile. Confirm the UI surfaces "Calling is not
configured yet" clearly (not a silent failure, not a raw stack trace).

- [ ] **Step 6: Clean up every piece of test data from this task**

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "
DELETE FROM customer_notes WHERE customer_id = (SELECT id FROM customers WHERE phone = '01799990001');
DELETE FROM customer_call_logs WHERE customer_id = (SELECT id FROM customers WHERE phone = '01799990001');
DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE customer_id = (SELECT id FROM customers WHERE phone = '01799990001'));
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_id = (SELECT id FROM customers WHERE phone = '01799990001'));
DELETE FROM order_addresses WHERE order_id IN (SELECT id FROM orders WHERE customer_id = (SELECT id FROM customers WHERE phone = '01799990001'));
DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE customer_id = (SELECT id FROM customers WHERE phone = '01799990001'));
DELETE FROM orders WHERE customer_id = (SELECT id FROM customers WHERE phone = '01799990001');
DELETE FROM customers WHERE phone = '01799990001';
"
```

(Table names for order line items/addresses/payments should be confirmed
against the real schema before running — check `\d orders` in psql if any
of these DELETEs fail on a foreign-key constraint, and delete child tables
first in the correct order.)

- [ ] **Step 7: Final full typecheck of both apps**

```bash
cd "H:\Amder Project\backend\apps\backend" && npx tsc --noEmit -p .
cd "H:\Amder Project\backend\apps\admin" && npx tsc --noEmit -p .
```

Expected: both clean, no output.
