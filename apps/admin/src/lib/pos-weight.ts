/**
 * Product weight/volume with a display unit. Stored as one base number:
 * kilograms for g/kg, litres for ml/L (≈ kg for courier weight).
 */
export type WeightUnit = "g" | "kg" | "ml" | "l";
export const WEIGHT_UNITS: { unit: WeightUnit; label: string }[] = [
  { unit: "g", label: "g" },
  { unit: "kg", label: "kg" },
  { unit: "ml", label: "ml" },
  { unit: "l", label: "L" },
];

const small = (u: WeightUnit) => u === "g" || u === "ml";
const round = (n: number) => Number(n.toFixed(3));

/** Typed value in `unit` → stored base number (kg or L). */
export const toBase = (value: number, unit: WeightUnit) =>
  round(small(unit) ? value / 1000 : value);

/** Stored base number → value to show in `unit`. */
export const fromBase = (base: number, unit: WeightUnit) =>
  round(small(unit) ? base * 1000 : base);

/** The unit to show a stored weight in: its own, else g below 1 kg. */
export const unitFor = (base: number, unit?: string | null): WeightUnit =>
  (["g", "kg", "ml", "l"].includes(unit ?? "")
    ? unit
    : base < 1
      ? "g"
      : "kg") as WeightUnit;

/** Receipt/till label: 0.5 kg → "500 g", 1.5 L → "1.5 L". null if none. */
export function formatWeight(
  base: string | number | null | undefined,
  unit?: string | null,
): string | null {
  const n = Number(base);
  if (base == null || base === "" || !Number.isFinite(n) || n <= 0) return null;
  const u = unitFor(n, unit);
  return `${fromBase(n, u)} ${u === "l" ? "L" : u}`;
}
