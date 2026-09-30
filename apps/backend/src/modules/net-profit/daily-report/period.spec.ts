import { autoName, daysInMonth, periodDays, validateManual } from './period';

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
