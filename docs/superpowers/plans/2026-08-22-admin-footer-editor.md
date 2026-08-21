# Admin Footer Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every value in the storefront footer editable from the admin panel, with EN/BN text, admin-managed social and app-store icon lists, and up to four link columns.

**Architecture:** One JSON document in the existing `Setting` table under the key `footer_config`, read by a public `GET /api/v1/footer` and written by `PUT /api/v1/admin/footer`. The service merges the stored document over a typed defaults constant, so a missing or partial document still renders today's footer. The storefront fetches it server-side in the locale layout and passes it to `SiteFooter`, which becomes a pure mapper onto the shared `@amader/ui` `Footer` component.

**Tech Stack:** NestJS 11 + Prisma (backend), Next.js 16 App Router + TanStack Query (admin and web), Tailwind (UI package), Jest + ts-jest (backend tests only).

**Spec:** `docs/superpowers/specs/2026-08-22-admin-footer-editor-design.md`

## Global Constraints

- **Setting key:** `footer_config`. Exact string, no prefix.
- **Caps:** at most 4 link columns, 10 social entries, 4 app buttons.
- **Built-in social icon names:** `facebook`, `instagram`, `youtube`, `tiktok`, `whatsapp`, `linkedin`, `x`, `telegram`, `pinterest`. Plus `custom`.
- **Built-in app button styles:** `googlePlay`, `appStore`. Plus `custom`.
- **Every translated field is `{ en: string; bn: string }`** — both keys required, empty string allowed, missing key rejected.
- **`phone.value` and `email.value` are single ASCII strings**, not translated pairs. They become `tel:` / `mailto:` targets.
- **An app button with an empty `url` still renders**, as a non-interactive `<span>`. Never hidden, never `href="#"`.
- **Only `apps/backend` has a test runner** (Jest). `packages/ui`, `apps/web` and `apps/admin` have no test framework — do not add one. Their verification is `tsc --noEmit`, Storybook, and stated manual browser checks.
- **Working directory for all commands is `h:/Amder Project/backend`** (the git root) unless a step says otherwise.
- The dev servers are already running: backend `:3000`, web `:3001`, admin `:3004`.

---

### Task 1: Shared constants and RBAC permissions

**Files:**
- Create: `packages/shared/src/footer.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/permission-catalog.ts` (after the `homepage_section` block, ~line 169)

**Interfaces:**
- Consumes: nothing.
- Produces: `FOOTER_SOCIAL_ICONS`, `FOOTER_APP_STYLES`, `FOOTER_MAX_COLUMNS`, `FOOTER_MAX_SOCIAL`, `FOOTER_MAX_APP_BUTTONS`, types `FooterSocialIcon` and `FooterAppStyle`. Permission keys `footer.view` and `footer.update`.

These live in `@amader/shared` rather than the backend module because three consumers need the same list: the backend DTO validates against it, the admin renders a dropdown from it, and the UI package keys its glyph map on it.

- [ ] **Step 1: Create the shared constants file**

Create `packages/shared/src/footer.ts`:

```ts
// Shared by the backend DTO (validation), the admin icon dropdown, and the
// @amader/ui glyph map — one list, so adding an icon is a single edit.
export const FOOTER_SOCIAL_ICONS = [
  'facebook',
  'instagram',
  'youtube',
  'tiktok',
  'whatsapp',
  'linkedin',
  'x',
  'telegram',
  'pinterest',
  'custom',
] as const;

export type FooterSocialIcon = (typeof FOOTER_SOCIAL_ICONS)[number];

export const FOOTER_APP_STYLES = ['googlePlay', 'appStore', 'custom'] as const;

export type FooterAppStyle = (typeof FOOTER_APP_STYLES)[number];

// Bounds against a malformed payload rendering a wall of icons — not product
// limits. The column cap is real though: the footer grid has four widths.
export const FOOTER_MAX_COLUMNS = 4;
export const FOOTER_MAX_SOCIAL = 10;
export const FOOTER_MAX_APP_BUTTONS = 4;
```

- [ ] **Step 2: Export it**

Add to `packages/shared/src/index.ts`, following the existing export style in that file:

```ts
export * from './footer';
```

- [ ] **Step 3: Add the permissions**

In `packages/shared/src/permission-catalog.ts`, insert immediately after the `perm('homepage_section', 'delete'),` line:

```ts

  perm('footer', 'view'),
  perm('footer', 'update'),
```

Only `view` and `update` — the footer is a single document, so there is nothing to create or delete.

- [ ] **Step 4: Build the shared package**

Run: `pnpm --filter @amader/shared build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 5: Seed the new permissions**

Run: `pnpm --filter @amader/db exec tsx prisma/seed.ts`

If that script name does not resolve, read `packages/db/package.json` and use its declared seed script instead. The seed is an upsert loop over `PERMISSION_CATALOG`, so re-running it is safe and idempotent.

- [ ] **Step 6: Verify the permissions landed**

Run:

```bash
docker exec backend-postgres-1 psql -U amader -d amader -c "select key from permissions where resource = 'footer' order by key;"
```

Expected: two rows, `footer.update` and `footer.view`.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/footer.ts packages/shared/src/index.ts packages/shared/src/permission-catalog.ts
git commit -m "feat(footer): shared footer constants and RBAC permissions"
```

---

### Task 2: Backend footer types and defaults

**Files:**
- Create: `apps/backend/src/modules/footer/footer.types.ts`
- Create: `apps/backend/src/modules/footer/footer.defaults.ts`

**Interfaces:**
- Consumes: `FooterSocialIcon`, `FooterAppStyle` from `@amader/shared`.
- Produces: `FooterConfig`, `Translated`, `FooterColumn`, `FooterLink`, `FooterSocialLink`, `FooterAppButton`, `PublicFooterDto`-shaped source types, and `FOOTER_DEFAULTS: FooterConfig`.

No test in this task — it is two declaration files with no behaviour. Task 3 tests them through the service.

- [ ] **Step 1: Create the types file**

Create `apps/backend/src/modules/footer/footer.types.ts`:

```ts
import type { FooterAppStyle, FooterSocialIcon } from '@amader/shared';

/** Every admin-editable text field carries both locales. Both keys are
 * required — an empty string is a deliberate blank, a missing key is a bug. */
export interface Translated {
  en: string;
  bn: string;
}

export interface FooterLink {
  label: Translated;
  href: string;
  newTab: boolean;
}

export interface FooterColumn {
  heading: Translated;
  links: FooterLink[];
}

export interface FooterSocialLink {
  icon: FooterSocialIcon;
  /** Set only when icon === 'custom'. */
  mediaId: number | null;
  url: string;
  /** Becomes the anchor's aria-label. */
  label: Translated;
}

export interface FooterAppButton {
  style: FooterAppStyle;
  /** Set only when style === 'custom'. */
  mediaId: number | null;
  /** Empty renders an inert button rather than hiding it. */
  url: string;
  lineOne: Translated;
  lineTwo: Translated;
}

/** Address and hours are prose, so their values translate. Phone and email
 * are single ASCII strings because they become tel:/mailto: targets. */
export interface FooterContact {
  address: { label: Translated; value: Translated };
  phone: { label: Translated; value: string };
  email: { label: Translated; value: string };
  hours: { label: Translated; value: Translated };
}

export interface FooterConfig {
  brandMark: Translated;
  description: Translated;
  contact: FooterContact;
  social: FooterSocialLink[];
  apps: { downloadLabel: Translated; buttons: FooterAppButton[] };
  columns: FooterColumn[];
  payment: { label: Translated; mediaId: number | null };
  copyright: Translated;
}
```

- [ ] **Step 2: Create the defaults file**

Create `apps/backend/src/modules/footer/footer.defaults.ts`. This must reproduce **today's rendered footer exactly**, so that a database with no `footer_config` row is visually indistinguishable from the current site.

