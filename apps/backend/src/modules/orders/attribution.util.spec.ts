import { deriveAttribution } from './attribution.util';

describe('deriveAttribution', () => {
  // The reported case: a customer taps an ad on m.facebook.com with no utm
  // tags. Before this, that was recorded as channel WEBSITE with a blank
  // Source, despite referrerDomain naming Facebook on the same row.
  it('reads Facebook from the referrer when the link carried no utm', () => {
    expect(deriveAttribution({ referrerDomain: 'm.facebook.com' })).toEqual({
      channel: 'FACEBOOK',
      utmSource: 'm.facebook.com',
    });
  });

  it("handles Facebook's link-shim hosts", () => {
    for (const d of ['l.facebook.com', 'lm.facebook.com', 'fb.me', 'www.facebook.com']) {
      expect(deriveAttribution({ referrerDomain: d }).channel).toBe('FACEBOOK');
    }
  });

  it('maps the other social referrers', () => {
    expect(deriveAttribution({ referrerDomain: 'instagram.com' }).channel).toBe('INSTAGRAM');
    expect(deriveAttribution({ referrerDomain: 'vt.tiktok.com' }).channel).toBe('TIKTOK');
    expect(deriveAttribution({ referrerDomain: 'youtu.be' }).channel).toBe('YOUTUBE');
    expect(deriveAttribution({ referrerDomain: 't.co' }).channel).toBe('X');
  });

  it('prefers utm_source over the referrer, and matches loose ad-tag spellings', () => {
    // Advertisers type this field by hand; "fbads" is what the user asked for.
    for (const tag of ['fbads', 'fb_ads', 'facebook-retargeting', 'FB', 'meta']) {
      expect(deriveAttribution({ utmSource: tag, referrerDomain: 'google.com' })).toEqual({
        channel: 'FACEBOOK',
        utmSource: tag,
      });
    }
  });

  it('keeps an unrecognised referrer as WEBSITE but still records the source', () => {
    expect(deriveAttribution({ referrerDomain: 'google.com' })).toEqual({
      channel: 'WEBSITE',
      utmSource: 'google.com',
    });
  });

  it('does not treat our own domain as a referral', () => {
    expect(deriveAttribution({ referrerDomain: 'amadere.com' }, 'amadere.com')).toEqual({
      channel: 'WEBSITE',
      utmSource: null,
    });
  });

  it('records direct traffic as WEBSITE with nothing attributed', () => {
    expect(deriveAttribution({})).toEqual({ channel: 'WEBSITE', utmSource: null });
    expect(deriveAttribution({ utmSource: '  ', referrerDomain: null })).toEqual({
      channel: 'WEBSITE',
      utmSource: null,
    });
  });
});
