import { daysLeft, expiryStatus, shelfBatches, soonestExpiry } from './pos-expiry';

const d = (s: string) => new Date(`${s}T06:00:00Z`);

describe('POS expiry (FIFO shelf batches)', () => {
  const deliveries = [
    { at: d('2026-09-01'), qty: 10, expiry: '2026-10-10' },
    { at: d('2026-09-20'), qty: 10, expiry: '2026-12-31' },
    { at: d('2026-10-01'), qty: 5, expiry: null },
  ];

  it('the units on hand are the newest deliveries', () => {
    // 12 left: all 5 from Oct 1, then 7 of the 10 from Sep 20.
    expect(shelfBatches(12, deliveries)).toEqual([
      { entryDate: d('2026-10-01'), expiry: null, qty: 5 },
      { entryDate: d('2026-09-20'), expiry: '2026-12-31', qty: 7 },
    ]);
  });

  it('reaches older deliveries as stock grows; extra is old unknown stock', () => {
    const b = shelfBatches(28, deliveries);
    expect(b.map((x) => x.qty)).toEqual([5, 10, 10, 3]);
    expect(b[3]).toEqual({ entryDate: null, expiry: null, qty: 3 });
    expect(soonestExpiry(b)).toBe('2026-10-10');
  });

  it('nothing on hand, nothing on the shelf', () => {
    expect(shelfBatches(0, deliveries)).toEqual([]);
  });

  it('status: expired, expiring within 15 days, OK, none', () => {
    expect(daysLeft('2026-10-10', '2026-10-04')).toBe(6);
    expect(expiryStatus('2026-10-03', '2026-10-04')).toBe('Expired');
    expect(expiryStatus('2026-10-19', '2026-10-04')).toBe('Expiring soon');
    expect(expiryStatus('2026-10-20', '2026-10-04')).toBe('OK');
    expect(expiryStatus(null, '2026-10-04')).toBe('No expiry');
  });
});
