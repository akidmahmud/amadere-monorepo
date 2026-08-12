# Email Template System — Design Spec

## Context

The admin panel's current "Email Settings" page is SMTP connection config only
(host/port/credentials, a "send test email" button) — there is no template
management of any kind. Auditing the actual codebase confirmed there is
exactly **one** transactional email sent anywhere in the system today: a
hardcoded plain-text "your order is confirmed" message
(`OrdersService.sendConfirmationEmail`), fired from checkout and from the
admin manual-order-creation flow. Newsletter Campaigns/Templates is a
separate, already-built system for admin-authored marketing campaigns, not
system-level transactional templates.

The user supplied screenshots of the legacy Botble/Laravel admin's "Email
Templates" feature (`amadere.com/admin/settings/email/templates`, still live)
and asked whether the new backend has an equivalent. It does not. This spec
covers building that equivalent as a genuinely new feature, informed directly
by the live legacy admin (its real template list, its per-template editor UI,
and `platform/plugins/ecommerce/config/email.php` — the config file that
actually powers it) rather than by re-guessing the screenshots.

This is the first of four sub-projects identified during scoping (agreed with
the user):

1. **This spec** — the template engine + admin UI itself (data model,
   rendering, list/toggle/edit pages, base header/footer/logo/CSS settings).
2. Order-lifecycle emails (confirmation, cancellation, delivery, payment
   confirmation) wired to real `Order` status transitions — separate spec.
3. Admin password-reset-by-email (doesn't exist today in any form — admins
   currently have zero self-service recovery) — separate spec.
4. A new Contact Us storefront form + admin inbox, using the Contact
   template group — separate spec.

Each gets its own spec → plan → implementation cycle. This document is
scoped to #1 only.

## Goals

- A `EmailTemplate` row per transactional email event, editable HTML +
  subject, per-template merge-variable list, enable/disable toggle.
- A base header/footer wrapper every template renders inside, itself
  editable as two more template rows.
- Global settings (logo, contact email, copyright, logo height, custom CSS)
  reused across every rendered email.
- Three admin pages mirroring the legacy admin's UX: a toggle-only status
  list, an edit-linked template list (grouped by category), and the
  settings page.
- A render path (`EmailTemplateRenderer`) that later sub-projects call
  instead of hand-building email strings — `render(key, variables) => {
  subject, html } | null` (null when disabled).

## Non-goals (this spec)

- Actually wiring any new trigger point to send an email — sub-projects 2–4.
- A `MARKETPLACE` template group — this backend has no vendor/multi-store
  concept anywhere; the legacy admin's Marketplace section doesn't map to
  anything here.
- Full Twig template support (filters, loops, `{% %}` control structures).
  The legacy editor uses Twig, but every real template in
  `config/email.php` only does flat `{{ variable }}` substitution plus a
  `{{ header }}`/`{{ footer }}` include — lists (e.g. order items) are
  pre-rendered server-side into one HTML-string variable, never looped
  in-template. Plain `{{ variable }}` regex substitution covers this; a real
  templating engine would be an unused-capability dependency. If a future
  template genuinely needs a filter/loop, that's a narrow, later addition.
- Seeding Contact/Ecommerce template rows — those belong to the sub-projects
  that actually send them (seeding a toggle for an email nothing sends yet
  is dead UI). This spec seeds only Base (header, footer) and one ACL row
  (admin reset-password — the row exists so sub-project 3 only has to wire
  behavior, not also touch this admin UI).

## Data model

### New: `EmailTemplate`

```prisma
enum EmailTemplateGroup {
  BASE
  ACL
  CONTACT
  ECOMMERCE
  NEWSLETTER
}

model EmailTemplate {
  id          Int                @id @default(autoincrement())
  key         String             @unique // e.g. "order_confirm", "core_base_header"
  group       EmailTemplateGroup
  title       String
  description String
  subject     String             @default("")
  bodyHtml    String             @db.Text
  // [{ key: "customer_name", description: "Customer's full name" }, ...] —
  // per-template, since each event has different data available. Shown as
  // the editor's insert-variable helper, not enforced/validated against.
  variables   Json               @default("[]")
  canDisable  Boolean            @default(true)
  enabled     Boolean            @default(true)
  createdAt   DateTime           @default(now()) @map("created_at")
  updatedAt   DateTime           @updatedAt @map("updated_at")

  @@map("email_templates")
}
```

`key` for the two base-wrapper rows: `core_base_header`, `core_base_footer`
(mirrors the legacy admin's own `core/base/header` / `core/base/footer`
naming, adapted to this schema's flat-key convention — every other key in
this codebase is a plain string, not a slash path).

### New: `EmailTemplateSettings` — reuses the existing `settings` table

Same pattern as `EmailSettingsService` (SMTP config) — a handful of keys in
the existing generic `Setting` key-value table, not a new table:

- `email_template_logo_media_id` (nullable Int, mirrors `site_logo_media_id`)
- `email_template_contact_email` (string, falls back to SMTP "from" address
  if unset)
