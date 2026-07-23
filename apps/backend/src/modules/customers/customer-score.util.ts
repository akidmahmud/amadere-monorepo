// F(requency)/M(onetary) scoring for the admin Customer Management table's
// "F Score"/"M Score"/"RFM Score" columns. The reference design renders
// these as read-only badges (not editable selects/inputs like Priority or
// Behaviour), so they're a computed metric, not manual data entry.
//
// ponytail: fixed BDT/order-count thresholds, not per-tenant quintiles —
// there's no real distribution-analysis spec for this yet. Upgrade path:
// replace with a quintile computed from the live customer base once there's
// an actual business definition for the buckets.
function bucket(value: number, thresholds: readonly [number, number, number, number]): number {
  const [t2, t3, t4, t5] = thresholds;
  if (value >= t5) return 5;
  if (value >= t4) return 4;
  if (value >= t3) return 3;
  if (value >= t2) return 2;
  return 1;
}

export function frequencyScore(completedOrderCount: number): number {
  return bucket(completedOrderCount, [5, 15, 30, 50]);
}

export function monetaryScore(lifetimeSpend: number): number {
  return bucket(lifetimeSpend, [1000, 5000, 15000, 30000]);
}

export function rfmScore(fScore: number, mScore: number): string {
  return `${fScore}${mScore}`;
}
