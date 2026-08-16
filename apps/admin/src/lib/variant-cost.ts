import type { CostPriceUnit } from "@/hooks/useProducts";

// costPerItem is a flat, absolute cost UNLESS costPriceUnit is set, in which
// case it's a rate per that unit of weight and must be scaled by the
// variant's own weight (weightOverride, kilograms) to get its real cost —
// see Product.costPriceUnit's schema comment for why (a single flat cost
// silently produced negative "profit" on a 2kg variant priced against a
// 1kg-denominated cost, since 2x the product costs 2x to buy).
//
// Returns undefined when there isn't enough information to compute a real
// number (no cost entered, or per-weight mode is on but this variant has no
// weight set) — callers render that as "—", never guess a number here.
export function computeVariantCost(
  costPerItem: number | undefined,
  costPriceUnit: CostPriceUnit | null | undefined,
  weightOverrideKg: number | undefined | null,
): number | undefined {
  if (costPerItem === undefined) return undefined;
  if (!costPriceUnit) return costPerItem;
  if (weightOverrideKg == null) return undefined;
  const gramsPerUnit = costPriceUnit === "PER_KG" ? 1000 : costPriceUnit === "PER_100G" ? 100 : 1;
  return costPerItem * ((weightOverrideKg * 1000) / gramsPerUnit);
}

export const COST_PRICE_UNIT_LABELS: Record<CostPriceUnit, string> = {
  PER_KG: "per kg",
  PER_100G: "per 100g",
  PER_G: "per gram",
};
