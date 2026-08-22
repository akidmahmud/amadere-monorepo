import { SHIPPING_ZONES_DEFAULTS } from './shipping-zones.defaults';
import { resolveZoneFee } from './shipping-zones.matcher';
import { ShippingZonesConfig } from './shipping-zones.types';

const config: ShippingZonesConfig = {
  zones: [
    { name: { en: 'Inside Dhaka', bn: 'ঢাকার ভিতরে' }, fee: 80, districts: ['Dhaka'] },
    { name: { en: 'Dhaka Suburb', bn: 'শহরতলি' }, fee: 100, districts: ['Gazipur', 'Narayanganj'] },
  ],
  fallback: { name: { en: 'Outside Dhaka', bn: 'ঢাকার বাইরে' }, fee: 120 },
};

describe('resolveZoneFee', () => {
  it('matches a district assigned to a zone', () => {
    expect(resolveZoneFee(config, 'Gazipur').fee).toBe(100);
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    // Admin's manual order form and legacy data both carry uneven casing.
    expect(resolveZoneFee(config, '  gAzIpUr ').fee).toBe(100);
  });

  it('falls back for a district assigned to no zone', () => {
    expect(resolveZoneFee(config, 'Sylhet').fee).toBe(120);
  });

  it('uses the first zone when no district is known yet', () => {
    // The cart preview is requested before the customer has picked a
    // district. Showing the cheapest rate first is the pre-existing
    // behaviour and must not silently become the fallback.
    expect(resolveZoneFee(config, undefined).fee).toBe(80);
  });

  it('lets the first zone win if a district is somehow listed twice', () => {
    const duplicated: ShippingZonesConfig = {
      ...config,
      zones: [
        config.zones[0],
        { name: { en: 'Dup', bn: 'Dup' }, fee: 999, districts: ['Dhaka'] },
      ],
    };
    expect(resolveZoneFee(duplicated, 'Dhaka').fee).toBe(80);
  });

  it('falls back when the config has no zones at all', () => {
    const empty: ShippingZonesConfig = { zones: [], fallback: config.fallback };
    expect(resolveZoneFee(empty, 'Dhaka').fee).toBe(120);
    expect(resolveZoneFee(empty, undefined).fee).toBe(120);
  });

  it('returns the matched zone name so the storefront can label the row', () => {
    expect(resolveZoneFee(config, 'Gazipur').name.en).toBe('Dhaka Suburb');
    expect(resolveZoneFee(config, 'Sylhet').name.en).toBe('Outside Dhaka');
  });

  // The regression guard for this whole feature: the shipped defaults must
  // charge exactly what the hardcoded constants charged before it existed.
  it('defaults reproduce the previous hardcoded 80 Dhaka / 120 elsewhere', () => {
    expect(resolveZoneFee(SHIPPING_ZONES_DEFAULTS, 'Dhaka').fee).toBe(80);
    expect(resolveZoneFee(SHIPPING_ZONES_DEFAULTS, 'Chattogram').fee).toBe(120);
    expect(resolveZoneFee(SHIPPING_ZONES_DEFAULTS, undefined).fee).toBe(80);
  });
});
