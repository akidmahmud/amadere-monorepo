import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

const KEY = 'sitemap.settings';

export interface SitemapSettings {
  enabled: boolean;
  indexNowEnabled: boolean;
  indexNowKey: string | null;
}

const DEFAULTS: SitemapSettings = { enabled: true, indexNowEnabled: false, indexNowKey: null };

// Same generic-Setting-table pattern as AnalyticsSettingsService/
// CourierSettingsService — no secrets here (the IndexNow key is meant to be
// publicly served as a verification file), so no CredentialsService needed.
@Injectable()
export class SitemapSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<SitemapSettings> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: KEY } });
    return row ? { ...DEFAULTS, ...(row.value as object) } : DEFAULTS;
  }

  async updateSettings(input: Partial<Pick<SitemapSettings, 'enabled' | 'indexNowEnabled'>>): Promise<SitemapSettings> {
    const next = { ...(await this.getSettings()), ...input };
    await this.save(next);
    return next;
  }

  async generateIndexNowKey(): Promise<SitemapSettings> {
    const next = { ...(await this.getSettings()), indexNowKey: randomUUID() };
    await this.save(next);
    return next;
  }

  // Only called by the public key-verification route — matches on the
  // exact stored key so a rotated/regenerated key correctly stops
  // verifying under its old value.
  async getIndexNowKeyIfMatches(key: string): Promise<string | null> {
    const settings = await this.getSettings();
    return settings.indexNowKey === key ? settings.indexNowKey : null;
  }

  private async save(value: SitemapSettings): Promise<void> {
    await this.prisma.client.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: value as never },
      update: { value: value as never },
    });
  }
}
