# Email Template System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a database-backed email template engine + admin UI (status toggle list, edit list, per-template editor, global settings) so future work can send real, admin-editable transactional emails instead of hardcoded strings.

**Architecture:** A new `EmailTemplate` Prisma model (one row per template, grouped by category) plus a settings blob reusing the existing generic `Setting` key-value table. A `EmailTemplatesService` does CRUD, a simple `{{ variable }}` regex-substitution renderer (no templating-engine dependency — every real Botble template only does flat substitution + a header/footer include, never loops), and preview. Three new admin pages under `/settings/email-templates` mirror the reference admin's UX. Nothing sends a real email yet — that's later sub-projects, which will import `EmailTemplatesService` and call `render()`.

**Tech Stack:** NestJS + Prisma (backend, existing), Next.js App Router + React Query + `@amader/admin-ui` (frontend, existing). No new dependencies.

## Global Constraints

- Follow this codebase's existing conventions exactly — do not introduce a new pattern where an established one already exists (verified against `invoice-template-settings`, `email-settings`, `customers`/`order-manager` modules built earlier this session).
- No unit test framework exists in this codebase. Verification is: `npx tsc --noEmit` clean after every task, then live verification via `curl`/`psql`/Playwright against the real running dev servers — never claim a task done without this.
- `prisma migrate dev` cannot be used directly — its shadow-database replay fails on an unrelated historical migration. Use the established workaround: `prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script` to generate SQL, hand-create the migration folder, apply via `prisma db execute`, then `prisma migrate resolve --applied` to keep migration history consistent.
- Dev servers run via `pnpm dev` from `h:\Amder Project\backend` (backend :3000, web :3001, admin :3004) — already running; `nest start --watch` and `next dev` both hot-reload, so no manual restart is needed after file edits, only after a `prisma generate` (regenerates the client apps import).
- After any backend DTO/controller change, regenerate the admin app's OpenAPI types: `cd apps/admin && npm run typegen` (requires the backend dev server to be up and serving `/api/docs-json`).
- Money is irrelevant here — do not add pricing/currency handling.

---

