// Variant weights are stored in kg; staff type a custom one in grams.

const WEIGHT = /^\s*(\d+(?:\.\d+)?)\s*(g|gm|gram|grams|kg|ml|l|ltr|litre|liter)\s*$/i;

/** "500 gram" / "1KG" / "2 Ltr" / "500 ML" → kg (ml/l ≈ kg). null = not a weight. */
export function labelToKg(label: string): number | null {
  const m = WEIGHT.exec(label);
  if (!m) return null;
  const n = Number(m[1]);
  return /^(kg|l|ltr|litre|liter)$/i.test(m[2]) ? n : n / 1000;
}

/** 750 → "750 gram", 1500 → "1.5KG" (matches the existing value names). */
export function gramsLabel(grams: number): string {
  return grams < 1000 ? `${grams} gram` : `${grams / 1000}KG`;
}

/** A solid weight value equal to `grams` ("1000 gram" finds "1KG"; "1 Ltr" doesn't). */
export function findGramsValue<T extends { label: string }>(
  values: T[],
  grams: number,
): T | undefined {
  return values.find(
    (v) =>
      !/(ml|l|ltr|litre|liter)\s*$/i.test(v.label) &&
      labelToKg(v.label) === grams / 1000,
  );
}
