/**
 * Each line's total after its share of the order discount, split EQUALLY
 * between the lines in whole taka, with the last line taking what is left:
 * 100 / 200 / 400 with ৳10 off → shares 3, 3, 4 → 97, 197, 396 (= 690).
 * A percentage discount is already a taka amount on the order, so it splits
 * the same way. The lines always add up to Σ lines − discount.
 * ponytail: equal split as the owner asked; a share can exceed a very cheap
 * line (shown negative) — split by value instead if that ever matters.
 */
export function afterDiscount(lineTotals: number[], discount: number): number[] {
  const n = lineTotals.length;
  if (!(discount > 0) || n === 0) return lineTotals;
  const share = Math.floor(discount / n);
  const last = Math.round((discount - share * (n - 1)) * 100) / 100;
  return lineTotals.map((t, i) =>
    Math.round((t - (i === n - 1 ? last : share)) * 100) / 100,
  );
}