### Task 1: Data layer — schema, migration, permissions, seed

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_add_email_templates/migration.sql`
- Modify: `packages/shared/src/permission-catalog.ts`
- Modify: `packages/db/prisma/seed.ts`

**Interfaces:**
- Produces: Prisma model `EmailTemplate` (fields: `id`, `key` unique, `group` enum `EmailTemplateGroup`, `title`, `description`, `subject`, `bodyHtml`, `defaultSubject`, `defaultBodyHtml`, `variables` Json, `canDisable`, `enabled`, `createdAt`, `updatedAt`), reachable via `this.prisma.client.emailTemplate`. Three seeded rows: `core_base_header`, `core_base_footer`, `admin_password_reset`. Permission keys `email_template.view` / `email_template.manage` present in the `Permission` table and granted to the Super Admin role.

- [ ] **Step 1: Add the schema model**

Open `packages/db/prisma/schema.prisma`. Find the `model Setting` block (search for `model Setting {`) — add the new enum and model immediately after it, so it sits near the other cross-cutting/settings-adjacent models:

```prisma
enum EmailTemplateGroup {
  BASE
  ACL
  CONTACT
  ECOMMERCE
  NEWSLETTER
}

model EmailTemplate {
  id      Int                @id @default(autoincrement())
  key     String             @unique
  group   EmailTemplateGroup
  title   String
  description String

  subject  String @default("")
  bodyHtml String @map("body_html") @db.Text

  // Immutable, set once at seed time — "Reset to default" copies these back
  // into subject/bodyHtml, so it never needs to re-read a seed script.
  defaultSubject  String @map("default_subject") @default("")
  defaultBodyHtml String @map("default_body_html") @db.Text @default("")

  // [{ key: "customer_name", description: "..." }, ...] — per-template,
  // since each event has different data available. Purely a UI hint for
  // the editor's insert-variable helper, never validated against.
  variables Json @default("[]")

  // A few templates (base header/footer, admin password reset) can't be
  // turned off — the toggle UI renders fixed-on for these.
  canDisable Boolean @map("can_disable") @default(true)
  enabled    Boolean @default(true)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("email_templates")
}
```

- [ ] **Step 2: Generate the migration SQL and apply it directly**

Shadow-DB-based `prisma migrate dev` is broken in this repo (documented in Global Constraints). Run:

```bash
cd "h:\Amder Project\backend\packages\db"
npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script
```

Confirm the output is exactly a `CREATE TYPE "EmailTemplateGroup"` + `CREATE TABLE "email_templates"` (no unrelated diffs — if there are unrelated diffs, something else changed the schema since the last migration; stop and investigate before continuing).

- [ ] **Step 3: Write the migration file and apply it**

```bash
cd "h:\Amder Project\backend\packages\db"
TS=$(date +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_add_email_templates"
```

Write the SQL from Step 2's output into `prisma/migrations/<TS>_add_email_templates/migration.sql`. It should look like:

```sql
-- CreateEnum
CREATE TYPE "EmailTemplateGroup" AS ENUM ('BASE', 'ACL', 'CONTACT', 'ECOMMERCE', 'NEWSLETTER');

-- CreateTable
CREATE TABLE "email_templates" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "group" "EmailTemplateGroup" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body_html" TEXT NOT NULL,
    "default_subject" TEXT NOT NULL DEFAULT '',
    "default_body_html" TEXT NOT NULL DEFAULT '',
    "variables" JSONB NOT NULL DEFAULT '[]',
    "can_disable" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_key_key" ON "email_templates"("key");
```

(Use the exact SQL `prisma migrate diff` printed in Step 2 — the block above is what it's expected to produce given the schema in Step 1; don't hand-edit it to differ.)

Apply it and mark it resolved:

```bash
cd "h:\Amder Project\backend\packages\db"
npx prisma db execute --file "prisma/migrations/${TS}_add_email_templates/migration.sql" --config prisma.config.ts
npx prisma migrate resolve --applied "${TS}_add_email_templates"
npx prisma migrate status
```

Expected: `Database schema is up to date!` from the last command.

- [ ] **Step 4: Regenerate the Prisma client**

```bash
cd "h:\Amder Project\backend\packages\db"
npx prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 5: Verify the table exists**

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "\d email_templates"
```

Expected: column list matching Step 3's `CREATE TABLE`.

- [ ] **Step 6: Add the two permission keys**

Open `packages/shared/src/permission-catalog.ts`. Find the entries for `setting`/`invoice_settings`/`invoice_template_settings` (search for `'invoice_template_settings'`) and add immediately after that group:

```ts
  perm('email_template', 'view'),
  perm('email_template', 'manage'),
```

- [ ] **Step 7: Add the seed rows**

Open `packages/db/prisma/seed.ts`. Add this block inside `main()`, after the `customerTier` seeding loop and before the `Role` seeding block (so it runs before roles/permissions are finalized — order doesn't actually matter here since these are independent upserts, but this keeps every "reference data" seed block grouped together before the "accounts" block):

```ts
  console.log('Seeding email templates...');
  const emailTemplateHeader = `<style>{{ custom_css }}</style>
<div style="background:#f5f6fa;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
    <div style="background:#2e7d43;padding:20px 30px;text-align:center;">
      {{ logo_html }}
    </div>
    <div style="padding:30px;color:#1e2b22;">`;
  const emailTemplateFooter = `    </div>
    <div style="padding:20px 30px;text-align:center;color:#94a69a;font-size:12px;border-top:1px solid #eef3ef;">
      {{ copyright }}
    </div>
  </div>
</div>`;
  const adminPasswordResetBody = `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Reset your password</h2>
<p style="margin:0 0 20px;line-height:1.6;">Hi {{ admin_name }},</p>
<p style="margin:0 0 20px;line-height:1.6;">We received a request to reset your Amader Admin password. Click the button below to choose a new one — this link expires in 1 hour.</p>
<p style="margin:0 0 24px;text-align:center;">
  <a href="{{ reset_link }}" style="display:inline-block;background:#2e7d43;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
</p>
<p style="margin:0;color:#64766b;font-size:13px;line-height:1.6;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
{{ footer }}`;

  const emailTemplates: {
    key: string;
    group: 'BASE' | 'ACL';
    title: string;
    description: string;
    subject: string;
    bodyHtml: string;
    variables: { key: string; description: string }[];
    canDisable: boolean;
  }[] = [
    {
      key: 'core_base_header',
      group: 'BASE',
      title: 'Email template header',
      description: 'Template for header of emails',
      subject: '',
      bodyHtml: emailTemplateHeader,
      variables: [
        { key: 'logo_html', description: 'The site logo, pre-rendered as an <img> tag' },
        { key: 'custom_css', description: 'Custom CSS from Email Template Settings' },
      ],
      canDisable: false,
    },
    {
      key: 'core_base_footer',
      group: 'BASE',
      title: 'Email template footer',
      description: 'Template for footer of emails',
      subject: '',
      bodyHtml: emailTemplateFooter,
      variables: [{ key: 'copyright', description: 'Copyright line from Email Template Settings' }],
      canDisable: false,
    },
    {
      key: 'admin_password_reset',
      group: 'ACL',
      title: 'Reset password',
      description: 'Send email to admin when requesting reset password',
      subject: 'Reset your Amader Admin password',
      bodyHtml: adminPasswordResetBody,
      variables: [
        { key: 'admin_name', description: "The admin's full name" },
        { key: 'reset_link', description: 'One-time password reset link' },
      ],
      canDisable: false,
    },
  ];
  for (const t of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { key: t.key },
      create: {
        key: t.key,
        group: t.group,
        title: t.title,
        description: t.description,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        defaultSubject: t.subject,
        defaultBodyHtml: t.bodyHtml,
        variables: t.variables,
        canDisable: t.canDisable,
        enabled: true,
      },
      // Never overwrite an admin's live edits on re-seed — a genuine content
      // change to a seeded template later is a manual DB/backfill decision,
      // not something re-running `prisma:seed` should silently do.
      update: {},
    });
  }
```

- [ ] **Step 8: Run the seed**

```bash
cd "h:\Amder Project\backend\packages\db"
npx prisma db seed
```

Expected: `Seeding email templates...` in the output, no errors.

- [ ] **Step 9: Verify live**

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT key, \"group\", can_disable, enabled FROM email_templates ORDER BY id;"
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT key FROM permissions WHERE key LIKE 'email_template%';"
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT count(*) FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.key LIKE 'email_template%';"
```

Expected: 3 rows in the first query (`core_base_header`/`BASE`, `core_base_footer`/`BASE`, `admin_password_reset`/`ACL`, all `can_disable=f`, `enabled=t`); 2 rows in the second; `2` in the third (both granted to Super Admin's role, matching the seed's existing "grant every permission to Super Admin" loop).

- [ ] **Step 10: Commit**

```bash
cd "h:\Amder Project\backend"
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations packages/shared/src/permission-catalog.ts packages/db/prisma/seed.ts
git commit -m "$(cat <<'EOF'
Add EmailTemplate data model, permissions, and seed rows

Foundation for the email template system — schema + seeded Base
header/footer and the ACL password-reset row (used once admin
password reset is built). No backend module or UI yet.
EOF
)"
```

---

### Task 2: Backend module — service, renderer, DTOs, controller

