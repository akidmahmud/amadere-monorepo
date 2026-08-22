import { ShippingZonesConfig } from './shipping-zones.types';

/**
 * Reproduces the hardcoded behaviour this feature replaces, exactly:
 * `computeCheckoutFees` was `isDhaka ? 80 : 120`, where "Dhaka" meant the
 * DISTRICT, not the division. One zone holding Dhaka at 80, everything else
 * falling through to 120.
 *
 * This matters more than a normal default. Shipping fees are real money on
 * real orders, so shipping this feature must charge every customer exactly
 * what they were charged the day before. Nothing changes until an admin
 * edits a zone.
 */
export const SHIPPING_ZONES_DEFAULTS: ShippingZonesConfig = {
  zones: [
    {
      name: { en: 'Inside Dhaka', bn: 'ঢাকার ভিতরে' },
      fee: 80,
      districts: ['Dhaka'],
    },
  ],
  fallback: {
    name: { en: 'Outside Dhaka', bn: 'ঢাকার বাইরে' },
    fee: 120,
  },
};
