import { Injectable } from '@nestjs/common';
import { Locale } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RevalidationService } from '../../common/revalidation/revalidation.service';
import { SHIPPING_ZONES_DEFAULTS } from './shipping-zones.defaults';
import { ShippingZonesConfig, Translated } from './shipping-zones.types';

export const SHIPPING_ZONES_KEY = 'shipping_zones';

/** One row of the rate list the checkout page shows the customer. */
export interface PublicShippingZone {
  name: string;
  fee: number;
  districts: string[];
  /** True for the catch-all row, so the UI can label it "all other districts". */
  isFallback: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function orDefault<T>(value: unknown, fallback: T): T {
  return isPlainObject(value) ? (value as T) : fallback;
}

// One row in the generic Setting table, same reuse-over-fork pattern as
// WhatsappSettingsService and the footer config. Merged over defaults on
// every read so a missing or malformed row still charges the rate the
// hardcoded constants charged before this feature existed.
@Injectable()
export class ShippingZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidation: RevalidationService,
  ) {}

  /** The raw config, for the admin editor and for fee resolution. */
  async getConfig(): Promise<ShippingZonesConfig> {
    const row = await this.prisma.client.setting.findUnique({
      where: { key: SHIPPING_ZONES_KEY },
    });
    return this.merge(row?.value as Partial<ShippingZonesConfig> | undefined);
  }

  /** Flattened to one locale for the checkout page's rate list. */
  async getPublic(locale: Locale): Promise<PublicShippingZone[]> {
    const config = await this.getConfig();
    const key: keyof Translated = locale === 'BN' ? 'bn' : 'en';
    return [
      ...config.zones.map((zone) => ({
        name: zone.name?.[key] ?? '',
        fee: zone.fee,
        districts: zone.districts,
        isFallback: false,
      })),
      {
        name: config.fallback.name?.[key] ?? '',
        fee: config.fallback.fee,
        districts: [],
        isFallback: true,
      },
    ];
  }

  async update(input: ShippingZonesConfig): Promise<ShippingZonesConfig> {
    const next = this.merge(input);
    await this.prisma.client.setting.upsert({
      where: { key: SHIPPING_ZONES_KEY },
      create: { key: SHIPPING_ZONES_KEY, value: next as never },
      update: { value: next as never },
    });
    // Fire-and-forget, like every other RevalidationService caller. The
    // checkout page renders the rate list, and the cart preview quotes the
    // fee, so a rate change has to reach the storefront without a deploy.
    void this.revalidation.revalidate(['/[locale]'], 'layout');
    return next;
  }

  // ------------------------------------------------------------------

  /** Structurally complete config whatever the stored row contains. The
   * generic `PUT /admin/settings/:key` endpoint can write any Setting key
   * without passing this module's DTO, so a malformed row must degrade to
   * defaults rather than throw — this value decides what customers pay on
   * every checkout. */
  private merge(stored: Partial<ShippingZonesConfig> | undefined): ShippingZonesConfig {
    const s = isPlainObject(stored) ? stored : {};
    const zones = Array.isArray(s.zones)
      ? (s.zones as unknown[]).filter(isPlainObject).map((z) => ({
          name: orDefault<Translated>(z.name, { en: '', bn: '' }),
          fee: typeof z.fee === 'number' && z.fee >= 0 ? z.fee : 0,
          districts: Array.isArray(z.districts)
            ? (z.districts as unknown[]).filter((d): d is string => typeof d === 'string')
            : [],
        }))
      : SHIPPING_ZONES_DEFAULTS.zones;

    const fallbackRaw: Record<string, unknown> = isPlainObject(s.fallback) ? s.fallback : {};
    const fallback = {
      name: orDefault<Translated>(fallbackRaw.name, SHIPPING_ZONES_DEFAULTS.fallback.name),
      fee:
        typeof fallbackRaw.fee === 'number' && fallbackRaw.fee >= 0
          ? fallbackRaw.fee
          : SHIPPING_ZONES_DEFAULTS.fallback.fee,
    };

    return structuredClone({ zones, fallback });
  }
}
