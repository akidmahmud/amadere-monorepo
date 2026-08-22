import { ShippingZonesConfig, Translated } from './shipping-zones.types';

export interface ResolvedZone {
  name: Translated;
  fee: number;
}

/**
 * Which shipping rate applies to a delivery district.
 *
 * Kept a pure function, separate from the service, for two reasons: it is
 * the piece that decides what a real customer is charged, so it deserves
 * direct unit tests with no Prisma or Nest around it; and both the cart
 * preview and real order placement call it through `computeCheckoutFees`,
 * which must stay the single source of truth so the two can never disagree.
 *
 * `district` is optional because the cart preview is requested before the
 * customer has typed an address. In that case the FIRST zone's rate is
 * shown — preserving the pre-existing behaviour of previewing the cheap
 * Dhaka rate until a real district is known, rather than quoting the
 * fallback high and dropping it later.
 */
export function resolveZoneFee(
  config: ShippingZonesConfig,
  district: string | undefined,
): ResolvedZone {
  if (!district?.trim()) {
    const first = config.zones[0];
    return first ? { name: first.name, fee: first.fee } : { ...config.fallback };
  }

  const needle = district.trim().toLowerCase();
  // First match wins. The DTO rejects a district assigned to two zones, but
  // a row written around it (the generic settings endpoint can reach any
  // Setting key) must still resolve to one predictable rate rather than
  // whichever happens to be last.
  for (const zone of config.zones) {
    if (zone.districts.some((d) => d.trim().toLowerCase() === needle)) {
      return { name: zone.name, fee: zone.fee };
    }
  }
  return { ...config.fallback };
}
