import {
  autoName,
  businessWindow,
  exactWindow,
  currentBusinessDay,
  daysInMonth,
  lastClosedBusinessDay,
  periodDays,
  validateManual,
  wholesaleBusinessDay,
} from './period';

describe('period helpers', () => {
  it('periodDays is inclusive and crosses months', () => {
    expect(periodDays('2026-09-29', '2026-10-01')).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ]);
    expect(periodDays('2026-09-30', '2026-09-30')).toEqual(['2026-09-30']);
  });
  it('daysInMonth', () => {
    expect(daysInMonth('2026-09-15')).toBe(30);
    expect(daysInMonth('2026-10-01')).toBe(31);
    expect(daysInMonth('2028-02-10')).toBe(29);
  });
  it('autoName uses a fixed English month (never "Sept")', () => {
    expect(autoName('2026-09-30')).toBe('Daily – 30 Sep 2026');
    expect(autoName('2026-01-05')).toBe('Daily – 5 Jan 2026');
  });
});

describe('validateManual', () => {
  const today = '2026-10-01';
  it('returns the trimmed name', () => {
    expect(
      validateManual('  Eid week ', '2026-09-25', '2026-10-01', today),
    ).toBe('Eid week');
  });
  it.each([
    ['   ', '2026-09-30', '2026-09-30', 'Give the report a name.'],
    [
      'x'.repeat(121),
      '2026-09-30',
      '2026-09-30',
      'Name is too long (120 characters max).',
    ],
    ['a', '2026-9-30', '2026-09-30', 'Dates must be real dates (YYYY-MM-DD).'],
    ['a', '2026-02-30', '2026-03-01', 'Dates must be real dates (YYYY-MM-DD).'],
    ['a', '2026-10-01', '2026-09-30', '"From" must be on or before "To".'],
    ['a', '2026-10-01', '2026-10-02', '"To" cannot be in the future.'],
    ['a', '2026-06-01', '2026-09-30', 'A report can cover at most 92 days.'],
  ])('rejects name=%j from=%s to=%s', (name, from, to, msg) => {
    expect(() => validateManual(name, from, to, today)).toThrow(msg);
  });
  it('accepts exactly 92 days', () => {
    expect(validateManual('a', '2026-07-02', '2026-10-01', today)).toBe('a');
  });
});

// Business day D = (D−1) 20:00 → D 20:00, Asia/Dhaka (UTC+6).
describe('business day (8 PM to 8 PM)', () => {
  it('window for one day starts 8 PM the day before, ends 8 PM (exclusive)', () => {
    const w = businessWindow('2026-10-02', '2026-10-02');
    expect(w.start.toISOString()).toBe('2026-10-01T14:00:00.000Z'); // 1 Oct 20:00 Dhaka
    expect(w.end.toISOString()).toBe('2026-10-02T14:00:00.000Z'); // 2 Oct 20:00 Dhaka
  });
  it('window for a range spans first-day open to last-day close', () => {
    const w = businessWindow('2026-09-01', '2026-09-30');
    expect(w.start.toISOString()).toBe('2026-08-31T14:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-09-30T14:00:00.000Z');
  });
  it.each([
    ['2026-10-02T13:59:00Z', '2026-10-02', '2026-10-01'], // 7:59 PM: 2 Oct still open
    ['2026-10-02T14:00:00Z', '2026-10-03', '2026-10-02'], // 8:00 PM: 2 Oct closes
    ['2026-10-02T14:15:00Z', '2026-10-03', '2026-10-02'], // 8:15 PM cron
    ['2026-10-02T18:30:00Z', '2026-10-03', '2026-10-02'], // 0:30 AM 3 Oct
  ])('at %s current=%s lastClosed=%s', (now, current, closed) => {
    expect(currentBusinessDay(new Date(now))).toBe(current);
    expect(lastClosedBusinessDay(new Date(now))).toBe(closed);
  });
});

describe('wholesaleBusinessDay', () => {
  const at = (iso: string) => new Date(iso);
  it.each([
    // [placedAt (DATE), createdAt (UTC instant), expected business day]
    ['2026-10-02', '2026-10-02T08:00:00Z', '2026-10-02'], // 2 PM Dhaka, same day
    ['2026-10-02', '2026-10-02T15:00:00Z', '2026-10-03'], // 9 PM Dhaka → next business day
    ['2026-09-16', '2026-09-16T18:03:00Z', '2026-09-17'], // 00:03 Dhaka, stamped with the UTC date
    ['2026-09-17', '2026-09-16T18:03:00Z', '2026-09-17'], // same, stamped with the Dhaka date
    ['2026-09-01', '2026-10-02T08:00:00Z', '2026-09-01'], // deliberately backdated: keep it
  ])('placed %s, entered %s → %s', (placed, created, want) => {
    expect(wholesaleBusinessDay(at(`${placed}T00:00:00Z`), at(created))).toBe(
      want,
    );
  });
});

describe('exactWindow (manual report with its own times)', () => {
  it('no times → business days (undefined)', () => {
    expect(exactWindow('2026-10-04', '2026-10-04')).toBeUndefined();
  });
  it('00:00 → 23:59 covers the whole calendar day in Dhaka', () => {
    const w = exactWindow('2026-10-04', '2026-10-04', '00:00', '23:59')!;
    expect(w.start.toISOString()).toBe('2026-10-03T18:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-10-04T18:00:00.000Z');
  });
  it('rejects an end before the start', () => {
    expect(() => exactWindow('2026-10-04', '2026-10-04', '18:00', '09:00')).toThrow();
  });
});