**Files:**
- Create: `apps/backend/src/modules/email-templates/email-templates.mapper.ts`
- Create: `apps/backend/src/modules/email-templates/email-templates.service.ts`
- Create: `apps/backend/src/modules/email-templates/dto/update-email-template.dto.ts`
- Create: `apps/backend/src/modules/email-templates/dto/update-email-template-settings.dto.ts`
- Create: `apps/backend/src/modules/email-templates/dto/preview-email-template.dto.ts`
- Create: `apps/backend/src/modules/email-templates/admin-email-templates.controller.ts`
- Create: `apps/backend/src/modules/email-templates/email-templates.module.ts`
- Modify: `apps/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `this.prisma.client.emailTemplate` / `this.prisma.client.setting` / `this.prisma.client.media` (Task 1). `PrismaService` (global provider, no explicit import needed — confirmed via `invoice-template-settings.module.ts`'s own `@Module` having no `imports` array). `AdminJwtGuard`, `PermissionGuard`, `RequirePermission`, `AuditLogInterceptor`, `CurrentAdmin` — all existing, same paths every other admin controller this session used.
- Produces: `EmailTemplatesService` with public methods `list()`, `get(key)`, `update(key, input)`, `reset(key)`, `getSettings()`, `updateSettings(input)`, `preview(key, draft)`, and `render(key, variables): Promise<{ subject: string; html: string } | null>` — the method later sub-projects will call. Routes: `GET /admin/email-templates`, `GET /admin/email-templates/settings`, `PUT /admin/email-templates/settings`, `GET /admin/email-templates/:key`, `PATCH /admin/email-templates/:key`, `POST /admin/email-templates/:key/reset`, `POST /admin/email-templates/:key/preview`.

- [ ] **Step 1: Write the mapper**

Create `apps/backend/src/modules/email-templates/email-templates.mapper.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { EmailTemplate, EmailTemplateGroup } from '@amader/db';

export interface EmailTemplateVariable {
  key: string;
  description: string;
}

export class EmailTemplateDto {
  @ApiProperty() id!: number;
  @ApiProperty() key!: string;
  @ApiProperty({ enum: EmailTemplateGroup }) group!: EmailTemplateGroup;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() subject!: string;
  @ApiProperty() bodyHtml!: string;
  @ApiProperty() defaultSubject!: string;
  @ApiProperty() defaultBodyHtml!: string;
  @ApiProperty({ type: [Object] }) variables!: EmailTemplateVariable[];
  @ApiProperty() canDisable!: boolean;
  @ApiProperty() enabled!: boolean;
}

export function toEmailTemplateDto(row: EmailTemplate): EmailTemplateDto {
  return {
    id: row.id,
    key: row.key,
    group: row.group,
    title: row.title,
    description: row.description,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    defaultSubject: row.defaultSubject,
    defaultBodyHtml: row.defaultBodyHtml,
    variables: row.variables as EmailTemplateVariable[],
    canDisable: row.canDisable,
    enabled: row.enabled,
  };
}

export class EmailTemplateSettingsDto {
  @ApiProperty({ nullable: true }) logoMediaId!: number | null;
  @ApiProperty({ nullable: true }) logoUrl!: string | null;
  @ApiProperty() contactEmail!: string;
  @ApiProperty() copyright!: string;
  @ApiProperty() logoHeight!: number;
  @ApiProperty() customCss!: string;
}

export class EmailTemplatePreviewDto {
  @ApiProperty() subject!: string;
  @ApiProperty() html!: string;
}
```

- [ ] **Step 2: Write the DTOs**

Create `apps/backend/src/modules/email-templates/dto/update-email-template.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyHtml?: string;

  // Ignored server-side for a template where canDisable is false — see
  // EmailTemplatesService.update()'s comment.
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
```

Create `apps/backend/src/modules/email-templates/dto/update-email-template-settings.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateEmailTemplateSettingsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  logoMediaId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  copyright?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  logoHeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customCss?: string;
}
```

Create `apps/backend/src/modules/email-templates/dto/preview-email-template.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// The (possibly unsaved) draft to preview — falls back to the template's
// currently-saved subject/bodyHtml for whichever field is omitted.
export class PreviewEmailTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyHtml?: string;
}
```

- [ ] **Step 3: Write the service**

Create `apps/backend/src/modules/email-templates/email-templates.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  EmailTemplateDto,
  EmailTemplatePreviewDto,
  EmailTemplateSettingsDto,
  EmailTemplateVariable,
  toEmailTemplateDto,
} from './email-templates.mapper';

const SETTINGS_KEY = 'email_template.settings';
const VARIABLE_TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

interface EmailTemplateSettingsJson {
  logoMediaId: number | null;
  contactEmail: string;
  copyright: string;
  logoHeight: number;
  customCss: string;
}