Port the content verbatim from `apps/web/src/components/SiteFooter.tsx`:
- `aboutLinks` (lines 27-35), `policyLinks` (37-47), `categoryLinks` (49-58) become the three `columns`, each `isBn ? X : Y` ternary splitting into `{ en: Y, bn: X }`.
- `descriptionText` (line 60) is Bengali-only today. Use it for **both** `en` and `bn` — the spec calls fixing the English copy a content decision for the owner, not a code change.
- The contact strings split at the colon: `"Address: Salna, Gazipur"` becomes label `"Address:"` and value `"Salna, Gazipur"`.

Skeleton with the first entry of each list filled in — complete the rest from the source file:

```ts
import { FooterConfig } from './footer.types';

// Mirrors what apps/web/src/components/SiteFooter.tsx hardcoded before this
// feature. Every getPublic() response is merged over this, so an empty or
// partially-filled footer_config row still renders a complete footer.
export const FOOTER_DEFAULTS: FooterConfig = {
  brandMark: { en: 'আমাদের', bn: 'আমাদের' },
  // Bengali on both locales, exactly as the site renders today. Writing
  // English copy here is the owner's content decision, not this task's.
  description: {
    en: 'Amader™ (আমাদের™) কেবল একটি ফুড ব্র্যান্ড নয়, এটি বিশুদ্ধতা, বিশ্বাস এবং যত্নের প্রতিশ্রুতি। Amader™ নিশ্চিত করে প্রতিটি পণ্য ১০০% বিশুদ্ধ, ন্যাচারাল এবং স্বাস্থ্যকর। আমাদের লক্ষ্য মানুষকে প্রাচীন ন্যাচারাল খাঁটি, স্বাস্থ্যকর খাবারের সাথে পুনরায় সংযুক্ত করে এমন একটি ভবিষ্যত তৈরি করা যেখানে স্বাস্থ্য, স্বাদ এবং প্রকৃতি মিলেমিশে বাস করে ওষুধ ছাড়া।',
    bn: 'Amader™ (আমাদের™) কেবল একটি ফুড ব্র্যান্ড নয়, এটি বিশুদ্ধতা, বিশ্বাস এবং যত্নের প্রতিশ্রুতি। Amader™ নিশ্চিত করে প্রতিটি পণ্য ১০০% বিশুদ্ধ, ন্যাচারাল এবং স্বাস্থ্যকর। আমাদের লক্ষ্য মানুষকে প্রাচীন ন্যাচারাল খাঁটি, স্বাস্থ্যকর খাবারের সাথে পুনরায় সংযুক্ত করে এমন একটি ভবিষ্যত তৈরি করা যেখানে স্বাস্থ্য, স্বাদ এবং প্রকৃতি মিলেমিশে বাস করে ওষুধ ছাড়া।',
  },
  contact: {
    address: {
      label: { en: 'Address:', bn: 'ঠিকানা:' },
      value: { en: 'Salna, Gazipur', bn: 'সালনা, গাজীপুর' },
    },
    phone: { label: { en: 'Call Us:', bn: 'কল করুন:' }, value: '+8801615980394' },
    email: { label: { en: 'Email:', bn: 'ইমেইল:' }, value: '' },
    hours: {
      label: { en: 'Working Hours:', bn: 'কর্মঘণ্টা:' },
      value: { en: '10am to 8pm', bn: 'সকাল ১০টা - রাত ৮টা' },
    },
  },
  social: [
    {
      icon: 'facebook',
      mediaId: null,
      url: 'https://www.facebook.com/amaderecommerce',
      label: { en: 'Facebook', bn: 'ফেসবুক' },
    },
    // instagram: https://www.instagram.com/amaderebuy
    // youtube:   https://www.youtube.com/@amadere
  ],
  apps: {
    downloadLabel: { en: 'Download App on Mobile:', bn: 'মোবাইলে অ্যাপ ডাউনলোড করুন:' },
    buttons: [
      {
        style: 'googlePlay',
        mediaId: null,
        url: '',
        lineOne: { en: 'GET IT ON', bn: 'পাওয়া যাচ্ছে' },
        lineTwo: { en: 'Google Play', bn: 'Google Play' },
      },
      // appStore: lineOne 'Download on the' / 'ডাউনলোড করুন', lineTwo 'App Store'
    ],
  },
  columns: [
    {
      heading: { en: 'About Amader™', bn: 'আমাদের™ সম্পর্কে' },
      links: [
        { label: { en: 'About Amader™', bn: 'আমাদের™ সম্পর্কে' }, href: '/about-us', newTab: false },
        // ...remaining six from aboutLinks
      ],
    },
    // ...Amader™ Policy (nine links) and Product Categories (eight links)
  ],
  payment: { label: { en: 'Pay With', bn: 'পে উইথ' }, mediaId: null },
  copyright: {
    en: 'Copyright © {year} Amader Ltd. All rights reserved.',
    bn: 'কপিরাইট © {year} আমাদের লিমিটেড। সর্বস্বত্ব সংরক্ষিত।',
  },
};
```

The `googlePlay` and `appStore` URLs are `''` on purpose — they are `"#"` today, which is a dead link. Empty means the button renders inert (Task 6), which is the behaviour the owner asked for.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @amader/backend exec tsc --noEmit -p tsconfig.json`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/footer/
git commit -m "feat(footer): config types and defaults ported from SiteFooter"
```

---

### Task 3: Footer service

**Files:**
- Create: `apps/backend/src/modules/footer/footer.service.ts`
- Test: `apps/backend/src/modules/footer/footer.service.spec.ts`

**Interfaces:**
- Consumes: `FOOTER_DEFAULTS` and the types from Task 2; `PrismaService` from `../../common/prisma/prisma.service`; `RevalidationService` from `../../common/revalidation/revalidation.service`.
- Produces: `FooterService` with `getPublic(locale: 'EN' | 'BN'): Promise<PublicFooter>`, `getAdmin(): Promise<FooterConfig>`, `update(input: FooterConfig): Promise<FooterConfig>`; and the exported `PublicFooter` interface consumed by the controller in Task 5 and the storefront in Task 7.

`getPublic` does three things: merge the stored document over defaults, flatten every `{ en, bn }` to the requested locale, and resolve each `mediaId` to a URL.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/footer/footer.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { FooterService } from './footer.service';
import { FOOTER_DEFAULTS } from './footer.defaults';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RevalidationService } from '../../common/revalidation/revalidation.service';

function createMockPrismaService() {
  return {
    client: {
      setting: { findUnique: jest.fn(), upsert: jest.fn() },
      media: { findMany: jest.fn().mockResolvedValue([]) },
    },
  };
}

type MockPrisma = ReturnType<typeof createMockPrismaService>;

