import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RevalidationService } from '../../common/revalidation/revalidation.service';
import { NetProfitSettingsService } from '../net-profit/settings/net-profit-settings.service';
import { SettingDto, SiteInfoDto, toSettingDto } from './settings.mapper';

// Encrypted secrets live in this same table under `credential.*` (see
// common/credentials/credentials.service.ts — AES-256-GCM, key from
// CREDENTIALS_ENCRYPTION_KEY). They are deliberately NOT reachable through
// this generic key/value API, for two separate reasons:
//
//  1. Reading. `list()` returned all 83 rows to anyone holding
//     `setting.view`, 14 of them credential ciphertext. It is not plaintext,
//     but handing out ciphertext to a low-privilege settings role is free
//     material for an offline attack and has no upside — every credential
//     already has its own screen that reports only whether it is set.
//
//  2. Writing, which was the sharper bug. `PUT /admin/settings/:key` writes
//     the value RAW. Point it at a credential key and the stored value is no
//     longer valid ciphertext, so CredentialsService.readCredential's decrypt
//     throws and it returns null — while hasCredential() still returns true
//     because the row exists. The UI would keep reporting the integration as
//     configured while it silently had no credential at all.
//
// Both are closed here rather than in the controller so any future caller of
// SettingsService inherits the same rule.
const CREDENTIAL_KEY_PREFIX = 'credential.';

function isCredentialKey(key: string): boolean {
  return key.startsWith(CREDENTIAL_KEY_PREFIX);
}

const SITE_LOGO_MEDIA_ID_KEY = 'site_logo_media_id';
// Value shape: { paddingPx: number, marginPx: number } — kept as its own key
// (not folded into SITE_LOGO_MEDIA_ID_KEY's plain-number value) so "which
// image" and "how it's styled" stay independently editable/upsertable via
// the same generic PUT /admin/settings/:key every other setting uses.
const SITE_LOGO_STYLE_KEY = 'site_logo_style';
const SITE_NAME_KEY = 'site_name';
const DEFAULT_SITE_NAME = 'আমাদের';
const PRODUCTS_PAGE_BANNER_MEDIA_ID_KEY = 'products_page_banner_media_id';
// Optional phone-shaped crop. The desktop banner is 16:5, which on a 390px
// screen is about 105px tall — a sliver that shows almost nothing of the
// artwork. Falls back to the desktop image when unset, so nothing changes for
// anyone who does not set it.
const PRODUCTS_PAGE_BANNER_MOBILE_MEDIA_ID_KEY = 'products_page_banner_mobile_media_id';
const SITE_FAVICON_MEDIA_ID_KEY = 'site_favicon_media_id';
export const ANNOUNCEMENT_BAR_SPEED_KEY = 'announcement_bar_speed';
// Site-wide SEO/Open Graph fallback — shown for the homepage and any other
// page with no per-page SeoMeta override of its own (see the `seo` module
// for that per-entity system; this is the site-level default it doesn't
// cover). Same media-id-key pattern as the favicon/logo above.
const SITE_SEO_TITLE_KEY = 'site_seo_title';
const SITE_SEO_DESCRIPTION_KEY = 'site_seo_description';
const SITE_SEO_IMAGE_MEDIA_ID_KEY = 'site_seo_image_media_id';

