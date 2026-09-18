// Asia/Dhaka is UTC+6 all year (no DST), so a fixed offset is exact.
const OFFSET_MS = 6 * 60 * 60 * 1000;

/** The calendar day in Dhaka, YYYY-MM-DD. */
export function dhakaDate(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** 00:00:00.000 Dhaka on `day`, as a UTC instant. */
export function dhakaDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) - OFFSET_MS);
}

/** 23:59:59.999 Dhaka on `day`, as a UTC instant. */
export function dhakaDayEnd(day: string): Date {
  return new Date(Date.parse(`${day}T23:59:59.999Z`) - OFFSET_MS);
}