- `email_template_copyright` (string, falls back to the site's own
  copyright setting if unset)
- `email_template_logo_height` (int, default `40`)
- `email_template_custom_css` (text, injected as a `<style>` block into the
  base wrapper)

## Rendering

`EmailTemplateRenderer` (new, in a new `email-templates` module):

```ts
render(key: string, variables: Record<string, string>): Promise<{ subject: string; html: string } | null>
```

- Fetches the `EmailTemplate` row by `key`. Throws if the row doesn't exist
  (a missing row is a real bug — every call site's `key` is a literal
  string this spec's seed or a later sub-project's seed controls).
- Returns `null` if `canDisable && !enabled` — the caller's job is to skip
  sending, not this method's.
- Substitutes `{{ variable_name }}` in both `subject` and `bodyHtml` via a
  single regex pass per call — unknown variables left as literal `{{ x }}`
  in the output (a visible bug in the admin's own template edit, not a
  silent data leak).
- Before substitution, wraps `bodyHtml` by replacing a literal `{{ header
  }}` / `{{ footer }}` token with the rendered (variable-substituted, since
  the footer's copyright year etc. needs the same pass) content of the two
  base-wrapper rows. If a template doesn't include either token, it renders
  standalone (matches legacy behavior — `can_off: false` templates like
  confirm-email skip the full chrome).
- The base footer's copyright renders from `EmailTemplateSettings`, not a
  template variable — every email shares one copyright line, so it isn't
  something a per-call site provides.

## Admin UI

Three new pages under a new `/settings/email` route group (mirrors the
existing `/settings/logo`, `/settings/invoice` pattern of one admin section
per settings concern):

### `/settings/email/status` — Email Template Status

Read-only grouped tables (`Base template`, `ACL`, `Contact`, `Ecommerce`,
`Newsletter` — each section only rendered if it has ≥1 row, so empty groups
from not-yet-built sub-projects don't show a bare heading) — Template /
Description / a toggle switch per row. Disabled (`canDisable: false`) rows
render the toggle in a fixed-on, non-interactive state, matching the
legacy screenshot's grayed-out switches for header/footer/reset-password.

### `/settings/email/templates` — Email Templates

Same grouped-table shape, "Operations" column is an Edit icon-button
instead of a toggle. Edit routes to `/settings/email/templates/[key]`:

- Subject text input
- HTML code editor for `bodyHtml` (reuses whatever code-editor component
  this app already uses elsewhere — checked: `CKEDITOR` is used for rich
  text elsewhere, but this needs raw HTML+`{{ }}` source editing, not a
  WYSIWYG; a plain `<textarea>` with monospace font is the honest minimal
  version unless the codebase already has a code editor component — verify
  during planning, don't assume Monaco/CodeMirror is worth adding as a new
  dependency for this alone)
- A "Variables" panel listing that template's own `variables` array —
  clicking one inserts `{{ key }}` at the cursor
- Save / Reset to default (restores the seed's original `subject`/`bodyHtml`
  — requires the seed values to be recoverable, e.g. a checked-in seed
  script the reset action re-reads, not just the DB's current row)
- Preview — renders the current (unsaved-if-edited) draft through
  `EmailTemplateRenderer` using placeholder values for every listed
  variable, opened in a new tab/modal

### `/settings/email/settings` — Email Template Settings

Logo picker (reuses the existing `MediaPicker` component, same pattern as
`/settings/logo`), contact email, copyright, logo height number input,
custom CSS textarea.

## Permissions

New permission key `email_template.view` / `email_template.manage` (matches
every other settings module's `<resource>.view`/`.manage` pair) — also
means this new module needs a nav-config entry (`permission:
"email_template.view"`) once its pages exist, so the role-based nav
filtering built earlier this session covers it.

## Backend module shape

New `apps/backend/src/modules/email-templates/`:
- `email-templates.service.ts` — CRUD + `EmailTemplateRenderer`'s `render()`
- `admin-email-templates.controller.ts` — list/get/update/toggle, settings
  get/update
- `dto/update-email-template.dto.ts`, `dto/update-email-template-settings.dto.ts`
- A seed script (or an addition to the existing seed pipeline — verify
  during planning how the two base-wrapper + one ACL row should ship: a
  Prisma seed script matching how `Role`/`Permission` are seeded elsewhere
  in this codebase, not a manual DB insert)

## Testing / verification

No unit tests in this codebase's convention (verified live, per every prior
feature this session). Verification plan for the implementation:
- Live-toggle a template off, confirm `EmailTemplateRenderer.render()`
  returns `null` for it (there is no real send trigger yet in this
  sub-project — confirmed via a temporary direct service call, not a
  browser flow, since nothing sends yet).
- Edit a template's subject/body, save, confirm the change persists and
  Preview reflects it.
- Confirm header/footer include + logo/copyright settings actually appear
  in a rendered preview.
- Confirm Reset to default restores the seed's original content.
