import { isRecoveredOrder, retailSourceOf, wholesaleSourceOf } from './sources';

const web = (utmSource: string | null, referrerDomain: string | null = null) =>
  retailSourceOf({ channel: 'WEBSITE', utmSource, referrerDomain });

describe('retailSourceOf', () => {
  it.each([
    ['fb', null],
    [null, 'l.facebook.com'],
    ['ig', null],
    ['TikTok', null],
    [null, 'www.google.com'],
    [null, null],
  ])('website utm=%s ref=%s → one Website block', (utm, ref) => {
    expect(web(utm, ref)).toBe('WEB_DIRECT');
  });

  it('APP is treated as website', () => {
    expect(
      retailSourceOf({ channel: 'APP', utmSource: 'ig', referrerDomain: null }),
    ).toBe('WEB_DIRECT');
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

describe('retailSourceOf — POS store', () => {
  it('a POS sale is its store: SHOP_<storeId>', () => {
    expect(
      retailSourceOf({
        channel: 'POS',
        storeId: 4,
        utmSource: null,
        referrerDomain: null,
      }),
    ).toBe('SHOP_4');
  });
  it('a POS sale with no store stays SHOP', () => {
    expect(
      retailSourceOf({
        channel: 'POS',
        storeId: null,
        utmSource: null,
        referrerDomain: null,
      }),
    ).toBe('SHOP');
  });
});

describe('isRecoveredOrder', () => {
  it('REC- orders are recovered carts; others are not', () => {
    expect(isRecoveredOrder('REC-MUS4RN6Z')).toBe(true);
    expect(isRecoveredOrder('ORD-20260911-0DEB04')).toBe(false);
    expect(isRecoveredOrder(null)).toBe(false);
  });
});