const SETTINGS_DEFAULTS: EmailTemplateSettingsJson = {
  logoMediaId: null,
  contactEmail: '',
  copyright: '',
  logoHeight: 40,
  customCss: '',
};

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<EmailTemplateDto[]> {
    const rows = await this.prisma.client.emailTemplate.findMany({ orderBy: { id: 'asc' } });
    return rows.map(toEmailTemplateDto);
  }

  async get(key: string): Promise<EmailTemplateDto> {
    const row = await this.findOrThrow(key);
    return toEmailTemplateDto(row);
  }

  async update(
    key: string,
    input: { subject?: string; bodyHtml?: string; enabled?: boolean },
  ): Promise<EmailTemplateDto> {
    const row = await this.findOrThrow(key);
    const updated = await this.prisma.client.emailTemplate.update({
      where: { key },
      data: {
        subject: input.subject ?? undefined,
        bodyHtml: input.bodyHtml ?? undefined,
        // A template that can't be disabled ignores an `enabled` write —
        // the toggle UI never renders for these rows, but this is a second
        // guard against a direct API call flipping it anyway.
        enabled: row.canDisable ? (input.enabled ?? undefined) : true,
      },
    });
    return toEmailTemplateDto(updated);
  }

  async reset(key: string): Promise<EmailTemplateDto> {
    const row = await this.findOrThrow(key);
    const updated = await this.prisma.client.emailTemplate.update({
      where: { key },
      data: { subject: row.defaultSubject, bodyHtml: row.defaultBodyHtml },
    });
    return toEmailTemplateDto(updated);
  }

  async getSettings(): Promise<EmailTemplateSettingsDto> {
    const json = await this.getSettingsJson();
    const media = json.logoMediaId
      ? await this.prisma.client.media.findUnique({ where: { id: json.logoMediaId } })
      : null;
    return { ...json, logoUrl: media?.url ?? null };
  }

  async updateSettings(input: Partial<EmailTemplateSettingsJson>): Promise<EmailTemplateSettingsDto> {
    const current = await this.getSettingsJson();
    const next: EmailTemplateSettingsJson = { ...current, ...input };
    await this.prisma.client.setting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value: next as never },
      update: { value: next as never },
    });
    return this.getSettings();
  }

  // Renders a template for actual sending. Returns null when the template
  // is disabled — the caller's job is to skip sending, not this method's.
  // Nothing in this sub-project calls this yet; it exists for the
  // order-lifecycle/password-reset/contact-form sub-projects that follow.
  async render(key: string, variables: Record<string, string>): Promise<{ subject: string; html: string } | null> {
    const row = await this.findOrThrow(key);
    if (row.canDisable && !row.enabled) return null;
    return this.renderWithChrome(row.bodyHtml, row.subject, variables);
  }

  async preview(key: string, draft: { subject?: string; bodyHtml?: string }): Promise<EmailTemplatePreviewDto> {
    const row = await this.findOrThrow(key);
    const variableList = row.variables as EmailTemplateVariable[];
    const placeholders: Record<string, string> = {};
    for (const v of variableList) placeholders[v.key] = `[${v.key}]`;
    return this.renderWithChrome(draft.bodyHtml ?? row.bodyHtml, draft.subject ?? row.subject, placeholders);
  }

  private async findOrThrow(key: string) {
    const row = await this.prisma.client.emailTemplate.findUnique({ where: { key } });
    if (!row) throw new NotFoundException(`Email template "${key}" not found`);
    return row;
  }

  private async getSettingsJson(): Promise<EmailTemplateSettingsJson> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: SETTINGS_KEY } });
    return row ? { ...SETTINGS_DEFAULTS, ...(row.value as object) } : SETTINGS_DEFAULTS;
  }

  private substitute(text: string, variables: Record<string, string>): string {
    return text.replace(VARIABLE_TOKEN, (match, name: string) => (name in variables ? variables[name] : match));
  }

  // Wraps bodyHtml in the Base header/footer templates (if it references
  // `{{ header }}`/`{{ footer }}` — a template without either token, e.g.
  // one that shouldn't get the full chrome, renders standalone) and injects
  // the settings-derived chrome variables (logo, copyright, custom CSS)
  // alongside the caller's own event variables.
  private async renderWithChrome(
    bodyHtml: string,
    subject: string,
    variables: Record<string, string>,
  ): Promise<{ subject: string; html: string }> {
    const settings = await this.getSettings();
    const chromeVars: Record<string, string> = {
      ...variables,
      logo_html: settings.logoUrl
        ? `<img src="${settings.logoUrl}" alt="" height="${settings.logoHeight}" style="height:${settings.logoHeight}px;" />`
        : '',
      copyright: settings.copyright || `Copyright © ${new Date().getFullYear()}`,
      custom_css: settings.customCss || '',
    };

    let html = bodyHtml;
    const header = await this.prisma.client.emailTemplate.findUnique({ where: { key: 'core_base_header' } });
    if (header) html = html.replace(/\{\{\s*header\s*\}\}/g, this.substitute(header.bodyHtml, chromeVars));
    const footer = await this.prisma.client.emailTemplate.findUnique({ where: { key: 'core_base_footer' } });
    if (footer) html = html.replace(/\{\{\s*footer\s*\}\}/g, this.substitute(footer.bodyHtml, chromeVars));
    html = this.substitute(html, variables);

    return { subject: this.substitute(subject, variables), html };
  }
}
```

- [ ] **Step 4: Write the controller**

Create `apps/backend/src/modules/email-templates/admin-email-templates.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { EmailTemplatesService } from './email-templates.service';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { UpdateEmailTemplateSettingsDto } from './dto/update-email-template-settings.dto';
import { PreviewEmailTemplateDto } from './dto/preview-email-template.dto';
import { EmailTemplateDto, EmailTemplatePreviewDto, EmailTemplateSettingsDto } from './email-templates.mapper';

@ApiTags('admin/email-templates')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/email-templates')
export class AdminEmailTemplatesController {
  constructor(private readonly emailTemplates: EmailTemplatesService) {}

  @Get()
  @RequirePermission('email_template.view')
  @ApiOkResponse({ type: [EmailTemplateDto] })
  list() {
    return this.emailTemplates.list();
  }

  // Declared before ':key' — NestJS resolves static segments in
  // declaration order, so this must come first or "settings" would be
  // swallowed as a :key value.
  @Get('settings')
  @RequirePermission('email_template.view')
  @ApiOkResponse({ type: EmailTemplateSettingsDto })
  getSettings() {
    return this.emailTemplates.getSettings();
  }

  @Put('settings')
  @RequirePermission('email_template.manage')
  @ApiOkResponse({ type: EmailTemplateSettingsDto })
  updateSettings(@Body() dto: UpdateEmailTemplateSettingsDto) {
    return this.emailTemplates.updateSettings(dto);
  }

