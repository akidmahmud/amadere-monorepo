# Upsell Progress Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-threshold free-shipping ladder with an admin-configurable, up-to-6-stage gamified progress bar (item-count or spend-based triggers, percentage/fixed/free-shipping rewards) shown in the cart drawer and at the top of checkout.

**Architecture:** A new `UpsellStage` Prisma model (full-list-replace admin CRUD, mirroring the existing `CustomerTier` pattern) plus a settings blob in the generic `Setting` table (mirroring `EmailSettingsService`). `PricingService.price()` gains a stage-matching step that replaces `freeShippingLadder()`. The existing `CartViewDto`/`PricingSummaryDto` response — already shared by the cart drawer and checkout page — gains an `upsell` field in place of `freeShipping`, so both frontends read one backend computation with zero client-side pricing logic.

**Tech Stack:** NestJS + Prisma + PostgreSQL (backend), Next.js + React Query (apps/web, apps/admin), Tailwind (packages/ui).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-08-13-upsell-progress-bar-design.md` — every task below implements a specific section of it.
- Follow this codebase's existing conventions exactly — do not introduce a new pattern where an established one already exists (verified against `customer-tiers`, `email-settings`, `net-profit/payments` modules this plan is modeled on).
- No unit test framework exists in this codebase. Verification is: `npx tsc --noEmit` clean after every task, then live verification via `curl`/`psql`/Playwright against the real running dev servers — never claim a task done without this.
- `prisma migrate dev` cannot be used directly — its shadow-database replay fails on an unrelated historical migration. Use the established workaround: `prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script` to generate SQL, hand-create the migration folder, apply via `prisma db execute`, then `prisma migrate resolve --applied` to keep migration history consistent.
- Dev servers run via `pnpm dev` from `h:\Amder Project\backend` (backend :3000, web :3001, admin :3004) — already running; `nest start --watch` and `next dev` both hot-reload, so no manual restart is needed after file edits, only after a `prisma generate` (regenerates the client apps import).
- After any backend DTO/controller change, regenerate **both** frontend apps' OpenAPI types (this feature touches storefront-facing DTOs, unlike prior sub-projects): `cd apps/admin && npm run typegen` and `cd apps/web && npm run typegen` (both require the backend dev server up and serving `/api/docs-json`).
- A stage's `discountPercent` and `discountFixedAmount` are mutually exclusive; at least one of `discountPercent`/`discountFixedAmount`/`freeShipping` must be set — validated server-side in the stages service, not the DB.
- Money is always 2dp, rounded up in the customer's favour (`Decimal.ROUND_UP`) — matches `PricingService.computeAmount()`'s existing convention.
- Working directly on `master`, no worktree/branch — established convention for this whole session, since live verification depends on dev servers watching the real working directory.

---

### Task 1: Prisma schema, migration, permissions

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `packages/shared/src/permission-catalog.ts`
- Create: `packages/db/prisma/migrations/<timestamp>_add_upsell_stages/migration.sql`

**Interfaces:**
- Produces: `UpsellStage` Prisma model (`id`, `sortOrder`, `triggerType`, `triggerValue`, `discountPercent`, `discountFixedAmount`, `freeShipping`, `label`, `enabled`, `createdAt`, `updatedAt`), `UpsellTriggerType` enum (`ITEM_COUNT` | `ORDER_AMOUNT`), permission keys `upsell_bar.view` / `upsell_bar.manage`.

- [ ] **Step 1: Add the model to the schema**

In `packages/db/prisma/schema.prisma`, insert immediately after the `CartItem` model (after its closing `}` on the line containing `@@map("cart_items")`, before `model WishlistItem {`):

```prisma
enum UpsellTriggerType {
  ITEM_COUNT
  ORDER_AMOUNT
}

model UpsellStage {
  id                  Int               @id @default(autoincrement())
  sortOrder           Int               @map("sort_order")
  triggerType         UpsellTriggerType @map("trigger_type")
  triggerValue        Decimal           @map("trigger_value") @db.Decimal(10, 2)
  discountPercent     Decimal?          @map("discount_percent") @db.Decimal(5, 2)
  discountFixedAmount Decimal?          @map("discount_fixed_amount") @db.Decimal(10, 2)
  freeShipping        Boolean           @default(false) @map("free_shipping")
  label               String
  enabled             Boolean           @default(true)
  createdAt           DateTime          @default(now()) @map("created_at")
  updatedAt           DateTime          @updatedAt @map("updated_at")

  @@map("upsell_stages")
}
```

- [ ] **Step 2: Add permission catalog entries**

In `packages/shared/src/permission-catalog.ts`, append after `perm('customer', 'manage'),` (the last two lines before the closing `];`):

```ts
  perm('upsell_bar', 'view'),
  perm('upsell_bar', 'manage'),
```

- [ ] **Step 3: Generate the migration diff**

```bash
cd "h:\Amder Project\backend\packages\db"
npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script
```

Confirm the output is exactly a `CREATE TYPE "UpsellTriggerType"` + `CREATE TABLE "upsell_stages"` (no unrelated diffs — if there are unrelated diffs, something else changed the schema since the last migration; stop and investigate before continuing).

- [ ] **Step 4: Hand-create the migration folder**

Create `packages/db/prisma/migrations/<TS>_add_upsell_stages/migration.sql` (use the current UTC timestamp in `YYYYMMDDHHMMSS` format for `<TS>`, matching the existing folders in that directory) with the exact SQL `prisma migrate diff` printed in Step 3 — it's expected to match this given the schema in Step 1, don't hand-edit it to differ:

```sql
-- CreateEnum
CREATE TYPE "UpsellTriggerType" AS ENUM ('ITEM_COUNT', 'ORDER_AMOUNT');

