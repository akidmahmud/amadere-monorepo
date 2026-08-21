# Admin Footer Editor — Design

**Date:** 2026-08-22
**Status:** Approved for planning
**Scope:** Storefront footer becomes fully admin-editable. Homepage is out of scope.

## Problem

`apps/web/src/components/SiteFooter.tsx` hardcodes every value it renders. The only
admin-editable thing in the footer today is the logo (via `site_logo_media_id`).
Changing a phone number, a policy link, or a column heading requires a code edit and a
deploy.

Hardcoded today:

| Value | Current source |
|---|---|
| Brand mark, description paragraph | String literals. The description is Bengali-only and renders on the English site too. |
| Address, phone, working hours | String literals with the label baked into the value (`"Call Us: +8801615980394"`). |
| Facebook / Instagram / YouTube URLs | String literals. |
| Google Play / App Store | Literal `"#"` — dead links that still render as buttons. |
| 3 link columns, 24 links | Literal arrays with inline `isBn ? … : …` ternaries. |
| Payment strip | Static `/images/payment-methods-placeholder.png`. |
| Copyright, "Pay with", app-download label | `messages/{en,bn}.json` — still needs a deploy to change. |

An `email` prop exists on the shared `Footer` component and is never passed.

## Decisions

Confirmed with the product owner before this document was written:

1. **Footer only.** `Admin → Homepage Sections` already exists and drives the entire
   storefront homepage; nothing is needed there.
2. **Full builder.** The admin can add, remove and reorder link columns and the links
   inside them — not just edit fixed text.
3. **EN + BN for every text field**, matching how homepage sections, menu items and
   announcements already work.
4. **A dedicated Footer module**, not an extension of the existing Menu Items tree.
5. **Columns cap at 4.**
6. **Payment strip stays one uploaded banner image**, not individually-managed icons.
7. **Social links and app buttons are admin-managed lists**, not a fixed set of three
   social URLs and two store buttons. The admin can add new entries, each with either a
   built-in icon or an uploaded custom one.
8. **App store buttons stay visible even without a URL.** They render today with a dead
   `href="#"`; they must not disappear when the URL is blank.

## Storage: one JSON setting, not new tables

The footer config lives in the existing `Setting` table under the key `footer_config`.

**Why not relational tables.** A full builder over `FooterColumn` + `FooterLink` +
their translation tables needs roughly ten CRUD endpoints, two reorder endpoints, and
optimistic drag state across two entities. As a JSON document, add/remove/reorder are
plain array operations in form state, saved by a single atomic `PUT` — no partial-save
states, no orphaned rows.

**Why this fits the codebase.** `HomepageSection.config` is already `Json` validated
per-type in its service rather than by the DB, so JSON config is established practice
here. `AGENTS.md §7` names the `Setting` table as the mechanism for values that must
change without a migration. `SettingsService.upsert` already revalidates `/[locale]` as
a layout — which is exactly where the footer renders.

**What it costs.** No DB-level integrity on link rows. A `class-validator` DTO with
nested validation covers this, and it is the same guarantee the homepage sections
config has today.

### Document shape

```jsonc
{
  "brandMark":   { "en": "Amader",  "bn": "আমাদের" },
  "description": { "en": "…",       "bn": "…" },
  "contact": {
    "address": { "label": { "en": "Address:", "bn": "…" }, "value": { "en": "…", "bn": "…" } },
    "phone":   { "label": { "en": "Call Us:", "bn": "…" }, "value": "+8801615980394" },
    "email":   { "label": { "en": "Email:",   "bn": "…" }, "value": "support@amadere.com" },
    "hours":   { "label": { "en": "Working Hours:", "bn": "…" }, "value": { "en": "…", "bn": "…" } }
  },
  "social": [
    { "icon": "facebook", "mediaId": null, "url": "https://…", "label": { "en": "Facebook", "bn": "…" } },
    { "icon": "custom",   "mediaId": 42,   "url": "https://…", "label": { "en": "TikTok",   "bn": "…" } }
  ],
  "apps": {
    "downloadLabel": { "en": "…", "bn": "…" },
    "buttons": [
      {
        "style": "googlePlay", "mediaId": null, "url": "",
        "lineOne": { "en": "GET IT ON",     "bn": "…" },
        "lineTwo": { "en": "Google Play",   "bn": "…" }
      }
    ]
  },
  "columns": [
    {
      "heading": { "en": "…", "bn": "…" },
      "links": [ { "label": { "en": "…", "bn": "…" }, "href": "/about-us", "newTab": false } ]
    }
  ],
  "payment":   { "label": { "en": "Pay With", "bn": "…" }, "mediaId": 123 },
  "copyright": { "en": "Copyright © {year} Amader Ltd. All rights reserved.", "bn": "…" }
}
```

