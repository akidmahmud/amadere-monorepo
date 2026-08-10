import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SettingDto, SiteInfoDto, toSettingDto } from './settings.mapper';

const SITE_LOGO_MEDIA_ID_KEY = 'site_logo_media_id';
const SITE_NAME_KEY = 'site_name';
const DEFAULT_SITE_NAME = 'আমাদের';

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

  // Public: resolves the logo Media row so the frontend gets a real URL,
  // not a raw mediaId it would have to look up separately.
  async getSiteInfo(): Promise<SiteInfoDto> {
    const rows = await this.prisma.client.setting.findMany({
      where: { key: { in: [SITE_LOGO_MEDIA_ID_KEY, SITE_NAME_KEY, PRODUCT_CARD_STYLE_KEY] } },
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

    const siteName = byKey.get(SITE_NAME_KEY);
    const cardStyleValue = byKey.get(PRODUCT_CARD_STYLE_KEY);
    const productCardStyle =
      cardStyleValue &&
      typeof cardStyleValue === 'object' &&
      (cardStyleValue as { style?: unknown }).style === 'TWO'
        ? 'TWO'
        : 'ONE';

    return {
      siteName: typeof siteName === 'string' ? siteName : DEFAULT_SITE_NAME,
      logoUrl,
      productCardStyle,
    };
  }
}