describe('FooterService', () => {
  let service: FooterService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FooterService,
        { provide: PrismaService, useValue: prisma },
        { provide: RevalidationService, useValue: { revalidate: jest.fn() } },
      ],
    }).compile();
    service = module.get(FooterService);
  });

  it('falls back to defaults when no footer_config row exists', async () => {
    prisma.client.setting.findUnique.mockResolvedValue(null);

    const footer = await service.getPublic('EN');

    expect(footer.columns).toHaveLength(FOOTER_DEFAULTS.columns.length);
    expect(footer.brandMark).toBe(FOOTER_DEFAULTS.brandMark.en);
  });

  it('flattens translated fields to the requested locale only', async () => {
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: { ...FOOTER_DEFAULTS, brandMark: { en: 'Amader', bn: 'আমাদের' } },
    });

    const en = await service.getPublic('EN');
    const bn = await service.getPublic('BN');

    expect(en.brandMark).toBe('Amader');
    expect(bn.brandMark).toBe('আমাদের');
  });

  it('merges a partial document over defaults instead of blanking the footer', async () => {
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: { copyright: { en: 'Only this', bn: 'Only this' } },
    });

    const footer = await service.getPublic('EN');

    expect(footer.copyright).toBe('Only this');
    expect(footer.columns).toHaveLength(FOOTER_DEFAULTS.columns.length);
    expect(footer.contact.phone.value).toBe(FOOTER_DEFAULTS.contact.phone.value);
  });

  it('keeps an app button whose url is empty', async () => {
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: {
        ...FOOTER_DEFAULTS,
        apps: {
          downloadLabel: { en: 'Get the app', bn: 'অ্যাপ নিন' },
          buttons: [
            {
              style: 'googlePlay',
              mediaId: null,
              url: '',
              lineOne: { en: 'GET IT ON', bn: 'GET IT ON' },
              lineTwo: { en: 'Google Play', bn: 'Google Play' },
            },
          ],
        },
      },
    });

    const footer = await service.getPublic('EN');

    expect(footer.apps.buttons).toHaveLength(1);
    expect(footer.apps.buttons[0].url).toBe('');
  });

  it('resolves custom icon and payment media ids to urls', async () => {
    prisma.client.media.findMany.mockResolvedValue([
      { id: 7, url: 'https://cdn.example/tiktok.png' },
      { id: 9, url: 'https://cdn.example/pay.png' },
    ]);
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: {
        ...FOOTER_DEFAULTS,
        social: [
          {
            icon: 'custom',
            mediaId: 7,
            url: 'https://tiktok.com/@amader',
            label: { en: 'TikTok', bn: 'টিকটক' },
          },
        ],
        payment: { label: { en: 'Pay With', bn: 'পে উইথ' }, mediaId: 9 },
      },
    });

    const footer = await service.getPublic('EN');

    expect(footer.social[0].imageUrl).toBe('https://cdn.example/tiktok.png');
    expect(footer.payment.imageUrl).toBe('https://cdn.example/pay.png');
  });

  it('upserts and triggers a layout revalidate on update', async () => {
    prisma.client.setting.findUnique.mockResolvedValue(null);
    prisma.client.setting.upsert.mockResolvedValue({
      key: 'footer_config',
      value: FOOTER_DEFAULTS,
    });

    await service.update(FOOTER_DEFAULTS);

    expect(prisma.client.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'footer_config' } }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @amader/backend exec jest src/modules/footer --verbose`
Expected: FAIL — `Cannot find module './footer.service'`.

- [ ] **Step 3: Write the service**

Create `apps/backend/src/modules/footer/footer.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Locale } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RevalidationService } from '../../common/revalidation/revalidation.service';
import { FOOTER_DEFAULTS } from './footer.defaults';
import { FooterConfig, Translated } from './footer.types';

export const FOOTER_CONFIG_KEY = 'footer_config';

/** getPublic()'s return shape — every Translated collapsed to one string and
 * every mediaId already resolved, so the storefront does no second lookup. */
export interface PublicFooter {
  brandMark: string;
  description: string;
  contact: {
    address: { label: string; value: string };
    phone: { label: string; value: string };
    email: { label: string; value: string };
    hours: { label: string; value: string };
  };
  social: { icon: string; imageUrl: string | null; url: string; label: string }[];
  apps: {
    downloadLabel: string;
    buttons: { style: string; imageUrl: string | null; url: string; lineOne: string; lineTwo: string }[];
  };
  columns: { heading: string; links: { label: string; href: string; newTab: boolean }[] }[];
  payment: { label: string; imageUrl: string | null };
  copyright: string;
}

type LocaleKey = 'en' | 'bn';

// One row in the generic Setting table, same reuse-over-fork pattern as
// WhatsappSettingsService. Merged over FOOTER_DEFAULTS on every read so a
// missing or half-filled document can never render an empty footer — this
// component is on every page of the site.
@Injectable()
export class FooterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidation: RevalidationService,
  ) {}

  async getAdmin(): Promise<FooterConfig> {
    const row = await this.prisma.client.setting.findUnique({
      where: { key: FOOTER_CONFIG_KEY },
    });
    return this.merge(row?.value as Partial<FooterConfig> | undefined);
  }

  async getPublic(locale: Locale): Promise<PublicFooter> {
    const config = await this.getAdmin();
    const key: LocaleKey = locale === 'BN' ? 'bn' : 'en';
    const urls = await this.resolveMedia(config);
    const t = (value: Translated): string => value?.[key] ?? '';

    return {
      brandMark: t(config.brandMark),
      description: t(config.description),
      contact: {
        address: { label: t(config.contact.address.label), value: t(config.contact.address.value) },
        phone: { label: t(config.contact.phone.label), value: config.contact.phone.value },
        email: { label: t(config.contact.email.label), value: config.contact.email.value },
        hours: { label: t(config.contact.hours.label), value: t(config.contact.hours.value) },
      },
      social: config.social.map((s) => ({
        icon: s.icon,
        imageUrl: s.mediaId ? (urls.get(s.mediaId) ?? null) : null,
        url: s.url,
        label: t(s.label),
      })),
      apps: {
        downloadLabel: t(config.apps.downloadLabel),
        buttons: config.apps.buttons.map((b) => ({
          style: b.style,
          imageUrl: b.mediaId ? (urls.get(b.mediaId) ?? null) : null,
          url: b.url,
          lineOne: t(b.lineOne),
          lineTwo: t(b.lineTwo),
        })),
      },
      columns: config.columns.map((c) => ({
        heading: t(c.heading),
        links: c.links.map((l) => ({ label: t(l.label), href: l.href, newTab: l.newTab })),
      })),
      payment: {
        label: t(config.payment.label),
        imageUrl: config.payment.mediaId ? (urls.get(config.payment.mediaId) ?? null) : null,
      },
      copyright: t(config.copyright),
    };
  }

  async update(input: FooterConfig): Promise<FooterConfig> {
    const next = this.merge(input);
    await this.prisma.client.setting.upsert({
      where: { key: FOOTER_CONFIG_KEY },
      create: { key: FOOTER_CONFIG_KEY, value: next as never },
      update: { value: next as never },
    });
    // Fire-and-forget, like every other RevalidationService caller: an admin
    // save must never wait on, or fail because of, an unreachable storefront.
    // 'layout' because the footer renders inside [locale]/layout.tsx on every
    // page, not on one specific route.
    void this.revalidation.revalidate(['/[locale]'], 'layout');
    return next;
  }

  // ------------------------------------------------------------------

  /** Shallow-merges each top-level section over defaults. Arrays replace
   * wholesale rather than merging element-wise — an admin who deletes a
   * column means it, and index-merging two different-length arrays produces
   * nonsense. An array that is absent entirely still falls back. */
  private merge(stored: Partial<FooterConfig> | undefined): FooterConfig {
    if (!stored || typeof stored !== 'object') return FOOTER_DEFAULTS;
    return {
      brandMark: stored.brandMark ?? FOOTER_DEFAULTS.brandMark,
      description: stored.description ?? FOOTER_DEFAULTS.description,
      contact: { ...FOOTER_DEFAULTS.contact, ...(stored.contact ?? {}) },
      social: stored.social ?? FOOTER_DEFAULTS.social,
      apps: { ...FOOTER_DEFAULTS.apps, ...(stored.apps ?? {}) },
      columns: stored.columns ?? FOOTER_DEFAULTS.columns,
      payment: { ...FOOTER_DEFAULTS.payment, ...(stored.payment ?? {}) },
      copyright: stored.copyright ?? FOOTER_DEFAULTS.copyright,
    };
  }

  /** One findMany for every custom icon plus the payment strip, rather than
   * a findUnique per entry — with ten social icons that would be eleven
   * round trips on a component that renders on every page. */
  private async resolveMedia(config: FooterConfig): Promise<Map<number, string>> {
    const ids = [
      ...config.social.map((s) => s.mediaId),
      ...config.apps.buttons.map((b) => b.mediaId),
      config.payment.mediaId,
    ].filter((id): id is number => typeof id === 'number');

    if (ids.length === 0) return new Map();

    const media = await this.prisma.client.media.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, url: true },
    });
    return new Map(media.map((m) => [m.id, m.url]));
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @amader/backend exec jest src/modules/footer --verbose`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/footer/
git commit -m "feat(footer): service with defaults merge, locale flattening, media resolution"
```

