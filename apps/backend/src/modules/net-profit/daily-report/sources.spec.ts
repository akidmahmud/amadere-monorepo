import { retailSourceOf, wholesaleSourceOf } from './sources';

const web = (utmSource: string | null, referrerDomain: string | null = null) =>
  retailSourceOf({ channel: 'WEBSITE', utmSource, referrerDomain });

describe('retailSourceOf', () => {
  it.each([
    ['fb', null, 'WEB_FACEBOOK'],
    ['facebook_ads', null, 'WEB_FACEBOOK'],
    [null, 'l.facebook.com', 'WEB_FACEBOOK'],
    [null, 'm.facebook.com', 'WEB_FACEBOOK'],
    ['ig', null, 'WEB_INSTAGRAM'],
    [null, 'instagram.com', 'WEB_INSTAGRAM'],
    ['TikTok', null, 'WEB_TIKTOK'],
    [null, 'www.google.com', 'WEB_DIRECT'],
    // Token match, not substring: "digital" contains "ig", "fbx" contains "fb".
    ['digital', null, 'WEB_DIRECT'],
    ['fbx', null, 'WEB_DIRECT'],
    [null, null, 'WEB_DIRECT'],
  ])('website utm=%s ref=%s → %s', (utm, ref, want) => {
    expect(web(utm, ref)).toBe(want);
  });

  it('APP is treated as website', () => {
    expect(
      retailSourceOf({ channel: 'APP', utmSource: 'ig', referrerDomain: null }),
    ).toBe('WEB_INSTAGRAM');
  });

  it.each([
    ['WHATSAPP', 'WHATSAPP'],
    ['FACEBOOK', 'FACEBOOK'],
    ['INSTAGRAM', 'INSTAGRAM'],
    ['TIKTOK', 'TIKTOK'],
    ['PHONE', 'TELESALE'],
    ['POS', 'SHOP'],
    ['MARKETPLACE', 'OTHER'],
    ['YOUTUBE', 'OTHER'],
  ])('channel %s → %s (utm ignored for staff orders)', (channel, want) => {
    expect(
      retailSourceOf({ channel, utmSource: 'fb', referrerDomain: null }),
    ).toBe(want);
  });
});

describe('wholesaleSourceOf', () => {
  it('wholesale type → WHOLESALE', () => {
    expect(wholesaleSourceOf({ type: 'WHOLESALE', channelId: null })).toBe(
      'WHOLESALE',
    );
  });
  it('channel sale → WCH_<id>', () => {
    expect(wholesaleSourceOf({ type: 'CHANNEL', channelId: 7 })).toBe('WCH_7');
  });
  it('channel sale without a channel row → WHOLESALE', () => {
    expect(wholesaleSourceOf({ type: 'CHANNEL', channelId: null })).toBe(
      'WHOLESALE',
    );
  });
});