-- CreateTable
CREATE TABLE "upsell_stages" (
    "id" SERIAL NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "trigger_type" "UpsellTriggerType" NOT NULL,
    "trigger_value" DECIMAL(10,2) NOT NULL,
    "discount_percent" DECIMAL(5,2),
    "discount_fixed_amount" DECIMAL(10,2),
    "free_shipping" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upsell_stages_pkey" PRIMARY KEY ("id")
);
```

- [ ] **Step 5: Apply it and mark it resolved**

```bash
cd "h:\Amder Project\backend\packages\db"
npx prisma db execute --file "prisma/migrations/<TS>_add_upsell_stages/migration.sql" --config prisma.config.ts
npx prisma migrate resolve --applied "<TS>_add_upsell_stages"
npx prisma migrate status
```

`migrate status` must report no pending migrations.

- [ ] **Step 6: Regenerate the Prisma client and seed permissions**

```bash
cd "h:\Amder Project\backend\packages\db"
npx prisma generate
npx prisma db seed
```

The seed script (`packages/db/prisma/seed.ts`) iterates `PERMISSION_CATALOG` with an idempotent `upsert` and re-grants every permission to the "Super Admin" role — no seed-file edit needed for this, only the catalog change from Step 2.

- [ ] **Step 7: Verify live**

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "\d upsell_stages"
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT key FROM permissions WHERE key LIKE 'upsell_bar%';"
```

Confirm the table exists with the expected columns and both permission rows are present. `npx tsc --noEmit` from `packages/db` should be clean (it has no separate build step beyond Prisma generate, so this is mainly a sanity check that the schema file itself is well-formed, already implied by `prisma generate` succeeding).

---

### Task 2: Backend `upsell-bar` module — settings + stages CRUD

**Files:**
- Create: `apps/backend/src/modules/upsell-bar/upsell-bar-settings.service.ts`
- Create: `apps/backend/src/modules/upsell-bar/upsell-stages.service.ts`
- Create: `apps/backend/src/modules/upsell-bar/dto/update-upsell-bar-settings.dto.ts`
- Create: `apps/backend/src/modules/upsell-bar/dto/update-upsell-stages.dto.ts`
- Create: `apps/backend/src/modules/upsell-bar/admin-upsell-bar.controller.ts`
- Create: `apps/backend/src/modules/upsell-bar/upsell-bar.module.ts`
- Modify: `apps/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (`../../common/prisma/prisma.service`), `AdminJwtGuard`/`PermissionGuard`/`RequirePermission`/`AuditLogInterceptor` (existing `common/auth`, `common/audit-log`), permission keys from Task 1.
- Produces: `UpsellBarSettingsService.getSettings(): Promise<UpsellBarSettings>` / `.updateSettings(input): Promise<UpsellBarSettings>` (exported for Task 3's `PricingService` to inject), `UpsellStagesService.list()` / `.replace(stages)`, `UpsellBarSettings` interface (`{enabled: boolean; countMode: 'TOTAL_UNITS' | 'DISTINCT_PRODUCTS'; maxDiscountCap: number | null}`), routes `GET/PUT /admin/upsell-bar/settings`, `GET/PUT /admin/upsell-bar/stages`.

- [ ] **Step 1: Settings service**

Create `apps/backend/src/modules/upsell-bar/upsell-bar-settings.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const KEY = 'upsell_bar.settings';

export type UpsellCountMode = 'TOTAL_UNITS' | 'DISTINCT_PRODUCTS';

export interface UpsellBarSettings {
  enabled: boolean;
  countMode: UpsellCountMode;
  maxDiscountCap: number | null;
}

const DEFAULTS: UpsellBarSettings = {
  enabled: false,
  countMode: 'TOTAL_UNITS',
  maxDiscountCap: null,
};

// Same shape as EmailSettingsService: one JSON row in the generic Setting
// table, explicit per-field merge on update (not a `{...current,...input}`
// spread) so an explicit `maxDiscountCap: null` clears the cap instead of
// class-transformer's `undefined`-on-untouched-fields clobbering it.
@Injectable()
export class UpsellBarSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<UpsellBarSettings> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: KEY } });
    return row ? { ...DEFAULTS, ...(row.value as object) } : DEFAULTS;
  }

  async updateSettings(input: Partial<UpsellBarSettings>): Promise<UpsellBarSettings> {
    const current = await this.getSettings();
    const next: UpsellBarSettings = {
      enabled: input.enabled ?? current.enabled,
      countMode: input.countMode ?? current.countMode,
      maxDiscountCap: input.maxDiscountCap !== undefined ? input.maxDiscountCap : current.maxDiscountCap,
    };
    await this.prisma.client.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: next as never },
      update: { value: next as never },
    });
    return next;
  }
}
```

- [ ] **Step 2: Stages DTOs**

Create `apps/backend/src/modules/upsell-bar/dto/update-upsell-stages.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class UpsellStageItemDto {
  @ApiProperty({ enum: ['ITEM_COUNT', 'ORDER_AMOUNT'] })
  @IsIn(['ITEM_COUNT', 'ORDER_AMOUNT'])
  triggerType!: 'ITEM_COUNT' | 'ORDER_AMOUNT';

  @ApiProperty()
  @IsNumber()
  @Min(0)
  triggerValue!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountFixedAmount?: number;

  @ApiProperty()
  @IsBoolean()
  freeShipping!: boolean;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty()
  @IsInt()
  sortOrder!: number;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class UpdateUpsellStagesDto {
  @ApiProperty({ type: [UpsellStageItemDto] })
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => UpsellStageItemDto)
  stages!: UpsellStageItemDto[];
}
```

Create `apps/backend/src/modules/upsell-bar/dto/update-upsell-bar-settings.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateUpsellBarSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false, enum: ['TOTAL_UNITS', 'DISTINCT_PRODUCTS'] })
  @IsOptional()
  @IsIn(['TOTAL_UNITS', 'DISTINCT_PRODUCTS'])
  countMode?: 'TOTAL_UNITS' | 'DISTINCT_PRODUCTS';

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxDiscountCap?: number | null;
}
```

- [ ] **Step 3: Stages service**

Create `apps/backend/src/modules/upsell-bar/upsell-stages.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateUpsellStagesDto } from './dto/update-upsell-stages.dto';

