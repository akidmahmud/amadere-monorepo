/** Days before expiry when a batch counts as "expiring soon". */
// ponytail: fixed at the owner's 15 days; move to POS Settings if it varies.
export const EXPIRY_ALERT_DAYS = 15;

/** A delivery into a store: stock in, opening stock or a transfer in. */
export interface Delivery {
  at: Date;
  qty: number;
  /** YYYY-MM-DD, or null when none was entered. */
  expiry: string | null;
}

export interface ShelfBatch {
  /** When it came in; null = stock older than any recorded delivery. */
  entryDate: Date | null;
  expiry: string | null;
  qty: number;
}

export type ExpiryStatus = 'Expired' | 'Expiring soon' | 'OK' | 'No expiry';

/**
 * Which deliveries are still on the shelf, assuming the oldest stock is sold
 * first (FIFO): the units on hand are the most recently received ones.
 * Anything left over beyond the recorded deliveries is old stock with no
 * known entry or expiry. `deliveries` may be in any order.
 */
export function shelfBatches(onHand: number, deliveries: Delivery[]): ShelfBatch[] {
  let left = Math.max(0, onHand);
  const out: ShelfBatch[] = [];
  for (const d of [...deliveries].sort((a, b) => b.at.getTime() - a.at.getTime())) {
    if (left <= 0) break;
    const qty = Math.min(left, d.qty);
    if (qty <= 0) continue;
    out.push({ entryDate: d.at, expiry: d.expiry, qty });
    left -= qty;
  }
  if (left > 0) out.push({ entryDate: null, expiry: null, qty: left });
  return out;
}

/** Whole days from `today` to `expiry` (both YYYY-MM-DD); negative = past. */
export function daysLeft(expiry: string, today: string): number {
  return Math.round(
    (Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86_400_000,
  );
}

export function expiryStatus(expiry: string | null, today: string): ExpiryStatus {
  if (!expiry) return 'No expiry';
  const d = daysLeft(expiry, today);
  return d < 0 ? 'Expired' : d <= EXPIRY_ALERT_DAYS ? 'Expiring soon' : 'OK';
}

/** The soonest expiry among the batches on the shelf (till card tag). */
export function soonestExpiry(batches: ShelfBatch[]): string | null {
  const dates = batches.flatMap((b) => (b.expiry ? [b.expiry] : [])).sort();
  return dates[0] ?? null;
}