**Contact label and value are separate fields.** Today the label is baked into the
value (`"Call Us: +8801615980394"`), which makes the phone number unusable as a link.
Split, the phone renders as `tel:` and the email as `mailto:` — on a storefront whose
primary payment method is cash on delivery and whose traffic is overwhelmingly mobile,
a tappable support number is worth four extra form fields. Address and hours stay plain
text with a translated label.

`phone.value` and `email.value` are single ASCII strings, not translated pairs, because
they have to be valid `tel:` / `mailto:` targets. This matches what the live footer
already displays in both locales. Bengali-numeral display of the phone number is
deliberately not supported; it would need a separate display field from the dial string.

**Social links and app buttons are lists.** Each social entry is a `url`, an
accessible `label`, and an icon that is either one of the built-in names — `facebook`,
`instagram`, `youtube`, `tiktok`, `whatsapp`, `linkedin`, `x`, `telegram`, `pinterest`
— or `custom` with a `mediaId` pointing at an uploaded image. The custom image renders
inside the same 40px circle as the built-ins, so an added icon is visually consistent
with the shipped ones rather than obviously bolted on.

App buttons work the same way: `style` is `googlePlay`, `appStore`, or `custom` with a
`mediaId`, and the two text lines are translated so "GET IT ON / Google Play" can read
in Bengali.

**An app button with an empty `url` still renders**, as a non-interactive element with
identical styling. It is not hidden, and it is not an `href="#"` — that anchor scrolls
the visitor to the top of the page, which is worse than nothing. A social entry with an
empty URL behaves the same way, though in practice one is only added with a URL.

`{year}` in `copyright` is interpolated by the storefront, preserving today's
`t("copyright", { year })` behaviour without requiring the admin to edit it annually.

## Backend — `apps/backend/src/modules/footer/`

| File | Responsibility |
|---|---|
| `footer.defaults.ts` | Today's exact footer content, as a typed constant. |
| `footer.service.ts` | `getPublic(locale)`, `getAdmin()`, `update(dto)`. |
| `footer.controller.ts` | `GET /api/v1/footer?locale=EN` — public. |
| `admin-footer.controller.ts` | `GET` / `PUT /api/v1/admin/footer`. |
| `dto/update-footer.dto.ts` | Nested `class-validator` schema. |
| `footer.module.ts` | Wiring. |

**`getPublic(locale)`** merges the stored document over `footer.defaults.ts`, flattens
each `{ en, bn }` pair down to the requested locale, and resolves `payment.mediaId` to
a real URL via the same Media lookup `SettingsService` uses for the logo. Merging over
defaults means a fresh database — or a partially-filled document — renders the current
footer rather than a blank one. There is no state in which the storefront shows an
empty footer.

**`update(dto)`** validates, upserts the setting, then calls
`RevalidationService.revalidate(['/[locale]'], 'layout')` fire-and-forget, matching
every other revalidation caller: an admin save must never wait on, or fail because of,
a briefly unreachable storefront.

**Validation rules.** At most 4 columns. At most 10 social entries and 4 app buttons —
bounds to keep a malformed payload from rendering a wall of icons, not product limits.
Each column `href` must be a site-relative path or an absolute `http(s)` URL. Social and
app URLs must be absolute `http(s)` or empty. `icon` / `style` must be a known name or
`custom`; `custom` requires a `mediaId`, and a `mediaId` without `custom` is rejected.
`phone.value` must be a dialable string and `email.value` a valid address, since they
become `tel:` and `mailto:` targets. Unknown keys rejected via `forbidNonWhitelisted`.
Both `en` and `bn` required on every translated field — an empty string is allowed, a
missing key is not.

**Permissions.** `footer.view` and `footer.update` added to
`packages/shared/src/permission-catalog.ts`, applied with `@RequirePermission` on the
admin controller, and picked up by re-running the seed.

## Admin — `/footer`

A single page with a single Save button, at `apps/admin/src/app/(shell)/footer/page.tsx`,
with a `useFooter.ts` hook alongside the other admin hooks.

Form sections: **Brand & description · Contact · Social & app links · Link columns ·
Payment strip · Copyright.**

Link columns are a nested repeater — add, remove and move columns (capped at 4), and
add, remove and move links within each. Bengali and English inputs sit side by side per
field, matching the existing homepage-sections form.

Social links and app buttons are repeaters too. Each row is an icon selector, a URL, and
its translated label. The icon selector is a dropdown of the built-in names that renders
each option's actual glyph, plus a `custom` choice that reveals a `MediaPicker`. The
payment strip uses the same `MediaPicker`.

The nav entry goes next to Menu Items in the Content group of `lib/nav-config.tsx`,
gated on `footer.view`.

## Storefront

`app/[locale]/layout.tsx` already server-fetches site info, nav menu and announcements;
the footer config joins that set and is passed to `SiteFooter` as `initialFooter`. This
keeps the footer server-rendered — no client fetch, no layout shift — and matches how
`initialLogoUrl` and `initialNavMenu` already reach the same component.