// Full replace — the admin page always submits the complete stage set (max
// 6, enforced by the DTO), mirroring CustomerTiersService.replace().
@Injectable()
export class UpsellStagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.client.upsellStage.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async replace(stages: UpdateUpsellStagesDto['stages']) {
    for (const s of stages) {
      if (s.discountPercent && s.discountFixedAmount) {
        throw new BadRequestException(`Stage "${s.label}" cannot set both a percentage and a fixed discount`);
      }
      if (!s.discountPercent && !s.discountFixedAmount && !s.freeShipping) {
        throw new BadRequestException(`Stage "${s.label}" must set a discount, free shipping, or both`);
      }
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.upsellStage.deleteMany({});
      if (stages.length > 0) {
        await tx.upsellStage.createMany({ data: stages });
      }
    });
    return this.list();
  }
}
```

- [ ] **Step 4: Controller**

Create `apps/backend/src/modules/upsell-bar/admin-upsell-bar.controller.ts`:

```ts
import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { UpsellBarSettings, UpsellBarSettingsService } from './upsell-bar-settings.service';
import { UpsellStagesService } from './upsell-stages.service';
import { UpdateUpsellBarSettingsDto } from './dto/update-upsell-bar-settings.dto';
import { UpdateUpsellStagesDto } from './dto/update-upsell-stages.dto';

@ApiTags('admin/upsell-bar')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/upsell-bar')
export class AdminUpsellBarController {
  constructor(
    private readonly settings: UpsellBarSettingsService,
    private readonly stages: UpsellStagesService,
  ) {}

  @Get('settings')
  @RequirePermission('upsell_bar.view')
  getSettings(): Promise<UpsellBarSettings> {
    return this.settings.getSettings();
  }

  @Put('settings')
  @RequirePermission('upsell_bar.manage')
  updateSettings(@Body() dto: UpdateUpsellBarSettingsDto): Promise<UpsellBarSettings> {
    return this.settings.updateSettings(dto);
  }

  @Get('stages')
  @RequirePermission('upsell_bar.view')
  listStages() {
    return this.stages.list();
  }

  @Put('stages')
  @RequirePermission('upsell_bar.manage')
  replaceStages(@Body() dto: UpdateUpsellStagesDto) {
    return this.stages.replace(dto.stages);
  }
}
```

- [ ] **Step 5: Module + registration**

Create `apps/backend/src/modules/upsell-bar/upsell-bar.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AdminUpsellBarController } from './admin-upsell-bar.controller';
import { UpsellBarSettingsService } from './upsell-bar-settings.service';
import { UpsellStagesService } from './upsell-stages.service';

@Module({
  controllers: [AdminUpsellBarController],
  providers: [UpsellBarSettingsService, UpsellStagesService],
  exports: [UpsellBarSettingsService],
})
export class UpsellBarModule {}
```

In `apps/backend/src/app.module.ts`, add the import near the other feature-module imports (after the `DiscountsModule` import line):

```ts
import { UpsellBarModule } from './modules/upsell-bar/upsell-bar.module';
```

And add `UpsellBarModule,` to the `imports` array near `DiscountsModule,`.

- [ ] **Step 6: Verify live**

```bash
npx tsc --noEmit
```
from `apps/backend`, must be clean. Then, with the backend dev server running and an admin JWT:

```bash
curl -s http://localhost:3000/api/admin/upsell-bar/settings -H "Authorization: Bearer $TOKEN"
curl -s -X PUT http://localhost:3000/api/admin/upsell-bar/stages -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"stages":[{"triggerType":"ITEM_COUNT","triggerValue":2,"discountPercent":3,"freeShipping":false,"label":"3% off","sortOrder":1,"enabled":true}]}'
curl -s http://localhost:3000/api/admin/upsell-bar/stages -H "Authorization: Bearer $TOKEN"
```

Confirm settings returns the defaults, the stage persists and round-trips, and `docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT * FROM upsell_stages;"` shows the row. Delete the test stage afterward (`PUT .../stages` with `{"stages":[]}`) to leave the table clean for later tasks' verification.

---

### Task 3: Pricing engine — replace `freeShippingLadder()` with stage matching

**Files:**
- Modify: `apps/backend/src/modules/cart/pricing.service.ts`
- Modify: `apps/backend/src/modules/cart/cart.module.ts`

**Interfaces:**
- Consumes: `UpsellBarSettingsService` from Task 2 (exported by `UpsellBarModule`), `this.prisma.client.upsellStage.findMany(...)` (Task 1's model).
- Produces: `AppliedDiscount.source` gains `'UPSELL'`; `PricingResult.freeShipping` is replaced by `PricingResult.upsell: UpsellBarResult | null`; `UpsellBarResult` (`{stages: {label, triggerType, triggerValue, unlocked}[], currentCount: string, nextStage: {label, triggerType, remaining} | null}`) — consumed by Task 4's `cart.service.ts`.

- [ ] **Step 1: Import the settings service and update `cart.module.ts`**

In `apps/backend/src/modules/cart/cart.module.ts`, add the import and module dependency:

```ts
import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../net-profit/settings/net-profit-settings.module';
import { UpsellBarModule } from '../upsell-bar/upsell-bar.module';
import { CartController, CartMergeController } from './cart.controller';
import { CartService } from './cart.service';
import { PricingService } from './pricing.service';
import { CartIdentityGuard } from './cart-identity.guard';

@Module({
  imports: [NetProfitSettingsModule, UpsellBarModule],
  controllers: [CartController, CartMergeController],
  providers: [CartService, PricingService, CartIdentityGuard],
  exports: [PricingService, CartIdentityGuard],
})
export class CartModule {}
```

- [ ] **Step 2: Update the interfaces and constructor in `pricing.service.ts`**

Replace lines 1-31 (imports through `PricingResult`) with:

```ts
import { Injectable } from '@nestjs/common';
import { Discount, Prisma, UpsellStage } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpsellBarSettingsService } from '../upsell-bar/upsell-bar-settings.service';

const Decimal = Prisma.Decimal;
type DecimalValue = Prisma.Decimal;

export interface PricedLine {
  productId: number;
  variantId: number | null;
  quantity: number;
  unitPrice: DecimalValue;
  lineTotal: DecimalValue;
}

export interface AppliedDiscount {
  source: 'COUPON' | 'PROMOTION' | 'UPSELL';
  label: string;
  amount: DecimalValue;
  freeShipping?: boolean;
}

export interface UpsellStageProgress {
  label: string;
  triggerType: 'ITEM_COUNT' | 'ORDER_AMOUNT';
  triggerValue: string;
  unlocked: boolean;
}

export interface UpsellBarResult {
  stages: UpsellStageProgress[];
  currentCount: string;
  nextStage: { label: string; triggerType: 'ITEM_COUNT' | 'ORDER_AMOUNT'; remaining: string } | null;
}

export interface PricingResult {
  lines: PricedLine[];
  subTotal: DecimalValue;
  discounts: AppliedDiscount[];
  totalDiscount: DecimalValue;
  total: DecimalValue;
  couponError: string | null;
  upsell: UpsellBarResult | null;
}
```

Update the constructor (currently `constructor(private readonly prisma: PrismaService) {}`) to:

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly upsellSettings: UpsellBarSettingsService,
  ) {}