---

### Task 4: Update DTO and validation

**Files:**
- Create: `apps/backend/src/modules/footer/dto/update-footer.dto.ts`
- Test: `apps/backend/src/modules/footer/dto/update-footer.dto.spec.ts`

**Interfaces:**
- Consumes: the caps and icon lists from `@amader/shared` (Task 1).
- Produces: `UpdateFooterDto`, plus the nested classes `TranslatedDto`, `FooterLinkDto`, `FooterColumnDto`, `FooterSocialLinkDto`, `FooterAppButtonDto`, `FooterContactDto`, `FooterAppsDto`, `FooterPaymentDto`. The controller in Task 5 binds `UpdateFooterDto`.

The global `ValidationPipe` already runs with `whitelist` and `transform`; nested objects need `@ValidateNested` plus `@Type` to be reached at all.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/footer/dto/update-footer.dto.spec.ts`:

```ts
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateFooterDto } from './update-footer.dto';
import { FOOTER_DEFAULTS } from '../footer.defaults';

function validate(payload: unknown) {
  return validateSync(plainToInstance(UpdateFooterDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('UpdateFooterDto', () => {
  it('accepts the defaults document', () => {
    expect(validate(FOOTER_DEFAULTS)).toHaveLength(0);
  });

  it('rejects a fifth column', () => {
    const payload = {
      ...FOOTER_DEFAULTS,
      columns: [...FOOTER_DEFAULTS.columns, ...FOOTER_DEFAULTS.columns].slice(0, 5),
    };
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects a link href that is neither relative nor http(s)', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.columns[0].links[0].href = 'javascript:alert(1)';
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects a custom icon with no mediaId', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.social = [
      { icon: 'custom', mediaId: null, url: 'https://x.test', label: { en: 'X', bn: 'X' } },
    ];
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects a mediaId on a built-in icon', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.social = [
      { icon: 'facebook', mediaId: 4, url: 'https://x.test', label: { en: 'F', bn: 'F' } },
    ];
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects a translated field missing its bn key', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.brandMark = { en: 'Amader' };
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('accepts an app button with an empty url', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.apps.buttons[0].url = '';
    expect(validate(payload)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @amader/backend exec jest src/modules/footer/dto --verbose`
Expected: FAIL — `Cannot find module './update-footer.dto'`.

- [ ] **Step 3: Write the DTO**

Create `apps/backend/src/modules/footer/dto/update-footer.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  FOOTER_APP_STYLES,
  FOOTER_MAX_APP_BUTTONS,
  FOOTER_MAX_COLUMNS,
  FOOTER_MAX_SOCIAL,
  FOOTER_SOCIAL_ICONS,
} from '@amader/shared';

// A site-relative path or an absolute http(s) URL. Deliberately excludes
// javascript: and data: — these strings land in an href rendered on every
// page, and the admin panel is not the only thing that writes settings.
const HREF = /^(\/[^\s]*|https?:\/\/[^\s]+)$/;
const ABSOLUTE_OR_EMPTY = /^(|https?:\/\/[^\s]+)$/;

export class TranslatedDto {
  @ApiProperty()
  @IsDefined()
  @IsString()
  en!: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  bn!: string;
}

export class FooterLinkDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  label!: TranslatedDto;

  @ApiProperty({ example: '/about-us' })
  @Matches(HREF, { message: 'href must be a site-relative path or an http(s) URL' })
  href!: string;

  @ApiProperty()
  @IsBoolean()
  newTab!: boolean;
}

export class FooterColumnDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  heading!: TranslatedDto;

  @ApiProperty({ type: FooterLinkDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FooterLinkDto)
  links!: FooterLinkDto[];
}

export class FooterSocialLinkDto {
  @ApiProperty({ enum: FOOTER_SOCIAL_ICONS })
  @IsIn(FOOTER_SOCIAL_ICONS as unknown as string[])
  icon!: string;

  @ApiProperty({ nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  mediaId!: number | null;

  @ApiProperty()
  @Matches(ABSOLUTE_OR_EMPTY, { message: 'url must be an http(s) URL or empty' })
  url!: string;

  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  label!: TranslatedDto;
}

export class FooterAppButtonDto {
  @ApiProperty({ enum: FOOTER_APP_STYLES })
  @IsIn(FOOTER_APP_STYLES as unknown as string[])
  style!: string;

  @ApiProperty({ nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  mediaId!: number | null;

  @ApiProperty({ description: 'Empty renders an inert button rather than hiding it' })
  @Matches(ABSOLUTE_OR_EMPTY, { message: 'url must be an http(s) URL or empty' })
  url!: string;

  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  lineOne!: TranslatedDto;

  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  lineTwo!: TranslatedDto;
}

export class TranslatedPairDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  label!: TranslatedDto;

  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  value!: TranslatedDto;
}

export class TranslatedLabelPlainValueDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  label!: TranslatedDto;

  @ApiProperty({ description: 'ASCII — becomes a tel:/mailto: target' })
  @IsString()
  value!: string;
}

export class FooterContactDto {
  @ApiProperty({ type: TranslatedPairDto })
  @ValidateNested()
  @Type(() => TranslatedPairDto)
  address!: TranslatedPairDto;

  @ApiProperty({ type: TranslatedLabelPlainValueDto })
  @ValidateNested()
  @Type(() => TranslatedLabelPlainValueDto)
  phone!: TranslatedLabelPlainValueDto;

  @ApiProperty({ type: TranslatedLabelPlainValueDto })
  @ValidateNested()
  @Type(() => TranslatedLabelPlainValueDto)
  email!: TranslatedLabelPlainValueDto;

  @ApiProperty({ type: TranslatedPairDto })
  @ValidateNested()
  @Type(() => TranslatedPairDto)
  hours!: TranslatedPairDto;
}

export class FooterAppsDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  downloadLabel!: TranslatedDto;

  @ApiProperty({ type: FooterAppButtonDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(FOOTER_MAX_APP_BUTTONS)
  @ValidateNested({ each: true })
  @Type(() => FooterAppButtonDto)
  buttons!: FooterAppButtonDto[];
}

export class FooterPaymentDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  label!: TranslatedDto;

  @ApiProperty({ nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  mediaId!: number | null;
}

export class UpdateFooterDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  brandMark!: TranslatedDto;

  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  description!: TranslatedDto;

  @ApiProperty({ type: FooterContactDto })
  @ValidateNested()
  @Type(() => FooterContactDto)
  contact!: FooterContactDto;

  @ApiProperty({ type: FooterSocialLinkDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(FOOTER_MAX_SOCIAL)
  @ValidateNested({ each: true })
  @Type(() => FooterSocialLinkDto)
  social!: FooterSocialLinkDto[];

  @ApiProperty({ type: FooterAppsDto })
  @ValidateNested()
  @Type(() => FooterAppsDto)
  apps!: FooterAppsDto;

  @ApiProperty({ type: FooterColumnDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(FOOTER_MAX_COLUMNS)
  @ValidateNested({ each: true })
  @Type(() => FooterColumnDto)
  columns!: FooterColumnDto[];

  @ApiProperty({ type: FooterPaymentDto })
  @ValidateNested()
  @Type(() => FooterPaymentDto)
  payment!: FooterPaymentDto;

  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  copyright!: TranslatedDto;
}
```

- [ ] **Step 4: Add the custom-icon consistency rule**

`@IsIn` and `@IsOptional` cannot express "`mediaId` is required when and only when `icon` is `custom`". Add this validator to the same file, above `FooterSocialLinkDto`, and decorate both `FooterSocialLinkDto.mediaId` and `FooterAppButtonDto.mediaId` with `@MediaIdMatchesVariant()`:

```ts
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

// A built-in icon renders an inline SVG and must not carry an image; a
// `custom` one has nothing to render without it. Enforced here rather than
// silently ignored, so a malformed save fails loudly at the boundary.
function MediaIdMatchesVariant(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'mediaIdMatchesVariant',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const parent = args.object as { icon?: string; style?: string };
          const variant = parent.icon ?? parent.style;
          return variant === 'custom'
            ? typeof value === 'number'
            : value === null || value === undefined;
        },
        defaultMessage() {
          return 'mediaId is required for a custom icon and must be null otherwise';
        },
      },
    });
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @amader/backend exec jest src/modules/footer --verbose`
Expected: PASS — 6 service tests plus 7 DTO tests.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/footer/dto/
git commit -m "feat(footer): update DTO with nested validation and icon/media consistency rule"
```

---

### Task 5: Controllers and module wiring

**Files:**
- Create: `apps/backend/src/modules/footer/footer.controller.ts`
- Create: `apps/backend/src/modules/footer/admin-footer.controller.ts`
- Create: `apps/backend/src/modules/footer/footer.module.ts`
- Modify: `apps/backend/src/app.module.ts` (import near line 59, registration near line 163)

**Interfaces:**
- Consumes: `FooterService` (Task 3), `UpdateFooterDto` (Task 4).
- Produces: `GET /api/v1/footer?locale=EN`, `GET /api/v1/admin/footer`, `PUT /api/v1/admin/footer`. Also `PublicFooterDto` and its nested classes — the names Tasks 7 and 8 import from the generated `schema.d.ts`.

**Why the extra DTO classes.** `openapi-typescript` generates `components["schemas"][…]` entries only from classes Swagger can see. `PublicFooter` (Task 3) is a bare TypeScript interface, so it never reaches the OpenAPI document — the storefront would have no generated type to import and would have to hand-maintain a duplicate that silently drifts. Step 1 below adds the decorated mirror.

- [ ] **Step 1: Write the response DTO classes**

Create `apps/backend/src/modules/footer/footer.mapper.ts`. These exist purely so Swagger emits schema components; the runtime shape is whatever `FooterService.getPublic` returns.

```ts
import { ApiProperty } from '@nestjs/swagger';

export class PublicFooterLinkDto {
  @ApiProperty() label!: string;
  @ApiProperty() href!: string;
  @ApiProperty() newTab!: boolean;
}

export class PublicFooterColumnDto {
  @ApiProperty() heading!: string;
  @ApiProperty({ type: PublicFooterLinkDto, isArray: true })
  links!: PublicFooterLinkDto[];
}

export class PublicFooterSocialDto {
  @ApiProperty() icon!: string;
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
  @ApiProperty() url!: string;
  @ApiProperty() label!: string;
}

export class PublicFooterAppButtonDto {
  @ApiProperty() style!: string;
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
  @ApiProperty() url!: string;
  @ApiProperty() lineOne!: string;
  @ApiProperty() lineTwo!: string;
}

export class PublicFooterAppsDto {
  @ApiProperty() downloadLabel!: string;
  @ApiProperty({ type: PublicFooterAppButtonDto, isArray: true })
  buttons!: PublicFooterAppButtonDto[];
}

export class PublicFooterContactRowDto {
  @ApiProperty() label!: string;
  @ApiProperty() value!: string;
}

export class PublicFooterContactDto {
  @ApiProperty({ type: PublicFooterContactRowDto }) address!: PublicFooterContactRowDto;
  @ApiProperty({ type: PublicFooterContactRowDto }) phone!: PublicFooterContactRowDto;
  @ApiProperty({ type: PublicFooterContactRowDto }) email!: PublicFooterContactRowDto;
  @ApiProperty({ type: PublicFooterContactRowDto }) hours!: PublicFooterContactRowDto;
}

export class PublicFooterPaymentDto {
  @ApiProperty() label!: string;
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
}

export class PublicFooterDto {
  @ApiProperty() brandMark!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: PublicFooterContactDto }) contact!: PublicFooterContactDto;
  @ApiProperty({ type: PublicFooterSocialDto, isArray: true }) social!: PublicFooterSocialDto[];
  @ApiProperty({ type: PublicFooterAppsDto }) apps!: PublicFooterAppsDto;
  @ApiProperty({ type: PublicFooterColumnDto, isArray: true }) columns!: PublicFooterColumnDto[];
  @ApiProperty({ type: PublicFooterPaymentDto }) payment!: PublicFooterPaymentDto;
  @ApiProperty() copyright!: string;
}
```

- [ ] **Step 2: Write the public controller**

Create `apps/backend/src/modules/footer/footer.controller.ts`:

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { FooterService, PublicFooter } from './footer.service';
import { PublicFooterDto } from './footer.mapper';

// Public, read-only, fetched server-side on every single page load (the
// footer is in [locale]/layout.tsx) — same throttle exemption and for the
// same reason as SiteInfoController and AnnouncementsController.
@SkipThrottle()
@ApiTags('footer')
@Controller('footer')
export class FooterController {
  constructor(private readonly footer: FooterService) {}

  @Get()
  @ApiOkResponse({ type: PublicFooterDto })
  get(@Query() { locale }: LocaleQueryDto): Promise<PublicFooter> {
    return this.footer.getPublic(locale ?? 'EN');
  }
}
```

- [ ] **Step 3: Write the admin controller**

Create `apps/backend/src/modules/footer/admin-footer.controller.ts`:

```ts
import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { FooterService } from './footer.service';
import { FooterConfig } from './footer.types';
import { UpdateFooterDto } from './dto/update-footer.dto';

@ApiTags('admin/footer')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/footer')
export class AdminFooterController {
  constructor(private readonly footer: FooterService) {}

  // Typed as UpdateFooterDto rather than the FooterConfig interface: read and
  // write carry the identical shape, and declaring the class here is what
  // puts it in the OpenAPI document for the admin app's typegen to pick up.
  @Get()
  @RequirePermission('footer.view')
  @ApiOkResponse({ type: UpdateFooterDto })
  get(): Promise<FooterConfig> {
    return this.footer.getAdmin();
  }

  // PUT, not PATCH: the admin form always submits the whole document, and a
  // partial merge of a nested array is exactly the ambiguity we avoided by
  // storing this as one blob.
  @Put()
  @RequirePermission('footer.update')
  @ApiOkResponse({ type: UpdateFooterDto })
  update(@Body() dto: UpdateFooterDto): Promise<FooterConfig> {
    return this.footer.update(dto as unknown as FooterConfig);
  }
}
```

- [ ] **Step 4: Write the module**

Create `apps/backend/src/modules/footer/footer.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AdminFooterController } from './admin-footer.controller';
import { FooterController } from './footer.controller';
import { FooterService } from './footer.service';

@Module({
  controllers: [FooterController, AdminFooterController],
  providers: [FooterService],
})
export class FooterModule {}
```

If `RevalidationService` is not globally provided, add its module to this module's `imports` — check how `HomepageSectionsModule` obtains it and copy that.

- [ ] **Step 5: Register in app.module.ts**

Add the import next to the other content-module imports (near line 59):

```ts
import { FooterModule } from './modules/footer/footer.module';
```

And add `FooterModule,` to the `imports` array, directly after `HomepageSectionsModule,`.

- [ ] **Step 6: Verify the endpoints respond**

The backend dev server hot-reloads. Wait for `Nest application successfully started` in `backend-dev.log`, then run:

```bash
curl -s "http://localhost:3000/api/v1/footer?locale=EN" | head -c 400
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/v1/admin/footer"
```

Expected: the first prints the defaults document flattened to English, with `"brandMark"` present and no `"en"`/`"bn"` keys anywhere. The second prints `401` — the admin route is guarded.

- [ ] **Step 7: Verify a BN request differs**

```bash
curl -s "http://localhost:3000/api/v1/footer?locale=BN" | head -c 200
```

Expected: Bengali contact labels, confirming the flatten honours the locale.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/footer/ apps/backend/src/app.module.ts
git commit -m "feat(footer): public and admin footer endpoints"
```

---

### Task 6: Rework the shared Footer component

**Files:**
- Modify: `packages/ui/src/components/Footer.tsx`
- Modify: `packages/ui/src/components/Footer.stories.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks — this package does not depend on the backend.
- Produces: the new `FooterProps` shape consumed by `SiteFooter` in Task 7: `social: FooterSocialLink[]`, `appButtons: FooterAppButton[]`, `appDownloadLabel: string`, and the existing scalar props unchanged.

This is a breaking change to `FooterProps`. `SiteFooter.tsx` and `Footer.stories.tsx` are the only consumers — both are updated, `SiteFooter` in Task 7.

- [ ] **Step 1: Replace the social and app props**

In `Footer.tsx`, delete `facebookHref`, `instagramHref`, `youtubeHref`, `googlePlayHref` and `appStoreHref` from `FooterProps`, and add:

```ts
export interface FooterSocialLink {
  /** A key in SOCIAL_ICONS, or 'custom' to render `imageUrl` instead. */
  icon: string;
  imageUrl?: string | null;
  url: string;
  label: string;
}

export interface FooterAppButton {
  /** 'googlePlay' | 'appStore' | 'custom'. */
  style: string;
  imageUrl?: string | null;
  /** Empty renders an inert button — see the comment at its render site. */
  url: string;
  lineOne: string;
  lineTwo: string;
}
```

and on `FooterProps`:

```ts
  social: FooterSocialLink[];
  appButtons: FooterAppButton[];
```

- [ ] **Step 2: Build the icon map**

The existing `facebookIcon`, `instagramIcon`, `youtubeIcon`, `googlePlayIcon` and `appStoreIcon` consts stay. Add six more inline SVGs in the same style — `tiktok`, `whatsapp`, `linkedin`, `x`, `telegram`, `pinterest` — each `viewBox="0 0 24 24"` at `width={16} height={16}` with `fill="currentColor"`, so they invert on hover exactly like the existing three. Then:

```ts
const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  facebook: facebookIcon,
  instagram: instagramIcon,
  youtube: youtubeIcon,
  tiktok: tiktokIcon,
  whatsapp: whatsappIcon,
  linkedin: linkedinIcon,
  x: xIcon,
  telegram: telegramIcon,
  pinterest: pinterestIcon,
};

const APP_ICONS: Record<string, React.ReactNode> = {
  googlePlay: googlePlayIcon,
  appStore: appStoreIcon,
};
```

- [ ] **Step 3: Render the social row from the array**

Replace the three hardcoded social anchors with a map. Note `flex-wrap`, which the current `flex gap-2` lacks — three icons fit a 360px viewport, ten do not:

```tsx
<div className="mt-5 flex flex-wrap gap-2">
  {social.map((item, index) => (
    <a
      key={index}
      href={item.url}
      aria-label={item.label}
      className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-header-green text-header-green transition-colors hover:bg-header-green hover:text-white"
    >
      {item.icon === "custom" && item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="h-4 w-4 object-contain" />
      ) : (
        SOCIAL_ICONS[item.icon] ?? null
      )}
    </a>
  ))}
</div>
```

Keys are the index, not `item.label` — admin-editable content can legitimately repeat a label.

- [ ] **Step 4: Render app buttons, keeping URL-less ones visible**

```tsx
{appButtons.length > 0 && (
  <>
    <div className="mt-6 font-header text-base font-medium text-header-ink">{appDownloadLabel}</div>
    <div className="mt-3 flex flex-wrap gap-2.5">
      {appButtons.map((button, index) => {
        const content = (
          <>
            {button.style === "custom" && button.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={button.imageUrl} alt="" className="h-5 w-5 object-contain" />
            ) : (
              APP_ICONS[button.style] ?? null
            )}
            <span className="leading-[1.15]">
              <span className="block text-[0.55rem] font-medium opacity-85">{button.lineOne}</span>
              <span className="block font-header text-[0.82rem] font-bold">{button.lineTwo}</span>
            </span>
          </>
        );
        const className = "inline-flex h-11 items-center gap-[9px] rounded-lg bg-[#111] px-3.5 text-white";
        // A button with no URL yet still renders — the owner explicitly asked
        // that these stay visible. It is a span, not href="#": that anchor
        // scrolls the visitor to the top of the page, and it would take
        // keyboard focus for a control that does nothing.
        return button.url ? (
          <a key={index} href={button.url} aria-label={`${button.lineOne} ${button.lineTwo}`} className={className}>
            {content}
          </a>
        ) : (
          <span key={index} className={className}>
            {content}
          </span>
        );
      })}
    </div>
  </>
)}
```

- [ ] **Step 5: Make the grid handle one to four columns**

Replace the hardcoded `lg:grid-cols-[1.6fr_1fr_1fr_1fr]` in the wrapper div. Whole class strings, so Tailwind's JIT still sees them:

```tsx
const GRID_COLS: Record<number, string> = {
  1: "lg:grid-cols-[1.6fr_1fr]",
  2: "lg:grid-cols-[1.6fr_1fr_1fr]",
  3: "lg:grid-cols-[1.6fr_1fr_1fr_1fr]",
  4: "lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]",
};
```

and at the render site:

```tsx
<div className={`grid grid-cols-2 gap-x-6 gap-y-10 py-4 pb-10 md:py-8 lg:gap-x-8 ${GRID_COLS[Math.min(Math.max(columns.length, 1), 4)]}`}>
```

- [ ] **Step 6: Honour `newTab` on column links**

`FooterLinkColumn.links` currently types as `{ label: string; href: string }`. The
admin can now mark a link "open in a new tab" and the backend validates and stores that
flag, so the component has to act on it or the checkbox is a lie. Add `newTab?: boolean`
to the link type and, at the render site inside `column.links.map`, pass the target
through:

```tsx
<Link
  href={link.href}
  {...(link.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
  className="font-header text-sm leading-none text-header-muted transition-colors hover:text-header-green md:leading-normal"
>
  {link.label}
</Link>
```

`rel="noopener noreferrer"` is not optional on a `target="_blank"` link pointing at an
admin-supplied URL — without it the opened page gets a handle on this one via
`window.opener`.

- [ ] **Step 7: Fix the column and link keys**

`columns.map((column) => …)` keys on `column.heading` and its inner map keys on `link.label`. Both become the index, for the same reason as the social row.

- [ ] **Step 8: Update the story**

`Footer.stories.tsx` passes the old props. Rewrite its args to the new shape, and add a second story named `FourColumns` that passes four columns, six social icons and two app buttons — one of them with `url: ""` — so the wrap behaviour and the inert button are both visible in Storybook.

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter @amader/ui exec tsc --noEmit`
Expected: exits 0. `SiteFooter.tsx` will still be broken at this point — it is fixed in Task 7, and it lives in a different package, so this check passes.

- [ ] **Step 10: Commit**

```bash
git add packages/ui/src/components/Footer.tsx packages/ui/src/components/Footer.stories.tsx
git commit -m "feat(ui): footer social/app icon lists, 1-4 column grid, inert URL-less app buttons"
```

---

### Task 7: Wire the storefront

**Files:**
- Modify: `apps/web/src/components/SiteFooter.tsx` (full rewrite — it drops to a mapper)
- Modify: `apps/web/src/app/[locale]/layout.tsx` (fetch near the existing `siteInfo` / `navMenu` fetches, and the `<SiteFooter …>` call at line 175)
- Modify: `apps/web/src/lib/api/schema.d.ts` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: `GET /api/v1/footer` and the generated `PublicFooterDto` schema component (Task 5); the new `FooterProps` (Task 6).
- Produces: nothing downstream.

- [ ] **Step 1: Regenerate the API types**

The backend must be running. Run:

```bash
pnpm --filter @amader/web typegen
```

Expected: `src/lib/api/schema.d.ts` now contains a `/api/v1/footer` path. Verify:

```bash
grep -c "api/v1/footer" apps/web/src/lib/api/schema.d.ts
```

Expected: at least 1.

- [ ] **Step 2: Fetch the footer in the layout**

In `apps/web/src/app/[locale]/layout.tsx`, alongside the existing `safeGet` calls for site info and nav menu, add:

```ts
const { data: footer } = await safeGet("/api/v1/footer", {
  params: { query: { locale: apiLocale } },
});
```

Use whatever variable already holds the API locale in that file — the nav-menu fetch above it uses the same value. `safeGet` swallows a backend outage and returns `{ data: undefined }`, which Step 3 handles.

- [ ] **Step 3: Rewrite SiteFooter as a mapper**

Replace the whole body of `apps/web/src/components/SiteFooter.tsx`:

```tsx
import { Footer } from "@amader/ui";
import { Link } from "@/i18n/navigation";
import type { components } from "@/lib/api/schema";

type PublicFooter = components["schemas"]["PublicFooterDto"];

export interface SiteFooterProps {
  /** Server-fetched in [locale]/layout.tsx, same as the logo and nav menu —
   * the footer is on every page, so a client-side fetch would mean a visible
   * pop-in on every navigation. */
  footer?: PublicFooter;
  initialLogoUrl?: string | null;
}

// Contact rows are label + value so the phone and email can be real links;
// address and hours have no link target and render as plain text.
function contactLine(label: string, value: string): string {
  return [label, value].filter(Boolean).join(" ");
}

export function SiteFooter({ footer, initialLogoUrl }: SiteFooterProps = {}) {
  // The backend merges over its own defaults, so `footer` is only ever
  // missing when the backend itself was unreachable at render time. Rendering
  // nothing beats rendering a half-built footer.
  if (!footer) return null;

  return (
    <Footer
      brandMark={footer.brandMark}
      logoUrl={initialLogoUrl ?? undefined}
      description={footer.description}
      address={contactLine(footer.contact.address.label, footer.contact.address.value)}
      phone={contactLine(footer.contact.phone.label, footer.contact.phone.value)}
      phoneHref={footer.contact.phone.value ? `tel:${footer.contact.phone.value}` : undefined}
      email={footer.contact.email.value ? contactLine(footer.contact.email.label, footer.contact.email.value) : undefined}
      emailHref={footer.contact.email.value ? `mailto:${footer.contact.email.value}` : undefined}
      workingHours={contactLine(footer.contact.hours.label, footer.contact.hours.value)}
      social={footer.social}
      appButtons={footer.apps.buttons}
      appDownloadLabel={footer.apps.downloadLabel}
      columns={footer.columns}
      copyrightLabel={footer.copyright.replace("{year}", String(new Date().getFullYear()))}
      payWithLabel={footer.payment.label}
      paymentImageUrl={footer.payment.imageUrl ?? undefined}
      linkComponent={Link}
    />
  );
}
```

Note `"use client"` is gone — this component no longer has state or hooks, so it becomes a server component and stops shipping its own JS.

- [ ] **Step 4: Add the phone and email link props to the UI component**

Step 3 passes `phoneHref` and `emailHref`, which do not exist yet. In `packages/ui/src/components/Footer.tsx`, add both as optional string props, and wrap the phone and email `<li>` contents in an anchor when the corresponding href is present:

```tsx
<li className="flex items-center gap-2.5 font-header text-sm text-header-text">
  {phoneIcon}
  {phoneHref ? (
    <a href={phoneHref} className="transition-colors hover:text-header-green">
      {phone}
    </a>
  ) : (
    phone
  )}
</li>
```

Same shape for email with `mailIcon` and `emailHref`. This is why the contact split was worth doing: the phone number becomes tappable on mobile.

- [ ] **Step 5: Update the layout's call site**

Line 175 of `layout.tsx` currently reads:

```tsx
<SiteFooter initialLogoUrl={siteInfo?.logoUrl} initialNavMenu={navMenu} />
```

Replace with:

```tsx
<SiteFooter footer={footer} initialLogoUrl={siteInfo?.logoUrl} />
```

`initialNavMenu` is dropped — the footer's Shop-By column came from the nav menu and is now one of the admin-managed columns. Confirm `navMenu` is still used by `SiteHeader` on the line above before deleting anything else.

- [ ] **Step 6: Typecheck both packages**

Run:

```bash
pnpm --filter @amader/ui exec tsc --noEmit
pnpm --filter @amader/web exec tsc --noEmit -p tsconfig.json
```

Expected: both exit 0.

- [ ] **Step 7: Verify in the browser**

Open `http://localhost:3001/en` and `http://localhost:3001/bn`. The footer must look identical to before this change, except: the Google Play and App Store buttons are no longer clickable (their URLs are empty by default), and the phone number is now a `tel:` link.

Then narrow the window to 360px and confirm no horizontal scrollbar appears on the page body.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/SiteFooter.tsx "apps/web/src/app/[locale]/layout.tsx" apps/web/src/lib/api/schema.d.ts packages/ui/src/components/Footer.tsx
git commit -m "feat(web): render the footer from admin config instead of hardcoded values"
```

---

### Task 8: Admin footer editor

**Files:**
- Create: `apps/admin/src/hooks/useFooter.ts`
- Create: `apps/admin/src/app/(shell)/footer/page.tsx`
- Modify: `apps/admin/src/lib/nav-config.tsx` (Content group, next to the `menu-items` entry at line 118)
- Modify: `apps/admin/src/lib/api/schema.d.ts` (regenerated)

**Interfaces:**
- Consumes: `GET`/`PUT /api/v1/admin/footer` (Task 5); `FOOTER_SOCIAL_ICONS`, `FOOTER_APP_STYLES` and the caps from `@amader/shared` (Task 1); `MediaPicker` from `@/components/MediaPicker`; `Button`, `Card`, `PageHeader` from `@amader/admin-ui`.
- Produces: nothing downstream.

- [ ] **Step 1: Regenerate the admin API types**

```bash
pnpm --filter @amader/admin typegen
grep -c "admin/footer" apps/admin/src/lib/api/schema.d.ts
```

Expected: at least 1.

- [ ] **Step 2: Write the hook**

Create `apps/admin/src/hooks/useFooter.ts`, following `useAnnouncements.ts` exactly:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

// The admin GET and PUT carry the same shape, and UpdateFooterDto is the
// class the controller declares — so it is the name that exists in the
// generated schema. FooterConfig is a bare interface and never reaches it.
export type FooterConfig = components["schemas"]["UpdateFooterDto"];

const KEY = ["admin-footer"];

export function useFooter() {
  return useQuery({ queryKey: KEY, queryFn: () => proxyFetch<FooterConfig>("/admin/footer") });
}

export function useUpdateFooter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FooterConfig) =>
      proxyFetch<FooterConfig>("/admin/footer", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
```

Confirm the name before moving on: `grep -c "UpdateFooterDto" apps/admin/src/lib/api/schema.d.ts` must be at least 1.

- [ ] **Step 3: Build the page shell and load state**

Create `apps/admin/src/app/(shell)/footer/page.tsx` as a `"use client"` component. It holds the entire document in one `useState<FooterConfig>`, seeded from `useFooter()` in a `useEffect`, and saves with a single button.

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button, Card, PageHeader } from "@amader/admin-ui";
import { FOOTER_MAX_COLUMNS, FOOTER_MAX_SOCIAL, FOOTER_MAX_APP_BUTTONS } from "@amader/shared";
import { MediaPicker } from "@/components/MediaPicker";
import { useFooter, useUpdateFooter, type FooterConfig } from "@/hooks/useFooter";

type Translated = { en: string; bn: string };

// Every text input in this page is a BN/EN pair rendered side by side, the
// same layout the homepage-sections form uses.
function TranslatedField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: Translated;
  onChange: (next: Translated) => void;
  multiline?: boolean;
}) {
  const Input = multiline ? "textarea" : "input";
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">{label} (বাংলা)</span>
        <Input
          className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text"
          value={value.bn}
          onChange={(e) => onChange({ ...value, bn: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">{label} (English)</span>
        <Input
          className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text"
          value={value.en}
          onChange={(e) => onChange({ ...value, en: e.target.value })}
        />
      </label>
    </div>
  );
}

export default function FooterPage() {
  const { data, isLoading } = useFooter();
  const update = useUpdateFooter();
  const [draft, setDraft] = useState<FooterConfig | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data && !draft) setDraft(structuredClone(data));
  }, [data, draft]);

  if (isLoading || !draft) return <Card>Loading…</Card>;

  async function handleSave() {
    if (!draft) return;
    await update.mutateAsync(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Footer"
        action={
          <div className="flex items-center gap-3">
            {saved && <span className="text-xs font-semibold text-success">✓ Saved</span>}
            <Button onClick={handleSave} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save Footer"}
            </Button>
          </div>
        }
      />
      {/* Cards added in the following steps */}
    </div>
  );
}
```

Check `PageHeader`'s actual prop names in `packages/admin-ui/src/components/PageHeader.tsx` before using `title`/`action` — match what it exports.

- [ ] **Step 4: Add the Brand, Contact and Copyright cards**

Three `<Card>` blocks inside the returned fragment, each a heading plus `TranslatedField` calls bound into `draft`:

- **Brand & description:** `brandMark`, `description` (multiline).
- **Contact:** for address and hours, a `TranslatedField` for `label` and another for `value`. For phone and email, a `TranslatedField` for `label` plus a single plain `<input>` bound to `contact.phone.value` / `contact.email.value` — those are ASCII, not translated. Label the plain inputs "Phone number (used for the tap-to-call link)" and "Email address".
- **Copyright:** one `TranslatedField`, with helper text below it reading `Use {year} — it is replaced with the current year.`

Each `onChange` writes immutably, e.g.:

```tsx
onChange={(next) => setDraft({ ...draft, brandMark: next })}
```

- [ ] **Step 5: Add the Social links repeater**

A `<Card>` listing `draft.social` as rows. Each row has an icon `<select>` built from `FOOTER_SOCIAL_ICONS`, a URL input, a `TranslatedField` for the label, a `MediaPicker` shown only when `icon === "custom"`, and Remove / Move up / Move down buttons. Below the list, an Add button, disabled at `FOOTER_MAX_SOCIAL`.

When the icon changes away from `custom`, clear `mediaId` to `null` in the same update — the backend rejects a `mediaId` on a built-in icon, and a stale one would make Save fail with a message the admin cannot act on.

`MediaPicker` reports the chosen record through `onSelectMedia`, which carries the id this form stores:

```tsx
<MediaPicker
  label="Custom icon"
  value={undefined}
  onChange={() => {}}
  onSelectMedia={(media) => updateSocial(index, { ...row, mediaId: media.id })}
/>
```

Add helper text under the picker: `Upload a square, transparent, dark-green icon — custom icons do not invert on hover the way the built-in ones do.`

- [ ] **Step 6: Add the App buttons repeater**

Same structure as Step 5 over `draft.apps.buttons`, with the `<select>` built from `FOOTER_APP_STYLES`, a `TranslatedField` each for `lineOne` and `lineTwo`, and the URL input labelled `Store URL (leave empty to show the button without a link)`. Capped at `FOOTER_MAX_APP_BUTTONS`. Above the list, one `TranslatedField` bound to `apps.downloadLabel`.

- [ ] **Step 7: Add the Link columns repeater**

A `<Card>` per column in `draft.columns`, each with a `TranslatedField` for `heading`, then a nested list of links — `TranslatedField` for `label`, a text input for `href`, a checkbox for `newTab`, and Remove / Move up / Move down per link. Add-link button per column; add-column button below all of them, disabled at `FOOTER_MAX_COLUMNS`.

Show the cap in the button text: `Add column (4 max)`. Add helper text on the `href` input: `A path like /about-us, or a full https:// address.`

- [ ] **Step 8: Add the Payment strip card**

A `TranslatedField` for `payment.label` plus a `MediaPicker` wired to `payment.mediaId` through `onSelectMedia`, exactly as in Step 5.

- [ ] **Step 9: Add the nav entry**

In `apps/admin/src/lib/nav-config.tsx`, next to the `menu-items` entry (line 118), add:

```tsx
  { key: "footer", label: "Footer", href: "/footer", icon: footerIcon, permission: "footer.view" },
```

Declare `footerIcon` with the other icon consts at the top of the file, following their exact shape — `const footerIcon = <Icon name="..." />;` — picking an icon name that exists in `packages/admin-ui/src/components/Icon.tsx`. Read that file for the available names rather than guessing.

- [ ] **Step 10: Typecheck**

Run: `pnpm --filter @amader/admin exec tsc --noEmit -p tsconfig.json`
Expected: exits 0.

- [ ] **Step 11: Verify end to end in the browser**

1. Open `http://localhost:3004/footer`. The form loads populated with the current footer.
2. Change the phone number, add a fourth link column, and add one social icon.
3. Save. Confirm the ✓ Saved indicator appears.
4. Reload the page — the changes persisted.
5. Open `http://localhost:3001/en` and confirm the footer shows all three changes, with four columns laid out across one row.
6. Narrow to 360px and confirm no horizontal page scroll.

If the storefront still shows old content, the on-demand revalidate has not landed — hard-reload once. If it is still stale after that, check `backend-dev.log` for a revalidation error rather than assuming the save failed.

- [ ] **Step 12: Commit**

```bash
git add apps/admin/src/hooks/useFooter.ts "apps/admin/src/app/(shell)/footer/page.tsx" apps/admin/src/lib/nav-config.tsx apps/admin/src/lib/api/schema.d.ts
git commit -m "feat(admin): footer editor page"
```

---

### Task 9: Delete the dead footer i18n namespace

**Files:**
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/bn.json`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

Its own task and its own commit, so it reverts independently of the feature. Do this **last** — after Task 7 has removed the only three live readers.

- [ ] **Step 1: Confirm there are no readers left**

```bash
grep -rn 'useTranslations("footer")' apps/web/src
grep -rn '"footer\.' apps/web/src
```

Expected: no output from either. If anything matches, stop and fix that call site first — do not delete keys that are still read.

- [ ] **Step 2: Delete the namespace**

Remove the entire `"footer": { … }` object from both `apps/web/messages/en.json` and `apps/web/messages/bn.json` — 30 keys each.

- [ ] **Step 3: Verify the JSON is still valid**

```bash
node -e "require('./apps/web/messages/en.json'); require('./apps/web/messages/bn.json'); console.log('both parse')"
```

Expected: `both parse`.

- [ ] **Step 4: Verify the storefront still renders**

Reload `http://localhost:3001/en` and `http://localhost:3001/bn`. `next-intl` throws a loud `MISSING_MESSAGE` error if a deleted key was still read, so a clean render is the proof.

- [ ] **Step 5: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/bn.json
git commit -m "chore(web): drop the dead footer i18n namespace"
```

---

## Final verification

- [ ] `pnpm --filter @amader/backend exec jest src/modules/footer` — 13 tests pass.
- [ ] `pnpm --filter @amader/backend exec tsc --noEmit -p tsconfig.json` — exits 0.
- [ ] `pnpm --filter @amader/ui exec tsc --noEmit` — exits 0.
- [ ] `pnpm --filter @amader/web exec tsc --noEmit -p tsconfig.json` — exits 0.
- [ ] `pnpm --filter @amader/admin exec tsc --noEmit -p tsconfig.json` — exits 0.
- [ ] Admin `/footer` saves and the storefront reflects it in both EN and BN.
- [ ] Storefront footer at 360px with 4 columns, 10 social icons and 4 app buttons: no horizontal page scroll.
- [ ] An app button with no URL is visible and not clickable.
- [ ] Append a summary of this feature to `bug-fix-and-feature-edit.md` at the repo parent, per the standing instruction in that file's history.
