/** Pure helpers for POS customer tiers and SMS text (no I/O; unit-tested). */

export interface PosTier {
  key: string;
  name: string;
  /** Reached with this many purchases at a store (0 = not by count). */
  minOrders: number;
  /** …or this much spent at a store, ৳ (0 = not by spend). */
  minSpent: number;
  color: string;
}

export interface TierStats {
  orders: number;
  spent: number;
}

/**
 * Highest tier the customer qualifies for, tiers listed lowest → highest.
 * A tier is reached by purchases OR spend; a tier with neither threshold is
 * the starting tier everyone has.
 */
export function tierFor(stats: TierStats, tiers: PosTier[]): PosTier | null {
  for (let i = tiers.length - 1; i >= 0; i--) {
    const t = tiers[i];
    const byOrders = t.minOrders > 0 && stats.orders >= t.minOrders;
    const bySpent = t.minSpent > 0 && stats.spent >= t.minSpent;
    if (byOrders || bySpent || (t.minOrders <= 0 && t.minSpent <= 0))
      return t;
  }
  return null;
}

export const tierRank = (t: PosTier | null, tiers: PosTier[]) =>
  t ? tiers.findIndex((x) => x.key === t.key) : -1;

/** {{tag}} → value; unknown tags become empty (a customer never sees "{{x}}"). */
export function renderSms(
  template: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => String(vars[k] ?? ''))
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Next run of a recurring campaign, same clock time. */
export function nextRun(from: Date, repeat: string): Date {
  const d = new Date(from);
  if (repeat === 'DAILY') d.setUTCDate(d.getUTCDate() + 1);
  else if (repeat === 'WEEKLY') d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/** "Gold Plus!" → "gold-plus". */
export const tierKeyOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tier';

export const DEFAULT_TIERS: PosTier[] = [
  { key: 'regular', name: 'Regular', minOrders: 0, minSpent: 0, color: '#6b7280' },
  { key: 'silver', name: 'Silver', minOrders: 5, minSpent: 5000, color: '#64748b' },
  { key: 'gold', name: 'Gold', minOrders: 10, minSpent: 20000, color: '#b7791f' },
  { key: 'platinum', name: 'Platinum', minOrders: 25, minSpent: 50000, color: '#1d7a46' },
];