```

- [ ] **Step 3: Replace the tail of `price()`**

Replace the body of `price()` from `discounts.push(...(await this.promotionDiscounts(pricedLines, subTotal)));` (inclusive) through the `return { ... }` block (i.e. everything from that line to the end of the method) with:

```ts
    discounts.push(...(await this.promotionDiscounts(pricedLines, subTotal)));

    if (options.couponCode) {
      const result = await this.couponDiscount(
        options.couponCode,
        pricedLines,
        subTotal,
        options.customerId,
      );
      if (typeof result === 'string') couponError = result;
      else discounts.push(result);
    }

    // PHASE 2 HOOK: reward-point redemption and referral-credit application
    // plug in here as additional AppliedDiscount entries.

    const otherDiscountsTotal = discounts.reduce(
      (sum, d) => sum.plus(d.amount),
      new Decimal(0),
    );
    const upsell = await this.applyUpsellBar(pricedLines, subTotal, discounts, otherDiscountsTotal);

    const totalDiscount = discounts.reduce(
      (sum, d) => sum.plus(d.amount),
      new Decimal(0),
    );
    const total = Decimal.max(subTotal.minus(totalDiscount), new Decimal(0));

    return {
      lines: pricedLines,
      subTotal,
      discounts,
      totalDiscount,
      total,
      couponError,
      upsell,
    };
  }
```

- [ ] **Step 4: Replace `freeShippingLadder()` with `applyUpsellBar()`**

Delete the entire `freeShippingLadder()` private method (the comment block starting `// Free-shipping incentive ladder...` through its closing `}`, currently the last method in the class before the final `}`). Replace it with:

```ts
  // Upsell progress bar: highest enabled stage whose trigger is satisfied
  // wins (ladder, not cumulative — see design spec's "Pricing engine"
  // section). Its discount only counts if it beats the coupon/promotion
  // total already computed into `discounts`/`otherDiscountsTotal` — the
  // loser's entries are dropped from `discounts` (mutated in place; `price()`
  // recomputes totalDiscount from it afterward). Free shipping from the
  // matched stage always applies regardless of which side won the amount
  // comparison.
  private async applyUpsellBar(
    lines: PricedLine[],
    subTotal: DecimalValue,
    discounts: AppliedDiscount[],
    otherDiscountsTotal: DecimalValue,
  ): Promise<UpsellBarResult | null> {
    const settings = await this.upsellSettings.getSettings();
    if (!settings.enabled) return null;

    const stages = await this.prisma.client.upsellStage.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (stages.length === 0) return null;

    const itemCount =
      settings.countMode === 'DISTINCT_PRODUCTS'
        ? new Set(lines.map((l) => l.productId)).size
        : lines.reduce((sum, l) => sum + l.quantity, 0);

    const satisfied = (stage: UpsellStage) =>
      stage.triggerType === 'ITEM_COUNT'
        ? itemCount >= stage.triggerValue.toNumber()
        : subTotal.greaterThanOrEqualTo(stage.triggerValue);

    let matched: UpsellStage | null = null;
    for (const stage of stages) {
      if (satisfied(stage)) matched = stage;
    }

    if (matched) {
      let stageAmount = new Decimal(0);
      if (matched.discountPercent) {
        stageAmount = subTotal
          .times(matched.discountPercent)
          .dividedBy(100)
          .toDecimalPlaces(2, Decimal.ROUND_UP);
      } else if (matched.discountFixedAmount) {
        stageAmount = Decimal.min(matched.discountFixedAmount, subTotal);
      }
      if (settings.maxDiscountCap !== null) {
        stageAmount = Decimal.min(stageAmount, new Decimal(settings.maxDiscountCap));
      }

      if (stageAmount.greaterThan(otherDiscountsTotal)) {
        discounts.length = 0;
        discounts.push({
          source: 'UPSELL',
          label: matched.label,
          amount: stageAmount,
          freeShipping: matched.freeShipping || undefined,
        });
      } else if (matched.freeShipping && !discounts.some((d) => d.freeShipping)) {
        discounts.push({ source: 'UPSELL', label: matched.label, amount: new Decimal(0), freeShipping: true });
      }
    }

    const nextStage = stages.find((s) => !satisfied(s));
    return {
      stages: stages.map((s) => ({
        label: s.label,
        triggerType: s.triggerType,
        triggerValue: s.triggerValue.toString(),
        unlocked: satisfied(s),
      })),
      currentCount: itemCount.toString(),
      nextStage: nextStage
        ? {
            label: nextStage.label,
            triggerType: nextStage.triggerType,
            remaining:
              nextStage.triggerType === 'ITEM_COUNT'
                ? String(Math.max(0, nextStage.triggerValue.toNumber() - itemCount))
                : Decimal.max(nextStage.triggerValue.minus(subTotal), new Decimal(0)).toString(),
          }
        : null,
    };
  }
```

- [ ] **Step 5: Verify live**

```bash
npx tsc --noEmit
```
from `apps/backend`, must be clean — this also confirms nothing else in the backend still references `PricingResult.freeShipping` (the compiler will error on any remaining reference; grep for `\.freeShipping` under `apps/backend/src` too, to be sure, excluding `AppliedDiscount.freeShipping` and `CartDiscountDto.freeShipping` which still exist by design).

Live-check the math directly: with the dev server running, configure one stage (`PUT /admin/upsell-bar/settings` with `{"enabled":true}`, `PUT /admin/upsell-bar/stages` with a 2-item 3%-off stage) and `POST` a couple of real items into a guest cart, then `GET` the cart and confirm `discounts` shows the `UPSELL` entry once 2+ items are in the cart, and `upsell.stages[0].unlocked` flips to `true` at the threshold. Reset the stage list back to `[]` afterward — this task's job is the engine, not the final wiring (later tasks reset it again for their own verification, but leaving stale state between tasks makes each one's checks harder to reason about).

