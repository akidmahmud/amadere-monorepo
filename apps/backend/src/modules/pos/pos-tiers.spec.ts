import {
  DEFAULT_TIERS,
  nextRun,
  renderSms,
  tierFor,
  tierKeyOf,
  tierRank,
} from './pos-tiers';

const T = DEFAULT_TIERS;

describe('tierFor', () => {
  it('everyone starts at the tier with no thresholds', () => {
    expect(tierFor({ orders: 1, spent: 100 }, T)?.key).toBe('regular');
  });
  it('purchases OR spend reach a tier; the highest one wins', () => {
    expect(tierFor({ orders: 5, spent: 0 }, T)?.key).toBe('silver');
    expect(tierFor({ orders: 1, spent: 20000 }, T)?.key).toBe('gold');
    expect(tierFor({ orders: 30, spent: 100 }, T)?.key).toBe('platinum');
  });
  it('no tiers → none', () => {
    expect(tierFor({ orders: 9, spent: 9 }, [])).toBeNull();
  });
  it('tierRank orders the list', () => {
    expect(tierRank(T[2], T)).toBe(2);
    expect(tierRank(null, T)).toBe(-1);
  });
});

describe('renderSms / nextRun / tierKeyOf', () => {
  it('fills tags; unknown tags vanish', () => {
    expect(
      renderSms('Hi {{name}}, ৳{{amount}} at {{store}} {{nope}}', {
        name: 'Karim',
        amount: '360.00',
        store: 'Uttara',
      }),
    ).toBe('Hi Karim, ৳360.00 at Uttara');
  });
  it('daily / weekly / monthly keep the clock time', () => {
    const d = new Date('2026-01-31T04:30:00Z');
    expect(nextRun(d, 'DAILY').toISOString()).toBe('2026-02-01T04:30:00.000Z');
    expect(nextRun(d, 'WEEKLY').toISOString()).toBe('2026-02-07T04:30:00.000Z');
    expect(nextRun(new Date('2026-03-15T04:30:00Z'), 'MONTHLY').toISOString()).toBe('2026-04-15T04:30:00.000Z');
  });
  it('tier keys from names', () => {
    expect(tierKeyOf('Gold Plus!')).toBe('gold-plus');
  });
});
