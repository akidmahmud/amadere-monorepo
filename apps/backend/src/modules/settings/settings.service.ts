import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RevalidationService } from '../../common/revalidation/revalidation.service';
import { NetProfitSettingsService } from '../net-profit/settings/net-profit-settings.service';
import { SettingDto, SiteInfoDto, toSettingDto } from './settings.mapper';

const SITE_LOGO_MEDIA_ID_KEY = 'site_logo_media_id';
// Value shape: { paddingPx: number, marginPx: number } — kept as its own key
// (not folded into SITE_LOGO_MEDIA_ID_KEY's plain-number value) so "which
// image" and "how it's styled" stay independently editable/upsertable via
// the same generic PUT /admin/settings/:key every other setting uses.
const SITE_LOGO_STYLE_KEY = 'site_logo_style';
const SITE_NAME_KEY = 'site_name';
const DEFAULT_SITE_NAME = 'আমাদের';
const PRODUCTS_PAGE_BANNER_MEDIA_ID_KEY = 'products_page_banner_media_id';
const SITE_FAVICON_MEDIA_ID_KEY = 'site_favicon_media_id';
export const ANNOUNCEMENT_BAR_SPEED_KEY = 'announcement_bar_speed';

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
      orderBy: { key: 'asc' },
    });
    return settings.map(toSettingDto);
  }

  async get(key: string): Promise<SettingDto> {
    const setting = await this.prisma.client.setting.findUnique({
      where: { key },
    });
    if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
    return toSettingDto(setting);
  }

  async upsert(key: string, value: unknown): Promise<SettingDto> {
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
            SITE_FAVICON_MEDIA_ID_KEY,
            ANNOUNCEMENT_BAR_SPEED_KEY,
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

    const faviconMediaId = byKey.get(SITE_FAVICON_MEDIA_ID_KEY);
    let faviconUrl: string | null = null;
    if (typeof faviconMediaId === 'number') {
      const media = await this.prisma.client.media.findUnique({
        where: { id: faviconMediaId },
      });
      faviconUrl = media?.url ?? null;
    }

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
    const { codOtpEnabled } = await this.netProfitSettings.getNamespace('otp', { codOtpEnabled: true });

    return {
      siteName: typeof siteName === 'string' ? siteName : DEFAULT_SITE_NAME,
      logoUrl,
      productsPageBannerUrl,
      faviconUrl,
      announcementSpeedSeconds,
      productCardStyle,
      logoPaddingPx,
      logoMarginPx,
      codOtpEnabled,
    };
  }
}
