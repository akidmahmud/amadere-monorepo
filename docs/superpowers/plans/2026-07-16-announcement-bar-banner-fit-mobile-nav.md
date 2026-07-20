# Announcement Bar, Banner-Carousel Fit Fix, Mobile Hamburger Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-editable, auto-sliding announcement bar above the storefront header; fix Hero Banner/Ad Banner carousels so mismatched-size slides crop to the first slide's real aspect ratio instead of jumping height between slides; collapse the mobile header's nav links and non-cart icons into a hamburger drawer.

**Architecture:** Announcement bar follows this codebase's established "admin-managed ordered list with per-locale translations" shape (mirrors `MenuItem`/`MenuItemTranslation` schema, service, controllers, and admin CRUD pages almost field-for-field). Banner carousel fix measures the first slide's real image dimensions client-side (`naturalWidth`/`naturalHeight` on load) and locks the carousel box to that ratio. Mobile nav reuses the exact Radix Dialog drawer pattern the cart drawer already uses, mirrored to the left side with its own Zustand store.

**Tech Stack:** NestJS + Prisma (`apps/backend`), Next.js (`apps/admin`, `apps/web`), shared React component library (`packages/ui`), `@radix-ui/react-dialog` (already a dependency, used by `CartDrawer`), Zustand (already a dependency, used by `cartDrawerStore`).

## Global Constraints

- No git commits at any point in this implementation — the user explicitly forbade them for this work. Edit files directly; do not run any `git` command.
- Announcement text is plain, admin-authored (EN + BN), no admin-configurable rotation speed — fixed 4000ms, matching `AdBannerSection`'s existing default.
- No dismiss/close control on the announcement bar — always visible while any active announcement exists.
- Mismatched-size carousel slides crop to fill (`object-cover`), never distort (`object-fit: fill`).
- Mobile hamburger drawer slides in from the **left** (cart drawer already slides from the right — must not collide).
- Banner Strip is untouched — single image, not a multi-slide carousel, no jumpy-height problem exists there.
- Every task's verification is `tsc --noEmit` on the relevant package(s) plus a live curl/SSR check against the already-running dev servers (backend :3000, admin :3004, web :3001) — this environment has no browser (Chromium not installed), so interactive/visual behavior (drawer slide animation, real auto-rotation timing, actual crop appearance) cannot be visually verified this session; disclose this explicitly in each task's report rather than claiming it as tested.

---

### Task 1: Announcement data model — schema, migration, permissions

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (insert after the `MenuItemTranslation` model, currently ending at line 1620)
- Modify: `packages/shared/src/permission-catalog.ts` (insert near the `menu_item` entries, currently lines 123-126)

**Interfaces:**
- Produces: Prisma models `Announcement` (`id, linkUrl, sortOrder, isActive, createdAt, updatedAt, translations`) and `AnnouncementTranslation` (`id, announcementId, locale, message`), and permission keys `announcement.view/create/update/delete`.

- [ ] **Step 1: Add the Prisma models**

Insert this immediately after the closing `}` of `MenuItemTranslation` (line 1620) in `packages/db/prisma/schema.prisma`, before the `// --- Net Profit` comment block:

```prisma
model Announcement {
  id        Int      @id @default(autoincrement())
  linkUrl   String?  @map("link_url")
  sortOrder Int      @default(0) @map("sort_order")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  translations AnnouncementTranslation[]

  @@map("announcements")
}

model AnnouncementTranslation {
  id             Int    @id @default(autoincrement())
  announcementId Int    @map("announcement_id")
  locale         Locale
  message        String

  announcement Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)

  @@unique([announcementId, locale])
  @@map("announcement_translations")
}
```

- [ ] **Step 2: Run the migration**

```bash
cd "H:\Amder Project\backend\packages\db" && npx prisma migrate dev --name add_announcements
```

Expected: prints `Applying migration ...add_announcements` and "Your database is now in sync with your schema."

- [ ] **Step 3: Rebuild the `@amader/db` package**

`apps/backend` resolves `@amader/db` from `packages/db/dist`, a built package — the new `Announcement`/`AnnouncementTranslation` types won't be visible to `apps/backend` until this runs (this exact gotcha bit a prior task this session — the fix was rebuilding, not just `prisma generate`):

```bash
cd "H:\Amder Project\backend\packages\db" && npm run build
```

Expected: prints `Generated Prisma Client` then completes with no `tsc` errors.

- [ ] **Step 4: Add the permission catalog entries**

In `packages/shared/src/permission-catalog.ts`, find the `menu_item` block (currently lines 123-126):

```ts
  perm('menu_item', 'view'),
  perm('menu_item', 'create'),
  perm('menu_item', 'update'),
  perm('menu_item', 'delete'),
```

Add immediately after it:

```ts
  perm('announcement', 'view'),
  perm('announcement', 'create'),
  perm('announcement', 'update'),
  perm('announcement', 'delete'),
```

- [ ] **Step 5: Re-run the seed script to register the new permissions**

```bash
cd "H:\Amder Project\backend\packages\db" && npx prisma db seed
```

Expected: prints `Seeding N permissions...` where N includes the 4 new `announcement.*` keys, and grants them to the super-admin role (the seed script's existing logic already does this for every permission in the catalog — no new code needed for that part).

- [ ] **Step 6: Verify the permission rows exist**

```bash
cd "H:\Amder Project\backend\packages\db" && node -e "
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: 'postgresql://amader:amader@localhost:5433/amader_migration' });
  await client.connect();
  const r = await client.query(\"SELECT key FROM permissions WHERE resource = 'announcement' ORDER BY action\");
  console.log(r.rows.map(row => row.key));
  await client.end();
})();
"
```

Expected: `[ 'announcement.create', 'announcement.delete', 'announcement.update', 'announcement.view' ]`.

- [ ] **Step 7: Report**

Report DONE with the migration name it created, confirmation Step 3's build succeeded with no errors, and the exact permission-key array Step 6 printed. No git commands.

---

### Task 2: Announcement backend module

**Files:**
- Create: `apps/backend/src/modules/announcements/dto/announcement-translation.dto.ts`
- Create: `apps/backend/src/modules/announcements/dto/create-announcement.dto.ts`
- Create: `apps/backend/src/modules/announcements/dto/update-announcement.dto.ts`
- Create: `apps/backend/src/modules/announcements/announcements.mapper.ts`
- Create: `apps/backend/src/modules/announcements/announcements.service.ts`
- Create: `apps/backend/src/modules/announcements/admin-announcements.controller.ts`
- Create: `apps/backend/src/modules/announcements/announcements.controller.ts`
- Create: `apps/backend/src/modules/announcements/announcements.module.ts`
- Modify: `apps/backend/src/app.module.ts` (currently imports `MenusModule` at line 44 and registers it at line 130)

**Interfaces:**
- Consumes: `Announcement`/`AnnouncementTranslation` Prisma types (Task 1), `PrismaService` (`apps/backend/src/common/prisma/prisma.service.ts`), `AdminJwtGuard`/`PermissionGuard`/`RequirePermission`/`AuditLogInterceptor` (`apps/backend/src/common/auth/*`, `apps/backend/src/common/audit-log/*`), `LocaleQueryDto` (`apps/backend/src/common/dto/locale-query.dto.ts`).
- Produces: `GET /admin/announcements`, `GET /admin/announcements/:id`, `POST /admin/announcements`, `PATCH /admin/announcements/:id`, `DELETE /admin/announcements/:id` (all permission-guarded); public `GET /announcements?locale=`. `AdminAnnouncementDto { id, linkUrl: string | null, sortOrder, isActive, translations: {locale, message}[] }`. `PublicAnnouncementDto { id, message, linkUrl: string | null }`.

- [ ] **Step 1: Create the translation DTO**

`apps/backend/src/modules/announcements/dto/announcement-translation.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class AnnouncementTranslationDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @IsString()
  @MinLength(1)
  message!: string;
}
```

- [ ] **Step 2: Create the create/update DTOs**

`apps/backend/src/modules/announcements/dto/create-announcement.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AnnouncementTranslationDto } from './announcement-translation.dto';

export class CreateAnnouncementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [AnnouncementTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnnouncementTranslationDto)
  translations!: AnnouncementTranslationDto[];
}
```

`apps/backend/src/modules/announcements/dto/update-announcement.dto.ts`:

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateAnnouncementDto } from './create-announcement.dto';

