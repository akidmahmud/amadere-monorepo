import { dhakaDate, dhakaDayStart } from '../product-cost-history/dhaka-date';

const DAY_MS = 86_400_000;

/**
 * [from, to] as Dhaka calendar days → a UTC instant range for queries.
 * The server runs on UTC; server-local midnight would put 00:00–06:00 Dhaka
 * sales on the previous day. Omitted days mean today in Dhaka.
 */
export function dhakaRange(
  from?: string,
  to?: string,
  now = new Date(),
): { gte: Date; lt: Date } {
  const today = dhakaDate(now);
  return {
    gte: dhakaDayStart(from ?? today),
    lt: new Date(dhakaDayStart(to ?? from ?? today).getTime() + DAY_MS),
  };
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Like dhakaRange, narrowed by optional Dhaka clock times: fromTime on the
 * first day, toTime (inclusive, to the minute) on the last. Nothing given =
 * no limit (undefined), for "all time" lists.
 */
export function dhakaTimeRange(
  q: { from?: string; to?: string; fromTime?: string; toTime?: string },
  now = new Date(),
): { gte: Date; lt: Date } | undefined {
  if (!q.from && !q.to && !q.fromTime && !q.toTime) return undefined;
  const r = dhakaRange(q.from, q.to ?? q.from, now);
  return {
    gte: q.fromTime
      ? new Date(r.gte.getTime() + minutesOf(q.fromTime) * 60_000)
      : r.gte,
    lt: q.toTime
      ? new Date(r.lt.getTime() - DAY_MS + (minutesOf(q.toTime) + 1) * 60_000)
      : r.lt,
  };
}