// Value shape: { style: 'ONE' | 'TWO' } — an object (not a bare string) so it
// fits the same Prisma.InputJsonValue-typed upsert() every other setting
// already uses, and so the admin's generic key/value editor shows something
// sensible if someone opens this key there instead of the dedicated control.
export const PRODUCT_CARD_STYLE_KEY = 'product_card_style';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly netProfitSettings: NetProfitSettingsService,
    private readonly revalidation: RevalidationService,
  ) {}

  async list(): Promise<SettingDto[]> {
    const settings = await this.prisma.client.setting.findMany({
      where: { NOT: { key: { startsWith: CREDENTIAL_KEY_PREFIX } } },
      orderBy: { key: 'asc' },
    });
    return settings.map(toSettingDto);
  }

  async get(key: string): Promise<SettingDto> {
    // Same answer as a key that does not exist — deliberately does not
    // confirm which credentials are configured.
    if (isCredentialKey(key)) throw new NotFoundException(`Setting "${key}" not found`);
    const setting = await this.prisma.client.setting.findUnique({
      where: { key },
    });
    if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
    return toSettingDto(setting);
  }

  async upsert(key: string, value: unknown): Promise<SettingDto> {
    if (isCredentialKey(key)) {
      throw new BadRequestException(
        'Credentials cannot be written through the generic settings API — a raw value here would replace the encrypted one and silently break the integration. Use the dedicated settings screen for that provider.',
      );
    }
    const setting = await this.prisma.client.setting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
    // Fire-and-forget, same as every other RevalidationService caller — a
    // settings save must never wait on (or fail because of) the storefront
    // being briefly unreachable. `type: 'layout'` because the settings this
    // generic upsert most often changes (logo, favicon, site name, product
    // card style) are all read once in [locale]/layout.tsx and rendered on
    // every single page, not one specific route — closes the exact gap
    // apps/web's api/revalidate/route.ts already flagged ("nothing calls
    // this yet"), which is why an admin-saved favicon kept showing the old
    // one until the page's own 5-60min timed revalidate window rolled over.
    void this.revalidation.revalidate(['/[locale]'], 'layout');
    // manifest.ts (site name/icon for bookmarks, PWA install) reads this
    // same settings data but lives at the app root, outside [locale] — the
    // layout-type revalidate above doesn't reach it, so it needs its own
    // literal-path (default page-type) revalidate call.
    void this.revalidation.revalidate(['/manifest.webmanifest']);
    return toSettingDto(setting);
  }

  // Public: resolves the logo & banner Media rows so the frontend gets real URLs,
  // not raw mediaIds it would have to look up separately.
  async getSiteInfo(): Promise<SiteInfoDto> {
    const rows = await this.prisma.client.setting.findMany({
      where: {
        key: {
          in: [
            SITE_LOGO_MEDIA_ID_KEY,
            SITE_LOGO_STYLE_KEY,
            SITE_NAME_KEY,
            PRODUCT_CARD_STYLE_KEY,
            PRODUCTS_PAGE_BANNER_MEDIA_ID_KEY,
            PRODUCTS_PAGE_BANNER_MOBILE_MEDIA_ID_KEY,
            SITE_FAVICON_MEDIA_ID_KEY,
            ANNOUNCEMENT_BAR_SPEED_KEY,
            SITE_SEO_TITLE_KEY,
            SITE_SEO_DESCRIPTION_KEY,
            SITE_SEO_IMAGE_MEDIA_ID_KEY,
          ],
        },
      },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));

    const logoMediaId = byKey.get(SITE_LOGO_MEDIA_ID_KEY);
    let logoUrl: string | null = null;
    if (typeof logoMediaId === 'number') {
      const media = await this.prisma.client.media.findUnique({
        where: { id: logoMediaId },
      });
      logoUrl = media?.url ?? null;
    }

    const bannerMediaId = byKey.get(PRODUCTS_PAGE_BANNER_MEDIA_ID_KEY);
    let productsPageBannerUrl: string | null = null;
    if (typeof bannerMediaId === 'number') {
      const media = await this.prisma.client.media.findUnique({
        where: { id: bannerMediaId },
      });
      productsPageBannerUrl = media?.url ?? null;
    }

    const bannerMobileMediaId = byKey.get(PRODUCTS_PAGE_BANNER_MOBILE_MEDIA_ID_KEY);
    let productsPageBannerMobileUrl: string | null = null;
    if (typeof bannerMobileMediaId === 'number') {
      const media = await this.prisma.client.media.findUnique({
        where: { id: bannerMobileMediaId },
      });
      productsPageBannerMobileUrl = media?.url ?? null;
    }

    const faviconMediaId = byKey.get(SITE_FAVICON_MEDIA_ID_KEY);
    let faviconUrl: string | null = null;
    if (typeof faviconMediaId === 'number') {
      const media = await this.prisma.client.media.findUnique({
        where: { id: faviconMediaId },
      });
      faviconUrl = media?.url ?? null;
    }

    const seoImageMediaId = byKey.get(SITE_SEO_IMAGE_MEDIA_ID_KEY);
    let seoImageUrl: string | null = null;
    if (typeof seoImageMediaId === 'number') {
      const media = await this.prisma.client.media.findUnique({
        where: { id: seoImageMediaId },
      });
      seoImageUrl = media?.url ?? null;
    }
    const seoTitleVal = byKey.get(SITE_SEO_TITLE_KEY);
    const seoTitle = typeof seoTitleVal === 'string' && seoTitleVal.trim() ? seoTitleVal : null;
    const seoDescriptionVal = byKey.get(SITE_SEO_DESCRIPTION_KEY);
    const seoDescription =
      typeof seoDescriptionVal === 'string' && seoDescriptionVal.trim() ? seoDescriptionVal : null;

    const speedVal = byKey.get(ANNOUNCEMENT_BAR_SPEED_KEY);
    let announcementSpeedSeconds = 20;
    if (typeof speedVal === 'number' && speedVal > 0) {
      announcementSpeedSeconds = speedVal;
    } else if (
      speedVal &&
      typeof speedVal === 'object' &&
      typeof (speedVal as { speedSeconds?: unknown }).speedSeconds === 'number' &&
      ((speedVal as { speedSeconds: number }).speedSeconds > 0)
    ) {
      announcementSpeedSeconds = (speedVal as { speedSeconds: number }).speedSeconds;
    }

    const siteName = byKey.get(SITE_NAME_KEY);
    const cardStyleValue = byKey.get(PRODUCT_CARD_STYLE_KEY);
    const productCardStyle =
      cardStyleValue &&
      typeof cardStyleValue === 'object' &&
      (cardStyleValue as { style?: unknown }).style === 'TWO'
        ? 'TWO'
        : 'ONE';

    const logoStyleValue = byKey.get(SITE_LOGO_STYLE_KEY) as { paddingPx?: unknown; marginPx?: unknown } | undefined;
    const logoPaddingPx = typeof logoStyleValue?.paddingPx === 'number' ? logoStyleValue.paddingPx : 0;
    const logoMarginPx = typeof logoStyleValue?.marginPx === 'number' ? logoStyleValue.marginPx : 0;

    // Same 'otp' namespace/default OtpSecurityService reads for the admin
    // toggle — duplicated here (rather than importing OtpSecurityService
    // itself) to avoid pulling in its VPN-detector dependency just for one
    // boolean.
    const { codOtpEnabled, codOtpEmailEnabled } = await this.netProfitSettings.getNamespace('otp', {
      codOtpEnabled: true,
      codOtpEmailEnabled: true,
    });

    return {
      siteName: typeof siteName === 'string' ? siteName : DEFAULT_SITE_NAME,
      logoUrl,
      productsPageBannerUrl,
      productsPageBannerMobileUrl,
      faviconUrl,
      announcementSpeedSeconds,
      productCardStyle,
      logoPaddingPx,
      logoMarginPx,
      codOtpEnabled,
      codOtpEmailEnabled,
      seoTitle,
      seoDescription,
      seoImageUrl,
    };
  }
}