---

### Task 4: Cart response DTO + `cart.service.ts` wiring

**Files:**
- Modify: `apps/backend/src/modules/cart/dto/cart-response.dto.ts`
- Modify: `apps/backend/src/modules/cart/cart.service.ts`

**Interfaces:**
- Consumes: `UpsellBarResult` from Task 3.
- Produces: `PricingSummaryDto.upsell: UpsellBarDto | null` (replaces `freeShipping`), consumed by Task 7's frontend wiring.

- [ ] **Step 1: Update the DTO**

In `apps/backend/src/modules/cart/dto/cart-response.dto.ts`, replace the `CartDiscountDto`, `FreeShippingLadderDto`, and `PricingSummaryDto` classes (lines 1-31) with:

```ts
export class CartDiscountDto {
  source!: 'COUPON' | 'PROMOTION' | 'UPSELL';
  label!: string;
  amount!: string;
  freeShipping!: boolean;
}

export class UpsellStageProgressDto {
  label!: string;
  triggerType!: 'ITEM_COUNT' | 'ORDER_AMOUNT';
  triggerValue!: string;
  unlocked!: boolean;
}

export class UpsellBarDto {
  stages!: UpsellStageProgressDto[];
  currentCount!: string;
  nextStage!: { label: string; triggerType: 'ITEM_COUNT' | 'ORDER_AMOUNT'; remaining: string } | null;
}

export class PricingSummaryDto {
  subTotal!: string;
  discounts!: CartDiscountDto[];
  totalDiscount!: string;
  total!: string;
  couponError!: string | null;
  upsell!: UpsellBarDto | null;
  // Real tax/COD-fee preview — same formula CheckoutService uses when the
  // order is actually placed (computeCheckoutFees), so this never drifts
  // from what the customer is really charged. codFee is always '0' unless
  // the caller told us the customer picked Cash on Delivery.
  taxAmount!: string;
  codFee!: string;
  // Checkout-time shipping fee — Dhaka district vs. outside-Dhaka rate (see
  // computeCheckoutFees), waived to '0' when an applied discount has
  // freeShipping set.
  shippingFee!: string;
  grandTotal!: string;
}
```

(The rest of the file — `CartLineItemDto`, `CartCrossSellItemDto`, `CartViewDto` — is unchanged.)

- [ ] **Step 2: Update `serializePricing()`**

In `apps/backend/src/modules/cart/cart.service.ts`, in `serializePricing()`, replace the line `freeShipping: pricing.freeShipping,` with `upsell: pricing.upsell,`.

- [ ] **Step 3: Verify live**

```bash
npx tsc --noEmit
```
from `apps/backend`, must be clean. Then `curl http://localhost:3000/api/cart -H "..."` (or the guest-token equivalent used elsewhere this session) and confirm the response has `upsell: null` (no stages configured yet, or the feature disabled) and no `freeShipping` key at all.

---

### Task 5: Admin nav entry, hooks, and settings page

**Files:**
- Modify: `apps/admin/src/lib/nav-config.tsx`
- Create: `apps/admin/src/hooks/useUpsellBar.ts`
- Create: `apps/admin/src/app/(shell)/upsell-bar/page.tsx`

**Interfaces:**
- Consumes: `GET/PUT /admin/upsell-bar/settings`, `GET/PUT /admin/upsell-bar/stages` (Task 2), `proxyFetch` (`@/lib/api/proxy-client`), `Button`/`Card`/`Icon`/`PageHeader`/`SettingsCard`/`ToggleSwitch` from `@amader/admin-ui`.

- [ ] **Step 1: Typegen so the admin app's schema knows the new endpoints**

```bash
cd "h:\Amder Project\backend\apps\admin"
npm run typegen
```

