import { Injectable } from '@nestjs/common';
import { Locale } from '@amader/db';
import { FOOTER_ABSOLUTE_URL_OR_EMPTY_PATTERN, FOOTER_HREF_PATTERN } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RevalidationService } from '../../common/revalidation/revalidation.service';
import { FOOTER_DEFAULTS } from './footer.defaults';
import { FooterAppButton, FooterColumn, FooterConfig, FooterLink, FooterSocialLink, Translated } from './footer.types';

export const FOOTER_CONFIG_KEY = 'footer_config';

/** A non-null, non-array object — the shape every `Translated` pair and
 * every nested settings object must have to survive the merge below. Guards
 * against a stored value that is a string, a number, an array, or null
 * where an object is expected (e.g. `{"social": "x"}` or
 * `{"columns": {}}`) — real possibilities since `footer_config` has a
 * second write path (the generic admin settings endpoint) that bypasses
 * UpdateFooterDto entirely. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `value` cast to `T` when it is a plain object, else `fallback`. The
 * double cast (`as unknown as T`) is deliberate, not a shortcut: `value` is
 * untyped JSON at runtime, so there is no structural overlap for
 * TypeScript to check the cast against — `isPlainObject` is the actual
 * (runtime) validation; the cast just tells the compiler to trust it, the
 * same way `plainToInstance` does at the DTO boundary. */
