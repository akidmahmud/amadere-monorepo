import { isDigitalOnly } from './digital-order.util';

describe('isDigitalOnly', () => {
  it('is true when every line is digital', () => {
    expect(isDigitalOnly([{ productType: 'DIGITAL' }, { productType: 'DIGITAL' }])).toBe(true);
  });

  it('is false when every line is physical', () => {
    expect(isDigitalOnly([{ productType: 'PHYSICAL' }])).toBe(false);
  });

  it('is false for a mixed cart — there is a parcel, so it behaves physically', () => {
    expect(isDigitalOnly([{ productType: 'DIGITAL' }, { productType: 'PHYSICAL' }])).toBe(false);
  });

  it('is false for an empty list rather than vacuously true', () => {
    // An empty cart must never look "digital" and skip address collection.
    expect(isDigitalOnly([])).toBe(false);
  });
});
