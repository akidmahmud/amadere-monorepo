const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Real calendar date? "2026-02-30" parses to Mar 2, so round-trip it. */
const isDay = (day: string) =>
  DAY_RE.test(day) &&
  !Number.isNaN(utc(day).getTime()) &&
  iso(utc(day)) === day;

export const MAX_RANGE_DAYS = 92;

export function periodDays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = utc(from).getTime(); t <= utc(to).getTime(); t += DAY_MS)
    out.push(iso(new Date(t)));
  return out;
}

export function daysInMonth(day: string): number {
  const [y, m] = day.split('-').map(Number);
  // Day 0 of the NEXT month (m is 1-based, Date.UTC months are 0-based) = last day of m.
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "Daily – 30 Sep 2026". Hand-formatted: ICU's en-GB short month is "Sept". */
export function autoName(day: string): string {
  const d = utc(day);
  return `Daily – ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function validateManual(
  name: string,
  from: string,
  to: string,
  today: string,
): string {
  const n = (name ?? '').trim();
  if (!n) throw new Error('Give the report a name.');
  if (n.length > 120) throw new Error('Name is too long (120 characters max).');
  if (!isDay(from) || !isDay(to))
    throw new Error('Dates must be real dates (YYYY-MM-DD).');
  if (from > to) throw new Error('"From" must be on or before "To".');
  if (to > today) throw new Error('"To" cannot be in the future.');
  if (periodDays(from, to).length > MAX_RANGE_DAYS)
    throw new Error(`A report can cover at most ${MAX_RANGE_DAYS} days.`);
  return n;
}
