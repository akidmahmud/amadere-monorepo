import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface PosVat {
  enabled: boolean;
  ratePercent: number;
  /** true = shelf prices already contain VAT (it is extracted, not added). */
  pricesIncludeVat: boolean;
  /**
   * "VAT coupon": VAT is charged on the receipt, then discounted back, so the
   * customer pays the pre-VAT price. The VAT is still recorded as owed (the
   * store bears it).
   */
  vatDiscount: boolean;
}

/** Matches the POS behaviour before this setting existed. */
export const POS_VAT_DEFAULT: PosVat = {
  enabled: true,
  ratePercent: 15,
  pricesIncludeVat: false,
  vatDiscount: false,
};

const VAT_KEY = 'pos.vat';
const LABEL_KEY = 'pos.label';

/** Barcode label paper size (the label printer's roll). */
export interface PosLabelSize {
  widthMm: number;
  heightMm: number;
  /** Print the product name / size (pack size or weight) above the barcode. */
  showName: boolean;
  showSize: boolean;
}
export const POS_LABEL_DEFAULT: PosLabelSize = {
  widthMm: 38,
  heightMm: 25,
  showName: true,
  showSize: true,
};

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

  async setVat(
    v: Omit<PosVat, 'vatDiscount'> & { vatDiscount?: boolean },
  ): Promise<PosVat> {
    const value = {
      enabled: v.enabled,
      ratePercent: v.ratePercent,
      pricesIncludeVat: v.pricesIncludeVat,
      vatDiscount: v.vatDiscount ?? false,
    };
    await this.prisma.client.setting.upsert({
      where: { key: VAT_KEY },
      create: { key: VAT_KEY, value: value },
      update: { value: value },
    });
    return value;
  }

  async getLabel(): Promise<PosLabelSize> {
    const row = await this.prisma.client.setting.findUnique({
      where: { key: LABEL_KEY },
    });
    return {
      ...POS_LABEL_DEFAULT,
      ...((row?.value as Partial<PosLabelSize> | undefined) ?? {}),
    };
  }

  async setLabel(
    v: Pick<PosLabelSize, 'widthMm' | 'heightMm'> & Partial<PosLabelSize>,
  ): Promise<PosLabelSize> {
    const cur = await this.getLabel();
    const value = {
      widthMm: v.widthMm,
      heightMm: v.heightMm,
      showName: v.showName ?? cur.showName,
      showSize: v.showSize ?? cur.showSize,
    };
    await this.prisma.client.setting.upsert({
      where: { key: LABEL_KEY },
      create: { key: LABEL_KEY, value },
      update: { value },
    });
    return value;
  }
}
