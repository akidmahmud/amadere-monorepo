import { couponChannelError } from './coupon-channel';

describe('couponChannelError', () => {
  it('an ALL coupon works everywhere', () => {
    expect(couponChannelError({ channel: 'ALL', storeId: null })).toBeNull();
    expect(couponChannelError({ channel: 'ALL', storeId: null }, { storeId: 3 })).toBeNull();
  });

  it('a POS coupon is refused at the website / phone checkout', () => {
    expect(couponChannelError({ channel: 'POS', storeId: null })).toBe('This code is only valid in store');
  });

  it('a POS coupon works at any store till when not store-limited', () => {
    expect(couponChannelError({ channel: 'POS', storeId: null }, { storeId: 3 })).toBeNull();
  });

  it("a store-limited POS coupon is refused at another store's till", () => {
    expect(couponChannelError({ channel: 'POS', storeId: 2 }, { storeId: 3 })).toBe("This code isn't valid at this store");
    expect(couponChannelError({ channel: 'POS', storeId: 2 }, { storeId: 2 })).toBeNull();
  });
});
