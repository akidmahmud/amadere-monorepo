import { BadRequestException, Injectable } from '@nestjs/common';
import { CourierProviderName } from '@amader/db';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { ShippingZonesService } from '../../shipping-zones/shipping-zones.service';
import type { ShippingZonesConfig } from '../../shipping-zones/shipping-zones.types';
import type { CourierRate, ReportSettings, ZoneRate } from './engine/types';

const NAMESPACE = 'sales_report';
export const REPORT_COURIERS: string[] = Object.values(CourierProviderName);
const DEFAULT_ZONE: ZoneRate = {
  smallMax: 0.2,
  small: 80,
  first: 105,
  extra: 20,
};
const DEFAULTS: ReportSettings = {
  rates: {},
  packaging: 0,
  fees: { COD: 0, BKASH: 0, NAGAD: 0 },
  th: { low: 50, over: 5, pending: 2, bill: 3 },
};

/** Zone name for a district — ignores showOnCheckout, which only hides the fee from customers. */
export function zoneOf(
  config: ShippingZonesConfig,
  district: string | null | undefined,
): string {
  const needle = district?.trim().toLowerCase();
  if (needle) {
    for (const z of config.zones) {
      if (z.districts.some((d) => d.trim().toLowerCase() === needle))
        return z.name.en;
    }
  }
  return config.fallback.name.en;
}

export function zoneNames(config: ShippingZonesConfig): string[] {
  return [...config.zones.map((z) => z.name.en), config.fallback.name.en];
}

const num = (v: unknown, path: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0)
    throw new BadRequestException(`${path} must be a number ≥ 0`);
  return v;
};

export function validateSettings(
  input: unknown,
  couriers: string[],
): ReportSettings {
  const s = input as ReportSettings;
  if (!s || typeof s !== 'object')
    throw new BadRequestException('Settings must be an object');
  for (const [courier, rc] of Object.entries(s.rates ?? {})) {
    if (!couriers.includes(courier))
      throw new BadRequestException(`Unknown courier ${courier}`);
    num(rc.cod, `${courier} COD %`);
    num(rc.returnPct, `${courier} return %`);
    if (rc.codBase !== 'product' && rc.codBase !== 'collect')
      throw new BadRequestException(`${courier} COD base is invalid`);
    for (const [zone, z] of Object.entries(rc.zones ?? {})) {
      for (const k of ['smallMax', 'small', 'first', 'extra'] as const)
        num(z[k], `${courier} ${zone} ${k}`);
    }
  }
  num(s.packaging, 'Packaging');
  for (const [k, v] of Object.entries(s.fees ?? {})) num(v, `${k} fee`);
  for (const k of ['low', 'over', 'pending', 'bill'] as const)
    num(s.th?.[k], `Threshold ${k}`);
  return s;
}

@Injectable()
export class ReportSettingsService {
  constructor(
    private readonly settings: NetProfitSettingsService,
    private readonly zones: ShippingZonesService,
  ) {}

  zoneConfig(): Promise<ShippingZonesConfig> {
    return this.zones.getConfig();
  }

  /** Stored settings, with every courier × current shipping zone filled with defaults. */
  async get(): Promise<ReportSettings> {
    const [stored, config] = await Promise.all([
      this.settings.getNamespace(NAMESPACE, DEFAULTS),
      this.zoneConfig(),
    ]);
    const rates: Record<string, CourierRate> = {};
    for (const courier of REPORT_COURIERS) {
      const rc = stored.rates?.[courier];
      rates[courier] = {
        cod: rc?.cod ?? 1,
        codBase: rc?.codBase ?? 'product',
        returnPct: rc?.returnPct ?? 100,
        zones: Object.fromEntries(
          zoneNames(config).map((z) => [
            z,
            rc?.zones?.[z] ?? { ...DEFAULT_ZONE },
          ]),
        ),
      };
    }
    return {
      rates,
      packaging: stored.packaging ?? 0,
      fees: { ...DEFAULTS.fees, ...stored.fees },
      th: { ...DEFAULTS.th, ...stored.th },
    };
  }

  async update(input: unknown): Promise<ReportSettings> {
    const valid = validateSettings(input, REPORT_COURIERS);
    await this.settings.setNamespace(NAMESPACE, valid);
    return this.get();
  }
}