(Requires the backend dev server up, already running.) This step must run after Task 2 and before writing the page, but the page below uses hand-written hook types rather than the generated schema (matching `usePayments.ts`'s own pattern), so it's not a hard blocker — run it now regardless, to keep the generated schema current for anything else touching `/admin/upsell-bar/*`.

- [ ] **Step 2: Nav entry**

In `apps/admin/src/lib/nav-config.tsx`, add an icon constant near the other Marketing-section icons (after `const giftVouchersIcon = <Icon name="card_giftcard" />;`):

```tsx
const upsellBarIcon = <Icon name="rocket_launch" />;
```

Add the nav entry in the Marketing section, after `discounts` and before `gift-vouchers`:

```tsx
  { key: "discounts", label: "Discounts", href: "/discounts", icon: discountsIcon, permission: "discount.view" },
  { key: "upsell-bar", label: "Upsell Bar", href: "/upsell-bar", icon: upsellBarIcon, permission: "upsell_bar.view" },
  { key: "gift-vouchers", label: "Gift Vouchers", href: "/gift-vouchers", icon: giftVouchersIcon, permission: "gift_voucher.view" },
```

- [ ] **Step 3: Hooks**

Create `apps/admin/src/hooks/useUpsellBar.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type UpsellTriggerType = "ITEM_COUNT" | "ORDER_AMOUNT";
export type UpsellCountMode = "TOTAL_UNITS" | "DISTINCT_PRODUCTS";

export interface UpsellBarSettings {
  enabled: boolean;
  countMode: UpsellCountMode;
  maxDiscountCap: number | null;
}

export interface UpsellStage {
  id: number;
  sortOrder: number;
  triggerType: UpsellTriggerType;
  triggerValue: string;
  discountPercent: string | null;
  discountFixedAmount: string | null;
  freeShipping: boolean;
  label: string;
  enabled: boolean;
}

export interface UpsellStageInput {
  sortOrder: number;
  triggerType: UpsellTriggerType;
  triggerValue: number;
  discountPercent?: number;
  discountFixedAmount?: number;
  freeShipping: boolean;
  label: string;
  enabled: boolean;
}

const SETTINGS_KEY = ["upsell-bar-settings"];
const STAGES_KEY = ["upsell-bar-stages"];

export function useUpsellBarSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: () => proxyFetch<UpsellBarSettings>("/admin/upsell-bar/settings") });
}

export function useUpdateUpsellBarSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<UpsellBarSettings>) =>
      proxyFetch<UpsellBarSettings>("/admin/upsell-bar/settings", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: (data) => qc.setQueryData(SETTINGS_KEY, data),
  });
}

export function useUpsellStages() {
  return useQuery({ queryKey: STAGES_KEY, queryFn: () => proxyFetch<UpsellStage[]>("/admin/upsell-bar/stages") });
}

export function useReplaceUpsellStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stages: UpsellStageInput[]) =>
      proxyFetch<UpsellStage[]>("/admin/upsell-bar/stages", { method: "PUT", body: JSON.stringify({ stages }) }),
    onSuccess: (data) => qc.setQueryData(STAGES_KEY, data),
  });
}
```

- [ ] **Step 4: Page**

Create `apps/admin/src/app/(shell)/upsell-bar/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button, Card, Icon, PageHeader, SettingsCard, ToggleSwitch } from "@amader/admin-ui";
import {
  useReplaceUpsellStages,
  useUpdateUpsellBarSettings,
  useUpsellBarSettings,
  useUpsellStages,
  type UpsellBarSettings,
  type UpsellStageInput,
  type UpsellTriggerType,
} from "@/hooks/useUpsellBar";

const upsellIcon = <Icon name="rocket_launch" />;

function emptyStage(sortOrder: number): UpsellStageInput {
  return {
    sortOrder,
    triggerType: "ITEM_COUNT",
    triggerValue: 0,
    discountPercent: undefined,
    discountFixedAmount: undefined,
    freeShipping: false,
    label: "",
    enabled: true,
  };
}

export default function UpsellBarPage() {
  const { data: settingsData, isLoading: settingsLoading } = useUpsellBarSettings();
  const { data: stagesData, isLoading: stagesLoading } = useUpsellStages();
  const updateSettings = useUpdateUpsellBarSettings();
  const replaceStages = useReplaceUpsellStages();

  const [settings, setSettings] = useState<UpsellBarSettings | null>(null);
  const [stages, setStages] = useState<UpsellStageInput[] | null>(null);

  useEffect(() => {
    if (settingsData && !settings) setSettings(settingsData);
  }, [settingsData, settings]);
  useEffect(() => {
    if (stagesData && !stages) {
      setStages(
        stagesData.map((s) => ({
          sortOrder: s.sortOrder,
          triggerType: s.triggerType,
          triggerValue: Number(s.triggerValue),
          discountPercent: s.discountPercent ? Number(s.discountPercent) : undefined,
          discountFixedAmount: s.discountFixedAmount ? Number(s.discountFixedAmount) : undefined,
          freeShipping: s.freeShipping,
          label: s.label,
          enabled: s.enabled,
        })),
      );
    }
  }, [stagesData, stages]);

  if (settingsLoading || stagesLoading || !settings || !stages) return <p className="text-sm text-muted">Loading…</p>;

  function updateStage(index: number, patch: Partial<UpsellStageInput>) {
    setStages((prev) => prev!.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function moveStage(index: number, dir: -1 | 1) {
    setStages((prev) => {
      const next = [...prev!];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((s, i) => ({ ...s, sortOrder: i + 1 }));
    });
  }

  function removeStage(index: number) {
    setStages((prev) => prev!.filter((_, i) => i !== index).map((s, i) => ({ ...s, sortOrder: i + 1 })));
  }

  function addStage() {
    setStages((prev) => [...prev!, emptyStage(prev!.length + 1)]);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={upsellIcon} title="Upsell Bar" subtitle="Configure the gamified progress bar shown in the cart drawer and checkout." />

      <SettingsCard icon={upsellIcon} title="Bar settings">
        <div className="flex flex-col gap-5">
          <ToggleSwitch
            checked={settings.enabled}
            onChange={(v) => setSettings({ ...settings, enabled: v })}
            label="Show the upsell bar in the cart drawer and checkout"
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Count mode</span>
            <select
              value={settings.countMode}
              onChange={(e) => setSettings({ ...settings, countMode: e.target.value as UpsellBarSettings["countMode"] })}
              className="h-10 w-64 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            >
              <option value="TOTAL_UNITS">Total units in cart</option>
              <option value="DISTINCT_PRODUCTS">Distinct products in cart</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Max discount cap (৳, optional)</span>
            <input
              type="number"
              min={0}
              value={settings.maxDiscountCap ?? ""}
              onChange={(e) => setSettings({ ...settings, maxDiscountCap: e.target.value === "" ? null : Number(e.target.value) })}
              className="h-10 w-40 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <Button
            type="button"
            variant="primary"
            className="self-start"
            disabled={updateSettings.isPending}
            onClick={() => updateSettings.mutate(settings)}
          >
            {updateSettings.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard icon={upsellIcon} title="Stages">
        <div className="flex flex-col gap-3">
          {stages.map((stage, i) => (
            <Card key={i} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Trigger</span>
                  <select
                    value={stage.triggerType}
                    onChange={(e) => updateStage(i, { triggerType: e.target.value as UpsellTriggerType })}
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  >
                    <option value="ITEM_COUNT">Item count</option>
                    <option value="ORDER_AMOUNT">Order amount (৳)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">{stage.triggerType === "ITEM_COUNT" ? "Items" : "Amount (৳)"}</span>
                  <input
                    type="number"
                    min={0}
                    value={stage.triggerValue}
                    onChange={(e) => updateStage(i, { triggerValue: Number(e.target.value) })}
                    className="h-10 w-28 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Discount %</span>
                  <input
                    type="number"
                    min={0}
                    value={stage.discountPercent ?? ""}
                    onChange={(e) =>
                      updateStage(i, {
                        discountPercent: e.target.value === "" ? undefined : Number(e.target.value),
                        discountFixedAmount: undefined,
                      })
                    }
                    className="h-10 w-24 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Fixed discount (৳)</span>
                  <input
                    type="number"
                    min={0}
                    value={stage.discountFixedAmount ?? ""}
                    onChange={(e) =>
                      updateStage(i, {
                        discountFixedAmount: e.target.value === "" ? undefined : Number(e.target.value),
                        discountPercent: undefined,
                      })
                    }
                    className="h-10 w-28 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  />
                </label>
                <label className="flex items-center gap-2 pb-2.5">
                  <input type="checkbox" checked={stage.freeShipping} onChange={(e) => updateStage(i, { freeShipping: e.target.checked })} />
                  <span className="text-sm text-text">Free shipping</span>
                </label>
                <label className="flex items-center gap-2 pb-2.5">
                  <input type="checkbox" checked={stage.enabled} onChange={(e) => updateStage(i, { enabled: e.target.checked })} />
                  <span className="text-sm text-text">Enabled</span>
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Label</span>
                <input
                  value={stage.label}
                  onChange={(e) => updateStage(i, { label: e.target.value })}
                  placeholder="e.g. 3% off"
                  className="h-10 w-64 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" disabled={i === 0} onClick={() => moveStage(i, -1)}>
                  Move up
                </Button>
                <Button type="button" variant="ghost" disabled={i === stages.length - 1} onClick={() => moveStage(i, 1)}>
                  Move down
                </Button>
                <Button type="button" variant="ghost" onClick={() => removeStage(i)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" disabled={stages.length >= 6} onClick={addStage}>
              Add stage
            </Button>
            <Button type="button" variant="primary" disabled={replaceStages.isPending} onClick={() => replaceStages.mutate(stages)}>
              {replaceStages.isPending ? "Saving…" : "Save stages"}
            </Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
```

- [ ] **Step 5: Verify live**

```bash
npx tsc --noEmit
```
from `apps/admin`, must be clean. Then in a browser (Playwright), log into the admin panel, confirm "Upsell Bar" appears under Marketing in the sidebar, navigate to `/upsell-bar`, toggle Enabled on, set count mode, add 2 stages (e.g. 2 items → 3% off, 4 items → 5% off + free shipping), Save both sections, reload the page, and confirm everything persisted. Leave these 2 stages configured — Task 7's verification needs real stages to check the frontend against.

---

### Task 6: `UpsellProgressBar` component in `packages/ui` (replaces `FreeShippingLadder`)

**Files:**
- Create: `packages/ui/src/components/UpsellProgressBar.tsx`
- Create: `packages/ui/src/components/UpsellProgressBar.stories.tsx`
- Delete: `packages/ui/src/components/FreeShippingLadder.tsx`
- Delete: `packages/ui/src/components/FreeShippingLadder.stories.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces: `UpsellProgressBar({stages, nextStage, className})` — consumed by Task 7's `SiteCartDrawer.tsx` and `CheckoutForm.tsx`. Props match `CartViewDto.upsell`'s shape from Task 4 exactly (`stages: {label, triggerType, triggerValue, unlocked}[]`, `nextStage: {label, triggerType, remaining} | null`), so both consumers can pass `cart.upsell.stages` / `cart.upsell.nextStage` directly with no mapping.

- [ ] **Step 1: Component**

Create `packages/ui/src/components/UpsellProgressBar.tsx`:

```tsx
"use client";

import { cn } from "../lib/cn";
import { formatMoney } from "./PriceTag";

export interface UpsellProgressBarStage {
  label: string;
  triggerType: "ITEM_COUNT" | "ORDER_AMOUNT";
  triggerValue: string;
  unlocked: boolean;
}

export interface UpsellProgressBarNextStage {
  label: string;
  triggerType: "ITEM_COUNT" | "ORDER_AMOUNT";
  remaining: string;
}

export interface UpsellProgressBarProps {
  stages: UpsellProgressBarStage[];
  nextStage: UpsellProgressBarNextStage | null;
  className?: string;
}

function remainingLabel(next: UpsellProgressBarNextStage | null): string | null {
  if (!next) return null;
  const amount =
    next.triggerType === "ORDER_AMOUNT" ? formatMoney(next.remaining) : `${next.remaining} item${next.remaining === "1" ? "" : "s"}`;
  return `Add ${amount} more to unlock ${next.label}`;
}

// Segmented, not a continuous numeric scale — stages can mix item-count and
// order-amount triggers, which have no shared unit to place on one axis.
// Progress fills to the fraction of stages unlocked; each stage gets an
// evenly-spaced checkpoint marker and its own label underneath.
export function UpsellProgressBar({ stages, nextStage, className }: UpsellProgressBarProps) {
  if (stages.length === 0) return null;

  const unlockedCount = stages.filter((s) => s.unlocked).length;
  const pct = (unlockedCount / stages.length) * 100;
  const headline = unlockedCount === stages.length ? "You've unlocked every reward!" : remainingLabel(nextStage);

  return (
    <div className={cn("rounded-[10px] bg-beige p-3", className)}>
      {headline && <p className="mb-2.5 font-ui text-xs font-medium text-ink">{headline}</p>}
      <div className="relative h-1.5 rounded-full bg-white">
        <div className="h-full rounded-full bg-green transition-all" style={{ width: `${pct}%` }} />
        <div className="absolute inset-0 flex items-center justify-between">
          {stages.map((stage, i) => (
            <div
              key={i}
              title={stage.label}
              className={cn("h-3 w-3 rounded-full border-2 border-white transition-colors", stage.unlocked ? "bg-green" : "bg-line")}
            />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between">
        {stages.map((stage, i) => (
          <span key={i} className={cn("font-ui text-[10px]", stage.unlocked ? "text-green" : "text-muted")}>
            {stage.label}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Story**

Create `packages/ui/src/components/UpsellProgressBar.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { UpsellProgressBar } from "./UpsellProgressBar";

const meta: Meta<typeof UpsellProgressBar> = {
  title: "PageSections/UpsellProgressBar",
  component: UpsellProgressBar,
  args: {
    stages: [
      { label: "3% off", triggerType: "ITEM_COUNT", triggerValue: "2", unlocked: true },
      { label: "5% off", triggerType: "ITEM_COUNT", triggerValue: "4", unlocked: false },
      { label: "Free shipping", triggerType: "ORDER_AMOUNT", triggerValue: "3000", unlocked: false },
    ],
    nextStage: { label: "5% off", triggerType: "ITEM_COUNT", remaining: "1" },
  },
};
export default meta;

type Story = StoryObj<typeof UpsellProgressBar>;

export const InProgress: Story = {};

export const AllUnlocked: Story = {
  args: {
    stages: [
      { label: "3% off", triggerType: "ITEM_COUNT", triggerValue: "2", unlocked: true },
      { label: "5% off", triggerType: "ITEM_COUNT", triggerValue: "4", unlocked: true },
    ],
    nextStage: null,
  },
};
```

- [ ] **Step 3: Delete the old component and story**

Delete `packages/ui/src/components/FreeShippingLadder.tsx` and `packages/ui/src/components/FreeShippingLadder.stories.tsx`.

- [ ] **Step 4: Update the barrel export**

In `packages/ui/src/index.ts`, replace `export * from "./components/FreeShippingLadder";` with `export * from "./components/UpsellProgressBar";`.

- [ ] **Step 5: Verify live**

```bash
npx tsc --noEmit
```
from `packages/ui`, must be clean. Also grep to confirm nothing else in the monorepo still imports `FreeShippingLadder` (Task 7 fixes the one real usage in `SiteCartDrawer.tsx` — this check should show only that file until Task 7 runs):

```bash
grep -rn "FreeShippingLadder" "h:\Amder Project\backend\apps" "h:\Amder Project\backend\packages"
```

---

### Task 7: Wire into the storefront (cart drawer + checkout) and typegen

**Files:**
- Modify: `apps/web/src/components/SiteCartDrawer.tsx`
- Modify: `apps/web/src/components/CheckoutForm.tsx`

**Interfaces:**
- Consumes: `UpsellProgressBar` from Task 6, `cart.upsell` field from Task 4's `CartViewDto` (available via `useCartQuery` in both files already).

- [ ] **Step 1: Typegen for `apps/web`**

```bash
cd "h:\Amder Project\backend\apps\web"
npm run typegen
```

(Requires the backend dev server up, already running.)

- [ ] **Step 2: `SiteCartDrawer.tsx`**

Replace the import `FreeShippingLadder` with `UpsellProgressBar` in the `@amader/ui` import block (line 9).

Replace the block:

```tsx
          {cart.freeShipping && (
            <FreeShippingLadder
              threshold={cart.freeShipping.threshold}
              remaining={cart.freeShipping.remaining}
              className="mb-3"
            />
          )}
```

with:

```tsx
          {cart.upsell && (
            <UpsellProgressBar stages={cart.upsell.stages} nextStage={cart.upsell.nextStage} className="mb-3" />
          )}
```

- [ ] **Step 3: `CheckoutForm.tsx`**

Add `UpsellProgressBar` to the existing `@amader/ui` import block (the one currently importing `Button, CartLineItem, Checkbox, Input, PaymentMethodSelector, formatMoney, useCartDrawerStore`).

Insert the banner right after the breadcrumb paragraph and before the empty-cart message, i.e. after this existing line:

```tsx
        <p className="mb-6 text-center font-body text-sm text-muted">Home &gt; Checkout</p>
```

insert:

```tsx

        {cart?.upsell && <UpsellProgressBar stages={cart.upsell.stages} nextStage={cart.upsell.nextStage} className="mb-6" />}
```

- [ ] **Step 4: Verify live**

```bash
npx tsc --noEmit
```
from `apps/web`, must be clean. Then in a browser (Playwright), using the 2 stages configured at the end of Task 5's verification (2 items → 3% off, 4 items → 5% off + free shipping):

1. Add 1 item to the cart, open the drawer — confirm the bar shows, no stage unlocked, "Add 1 item more to unlock 3% off".
2. Add a 2nd item — confirm the first checkpoint fills/unlocks, the cart's `discounts` list shows a 3% `UPSELL` entry, and the label now points at the 4-item stage.
3. Add 2 more items (4 total) — confirm the second checkpoint unlocks, the discount switches to 5%, and shipping fee shows as waived (`shippingFee: "0"` in the cart response, or the UI's shipping row reflecting it).
4. Go to `/checkout` — confirm the same bar, same unlocked state, renders at the top of the page above the empty-cart/order-review section.
5. Clean up: empty the cart afterward.

---

### Task 8: End-to-end verification and cleanup

No new files — this task is the spec's full "Testing / verification" checklist run against everything Tasks 1-7 built together, plus confirming the old free-shipping path is completely gone.

- [ ] **Step 1: Bigger-wins pricing check**

With the 2 stages from Task 5 still configured, apply a real coupon (create one via `/discounts` if none exists with a known discount amount) to a cart that also qualifies for the 3% or 5% upsell stage. Confirm via the cart API response that `total` reflects only the larger of the two discount amounts — not both added together — and that `discounts` contains only the winning side's entry (plus a zero-amount `UPSELL` free-shipping entry if the matched stage grants free shipping and the coupon doesn't).

- [ ] **Step 2: Free-shipping independence check**

Configure a case where the coupon's discount amount is larger than the upsell stage's (so the coupon wins step 1's amount comparison) but the matched upsell stage still has `freeShipping: true`. Confirm `shippingFee` is still waived in the cart response — free shipping must apply regardless of which side won.

- [ ] **Step 3: Whole-feature disable check**

In the admin `/upsell-bar` page, toggle Enabled off and save. Confirm via the storefront (drawer and checkout) that the bar disappears entirely and the cart API's `upsell` field is `null`, with no console errors in the browser. Toggle it back on afterward if continuing to test, or leave it off/stages cleared if this is the final state you want to hand back — confirm with whichever state you leave it in.

- [ ] **Step 4: Old free-shipping path fully gone**

```bash
grep -rn "free_shipping_threshold\|freeShippingLadder\|FreeShippingLadder\|FreeShippingLadderDto" "h:\Amder Project\backend\apps" "h:\Amder Project\backend\packages"
```

Must return no matches. (The orphaned `free_shipping_threshold` row, if one exists in the `Setting` table from before this feature, is harmless — nothing reads that key anymore; no DB cleanup needed for it.)

- [ ] **Step 5: Final cleanup**

Reset any test data created during verification (test coupons, cart items, stage configurations left in a non-final state) back to a clean slate, matching this session's established "clean up test data afterward" convention. Confirm `npx tsc --noEmit` is clean across `apps/backend`, `apps/admin`, `apps/web`, and `packages/ui` one more time as a final sanity pass.

- [ ] **Step 6: Append to the bug-fix log**

Per the standing instruction for this session, append a summary of this feature (what was built, files touched, key design decisions, anything deferred) to `H:\Amder Project\bug-fix-and-feature-edit.md`.