  @Get(':key')
  @RequirePermission('email_template.view')
  @ApiOkResponse({ type: EmailTemplateDto })
  get(@Param('key') key: string) {
    return this.emailTemplates.get(key);
  }

  @Patch(':key')
  @RequirePermission('email_template.manage')
  @ApiOkResponse({ type: EmailTemplateDto })
  update(@Param('key') key: string, @Body() dto: UpdateEmailTemplateDto) {
    return this.emailTemplates.update(key, dto);
  }

  @Post(':key/reset')
  @RequirePermission('email_template.manage')
  @ApiOkResponse({ type: EmailTemplateDto })
  reset(@Param('key') key: string) {
    return this.emailTemplates.reset(key);
  }

  @Post(':key/preview')
  @RequirePermission('email_template.view')
  @ApiOkResponse({ type: EmailTemplatePreviewDto })
  preview(@Param('key') key: string, @Body() dto: PreviewEmailTemplateDto) {
    return this.emailTemplates.preview(key, dto);
  }
}
```

- [ ] **Step 5: Write the module and register it**

Create `apps/backend/src/modules/email-templates/email-templates.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AdminEmailTemplatesController } from './admin-email-templates.controller';
import { EmailTemplatesService } from './email-templates.service';

@Module({
  controllers: [AdminEmailTemplatesController],
  providers: [EmailTemplatesService],
  // Exported for later sub-projects (order-lifecycle emails, admin
  // password reset, contact form) to import and call render().
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
```

Open `apps/backend/src/app.module.ts`. Find the `EmailSettingsModule` import line and add immediately after it:

```ts
import { EmailTemplatesModule } from './modules/email-templates/email-templates.module';
```

Find `EmailSettingsModule,` in the `@Module({ imports: [...] })` array and add immediately after it:

```ts
    EmailTemplatesModule,
```

- [ ] **Step 6: Typecheck**

```bash
cd "h:\Amder Project\backend\apps\backend"
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 7: Regenerate admin OpenAPI types**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/docs-json
```

Expected: `200` (confirms the backend dev server picked up the new module via hot-reload — if not `200`, wait a few seconds for `nest start --watch` to finish recompiling and retry).

```bash
cd "h:\Amder Project\backend\apps\admin"
npm run typegen
```

- [ ] **Step 8: Verify live via the browser session**

Admin API auth in this app is httpOnly-cookie-based through the admin app's own Next.js proxy (`apps/admin/src/app/api/backend/[...path]`), not a bearer token a shell command can easily construct — every prior live verification this session went through the logged-in browser session for exactly this reason. Do the same here: with the admin app open and logged in at `http://localhost:3004` (already the case), run each check as a `fetch` from that page's own JS context (same-origin, so the session cookie is attached automatically) rather than raw `curl`:

```js
// List — expect 3 items: core_base_header, core_base_footer, admin_password_reset
await fetch('/api/backend/admin/email-templates').then(r => r.json())

// Settings — expect defaults: logoMediaId null, logoHeight 40, empty strings
await fetch('/api/backend/admin/email-templates/settings').then(r => r.json())

// Preview admin_password_reset — expect subject "Reset your Amader Admin password"
// and html containing "[admin_name]" / "[reset_link]" placeholders, wrapped in
// the header/footer chrome (a green bar, then the body, then a footer line)
await fetch('/api/backend/admin/email-templates/admin_password_reset/preview', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
}).then(r => r.json())
```

Confirm each response matches the expectations in the comments above.

- [ ] **Step 9: Commit**

```bash
cd "h:\Amder Project\backend"
git add apps/backend/src/modules/email-templates apps/backend/src/app.module.ts apps/admin/src/lib/api/schema.d.ts
git commit -m "$(cat <<'EOF'
Add email-templates backend module (CRUD, render, preview)

New admin/email-templates endpoints: list/get/update/reset/preview
per template, plus get/update for the shared settings (logo,
contact email, copyright, logo height, custom CSS). render() is the
method later sub-projects will call to actually send an email.
EOF
)"
```

---

### Task 3: Frontend — hooks + the three-tab hub page

**Files:**
- Create: `apps/admin/src/hooks/useEmailTemplates.ts`
- Create: `apps/admin/src/app/(shell)/settings/email-templates/page.tsx`
- Modify: `apps/admin/src/app/(shell)/settings/page.tsx`

**Interfaces:**
- Consumes: `proxyFetch` (`@/lib/api/proxy-client`), `components["schemas"]["EmailTemplateDto" | "EmailTemplateSettingsDto"]` (Task 2's regenerated schema), `MediaPicker` (`@/components/MediaPicker`), `Card`/`Button`/`Icon`/`PageHeader`/`Tabs`/`ToggleSwitch` (`@amader/admin-ui`).
- Produces: `useEmailTemplates()`, `useEmailTemplate(key)`, `useUpdateEmailTemplate(key)`, `useResetEmailTemplate(key)`, `usePreviewEmailTemplate(key)`, `useEmailTemplateSettings()`, `useUpdateEmailTemplateSettings()` — all exported from `useEmailTemplates.ts`, consumed by Task 4's editor page too.

- [ ] **Step 1: Write the hooks file**

Create `apps/admin/src/hooks/useEmailTemplates.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type EmailTemplate = components["schemas"]["EmailTemplateDto"];
export type EmailTemplateSettings = components["schemas"]["EmailTemplateSettingsDto"];
export type EmailTemplatePreview = components["schemas"]["EmailTemplatePreviewDto"];

const KEY = ["email-templates"];
const SETTINGS_KEY = ["email-template-settings"];
const BASE = "/admin/email-templates";

export function useEmailTemplates() {
  return useQuery({ queryKey: KEY, queryFn: () => proxyFetch<EmailTemplate[]>(BASE) });
}

export function useEmailTemplate(key: string) {
  return useQuery({
    queryKey: [...KEY, key],
    queryFn: () => proxyFetch<EmailTemplate>(`${BASE}/${key}`),
    enabled: !!key,
  });
}

export function useUpdateEmailTemplate(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { subject?: string; bodyHtml?: string; enabled?: boolean }) =>
      proxyFetch<EmailTemplate>(`${BASE}/${key}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useResetEmailTemplate(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => proxyFetch<EmailTemplate>(`${BASE}/${key}/reset`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function usePreviewEmailTemplate(key: string) {
  return useMutation({
    mutationFn: (draft: { subject?: string; bodyHtml?: string }) =>
      proxyFetch<EmailTemplatePreview>(`${BASE}/${key}/preview`, { method: "POST", body: JSON.stringify(draft) }),
  });
}

export function useEmailTemplateSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: () => proxyFetch<EmailTemplateSettings>(`${BASE}/settings`) });
}

export function useUpdateEmailTemplateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      logoMediaId?: number | null;
      contactEmail?: string;
      copyright?: string;
      logoHeight?: number;
      customCss?: string;
    }) => proxyFetch<EmailTemplateSettings>(`${BASE}/settings`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
```

- [ ] **Step 2: Write the hub page**

Create `apps/admin/src/app/(shell)/settings/email-templates/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader, Tabs, ToggleSwitch } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import {
  useEmailTemplates,
  useEmailTemplateSettings,
  useUpdateEmailTemplate,
  useUpdateEmailTemplateSettings,
  type EmailTemplate,
} from "@/hooks/useEmailTemplates";
import type { components } from "@/lib/api/schema";

