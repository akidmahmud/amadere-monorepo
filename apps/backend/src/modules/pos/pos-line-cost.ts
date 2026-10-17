import type { Prisma, CostPriceUnit } from '@amader/db';
import type {
  CostResolver,
  ProductCostHistoryService,
} from '../product-cost-history/product-cost-history.service';
import { lineUnitCost } from '../net-profit/order-manager/order-csv';

/** What a sold line needs for its cost (Prisma `select`s below). */
export interface CostLine {
  productId: number | null;
  variantId: number | null;
  product?: {
    shippableWeight: Prisma.Decimal | null;
    costPerItem: Prisma.Decimal | null;
    costPriceUnit: CostPriceUnit | null;
  } | null;
  variant?: {
    weightOverride: Prisma.Decimal | null;
    costPerItem: Prisma.Decimal | null;
  } | null;
}

export const COST_PRODUCT_SELECT = {
  shippableWeight: true,
  costPerItem: true,
  costPriceUnit: true,
} as const;
export const COST_VARIANT_SELECT = {
  weightOverride: true,
  costPerItem: true,
} as const;

/**
 * Unit cost of each sold line on its sale day, from the cost history (as the
 * website Sales report does); the product's current cost when it has none.
 * Returns "" when no cost is set.
 */
export async function lineCoster(
  costs: ProductCostHistoryService,
  lines: CostLine[],
): Promise<(line: CostLine, date: string) => string> {
  const resolver: CostResolver = await costs.loadResolver(
    [...new Set(lines.flatMap((i) => (i.productId ? [i.productId] : [])))],
    [...new Set(lines.flatMap((i) => (i.variantId ? [i.variantId] : [])))],
  );
  return (i, date) => {
    const kg = Number(
      i.variant?.weightOverride ?? i.product?.shippableWeight ?? 0,
    );
    const c =
      resolver.resolve(
        { productId: i.productId, variantId: i.variantId, unitWeightKg: kg },
        date,
      )?.unitCost ??
      lineUnitCost(
        i.variant?.costPerItem,
        i.product?.costPerItem,
        i.product?.costPriceUnit,
        kg,
      );
    return c === null || c === undefined ? '' : c.toFixed(2);
  };
}
