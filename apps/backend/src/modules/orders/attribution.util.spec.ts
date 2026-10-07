import { deriveSource } from './attribution.util';

describe('deriveSource', () => {
  // A customer taps an ad on m.facebook.com with no utm tags. Source must still
  // name Facebook. Origin is not derived: a storefront checkout is always WEBSITE.
  it('falls back to the referrer when the link carried no utm', () => {
    expect(deriveSource({ referrerDomain: 'm.facebook.com' })).toBe('m.facebook.com');
    expect(deriveSource({ referrerDomain: 'www.lm.facebook.com' })).toBe('lm.facebook.com');
  });

  it('prefers utm_source over the referrer', () => {
    expect(deriveSource({ utmSource: ' fbAds ', referrerDomain: 'google.com' })).toBe('fbAds');
  });

  it('does not treat our own domain as a referral', () => {
    expect(deriveSource({ referrerDomain: 'www.amadere.com' }, 'amadere.com')).toBeNull();
  });

  it('records direct traffic as no source', () => {
    expect(deriveSource({})).toBeNull();
    expect(deriveSource({ utmSource: '  ', referrerDomain: null })).toBeNull();
  });
});
