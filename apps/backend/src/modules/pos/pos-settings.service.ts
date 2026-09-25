import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface PosVat {
  enabled: boolean;
  ratePercent: number;
  /** true = shelf prices already contain VAT (it is extracted, not added). */
  pricesIncludeVat: boolean;
}

/** Matches the POS behaviour before this setting existed. */
export const POS_VAT_DEFAULT: PosVat = {
  enabled: true,
  ratePercent: 15,
  pricesIncludeVat: false,
};

const VAT_KEY = 'pos.vat';

/**
 * POS-wide settings (one for all stores). Deliberately separate from the
 * website's Accounts VAT settings, which the POS no longer reads.
 */
@Injectable()
export class PosSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getVat(): Promise<PosVat> {
    const row = await this.prisma.client.setting.findUnique({
      where: { key: VAT_KEY },
    });
    return {
      ...POS_VAT_DEFAULT,
      ...((row?.value as Partial<PosVat> | undefined) ?? {}),
    };
  }

  async setVat(v: PosVat): Promise<PosVat> {
    const value = {
      enabled: v.enabled,
      ratePercent: v.ratePercent,
      pricesIncludeVat: v.pricesIncludeVat,
    };
    await this.prisma.client.setting.upsert({
      where: { key: VAT_KEY },
      create: { key: VAT_KEY, value: value },
      update: { value: value },
    });
    return value;
  }
}