export class UpdateAnnouncementDto extends PartialType(CreateAnnouncementDto) {}
```

- [ ] **Step 3: Create the mapper**

`apps/backend/src/modules/announcements/announcements.mapper.ts`:

```ts
import { Announcement, AnnouncementTranslation, Locale } from '@amader/db';

type AnnouncementWithTranslations = Announcement & {
  translations: AnnouncementTranslation[];
};

export class AdminAnnouncementTranslationDto {
  locale!: Locale;
  message!: string;
}

export class AdminAnnouncementDto {
  id!: number;
  linkUrl!: string | null;
  sortOrder!: number;
  isActive!: boolean;
  translations!: AdminAnnouncementTranslationDto[];
}

export function toAdminAnnouncementDto(
  announcement: AnnouncementWithTranslations,
): AdminAnnouncementDto {
  return {
    id: announcement.id,
    linkUrl: announcement.linkUrl,
    sortOrder: announcement.sortOrder,
    isActive: announcement.isActive,
    translations: announcement.translations.map((t) => ({
      locale: t.locale,
      message: t.message,
    })),
  };
}

function resolveTranslation<T extends { locale: Locale }>(
  translations: T[],
  locale: Locale,
): T | undefined {
  return translations.find((t) => t.locale === locale) ?? translations[0];
}

export class PublicAnnouncementDto {
  id!: number;
  message!: string;
  linkUrl!: string | null;
}

export function toPublicAnnouncementDto(
  announcement: AnnouncementWithTranslations,
  locale: Locale,
): PublicAnnouncementDto {
  const translation = resolveTranslation(announcement.translations, locale);
  return {
    id: announcement.id,
    message: translation?.message ?? '',
    linkUrl: announcement.linkUrl,
  };
}
```

- [ ] **Step 4: Create the service**

`apps/backend/src/modules/announcements/announcements.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Locale } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import {
  AdminAnnouncementDto,
  PublicAnnouncementDto,
  toAdminAnnouncementDto,
  toPublicAnnouncementDto,
} from './announcements.mapper';

