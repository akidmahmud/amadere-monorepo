import { dhakaRange, dhakaTimeRange } from './dhaka-range';

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

describe('dhakaTimeRange', () => {
  it('nothing given = no limit', () => {
    expect(dhakaTimeRange({})).toBeUndefined();
  });
  it('dates + Dhaka times (UTC+6), toTime inclusive to the minute', () => {
    expect(
      dhakaTimeRange({ from: '2026-09-28', to: '2026-09-29', fromTime: '10:00', toTime: '18:30' }),
    ).toEqual({
      gte: new Date('2026-09-28T04:00:00Z'),
      lt: new Date('2026-09-29T12:31:00Z'),
    });
  });
  it('times alone mean today in Dhaka', () => {
    const now = new Date('2026-09-29T20:00:00Z'); // 30 Sep 02:00 in Dhaka
    expect(dhakaTimeRange({ fromTime: '09:00', toTime: '09:59' }, now)).toEqual({
      gte: new Date('2026-09-30T03:00:00Z'),
      lt: new Date('2026-09-30T04:00:00Z'),
    });
  });
});