`SiteFooter.tsx` drops all of its hardcoded arrays and becomes a mapper from config to
props. It keeps `safeGet`-style fallback behaviour: if the backend is unreachable, the
footer renders defaults rather than failing the page.

### `@amader/ui` `Footer` change

The grid is currently `lg:grid-cols-[1.6fr_1fr_1fr_1fr]` — the brand block plus exactly
three columns. A fourth column would wrap onto a new row. It needs a static lookup keyed
on column count so Tailwind's JIT still sees whole class strings:

```ts
const gridCols = {
  1: "lg:grid-cols-[1.6fr_1fr]",
  2: "lg:grid-cols-[1.6fr_1fr_1fr]",
  3: "lg:grid-cols-[1.6fr_1fr_1fr_1fr]",
  4: "lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]",
}[Math.min(Math.max(columns.length, 1), 4)];
```

Separately, `columns.map` keys on `column.heading` and links key on `link.label`. With
admin-editable content, two columns can legitimately share a heading, which would
collide. Both switch to index-based keys.

**Social and app props become arrays.** `facebookHref` / `instagramHref` /
`youtubeHref` collapse into one `social: FooterSocialLink[]`, and `googlePlayHref` /
`appStoreHref` into `appButtons: FooterAppButton[]`. The nine built-in social glyphs and
the two store glyphs stay inside `@amader/ui` as a name-keyed map; a `custom` entry
renders its image in the same 40px circle. This is a breaking change to `FooterProps`,
but `SiteFooter` is the only consumer outside `Footer.stories.tsx`, which is updated in
the same commit.

**Mobile responsiveness.** The social row is `flex gap-2` today — fine for three icons,
but it will overflow a 360px viewport once the admin adds a fourth or fifth. It becomes
`flex flex-wrap gap-2`. The app-button row already wraps. Both are checked at 360px with
the maximum allowed entry counts, not just the current three-and-two.

An app button with no URL renders as a `<span>` carrying the anchor's classes minus the
hover state, so it is visually identical but not focusable or clickable — a keyboard
user does not tab onto a control that does nothing.

## Dead i18n keys

The `footer` namespace in `apps/web/messages/{en,bn}.json` holds 30 keys. Only
`SiteFooter.tsx` reads that namespace, and it uses exactly three: `appDownloadLabel`,
`copyright`, `payWith`. The other 27 are already dead — leftovers from an earlier footer
design, superseded when the current footer moved its links inline. Verified: no other
`useTranslations("footer")` call and no `t("footer.…")` anywhere in the app.

Once those last three move into the database, the whole namespace has no readers.
Leaving it in place creates two sources of truth where one is a decoy — someone editing
`messages/en.json` to fix the copyright line would watch the change do nothing.

The namespace is deleted from both files, **as its own commit**, separate from the
feature so it can be reverted independently.

## Out of scope

`SiteHeader`, `MobileStickyFooter`, and the newsletter banner. They are separate
components with separate content sources and none of them are what was asked for.

## Testing

- Unit: `getPublic` locale flattening — a document with both locales returns only the
  requested one.
- Unit: defaults merge — an absent setting, and a partially-filled document, both yield
  a complete footer.
- Unit: DTO rejection — a 5th column, a malformed `href`, an `icon: "custom"` with no
  `mediaId`, a `mediaId` on a built-in icon, and an unknown key are each refused.
- Unit: `payment.mediaId` and each `custom` social/app `mediaId` resolve to URLs; an
  absent payment image leaves the placeholder.
- Unit: an app button with an empty `url` is still present in the returned config —
  guards against a future "tidy up empty values" change silently reintroducing the
  disappearing-button behaviour the owner explicitly rejected.
- Manual: save in admin, confirm the storefront footer reflects it in both locales.
- Manual at 360px width: 4 columns, 10 social icons and 4 app buttons wrap without
  horizontal overflow.

## Risks

**A bad save blanks the footer.** Mitigated by merge-over-defaults: a field the admin
clears falls back rather than rendering empty. A deliberately-emptied field is
indistinguishable from an unset one — accepted, since the footer degrading to its
default is the safe direction.

**Custom icons will not match the built-ins on hover.** The nine built-in glyphs are
inline SVG using `currentColor`, so hovering inverts them to white on green. An uploaded
PNG cannot do that — it will sit static inside the circle while its neighbours invert.
Accepted rather than solved: the alternative is restricting uploads to single-colour SVG
and recolouring via CSS mask, which is a real constraint to put on a non-technical
admin. The admin guidance should be "upload a square, transparent, dark-green icon".

**Config drift from the DTO.** The document is validated on write, but a row written
before a future schema change is not re-validated on read. `getPublic` merging over
typed defaults contains this: unknown or missing fields are ignored rather than crashing
the layout, which renders on every page.
