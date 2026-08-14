import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
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

// Value shape: { style: 'ONE' | 'TWO' } — an object (not a bare string) so it
// fits the same Prisma.InputJsonValue-typed upsert() every other setting
// already uses, and so the admin's generic key/value editor shows something
// sensible if someone opens this key there instead of the dedicated control.
export const PRODUCT_CARD_STYLE_KEY = 'product_card_style';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      siteName: typeof siteName === 'string' ? siteName : DEFAULT_SITE_NAME,
      logoUrl,
      productsPageBannerUrl,
      productCardStyle,
      logoPaddingPx,
      logoMarginPx,
    };
  }
}