type EmailTemplateGroup = components["schemas"]["EmailTemplateDto"]["group"];

const emailIcon = <Icon name="mail" />;
const gradientStyle = { background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" };

const GROUP_ORDER: EmailTemplateGroup[] = ["BASE", "ACL", "CONTACT", "ECOMMERCE", "NEWSLETTER"];
const GROUP_LABELS: Record<EmailTemplateGroup, string> = {
  BASE: "Base template",
  ACL: "ACL",
  CONTACT: "Contact",
  ECOMMERCE: "Ecommerce",
  NEWSLETTER: "Newsletter",
};

function groupTemplates(templates: EmailTemplate[]): { group: EmailTemplateGroup; items: EmailTemplate[] }[] {
  return GROUP_ORDER.map((group) => ({ group, items: templates.filter((t) => t.group === group) })).filter(
    (g) => g.items.length > 0,
  );
}

function TemplatesTab({ templates }: { templates: EmailTemplate[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groupTemplates(templates).map(({ group, items }) => (
        <Card key={group} className="flex flex-col gap-3">
          <h3 className="font-ui text-sm font-bold text-text">{GROUP_LABELS[group]}</h3>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="border-b border-border pb-2 text-xs font-bold uppercase text-secondary">Template</th>
                <th className="border-b border-border pb-2 text-xs font-bold uppercase text-secondary">Description</th>
                <th className="border-b border-border pb-2 text-right text-xs font-bold uppercase text-secondary">Operations</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.key} className="border-b border-border last:border-b-0">
                  <td className="py-3 text-sm font-semibold text-text">{t.title}</td>
                  <td className="py-3 text-sm text-secondary">{t.description}</td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/settings/email-templates/${t.key}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-inner bg-brand-500 text-white"
                      aria-label={`Edit ${t.title}`}
                    >
                      <Icon name="edit" size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

function StatusRow({ template }: { template: EmailTemplate }) {
  const update = useUpdateEmailTemplate(template.key);
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="py-3 text-sm font-semibold text-text">{template.title}</td>
      <td className="py-3 text-sm text-secondary">{template.description}</td>
      <td className="py-3 text-right">
        <ToggleSwitch
          checked={template.enabled}
          disabled={!template.canDisable || update.isPending}
          onChange={(enabled) => update.mutate({ enabled })}
        />
      </td>
    </tr>
  );
}

function StatusTab({ templates }: { templates: EmailTemplate[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groupTemplates(templates).map(({ group, items }) => (
        <Card key={group} className="flex flex-col gap-3">
          <h3 className="font-ui text-sm font-bold text-text">{GROUP_LABELS[group]}</h3>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="border-b border-border pb-2 text-xs font-bold uppercase text-secondary">Template</th>
                <th className="border-b border-border pb-2 text-xs font-bold uppercase text-secondary">Description</th>
                <th className="border-b border-border pb-2 text-right text-xs font-bold uppercase text-secondary">Operations</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <StatusRow key={t.key} template={t} />
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

function SettingsTab() {
  const { data, isLoading } = useEmailTemplateSettings();
  const update = useUpdateEmailTemplateSettings();
  const [logoMediaId, setLogoMediaId] = useState<number | null | undefined>(undefined);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [contactEmail, setContactEmail] = useState<string | undefined>(undefined);
  const [copyright, setCopyright] = useState<string | undefined>(undefined);
  const [logoHeight, setLogoHeight] = useState<number | undefined>(undefined);
  const [customCss, setCustomCss] = useState<string | undefined>(undefined);

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  const effectiveLogoUrl = logoUrl !== undefined ? logoUrl : (data.logoUrl ?? undefined);

  function handleSave() {
    update.mutate({
      logoMediaId: logoMediaId !== undefined ? logoMediaId : undefined,
      contactEmail: contactEmail !== undefined ? contactEmail : undefined,
      copyright: copyright !== undefined ? copyright : undefined,
      logoHeight: logoHeight !== undefined ? logoHeight : undefined,
      customCss: customCss !== undefined ? customCss : undefined,
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <MediaPicker
        label="Logo"
        value={effectiveLogoUrl}
        onChange={(url) => setLogoUrl(url)}
        onSelectMedia={(media) => setLogoMediaId(media.id)}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Contact email address</span>
        <input
          value={contactEmail !== undefined ? contactEmail : data.contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="e.g: example@domain.com"
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Copyright</span>
        <input
          value={copyright !== undefined ? copyright : data.copyright}
          onChange={(e) => setCopyright(e.target.value)}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Logo height (px)</span>
        <input
          type="number"
          value={logoHeight !== undefined ? logoHeight : data.logoHeight}
          onChange={(e) => setLogoHeight(Number(e.target.value))}
          className="h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Email template custom CSS</span>
        <textarea
          value={customCss !== undefined ? customCss : data.customCss}
          onChange={(e) => setCustomCss(e.target.value)}
          rows={6}
          spellCheck={false}
          className="rounded-sm border border-border bg-surface p-3 font-mono text-xs text-text outline-none focus:border-brand-500"
        />
      </label>
      <div>
        <Button type="button" variant="primary" disabled={update.isPending} onClick={handleSave}>
          {update.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </Card>
  );
}

export default function EmailTemplatesPage() {
  const [tab, setTab] = useState<"templates" | "status" | "settings">("templates");
  const { data: templates, isLoading } = useEmailTemplates();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={emailIcon} title="Email Templates" subtitle="Email templates using HTML & system variables." style={gradientStyle} />
      <Link href="/settings" className="flex items-center gap-1.5 text-sm font-semibold text-brand-500">
        <Icon name="arrow_back" size={16} /> Back to Settings
      </Link>

      <Tabs
        options={[
          { value: "templates", label: "Email Templates" },
          { value: "status", label: "Email Template Status" },
          { value: "settings", label: "Email Template Settings" },
        ]}
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />

      {isLoading || !templates ? (
        <Card><p className="text-sm text-muted">Loading…</p></Card>
      ) : (
        <>
          {tab === "templates" && <TemplatesTab templates={templates} />}
          {tab === "status" && <StatusTab templates={templates} />}
        </>
      )}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
```

- [ ] **Step 3: Add the Settings hub card**

Open `apps/admin/src/app/(shell)/settings/page.tsx`. In `SETTINGS_LINKS`, add a new entry after the existing `"/settings/email"` line:

```ts
  { href: "/settings/email-templates", icon: "forward_to_inbox", label: "Email Templates", description: "Enable/disable and edit every transactional email template." },
```

- [ ] **Step 4: Typecheck**

```bash
cd "h:\Amder Project\backend\apps\admin"
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 5: Verify live**

Navigate to `http://localhost:3004/settings` — confirm the new "Email Templates" card appears in the grid. Click it, land on `/settings/email-templates`.

- On the **Email Templates** tab: confirm two cards render — "Base template" (2 rows: Email template header, Email template footer) and "ACL" (1 row: Reset password) — each row has an Edit icon-link. Confirm "Contact"/"Ecommerce"/"Newsletter" sections do NOT render (no seeded rows yet — matches the spec's stated behavior).
- Switch to the **Email Template Status** tab: same two groups, this time each row has a toggle switch instead of an Edit link. Confirm all three toggles render **disabled** (fixed-on, non-interactive) — every seeded row has `canDisable: false`.
- Switch to the **Email Template Settings** tab: confirm the form renders with empty/default values (contact email blank, copyright blank, logo height `40`, custom CSS blank, no logo image). Type something into "Copyright" (e.g. `Copyright © 2026 Amader eBuy Ltd`), click Save settings, reload the page, confirm the value persisted.

- [ ] **Step 6: Commit**

```bash
cd "h:\Amder Project\backend"
git add apps/admin/src/hooks/useEmailTemplates.ts "apps/admin/src/app/(shell)/settings/email-templates/page.tsx" "apps/admin/src/app/(shell)/settings/page.tsx"
git commit -m "$(cat <<'EOF'
Add Email Templates admin page (Templates / Status / Settings tabs)

New /settings/email-templates hub, linked from the Settings page's
card grid. Templates tab lists every template grouped by category
with an edit link; Status tab is the same grouping with inline
enable/disable toggles; Settings tab covers logo/contact
email/copyright/logo height/custom CSS.
EOF
)"
```

---

### Task 4: Frontend — per-template editor page

**Files:**
- Create: `apps/admin/src/app/(shell)/settings/email-templates/[key]/page.tsx`

**Interfaces:**
- Consumes: `useEmailTemplate`, `useUpdateEmailTemplate`, `useResetEmailTemplate`, `usePreviewEmailTemplate` (Task 3).
- Produces: nothing further consumes this — it's the leaf page.

- [ ] **Step 1: Write the editor page**

Create `apps/admin/src/app/(shell)/settings/email-templates/[key]/page.tsx`:

```tsx
"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, Modal, PageHeader } from "@amader/admin-ui";
import {
  useEmailTemplate,
  usePreviewEmailTemplate,
  useResetEmailTemplate,
  useUpdateEmailTemplate,
} from "@/hooks/useEmailTemplates";

const emailIcon = <Icon name="mail" />;
const gradientStyle = { background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" };
const textareaClass =
  "min-h-[420px] rounded-sm border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none focus:border-brand-500";

export default function EmailTemplateEditorPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const { data, isLoading } = useEmailTemplate(key);
  const update = useUpdateEmailTemplate(key);
  const reset = useResetEmailTemplate(key);
  const preview = usePreviewEmailTemplate(key);

  const [subjectDraft, setSubjectDraft] = useState<string | null>(null);
  const [bodyDraft, setBodyDraft] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader icon={emailIcon} title="Setting for email template" subtitle="Email template using HTML & system variables." style={gradientStyle} />
        <Card><p className="text-sm text-muted">Loading…</p></Card>
      </div>
    );
  }

  const subject = subjectDraft ?? data.subject;
  const body = bodyDraft ?? data.bodyHtml;
  const dirty = subjectDraft !== null || bodyDraft !== null;

  function insertVariable(varKey: string) {
    const el = bodyRef.current;
    const token = `{{ ${varKey} }}`;
    if (!el) {
      setBodyDraft(body + token);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = body.slice(0, start) + token + body.slice(end);
    setBodyDraft(next);
    // Restore focus + caret after the inserted token on the next tick,
    // once React has re-rendered the textarea with the new value.
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={emailIcon} title={data.title} subtitle="Email template using HTML & system variables." style={gradientStyle} />
      <Link href="/settings/email-templates" className="flex items-center gap-1.5 text-sm font-semibold text-brand-500">
        <Icon name="arrow_back" size={16} /> Back to Email Templates
      </Link>

      <Card className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubjectDraft(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Content</span>
          <textarea ref={bodyRef} value={body} onChange={(e) => setBodyDraft(e.target.value)} className={textareaClass} spellCheck={false} />
        </label>

        {data.variables.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-secondary">Variables — click to insert</p>
            <div className="flex flex-wrap gap-1.5">
              {data.variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  title={v.description}
                  className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-[0.7rem] text-secondary hover:bg-brand-50 hover:text-brand-500"
                >
                  {`{{ ${v.key} }}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="primary"
            disabled={!dirty || update.isPending}
            onClick={() =>
              update.mutate(
                { subject: subjectDraft ?? undefined, bodyHtml: bodyDraft ?? undefined },
                { onSuccess: () => { setSubjectDraft(null); setBodyDraft(null); } },
              )
            }
          >
            {update.isPending ? "Saving…" : "Save settings"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={reset.isPending}
            onClick={() => reset.mutate(undefined, { onSuccess: () => { setSubjectDraft(null); setBodyDraft(null); } })}
          >
            Reset to default
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={preview.isPending}
            onClick={() => {
              preview.mutate({ subject, bodyHtml: body }, { onSuccess: () => setPreviewOpen(true) });
            }}
          >
            Preview
          </Button>
        </div>
      </Card>

      {previewOpen && preview.data && (
        <Modal open onClose={() => setPreviewOpen(false)} title={preview.data.subject}>
          <iframe title="Email preview" srcDoc={preview.data.html} className="h-[600px] w-full rounded-sm border border-border bg-white" />
        </Modal>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "h:\Amder Project\backend\apps\admin"
npx tsc --noEmit -p tsconfig.json
```

Expected: no output. If `Modal` isn't exported from `@amader/admin-ui` with this exact prop shape (`open`/`onClose`/`title`/children), check `packages/admin-ui/src/components/Modal.tsx` for its real props and adjust the JSX above to match — every other modal usage this session (`ConfirmDialog`, `CustomerImportModal`, etc.) follows the same `open`/`onClose` shape, so this should match directly, but confirm before treating a mismatch as anything other than a prop-name fix.

- [ ] **Step 3: Verify live — edit, save**

Navigate to `http://localhost:3004/settings/email-templates`, click the Edit icon on "Reset password" (the ACL group's row). Confirm the editor loads with the seeded subject (`Reset your Amader Admin password`) and body (containing `{{ header }}`, `{{ admin_name }}`, `{{ reset_link }}`, `{{ footer }}`).

- Click a variable chip (e.g. `{{ admin_name }}`) with the cursor placed somewhere in the textarea — confirm it inserts at the cursor position, not just appended at the end.
- Change the Subject field to `Reset your password — TEST`, click Save settings. Reload the page — confirm the change persisted.
- Click Reset to default. Confirm the Subject reverts to `Reset your Amader Admin password` without a page reload (client state resets from the reset mutation's response).
- Click Preview. Confirm a modal opens showing rendered HTML with the header (green bar) and footer wrapping the content, and `[admin_name]`/`[reset_link]` placeholder text where the real variables would go at send time.

- [ ] **Step 4: Verify live via SQL — confirm defaultSubject/defaultBodyHtml are truly immutable**

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT key, subject, default_subject FROM email_templates WHERE key = 'admin_password_reset';"
```

Expected: `subject` matches whatever was last saved via the editor in Step 3 (or the original seed value if you reset it back); `default_subject` is unchanged from the seed's original value (`Reset your Amader Admin password`) regardless of any edits made.

- [ ] **Step 5: Full regression pass on Task 1–2's constraints**

```bash
cd "h:\Amder Project\backend\apps\backend" && npx tsc --noEmit -p tsconfig.json
cd "h:\Amder Project\backend\apps\admin" && npx tsc --noEmit -p tsconfig.json
cd "h:\Amder Project\backend\packages\db" && npx prisma migrate status
```

Expected: no output from either `tsc` command; `Database schema is up to date!` from the last command.

- [ ] **Step 6: Commit**

```bash
cd "h:\Amder Project\backend"
git add "apps/admin/src/app/(shell)/settings/email-templates/[key]/page.tsx"
git commit -m "$(cat <<'EOF'
Add per-template email editor page (subject, body, variables, preview)

Subject + raw-HTML body editor with click-to-insert merge-variable
chips (matching the Invoice Template settings page's established
pattern), Save / Reset to default / Preview. Completes the email
template system sub-project — nothing sends a real email yet; that's
the order-lifecycle, admin password reset, and contact form
sub-projects that follow, each importing EmailTemplatesService.
EOF
)"
```
