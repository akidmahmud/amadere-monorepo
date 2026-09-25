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