const WITH_TRANSLATIONS = { translations: true } as const;

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async adminList(): Promise<AdminAnnouncementDto[]> {
    const items = await this.prisma.client.announcement.findMany({
      include: WITH_TRANSLATIONS,
      orderBy: { sortOrder: 'asc' },
    });
    return items.map(toAdminAnnouncementDto);
  }

  async adminGet(id: number): Promise<AdminAnnouncementDto> {
    const item = await this.prisma.client.announcement.findUnique({
      where: { id },
      include: WITH_TRANSLATIONS,
    });
    if (!item) throw new NotFoundException('Announcement not found');
    return toAdminAnnouncementDto(item);
  }

  async create(dto: CreateAnnouncementDto): Promise<AdminAnnouncementDto> {
    const item = await this.prisma.client.announcement.create({
      data: {
        linkUrl: dto.linkUrl,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        translations: { create: dto.translations },
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminAnnouncementDto(item);
  }

  async update(id: number, dto: UpdateAnnouncementDto): Promise<AdminAnnouncementDto> {
    await this.adminGet(id);

    if (dto.translations) {
      await this.prisma.client.announcementTranslation.deleteMany({
        where: { announcementId: id },
      });
    }

    const item = await this.prisma.client.announcement.update({
      where: { id },
      data: {
        linkUrl: dto.linkUrl,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        translations: dto.translations ? { create: dto.translations } : undefined,
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminAnnouncementDto(item);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.announcement.delete({ where: { id } });
  }

  async publicList(locale: Locale): Promise<PublicAnnouncementDto[]> {
    const items = await this.prisma.client.announcement.findMany({
      where: { isActive: true },
      include: WITH_TRANSLATIONS,
      orderBy: { sortOrder: 'asc' },
    });
    return items.map((item) => toPublicAnnouncementDto(item, locale));
  }
}
```

- [ ] **Step 5: Create the admin controller**

`apps/backend/src/modules/announcements/admin-announcements.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { AdminAnnouncementDto } from './announcements.mapper';

@ApiTags('admin/announcements')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/announcements')
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @RequirePermission('announcement.view')
  @ApiOkResponse({ type: AdminAnnouncementDto, isArray: true })
  list(): Promise<AdminAnnouncementDto[]> {
    return this.announcements.adminList();
  }

  @Get(':id')
  @RequirePermission('announcement.view')
  @ApiOkResponse({ type: AdminAnnouncementDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminAnnouncementDto> {
    return this.announcements.adminGet(id);
  }

  @Post()
  @RequirePermission('announcement.create')
  @ApiOkResponse({ type: AdminAnnouncementDto })
  create(@Body() dto: CreateAnnouncementDto): Promise<AdminAnnouncementDto> {
    return this.announcements.create(dto);
  }

  @Patch(':id')
  @RequirePermission('announcement.update')
  @ApiOkResponse({ type: AdminAnnouncementDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
  ): Promise<AdminAnnouncementDto> {
    return this.announcements.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('announcement.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.announcements.delete(id);
  }
}
```

- [ ] **Step 6: Create the public controller**

`apps/backend/src/modules/announcements/announcements.controller.ts`:

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { AnnouncementsService } from './announcements.service';
import { PublicAnnouncementDto } from './announcements.mapper';

@ApiTags('announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @ApiOkResponse({ type: PublicAnnouncementDto, isArray: true })
  list(@Query() { locale }: LocaleQueryDto): Promise<PublicAnnouncementDto[]> {
    return this.announcements.publicList(locale ?? 'EN');
  }
}
```

- [ ] **Step 7: Create the module**

`apps/backend/src/modules/announcements/announcements.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AdminAnnouncementsController } from './admin-announcements.controller';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

@Module({
  controllers: [AnnouncementsController, AdminAnnouncementsController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}
```

- [ ] **Step 8: Register the module in `app.module.ts`**

Add the import (near the `MenusModule` import, currently line 44):

```ts
import { AnnouncementsModule } from './modules/announcements/announcements.module';
```

Add it to the `imports` array (near `MenusModule`, currently line 130):

```ts
    AnnouncementsModule,
```

- [ ] **Step 9: Typecheck**

```bash
cd "H:\Amder Project\backend" && npx tsc --noEmit -p apps/backend/tsconfig.json
```

Expected: no output (clean).

- [ ] **Step 10: Live verification**

The dev backend hot-reloads on save.

```bash
cd "H:\Amder Project\backend"
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/admin/auth/login -H "Content-Type: application/json" -d '{"email":"admin@amadere.com","password":"ChangeMe123!"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.accessToken))")

# Create two test announcements.
ID1=$(curl -s -X POST http://localhost:3000/api/v1/admin/announcements -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"sortOrder":0,"translations":[{"locale":"EN","message":"Free shipping over ৳999"},{"locale":"BN","message":"৳৯৯৯৳বেশিকেনাকাটাপহুঁছাইলিষিং"}]}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))")
ID2=$(curl -s -X POST http://localhost:3000/api/v1/admin/announcements -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"sortOrder":1,"linkUrl":"/collections/amader-modhu","translations":[{"locale":"EN","message":"20% off honey this week"},{"locale":"BN","message":"20% off honey this week BN"}]}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))")
echo "created: $ID1 $ID2"

# Public endpoint returns both, ordered.
curl -s "http://localhost:3000/api/v1/announcements?locale=EN"

# Clean up.
curl -s -X DELETE "http://localhost:3000/api/v1/admin/announcements/$ID1" -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE "http://localhost:3000/api/v1/admin/announcements/$ID2" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/api/v1/announcements?locale=EN"
```

Expected: the first `GET /announcements` call returns `{"success":true,"data":[{"id":<ID1>,"message":"Free shipping over ৳999","linkUrl":null},{"id":<ID2>,"message":"20% off honey this week","linkUrl":"/collections/amader-modhu"}]}`; the final call after deletion returns `{"success":true,"data":[]}`.

- [ ] **Step 11: Report**

Report DONE with the typecheck result and the exact curl output from Step 10 (both the populated and empty-after-cleanup responses). No git commands.

---

### Task 3: Announcement admin UI

**Files:**
- Create: `apps/admin/src/hooks/useAnnouncements.ts`
- Create: `apps/admin/src/app/(shell)/announcements/page.tsx`
- Create: `apps/admin/src/app/(shell)/announcements/new/page.tsx`
- Create: `apps/admin/src/app/(shell)/announcements/[id]/page.tsx`
- Modify: `apps/admin/src/lib/nav-config.tsx` (add an `announcementsIcon` const near line 25's `menuItemsIcon`, and a nav entry near line 107's `menu-items` entry)

**Interfaces:**
- Consumes: `GET/POST/PATCH/DELETE /admin/announcements[/:id]` (Task 2), `proxyFetch` (`apps/admin/src/lib/api/proxy-client.ts`, same helper `useMenuItems.ts` already uses).
- Produces: `useAnnouncements()`, `useCreateAnnouncement()`, `useUpdateAnnouncement(id)`, `useDeleteAnnouncement()` (same shape as `useMenuItems.ts`'s exports).

- [ ] **Step 1: Regenerate admin's OpenAPI types**

Task 2's new endpoints need to exist in `apps/admin/src/lib/api/schema.d.ts` before this task's hooks can reference `components["schemas"]["AdminAnnouncementDto"]`.

```bash
cd "H:\Amder Project\backend\apps\admin" && npm run typegen
```

Expected: prints `openapi-typescript ... → src/lib/api/schema.d.ts` success line.

- [ ] **Step 2: Create the hook file**

`apps/admin/src/hooks/useAnnouncements.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type Announcement = components["schemas"]["AdminAnnouncementDto"];
export type AnnouncementInput = components["schemas"]["CreateAnnouncementDto"];

const KEY = ["admin-announcements"];

export function useAnnouncements() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<Announcement[]>("/admin/announcements"),
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AnnouncementInput) =>
      proxyFetch<Announcement>("/admin/announcements", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAnnouncement(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AnnouncementInput>) =>
      proxyFetch<Announcement>(`/admin/announcements/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
```

- [ ] **Step 3: Typecheck (confirms the schema types resolve)**

```bash
cd "H:\Amder Project\backend" && npx tsc --noEmit -p apps/admin/tsconfig.json
```

Expected: no output.

- [ ] **Step 4: Create the list page**

`apps/admin/src/app/(shell)/announcements/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useAnnouncements, useDeleteAnnouncement } from "@/hooks/useAnnouncements";

export default function AnnouncementsPage() {
  const { data: items, isLoading } = useAnnouncements();
  const deleteItem = useDeleteAnnouncement();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{items?.length ?? 0} announcements</p>
        <Link href="/announcements/new">
          <Button variant="primary">Add announcement</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {items && items.length === 0 && <p className="text-sm text-muted">No announcements yet.</p>}

      <div className="flex flex-col gap-3">
        {items?.map((item) => (
          <Card key={item.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">{item.translations[0]?.message}</div>
              <div className="text-xs text-muted">
                {item.isActive ? "active" : "inactive"}
                {item.linkUrl && ` · ${item.linkUrl}`}
              </div>
            </div>
            <Link href={`/announcements/${item.id}`}>
              <Button type="button" variant="ghost">Edit</Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${item.translations[0]?.message}"?`)) deleteItem.mutate(item.id);
              }}
            >
              Delete
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 5: Create the new-item page**

`apps/admin/src/app/(shell)/announcements/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useCreateAnnouncement } from "@/hooks/useAnnouncements";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function NewAnnouncementPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const create = useCreateAnnouncement();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      linkUrl: linkUrl || undefined,
      sortOrder: 0,
      isActive,
      translations: [{ locale: "EN", message }, { locale: "BN", message }],
    });
    router.push("/announcements");
  }

  return (
    <Card className="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Message</span>
          <input required value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Link (optional)</span>
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className={inputClass} />
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create announcement"}
          </Button>
          <Link href="/announcements">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
```

- [ ] **Step 6: Create the edit page**

`apps/admin/src/app/(shell)/announcements/[id]/page.tsx`:

```tsx
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useAnnouncements, useUpdateAnnouncement } from "@/hooks/useAnnouncements";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const announcementId = Number(id);
  const router = useRouter();
  const { data: items, isLoading } = useAnnouncements();
  const item = items?.find((i) => i.id === announcementId);
  const update = useUpdateAnnouncement(announcementId);

  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!item) return;
    setMessage(item.translations[0]?.message ?? "");
    setLinkUrl(item.linkUrl ?? "");
    setIsActive(item.isActive);
  }, [item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      linkUrl: linkUrl || undefined,
      isActive,
      translations: [{ locale: "EN", message }, { locale: "BN", message }],
    });
    router.push("/announcements");
  }

  if (isLoading || !item) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <Card className="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Message</span>
          <input required value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Link (optional)</span>
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className={inputClass} />
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Link href="/announcements">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
```

- [ ] **Step 7: Add the nav-config entry**

In `apps/admin/src/lib/nav-config.tsx`, add near the `menuItemsIcon` const (currently line 25):

```tsx
const announcementsIcon = <Icon name="campaign" />;
```

Add near the `menu-items` nav entry (currently line 107):

```tsx
      { key: "announcements", label: "Announcements", href: "/announcements", icon: announcementsIcon },
```

- [ ] **Step 8: Typecheck**

```bash
cd "H:\Amder Project\backend" && npx tsc --noEmit -p apps/admin/tsconfig.json
```

Expected: no output.

- [ ] **Step 9: Live SSR verification**

```bash
cd "H:\Amder Project\backend"
curl -s -o /dev/null -w "announcements list status: %{http_code}\n" "http://localhost:3004/announcements"
curl -s -o /dev/null -w "announcements new status: %{http_code}\n" "http://localhost:3004/announcements/new"
```

Expected: both print `200` (or a redirect-to-login status if the admin session cookie isn't present in this curl call — either is acceptable evidence the route compiles and resolves; a 500 is not).

- [ ] **Step 10: Report**

Report DONE with both typecheck results and the two status codes from Step 9. No git commands.

---

### Task 4: Storefront announcement bar

**Files:**
- Create: `packages/ui/src/components/AnnouncementBar.tsx`
- Modify: `packages/ui/src/index.ts` (add an export line near line 21's `Header` export)
- Create: `apps/web/src/hooks/useAnnouncements.ts`

**Interfaces:**
- Consumes: `GET /api/v1/announcements?locale=` (Task 2), `DefaultLink`/`LinkComponent` (`packages/ui/src/lib/link-component.ts`), `api.GET` (`apps/web/src/lib/api/client.ts`, same helper `useNavCollections.ts` already uses).
- Produces: `AnnouncementBar` component (`items: {id, message, linkUrl}[]`, `autoplayMs?`, `linkComponent?`), `useAnnouncements(locale: "EN" | "BN")` hook.

- [ ] **Step 1: Create the `AnnouncementBar` component**

`packages/ui/src/components/AnnouncementBar.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface AnnouncementItem {
  id: number;
  message: string;
  linkUrl?: string | null;
}

export interface AnnouncementBarProps {
  items: AnnouncementItem[];
  /** Only relevant with 2+ announcements — how often it auto-advances. */
  autoplayMs?: number;
  linkComponent?: LinkComponent;
}

// Always visible while any active announcement exists — no dismiss control.
// Auto-advances through multiple messages the same way AdBannerSection does
// (a plain setInterval, dot-free — there's nothing to click to jump to a
// specific message, matching the reference design's plain rotating text).
export function AnnouncementBar({ items, autoplayMs = 4000, linkComponent: Link = DefaultLink }: AnnouncementBarProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), autoplayMs);
    return () => clearInterval(timer);
  }, [items.length, autoplayMs]);

  if (items.length === 0) return null;

  const current = items[Math.min(index, items.length - 1)];
  const content = <p className="font-ui text-[13px] font-medium text-white">{current.message}</p>;

  return (
    <div className="flex h-9 w-full items-center justify-center bg-green px-5">
      {current.linkUrl ? (
        <Link href={current.linkUrl} className="hover:underline">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
```

- [ ] **Step 2: Export it from the package index**

In `packages/ui/src/index.ts`, add near the `Header` export (currently line 21):

```ts
export * from "./components/AnnouncementBar";
```

- [ ] **Step 3: Typecheck `packages/ui`**

```bash
cd "H:\Amder Project\backend" && npx tsc --noEmit -p packages/ui/tsconfig.json
```

Expected: no output.

- [ ] **Step 4: Regenerate `apps/web`'s OpenAPI types and create the hook**

```bash
cd "H:\Amder Project\backend\apps\web" && npm run typegen
```

Expected: `openapi-typescript ... → src/lib/api/schema.d.ts` success line.

`apps/web/src/hooks/useAnnouncements.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function useAnnouncements(locale: "EN" | "BN") {
  return useQuery({
    queryKey: ["announcements", locale],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/announcements", { params: { query: { locale } } });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 5: Typecheck `apps/web`**

```bash
cd "H:\Amder Project\backend" && npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: no output. (This hook isn't imported anywhere yet — Task 7 wires it into `SiteHeader.tsx` — so this step only confirms the file itself compiles.)

- [ ] **Step 6: Report**

Report DONE with both typecheck results. No git commands.

---

### Task 5: Hero Banner and Ad Banner — lock to first slide's real aspect ratio

**Files:**
- Modify: `packages/ui/src/components/HeroCarousel.tsx` (full current content shown below — replace entirely)
- Modify: `packages/ui/src/components/AdBannerSection.tsx` (full current content shown below — replace entirely)

**Interfaces:**
- No new exports — `HeroCarouselProps`/`AdBannerSectionProps` are unchanged; this is a pure internal-rendering change.

- [ ] **Step 1: Replace `HeroCarousel.tsx` in full**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";
import { PlaceholderBanner } from "./PlaceholderBanner";

export interface HeroSlide {
  imageUrl: string;
  linkUrl?: string;
}

export interface HeroCarouselProps {
  slides?: HeroSlide[];
  stripImageUrl?: string;
  stripLinkUrl?: string;
  linkComponent?: LinkComponent;
  slideCount?: number;
  activeSlide?: number;
  /** Only relevant with 2+ slides — how often it auto-advances. */
  autoplayMs?: number;
}

// Placeholder used only until the first real slide's image finishes loading
// and reports its actual size (see handleFirstImageLoad below) — keeps the
// box from being empty/collapsed during that brief window, close enough to
// the old fixed 1882:500 design constant that there's no visible jump once
// the real ratio is measured.
const DEFAULT_HERO_RATIO = 1882 / 500;

// The banner module now ships (HomepageSection, type HERO_BANNER) — real
// slides render here; the placeholder-with-dots stays as the empty-state
// fallback until an admin adds at least one slide.
export function HeroCarousel({
  slides,
  stripImageUrl,
  stripLinkUrl,
  linkComponent: Link = DefaultLink,
  slideCount = 8,
  activeSlide = 0,
  autoplayMs = 5000,
}: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [lockedRatio, setLockedRatio] = useState<number | null>(null);
  const hasLockedRatio = useRef(false);

  // Defense in depth: admin-entered config can end up with a slide that has
  // no image yet (e.g. "Add slide" clicked before an upload finishes) — an
  // empty imageUrl must never reach `<img src>`, so filter here regardless
  // of whether the admin form that produced this config already validates it.
  const validSlides = slides?.filter((slide) => slide.imageUrl);
  const slideTotal = validSlides?.length ?? 0;

  useEffect(() => {
    if (slideTotal <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slideTotal), autoplayMs);
    return () => clearInterval(timer);
  }, [slideTotal, autoplayMs]);

  // Locks the carousel's box to whichever slide's image finishes loading
  // first — in practice always the first slide, since it starts loading
  // immediately on mount and autoplayMs (5s+) gives it plenty of time to
  // finish before the carousel could advance to slide 2. The ref guard
  // means every later slide (matching or mismatched size) renders inside
  // this same fixed box instead of each slide independently resizing it.
  function handleFirstImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (hasLockedRatio.current) return;
    hasLockedRatio.current = true;
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) setLockedRatio(naturalWidth / naturalHeight);
  }

  if (!validSlides || validSlides.length === 0) {
    return (
      <div>
        <PlaceholderBanner variant="hero" dotCount={slideCount} activeDot={activeSlide} />
        <PlaceholderBanner variant="strip" className="mt-5" />
      </div>
    );
  }

  const current = validSlides[Math.min(index, validSlides.length - 1)];
  // Box height is locked to the first slide's real aspect ratio (see
  // handleFirstImageLoad) instead of each slide having independent height —
  // a mismatched-size slide crops to fill (object-cover, no distortion)
  // instead of changing the carousel's height as it transitions.
  const image = (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-gray"
      style={{ aspectRatio: lockedRatio ?? DEFAULT_HERO_RATIO }}
    >
      <img src={current.imageUrl} alt="" onLoad={handleFirstImageLoad} className="h-full w-full object-cover" />
    </div>
  );

  return (
    <div>
      <div className="relative">
        {current.linkUrl ? <Link href={current.linkUrl}>{image}</Link> : image}
        {validSlides.length > 1 && (
          <div className="absolute bottom-3.5 left-1/2 flex -translate-x-1/2 gap-2">
            {validSlides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-[9px] w-[9px] rounded-full",
                  i === index ? "bg-[#333]" : "bg-white",
                )}
              />
            ))}
          </div>
        )}
      </div>
      {stripImageUrl &&
        (stripLinkUrl ? (
          <Link href={stripLinkUrl}>
            <img
              src={stripImageUrl}
              alt=""
              className="mt-5 h-[150px] w-full rounded-2xl object-cover"
            />
          </Link>
        ) : (
          <img
            src={stripImageUrl}
            alt=""
            className="mt-5 h-[150px] w-full rounded-2xl object-cover"
          />
        ))}
    </div>
  );
}
```

- [ ] **Step 2: Replace `AdBannerSection.tsx` in full**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";

export interface AdBannerImage {
  imageUrl: string;
  linkUrl?: string;
}

export interface AdBannerSectionProps {
  images: AdBannerImage[];
  /** Only relevant with 2+ images — how often it auto-advances. */
  autoplayMs?: number;
  linkComponent?: LinkComponent;
}

// Same reasoning as HeroCarousel's DEFAULT_HERO_RATIO — a placeholder used
// only until the first real image reports its actual size.
const DEFAULT_AD_BANNER_RATIO = 1686 / 759;

// One image = plain static banner. More than one = an auto-advancing slider
// (dot indicators double as manual override), same visual language as
// HeroCarousel but with a real autoplay timer, which that one doesn't have.
export function AdBannerSection({ images, autoplayMs = 4000, linkComponent: Link = DefaultLink }: AdBannerSectionProps) {
  const valid = images.filter((i) => i.imageUrl);
  const [index, setIndex] = useState(0);
  const [lockedRatio, setLockedRatio] = useState<number | null>(null);
  const hasLockedRatio = useRef(false);

  useEffect(() => {
    if (valid.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % valid.length), autoplayMs);
    return () => clearInterval(timer);
  }, [valid.length, autoplayMs]);

  // Same first-image-locks-the-box approach as HeroCarousel — see that
  // file's handleFirstImageLoad for the full reasoning.
  function handleFirstImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (hasLockedRatio.current) return;
    hasLockedRatio.current = true;
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) setLockedRatio(naturalWidth / naturalHeight);
  }

  if (valid.length === 0) return null;

  const current = valid[Math.min(index, valid.length - 1)];
  const image = (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-gray"
      style={{ aspectRatio: lockedRatio ?? DEFAULT_AD_BANNER_RATIO }}
    >
      <img src={current.imageUrl} alt="" onLoad={handleFirstImageLoad} className="h-full w-full object-cover" />
    </div>
  );

  return (
    <div className="relative">
      {current.linkUrl ? <Link href={current.linkUrl}>{image}</Link> : image}
      {valid.length > 1 && (
        <div className="absolute bottom-3.5 left-1/2 flex -translate-x-1/2 gap-2">
          {valid.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn("h-[9px] w-[9px] rounded-full", i === index ? "bg-[#333]" : "bg-white")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd "H:\Amder Project\backend" && npx tsc --noEmit -p packages/ui/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: no output from either command.

- [ ] **Step 4: Live SSR verification**

```bash
curl -s -o /dev/null -w "homepage status: %{http_code}\n" "http://localhost:3001/"
curl -s "http://localhost:3001/" | grep -oE 'aspectRatio' | head -1
```

Expected: `status: 200`; the `aspectRatio` inline-style key appears in the rendered HTML (confirms the new `style={{ aspectRatio: ... }}` is reaching the DOM — the actual measured value can't be confirmed via curl since `naturalWidth`/`naturalHeight` are only known client-side after the browser decodes the image, which is exactly the interactive gap this plan's Global Constraints section discloses rather than works around).

- [ ] **Step 5: Report**

Report DONE with both typecheck results and the SSR check output. Explicitly note that the real client-side ratio-locking behavior (does it actually measure correctly, does a mismatched second slide actually crop instead of distort) is not visually verifiable in this environment — state this as a known gap, not as tested. No git commands.

---

### Task 6: Mobile nav drawer store and component

**Files:**
- Create: `packages/ui/src/stores/mobileNavDrawerStore.ts`
- Create: `packages/ui/src/components/MobileNavDrawer.tsx`
- Modify: `packages/ui/src/index.ts` (add an export line near the existing `CartDrawer` export, currently line 24)

**Interfaces:**
- Consumes: `@radix-ui/react-dialog` (already a dependency — `CartDrawer.tsx` already imports it), `DefaultLink`/`LinkComponent`.
- Produces: `useMobileNavDrawerStore` (`{isOpen, open(), close(), toggle()}` — same shape as `useCartDrawerStore`), `MobileNavDrawer` component (`title, closeLabel, navItems: {key,href,label}[], accountHref?, accountLabel?, trackOrderHref, trackOrderLabel, localeSwitchLabel, onLocaleSwitch, linkComponent?`).

- [ ] **Step 1: Create the store**

`packages/ui/src/stores/mobileNavDrawerStore.ts`:

```ts
"use client";

import { create } from "zustand";

export interface MobileNavDrawerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useMobileNavDrawerStore = create<MobileNavDrawerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
```

- [ ] **Step 2: Create the drawer component**

`packages/ui/src/components/MobileNavDrawer.tsx`:

```tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { useMobileNavDrawerStore } from "../stores/mobileNavDrawerStore";

const closeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export interface MobileNavDrawerNavItem {
  key: string;
  href: string;
  label: string;
}

export interface MobileNavDrawerProps {
  title: string;
  closeLabel: string;
  navItems: MobileNavDrawerNavItem[];
  accountHref?: string;
  accountLabel?: string;
  trackOrderHref: string;
  trackOrderLabel: string;
  localeSwitchLabel: string;
  onLocaleSwitch: () => void;
  linkComponent?: LinkComponent;
}

// Mirrors CartDrawer.tsx's exact Radix Dialog structure (same overlay/panel
// classes), mirrored to the left instead of the right so the two drawers
// never visually collide if somehow both were open.
export function MobileNavDrawer({
  title,
  closeLabel,
  navItems,
  accountHref,
  accountLabel,
  trackOrderHref,
  trackOrderLabel,
  localeSwitchLabel,
  onLocaleSwitch,
  linkComponent: Link = DefaultLink,
}: MobileNavDrawerProps) {
  const isOpen = useMobileNavDrawerStore((s) => s.isOpen);
  const close = useMobileNavDrawerStore((s) => s.close);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(20,40,25,.45)] data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <Dialog.Content
          className="fixed left-0 top-0 z-[70] flex h-full w-[320px] max-w-[85vw] flex-col bg-white"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between bg-green px-5 py-4 text-white">
            <Dialog.Title className="font-ui text-[15px] tracking-wide">{title.toUpperCase()}</Dialog.Title>
            <Dialog.Close aria-label={closeLabel} className="grid place-items-center">
              {closeIcon}
            </Dialog.Close>
          </div>

          <nav className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={close}
                className="border-b border-line py-3 font-ui text-sm font-medium text-ink hover:text-green"
              >
                {item.label}
              </Link>
            ))}

            <div className="mt-4 flex flex-col gap-3">
              {accountHref && accountLabel && (
                <Link href={accountHref} onClick={close} className="font-ui text-sm font-medium text-ink hover:text-green">
                  {accountLabel}
                </Link>
              )}
              <Link href={trackOrderHref} onClick={close} className="font-ui text-sm font-medium text-ink hover:text-green">
                {trackOrderLabel}
              </Link>
              <button
                type="button"
                onClick={() => {
                  onLocaleSwitch();
                  close();
                }}
                className="text-left font-ui text-sm font-medium text-ink hover:text-green"
              >
                {localeSwitchLabel}
              </button>
            </div>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 3: Export both from the package index**

In `packages/ui/src/index.ts`, add near the `CartDrawer` export (currently line 24):

```ts
export * from "./components/MobileNavDrawer";
```

(`useMobileNavDrawerStore` doesn't need a separate index export — check first whether `cartDrawerStore` itself is exported from `index.ts` at all; `Header.tsx` imports it directly via a relative path (`../stores/cartDrawerStore`), not through the package index. Follow that same convention — `SiteHeader.tsx` in Task 7 will import `useMobileNavDrawerStore` the same way it would need to for rendering the drawer directly, but since `MobileNavDrawer` itself already reads from the store internally, `SiteHeader.tsx` doesn't need the store at all, only `Header.tsx` does for the toggle button — see Task 7.)

- [ ] **Step 4: Typecheck**

```bash
cd "H:\Amder Project\backend" && npx tsc --noEmit -p packages/ui/tsconfig.json
```

Expected: no output.

- [ ] **Step 5: Report**

Report DONE with the typecheck result. Note this component isn't wired into any page yet (Task 7 does that) so there's nothing further to verify live at this point. No git commands.

---

### Task 7: Wire the hamburger button, drawer, and desktop-only nav row into the header

**Files:**
- Modify: `packages/ui/src/components/Header.tsx` (full current content shown below — replace entirely)
- Modify: `packages/ui/src/components/Header.stories.tsx` (add one field to `meta.args` — this file is inside `packages/ui/tsconfig.json`'s typechecked `src` scope, so it breaks once `mobileMenuLabel` becomes a required prop)
- Modify: `packages/ui/src/components/Nav.tsx:28` (one class change)
- Modify: `apps/web/src/components/SiteHeader.tsx` (full current content shown below — replace entirely)
- Modify: `apps/web/messages/en.json` (add two keys to the `header` object, currently lines 9-16)
- Modify: `apps/web/messages/bn.json` (same two keys, translated)

**Interfaces:**
- Consumes: `useMobileNavDrawerStore` (Task 6), `MobileNavDrawer`/`AnnouncementBar` (Tasks 6, 4), `useAnnouncements` (Task 4).
- Produces: `HeaderProps` gains one new required field: `mobileMenuLabel: string`.

- [ ] **Step 1: Replace `Header.tsx` in full**

```tsx
"use client";

import { FormEvent, ReactNode, useState } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { useCartDrawerStore } from "../stores/cartDrawerStore";
import { useMobileNavDrawerStore } from "../stores/mobileNavDrawerStore";

const leaf = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-green">
    <path d="M17 8C8 10 5.9 16.2 3.8 21.5c-.4 1 .5 1.9 1.5 1.5C10.6 21 16.8 18.9 19 10c1-4 .4-6-1.5-8C15.6.2 12.6.6 10 3c-1.5 1.4-2 3.5-1 5 .5.8 1.5 1.2 2.3 1 1-.3 1.7-1.5 1.7-2.5" />
  </svg>
);
const searchIcon = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.2}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4-4" />
  </svg>
);
const trackIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
    <path d="M3 7h13v10H3zM16 10h3l2 3v4h-5" />
    <circle cx="7" cy="18" r="1.6" />
    <circle cx="18" cy="18" r="1.6" />
  </svg>
);
const cartIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
  </svg>
);
const accountIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
  </svg>
);
const hamburgerIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
    <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
  </svg>
);

export interface HeaderProps {
  brandHref: string;
  brandMark: string;
  logoUrl?: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  onSearchSubmit?: (query: string) => void;
  onSearchQueryChange?: (query: string) => void;
  searchSuggestions?: ReactNode;
  trackOrderHref: string;
  trackOrderLabel: string;
  accountHref?: string;
  accountLabel?: string;
  cartLabel: string;
  cartCount?: number;
  localeSwitchLabel: string;
  onLocaleSwitch: () => void;
  /** aria-label for the mobile-only hamburger button that opens MobileNavDrawer. */
  mobileMenuLabel: string;
  linkComponent?: LinkComponent;
  className?: string;
}

export function Header({
  brandHref,
  brandMark,
  logoUrl,
  searchPlaceholder,
  searchAriaLabel,
  onSearchSubmit,
  onSearchQueryChange,
  searchSuggestions,
  trackOrderHref,
  trackOrderLabel,
  accountHref,
  accountLabel,
  cartLabel,
  cartCount,
  localeSwitchLabel,
  onLocaleSwitch,
  mobileMenuLabel,
  linkComponent: Link = DefaultLink,
  className,
}: HeaderProps) {
  const [query, setQuery] = useState("");
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const openCart = useCartDrawerStore((s) => s.open);
  const openMobileNav = useMobileNavDrawerStore((s) => s.open);

  function handleQueryChange(value: string) {
    setQuery(value);
    onSearchQueryChange?.(value);
    setIsSuggestionsOpen(value.trim().length > 0);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSuggestionsOpen(false);
    onSearchSubmit?.(query);
  }

  return (
    <header className={cn("sticky top-0 z-40 bg-white", className)}>
      {/* 3-zone header: logo pinned left, search truly centered (CSS grid,
          not flex auto-margins — those drift off-center whenever the logo
          and icons zones differ in width), icons pinned right. Each zone
          carries an id so it's directly identifiable in devtools (Elements
          panel shows the id on the tag; "Copy selector" yields "#site-header-…"). */}
      <div
        id="site-header-row"
        className="flex w-full flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 sm:grid sm:grid-cols-[auto_1fr_auto] sm:flex-nowrap sm:h-32 sm:py-0"
      >
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={mobileMenuLabel}
            onClick={openMobileNav}
            className="grid h-8 w-8 place-items-center text-ink sm:hidden"
          >
            {hamburgerIcon}
          </button>
          <Link id="site-header-logo" href={brandHref} className="flex shrink-0 items-center gap-1.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brandMark} className="mt-2 h-28 w-auto" />
            ) : (
              <>
                {leaf}
                <span className="font-bengali text-[25px] font-bold leading-none text-green">
                  {brandMark}
                  <span className="align-super text-[8px]">™</span>
                </span>
              </>
            )}
          </Link>
        </div>

        <div
          id="site-header-search"
          className="relative order-3 w-full sm:order-none sm:w-full sm:max-w-[440px] sm:justify-self-center"
        >
          <form
            onSubmit={handleSubmit}
            className="flex h-10 w-full items-center rounded-[30px] bg-beige pl-5 pr-2"
          >
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => query.trim().length > 0 && setIsSuggestionsOpen(true)}
              onBlur={() => setIsSuggestionsOpen(false)}
              placeholder={searchPlaceholder}
              className="w-0 flex-1 bg-transparent font-body text-[13.5px] text-ink outline-none placeholder:text-[#9c9080]"
            />
            <button
              type="submit"
              aria-label={searchAriaLabel}
              className="grid h-7 w-7 shrink-0 place-items-center text-green-deep"
            >
              {searchIcon}
            </button>
          </form>
          {isSuggestionsOpen && searchSuggestions && (
            // onMouseDown here fires before the input's onBlur, and
            // preventDefault stops that mousedown from shifting focus away
            // from the input at all — so blur never closes this before a
            // click on a suggestion link gets to run.
            <div
              onMouseDown={(e) => e.preventDefault()}
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[14px] border border-line bg-white shadow-brand"
            >
              {searchSuggestions}
            </div>
          )}
        </div>

        <div
          id="site-header-icons"
          className="order-2 ml-auto flex shrink-0 items-center gap-4 sm:order-none sm:ml-0 sm:justify-self-end"
        >
          <button
            type="button"
            onClick={onLocaleSwitch}
            className="hidden font-ui text-[13px] font-medium text-ink hover:text-green sm:block"
          >
            {localeSwitchLabel}
          </button>
          {accountHref && accountLabel && (
            <Link href={accountHref} aria-label={accountLabel} className="hidden place-items-center text-green sm:grid">
              {accountIcon}
            </Link>
          )}
          <Link href={trackOrderHref} aria-label={trackOrderLabel} className="hidden place-items-center text-green sm:grid">
            {trackIcon}
          </Link>
          <button
            type="button"
            aria-label={cartLabel}
            onClick={openCart}
            className="relative grid place-items-center text-green"
          >
            {cartIcon}
            {cartCount !== undefined && cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-gold text-[10px] font-bold text-green-deep">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 1b: Add the new required prop to `Header.stories.tsx`'s args**

In `packages/ui/src/components/Header.stories.tsx`, add `mobileMenuLabel: "Menu",` to the `meta.args` object (after `localeSwitchLabel: "বাংলা",`):

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Header } from "./Header";

const meta: Meta<typeof Header> = {
  title: "Layout/Header",
  component: Header,
  args: {
    brandHref: "/",
    brandMark: "আমাদের",
    searchPlaceholder: "Search",
    searchAriaLabel: "Search",
    trackOrderHref: "/track",
    trackOrderLabel: "Track order",
    accountHref: "/account",
    accountLabel: "My Account",
    cartLabel: "Cart",
    localeSwitchLabel: "বাংলা",
    mobileMenuLabel: "Menu",
    onLocaleSwitch: () => {},
  },
};
export default meta;

type Story = StoryObj<typeof Header>;

export const Default: Story = {};
export const WithCartCount: Story = { args: { cartCount: 3 } };
```

(This is the full file — replace it entirely, the only change is the one new `mobileMenuLabel` line.)

- [ ] **Step 2: Make `Nav.tsx`'s row desktop-only**

In `packages/ui/src/components/Nav.tsx`, change line 28 from:

```tsx
    <nav id="site-nav-row" className={cn("border-b border-line bg-white", className)}>
```

to:

```tsx
    <nav id="site-nav-row" className={cn("hidden border-b border-line bg-white sm:block", className)}>
```

- [ ] **Step 3: Add the two new i18n keys**

In `apps/web/messages/en.json`, change the `header` object (currently lines 9-16) from:

```json
  "header": {
    "searchPlaceholder": "Search",
    "searchAria": "Search",
    "trackOrder": "Track order",
    "account": "My Account",
    "cart": "Cart",
    "localeSwitch": "বাংলা"
  },
```

to:

```json
  "header": {
    "searchPlaceholder": "Search",
    "searchAria": "Search",
    "trackOrder": "Track order",
    "account": "My Account",
    "cart": "Cart",
    "localeSwitch": "বাংলা",
    "menu": "Menu",
    "close": "Close"
  },
```

In `apps/web/messages/bn.json`, change the equivalent block (currently lines 9-16) from:

```json
  "header": {
    "searchPlaceholder": "খুঁজুন",
    "searchAria": "খুঁজুন",
    "trackOrder": "অর্ডার ট্র্যাক করুন",
    "account": "আমার অ্যাকাউন্ট",
    "cart": "কার্ট",
    "localeSwitch": "English"
  },
```

to:

```json
  "header": {
    "searchPlaceholder": "খুঁজুন",
    "searchAria": "খুঁজুন",
    "trackOrder": "অর্ডার ট্র্যাক করুন",
    "account": "আমার অ্যাকাউন্ট",
    "cart": "কার্ট",
    "localeSwitch": "English",
    "menu": "মেনু",
    "close": "বন্ধ করুন"
  },
```

- [ ] **Step 4: Replace `SiteHeader.tsx` in full**

```tsx
"use client";

import { useEffect, useState } from "react";
import { AnnouncementBar, Header, MobileNavDrawer, Nav } from "@amader/ui";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, Link } from "@/i18n/navigation";
import { navConfig } from "@/config/nav";
import { toApiLocale } from "@/lib/api-locale";
import { useCartQuery } from "@/hooks/useCart";
import { useMe } from "@/hooks/useAuth";
import { useSearchSuggestions } from "@/hooks/useSearch";
import { useSiteInfo } from "@/hooks/useSiteInfo";
import { useNavCollections } from "@/hooks/useNavCollections";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { toDisplayImageUrl } from "@/lib/media";

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface SiteHeaderProps {
  /** Server-fetched logo URL, so the real logo is in the first paint instead
   * of flashing the fallback mark while the client-side fetch is in flight. */
  initialLogoUrl?: string | null;
}

export function SiteHeader({ initialLogoUrl }: SiteHeaderProps = {}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { data: cart } = useCartQuery(toApiLocale(locale));
  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const { data: me } = useMe();
  const { data: siteInfo } = useSiteInfo();
  const { data: navCollections } = useNavCollections(toApiLocale(locale));
  const { data: announcements } = useAnnouncements(toApiLocale(locale));
  const logoUrl = siteInfo?.logoUrl ?? initialLogoUrl ?? undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounced(searchQuery, 250);
  const { data: suggestions, isLoading: suggestionsLoading } = useSearchSuggestions(debouncedQuery, toApiLocale(locale));

  const otherLocale = locale === "en" ? "bn" : "en";
  const switchLocale = () => router.replace(pathname, { locale: otherLocale });

  const items = [
    ...navConfig.map((item) => ({
      key: item.key,
      href: item.href,
      hasChildren: undefined as boolean | undefined,
      label: t(`nav.${item.key}`),
    })),
    ...(navCollections ?? []).map((collection) => ({
      key: `collection-${collection.slug}`,
      href: `/collections/${collection.slug}`,
      hasChildren: undefined,
      label: collection.name,
    })),
  ];

  return (
    <>
      <AnnouncementBar items={announcements ?? []} linkComponent={Link} />
      <Header
        brandHref="/"
        brandMark="আমাদের"
        logoUrl={logoUrl}
        searchPlaceholder={t("header.searchPlaceholder")}
        searchAriaLabel={t("header.searchAria")}
        onSearchSubmit={(query) => query.trim() && router.push(`/search?q=${encodeURIComponent(query.trim())}`)}
        onSearchQueryChange={setSearchQuery}
        searchSuggestions={
          searchQuery.trim().length >= 2 ? (
            <div className="max-h-[70vh] overflow-y-auto py-1.5">
              {suggestionsLoading ? (
                <p className="px-4 py-3 text-center font-body text-xs text-muted">Searching…</p>
              ) : suggestions?.items?.length ? (
                <>
                  {suggestions.items.map((hit) => (
                    <Link
                      key={hit.slug}
                      href={`/products/${hit.slug}`}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-beige"
                    >
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-[8px] bg-beige">
                        {hit.primaryImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={toDisplayImageUrl(hit.primaryImageUrl)} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-body text-[13px] text-ink">{hit.name}</span>
                        <span className="block font-ui text-xs font-semibold text-green-deep">
                          ৳{hit.salePrice ?? hit.price}
                        </span>
                      </span>
                    </Link>
                  ))}
                  <Link
                    href={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
                    className="block border-t border-line px-4 py-2 text-center font-ui text-xs font-semibold text-green hover:bg-beige"
                  >
                    View all results for &quot;{searchQuery.trim()}&quot;
                  </Link>
                </>
              ) : (
                <p className="px-4 py-3 text-center font-body text-xs text-muted">
                  No products found for &quot;{searchQuery.trim()}&quot;.
                </p>
              )}
            </div>
          ) : undefined
        }
        trackOrderHref="/track"
        trackOrderLabel={t("header.trackOrder")}
        accountHref={me ? "/account" : "/login"}
        accountLabel={t("header.account")}
        cartLabel={t("header.cart")}
        cartCount={cartCount}
        localeSwitchLabel={t("header.localeSwitch")}
        onLocaleSwitch={switchLocale}
        mobileMenuLabel={t("header.menu")}
        linkComponent={Link}
      />
      <Nav items={items} activeHref={pathname} linkComponent={Link} />
      <MobileNavDrawer
        title={t("header.menu")}
        closeLabel={t("header.close")}
        navItems={items}
        accountHref={me ? "/account" : "/login"}
        accountLabel={t("header.account")}
        trackOrderHref="/track"
        trackOrderLabel={t("header.trackOrder")}
        localeSwitchLabel={t("header.localeSwitch")}
        onLocaleSwitch={switchLocale}
        linkComponent={Link}
      />
    </>
  );
}
```

- [ ] **Step 5: Typecheck**

```bash
cd "H:\Amder Project\backend" && npx tsc --noEmit -p packages/ui/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: no output from either command.

- [ ] **Step 6: Live SSR verification**

```bash
cd "H:\Amder Project\backend"
curl -s -o /tmp/homepage_nav_check.html -w "status: %{http_code}\n" "http://localhost:3001/"
grep -c 'id="site-header-row"' /tmp/homepage_nav_check.html
grep -oE 'sm:hidden' /tmp/homepage_nav_check.html | head -1
grep -oE 'hidden border-b border-line bg-white sm:block' /tmp/homepage_nav_check.html | head -1
grep -ic "application error\|failed to compile\|unhandled runtime error" /tmp/homepage_nav_check.html
```

Expected: `status: 200`; `id="site-header-row"` found once; the hamburger button's `sm:hidden` class and `Nav`'s new `hidden ... sm:block` class both appear in the rendered HTML; error-grep returns `0`.

- [ ] **Step 7: Report**

Report DONE with the typecheck results and Step 6's output. Note explicitly that the drawer's actual open/close/slide-in behavior on a real mobile viewport can't be visually verified in this environment (no browser) — the check above confirms the responsive classes are present in the markup, not that clicking the hamburger button visibly works. No git commands.

---

### Task 8: Full end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full monorepo typecheck**

```bash
cd "H:\Amder Project\backend"
npx tsc --noEmit -p packages/db/tsconfig.json
npx tsc --noEmit -p apps/backend/tsconfig.json
npx tsc --noEmit -p packages/ui/tsconfig.json
npx tsc --noEmit -p apps/admin/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: no output from any of the five commands.

- [ ] **Step 2: End-to-end announcement bar check on the real homepage**

```bash
cd "H:\Amder Project\backend"
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/admin/auth/login -H "Content-Type: application/json" -d '{"email":"admin@amadere.com","password":"ChangeMe123!"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.accessToken))")

ID=$(curl -s -X POST http://localhost:3000/api/v1/admin/announcements -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"sortOrder":0,"translations":[{"locale":"EN","message":"END TO END TEST ANNOUNCEMENT"},{"locale":"BN","message":"END TO END TEST ANNOUNCEMENT BN"}]}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))")

curl -s "http://localhost:3001/" | grep -c "END TO END TEST ANNOUNCEMENT"

curl -s -X DELETE "http://localhost:3000/api/v1/admin/announcements/$ID" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/api/v1/announcements?locale=EN"
```

Expected: the grep count is `1` or more (the message text appears in the server-rendered homepage HTML — `AnnouncementBar` renders unconditionally on the server for the first item, not gated behind client-only state like the promo video modal was, so this genuinely proves the whole chain: DB → API → `useAnnouncements` → `AnnouncementBar` → rendered HTML); the final `GET /announcements` call returns `{"success":true,"data":[]}`, confirming cleanup.

- [ ] **Step 3: Confirm no test data was left behind**

```bash
cd "H:\Amder Project\backend\packages\db" && node -e "
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: 'postgresql://amader:amader@localhost:5433/amader_migration' });
  await client.connect();
  const r = await client.query('SELECT count(*) FROM announcements');
  console.log('remaining announcements:', r.rows[0].count);
  await client.end();
})();
"
```

Expected: `remaining announcements: 0` (or whatever count existed before this plan's testing began, if any real announcements were created outside of this plan's test steps — there were none, since this is a brand-new table).

- [ ] **Step 4: Report the disclosed gaps to the user**

No code change — state plainly in the final summary: the announcement bar's real auto-rotation timing, the mobile hamburger drawer's actual slide-in/out interaction, and the banner carousels' real crop-vs-distort appearance for a genuinely mismatched-size image were never visually driven or screenshotted in this environment (no Chromium installed). Everything curl/SSR/typecheck could confirm has been confirmed; the fully interactive/visual surface has not.

---

## Note on Task 1's schema location line numbers

Line numbers cited throughout this plan (e.g. "MenuItemTranslation ending at line 1620", "permission-catalog.ts lines 123-126") reflect the file state at the time this plan was written. If an earlier task in this same plan has already shifted line numbers in a shared file by the time a later task runs, search for the cited symbol/string instead of trusting the exact line number — the surrounding code shown in each step is the source of truth, not the line number.
