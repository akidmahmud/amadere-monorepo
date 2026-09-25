import { dhakaRange } from './dhaka-range';

describe('dhakaRange', () => {
  it('a Dhaka day starts at 18:00 UTC the day before', () => {
    const r = dhakaRange('2026-09-25', '2026-09-25');
    expect(r.gte.toISOString()).toBe('2026-09-24T18:00:00.000Z');
    expect(r.lt.toISOString()).toBe('2026-09-25T18:00:00.000Z');
  });

  it('a sale at 01:00 Dhaka falls inside that Dhaka day, not the previous one', () => {
    const r = dhakaRange('2026-09-25', '2026-09-25');
    const oneAm = new Date('2026-09-24T19:00:00.000Z'); // 01:00 Dhaka on the 25th
    expect(oneAm >= r.gte && oneAm < r.lt).toBe(true);
  });

  it('defaults to today in Dhaka', () => {
    const now = new Date('2026-09-24T20:30:00.000Z'); // 02:30 on the 25th in Dhaka
    expect(dhakaRange(undefined, undefined, now).gte.toISOString()).toBe(
      '2026-09-24T18:00:00.000Z',
    );
  });
});
