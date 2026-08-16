import type { CostPriceUnit } from "@/hooks/useProducts";

// How many of costPriceUnit's unit fit in one of the variant's own "Weight"
// field — that field means kilograms for the weight units (PER_KG etc.) and
// is reused to mean liters for the volume units (PER_LITER/PER_ML), since
// weight and volume aren't the same physical quantity and there's no single
// conversion between them. A "2 Ltr" oil variant just enters 2 there.
const UNITS_PER_FIELD_VALUE: Record<CostPriceUnit, number> = {
  PER_KG: 1,
  PER_100G: 10,
  PER_G: 1000,
  PER_LITER: 1,
  PER_ML: 1000,
};

// costPerItem is a flat, absolute cost UNLESS costPriceUnit is set, in which
// case it's a rate per that unit and must be scaled by the variant's own
// "Weight" field to get its real cost — see Product.costPriceUnit's schema
// comment for why (a single flat cost silently produced negative "profit" on
// a 2kg variant priced against a 1kg-denominated cost, since 2x the product
// costs 2x to buy).
//
// Returns undefined when there isn't enough information to compute a real
// number (no cost entered, or per-unit mode is on but this variant has no
// Weight set) — callers render that as "—", never guess a number here.
export function computeVariantCost(
  costPerItem: number | undefined,
  costPriceUnit: CostPriceUnit | null | undefined,
  weightFieldValue: number | undefined | null,
): number | undefined {
  if (costPerItem === undefined) return undefined;
  if (!costPriceUnit) return costPerItem;
  if (weightFieldValue == null) return undefined;
  return costPerItem * (weightFieldValue * UNITS_PER_FIELD_VALUE[costPriceUnit]);
}

export const COST_PRICE_UNIT_LABELS: Record<CostPriceUnit, string> = {
  PER_KG: "per kg",
  PER_100G: "per 100g",
  PER_G: "per gram",
  PER_LITER: "per liter",
  PER_ML: "per ml",
};
