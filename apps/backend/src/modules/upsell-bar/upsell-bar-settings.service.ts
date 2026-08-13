import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const KEY = 'upsell_bar.settings';

export type UpsellCountMode = 'TOTAL_UNITS' | 'DISTINCT_PRODUCTS';

export interface UpsellBarSettings {
  enabled: boolean;
  countMode: UpsellCountMode;
  maxDiscountCap: number | null;
}

const DEFAULTS: UpsellBarSettings = {
  enabled: false,
  countMode: 'TOTAL_UNITS',
  maxDiscountCap: null,
};

// Same shape as EmailSettingsService: one JSON row in the generic Setting
// table, explicit per-field merge on update (not a `{...current,...input}`
// spread) so an explicit `maxDiscountCap: null` clears the cap instead of
// class-transformer's `undefined`-on-untouched-fields clobbering it.
@Injectable()
export class UpsellBarSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<UpsellBarSettings> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: KEY } });
    return row ? { ...DEFAULTS, ...(row.value as object) } : DEFAULTS;
  }

  async updateSettings(input: Partial<UpsellBarSettings>): Promise<UpsellBarSettings> {
    const current = await this.getSettings();
    const next: UpsellBarSettings = {
      enabled: input.enabled ?? current.enabled,
      countMode: input.countMode ?? current.countMode,
      maxDiscountCap: input.maxDiscountCap !== undefined ? input.maxDiscountCap : current.maxDiscountCap,
    };
    await this.prisma.client.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: next as never },
      update: { value: next as never },
    });
    return next;
  }
}
