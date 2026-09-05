import {
  quoteShippingRule,
  STEADFAST_SHIPPING_RULES,
} from '@amader/shared';

// This decides real money on real parcels, so the published Steadfast card
// is checked against the numbers on the merchant's own rate sheet.
describe('quoteShippingRule (Steadfast card)', () => {
  const cfg = STEADFAST_SHIPPING_RULES;
  const at = (district: string | null, weightKg: number, type?: 'HOME' | 'POINT') =>
    quoteShippingRule(cfg, { district, weightKg, deliveryType: type })?.amount;

  it('prices home delivery at the published base rates', () => {
    expect(at('Dhaka', 1)).toBe(105);
    expect(at('Gazipur', 1)).toBe(60);
    expect(at('Dhaka Sub-Urban', 0.5)).toBe(115);
    expect(at('Dhaka Sub-Urban', 1)).toBe(135);
    // Unlisted district falls to the catch-all, not to zero.
    expect(at('Rajshahi', 0.4)).toBe(115);
    expect(at('Rajshahi', 1)).toBe(135);
  });

  it('rounds partial additional weight up to a whole kg', () => {
    // 105 + ceil(0.1) * 20
    expect(at('Dhaka', 1.1)).toBe(125);
    expect(at('Dhaka', 1.9)).toBe(125);
    expect(at('Dhaka', 2)).toBe(125);
    expect(at('Dhaka', 2.1)).toBe(145);
  });

  it('applies the point-delivery slabs above 7kg instead of per-kg', () => {
    expect(at('Gazipur', 1, 'POINT')).toBe(60);
    expect(at('Gazipur', 7, 'POINT')).toBe(180);
    expect(at('Gazipur', 9, 'POINT')).toBe(200);
    expect(at('Gazipur', 20, 'POINT')).toBe(250);
    expect(at('Rajshahi', 1, 'POINT')).toBe(120);
    expect(at('Rajshahi', 9, 'POINT')).toBe(180);
  });

  it('quotes the lightest band for an unweighed parcel rather than nothing', () => {
    expect(at('Dhaka', 0)).toBe(105);
    expect(at(null, 0)).toBe(115);
  });

  it('returns null when no rule can apply, so the caller falls back to zones', () => {
    expect(quoteShippingRule({ applyOnCheckout: true, rules: [] }, { weightKg: 1 })).toBeNull();
  });
});