function orDefault<T>(value: unknown, fallback: T): T {
  return isPlainObject(value) ? (value as unknown as T) : fallback;
}

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
  /** Null when the admin has not chosen a footer-specific logo — the
   * storefront then falls back to the site logo, as it did before this
   * field existed. */
  logo: { imageUrl: string | null };
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
      logo: {
        imageUrl: config.logo.mediaId ? (urls.get(config.logo.mediaId) ?? null) : null,
      },
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

  /** Merges each field over defaults individually — never an object spread
   * — at every level. A stored document is untyped JSON at runtime —
   * `Partial<FooterConfig>` is a cast, not a guarantee — and it is not even
   * guaranteed to have come from UpdateFooterDto: the generic
   * `PUT /api/v1/admin/settings/:key` endpoint can overwrite the
   * `footer_config` row with arbitrary JSON under a different permission,
   * bypassing every DTO check including the href/url hardening. So this
   * merge re-checks, at the read boundary, everything the DTO would have
   * rejected:
   *
   * - Every object field (`isPlainObject`) falls back to its default unless
   *   it is actually a non-null, non-array object — `{"social": "x"}` or
   *   `contact: { address: null }` both fall back instead of throwing two
   *   levels deep in getPublic() on a layout that renders every page.
   * - Every array field (`Array.isArray`) falls back to its default unless
   *   it is genuinely an array — `{"columns": {}}` falls back instead of
   *   `.map`-ing over an object and throwing.
   * - Every link/social/app-button entry has its `href`/`url` re-checked
   *   against the same regex the DTO enforces (`FOOTER_HREF_PATTERN` /
   *   `FOOTER_ABSOLUTE_URL_OR_EMPTY_PATTERN`, both from `@amader/shared` so
   *   the DTO and this merge cannot drift apart) and is dropped — not
   *   sanitised in place — if it fails, so `columns[0].links[0].href =
   *   "//evil.example/pay"` written through the generic settings endpoint
   *   never reaches the public storefront.
   *
   * Arrays still replace wholesale rather than merging element-wise — an
   * admin who deletes a column means it, and index-merging two
   * different-length arrays produces nonsense — but only when actually
   * present and array-shaped; otherwise the whole array falls back.
   *
   * structuredClone at the end so the returned draft never aliases
   * FOOTER_DEFAULTS: getAdmin() hands this out as an editable draft, and an
   * in-place mutation on a shared module-level object would corrupt the
   * defaults for the rest of the process's lifetime. */
  private merge(stored: Partial<FooterConfig> | undefined): FooterConfig {
    const s: Record<string, unknown> = isPlainObject(stored) ? stored : {};
    const contact: Record<string, unknown> = isPlainObject(s.contact) ? s.contact : {};
    const apps: Record<string, unknown> = isPlainObject(s.apps) ? s.apps : {};
    const payment: Record<string, unknown> = isPlainObject(s.payment) ? s.payment : {};
    const logo: Record<string, unknown> = isPlainObject(s.logo) ? s.logo : {};

    const merged: FooterConfig = {
      brandMark: orDefault(s.brandMark, FOOTER_DEFAULTS.brandMark),
      description: orDefault(s.description, FOOTER_DEFAULTS.description),
      contact: {
        address: orDefault(contact.address, FOOTER_DEFAULTS.contact.address),
        phone: orDefault(contact.phone, FOOTER_DEFAULTS.contact.phone),
        email: orDefault(contact.email, FOOTER_DEFAULTS.contact.email),
        hours: orDefault(contact.hours, FOOTER_DEFAULTS.contact.hours),
      },
      social: this.sanitizeSocial(s.social),
      apps: {
        downloadLabel: orDefault(apps.downloadLabel, FOOTER_DEFAULTS.apps.downloadLabel),
        buttons: this.sanitizeAppButtons(apps.buttons),
      },
      columns: this.sanitizeColumns(s.columns),
      payment: {
        label: orDefault(payment.label, FOOTER_DEFAULTS.payment.label),
        mediaId: typeof payment.mediaId === 'number' ? payment.mediaId : FOOTER_DEFAULTS.payment.mediaId,
      },
      copyright: orDefault(s.copyright, FOOTER_DEFAULTS.copyright),
      logo: {
        mediaId: typeof logo.mediaId === 'number' ? logo.mediaId : FOOTER_DEFAULTS.logo.mediaId,
      },
    };
    return structuredClone(merged);
  }

  /** Drops entries whose `url` fails the DTO's own rule instead of keeping
   * a malformed entry around — an offsite/malformed url has no safe
   * sanitised form to fall back to, unlike a whole missing array. */
  private sanitizeSocial(value: unknown): FooterSocialLink[] {
    if (!Array.isArray(value)) return FOOTER_DEFAULTS.social;
    return value.filter(
      (item): item is FooterSocialLink =>
        isPlainObject(item) &&
        typeof item.url === 'string' &&
        FOOTER_ABSOLUTE_URL_OR_EMPTY_PATTERN.test(item.url),
    ) as FooterSocialLink[];
  }

  private sanitizeAppButtons(value: unknown): FooterAppButton[] {
    if (!Array.isArray(value)) return FOOTER_DEFAULTS.apps.buttons;
    return value.filter(
      (item): item is FooterAppButton =>
        isPlainObject(item) &&
        typeof item.url === 'string' &&
        FOOTER_ABSOLUTE_URL_OR_EMPTY_PATTERN.test(item.url),
    ) as FooterAppButton[];
  }

  /** Columns are admin-authored, not a fixed shape from FOOTER_DEFAULTS, so
   * a malformed column falls back to an empty heading/links rather than to
   * a same-index default that may not correspond to anything. */
  private sanitizeColumns(value: unknown): FooterColumn[] {
    if (!Array.isArray(value)) return FOOTER_DEFAULTS.columns;
    return value.filter(isPlainObject).map((item) => ({
      heading: orDefault<Translated>(item.heading, { en: '', bn: '' }),
      links: this.sanitizeLinks(item.links),
    }));
  }

  private sanitizeLinks(value: unknown): FooterLink[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is FooterLink =>
        isPlainObject(item) && typeof item.href === 'string' && FOOTER_HREF_PATTERN.test(item.href),
    ) as FooterLink[];
  }

  /** One findMany for every custom icon plus the payment strip, rather than
   * a findUnique per entry — with ten social icons that would be eleven
   * round trips on a component that renders on every page. */
  private async resolveMedia(config: FooterConfig): Promise<Map<number, string>> {
    const ids = [
      ...config.social.map((s) => s.mediaId),
      ...config.apps.buttons.map((b) => b.mediaId),
      config.payment.mediaId,
      config.logo.mediaId,
    ].filter((id): id is number => typeof id === 'number');

    if (ids.length === 0) return new Map();

    const media = await this.prisma.client.media.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, url: true },
    });
    return new Map(media.map((m) => [m.id, m.url]));
  }
}
