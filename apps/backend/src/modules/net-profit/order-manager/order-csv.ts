import { CostPriceUnit, Prisma } from '@amader/db';

// Shared by the retail Order Manager export and the Wholesale orders export,
// so the two files open with the same columns and the same per-line maths.

export const ORDER_CSV_HEADER = [
  'Date',
  'Order Number',
  'Source',
  'Origin',
  'Customer Name',
  'Address',
  'Phone Number',
  'Consignment ID',
  'Product SKU',
  'Qty.',
  'Price / kg',
  'Cost / kg',
  'Invoice Value',
  'Cost Value',
  'Delivery Charge',
  'Discount',
  'Grand Total',
  'Order Status',
  'Payment Status',
  'Payment Method',
  'Notes / comment',
  'Assign',
  'Division',
  'District',
  'Created At',
];

// How many of a CostPriceUnit fit in one of the variant's "Weight" field
// values (kg, or liters for the volume units) — mirrors admin's variant-cost.ts.
const UNITS_PER_WEIGHT: Record<CostPriceUnit, number> = {
  PER_KG: 1,
  PER_100G: 10,
  PER_G: 1000,
  PER_LITER: 1,
  PER_ML: 1000,
};

/**
 * One line's buying cost per item, resolved the way the profit screens do:
 * the variant's own cost first, else the product's. A product cost with a
 * costPriceUnit is a rate (e.g. per kg) and is scaled by the line's weight;
 * with no weight to scale by there is no honest number, so null.
 */
export function lineUnitCost(
  variantCost: Prisma.Decimal | number | null | undefined,
  productCost: Prisma.Decimal | number | null | undefined,
  costPriceUnit: CostPriceUnit | null | undefined,
  weightKg: number,
): number | null {
  if (variantCost != null) return Number(variantCost);
  if (productCost == null) return null;
  if (!costPriceUnit) return Number(productCost);
  if (!(weightKg > 0)) return null;
  return Number(productCost) * weightKg * UNITS_PER_WEIGHT[costPriceUnit];
}

/** The Prisma `select` each export needs on its line's variant/product. */
export const CSV_LINE_VARIANT_SELECT = {
  weightOverride: true,
  sku: true,
  costPerItem: true,
} as const;
export const CSV_LINE_PRODUCT_SELECT = {
  shippableWeight: true,
  sku: true,
  costPerItem: true,
  costPriceUnit: true,
} as const;

export interface CsvLineInput {
  unitPrice: Prisma.Decimal | number;
  quantity: number;
  skuSnapshot: string | null;
  variant: {
    weightOverride: Prisma.Decimal | null;
    sku: string | null;
    costPerItem: Prisma.Decimal | null;
  } | null;
  product: {
    shippableWeight: Prisma.Decimal | null;
    sku: string | null;
    costPerItem: Prisma.Decimal | null;
    costPriceUnit: CostPriceUnit | null;
  } | null;
}

/**
 * [SKU, Qty., Price / kg, Cost / kg, Invoice Value, Cost Value] for one line.
 *
 * Quantity and price are expressed BY WEIGHT, matching the shop's sheet: a
 * 500 g pack sold at 790 appears as qty 0.5 at 1580 per kg. Weight comes from
 * the variant, falling back to the product; with neither the line falls back
 * to plain units rather than inventing a conversion. Cost sits beside price in
 * the same unit — current cost, not a snapshot, blank when none is entered.
 * A null line (an order with no items) yields blanks so the order still gets
 * its row.
 */
export function csvLineCells(item: CsvLineInput | null): string[] {
  if (!item) return ['', '', '', '', '', ''];
  const unit = Number(item.unitPrice);
  const weightKg = Number(
    item.variant?.weightOverride ?? item.product?.shippableWeight ?? 0,
  );
  const unitCost = lineUnitCost(
    item.variant?.costPerItem,
    item.product?.costPerItem,
    item.product?.costPriceUnit,
    weightKg,
  );
  const per = weightKg > 0 ? weightKg : 1;
  const qty =
    weightKg > 0
      ? String(Number((weightKg * item.quantity).toFixed(3)))
      : String(item.quantity);
  // SKU only, not the product name. The snapshot is empty on lines recorded
  // before it was captured, so fall back to the variant's then the product's.
  const sku = item.skuSnapshot || item.variant?.sku || item.product?.sku || '';
  return [
    sku,
    qty,
    (unit / per).toFixed(2),
    unitCost === null ? '' : (unitCost / per).toFixed(2),
    (unit * item.quantity).toFixed(2),
    unitCost === null ? '' : (unitCost * item.quantity).toFixed(2),
  ];
}

// dd/mm/yyyy and hh:mm:ss, matching the sheet rather than ISO.
const two = (n: number) => String(n).padStart(2, '0');
export const csvDate = (d: Date) =>
  `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
export const csvTime = (d: Date) =>
  `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;

export function toOrderCsv(rows: string[][]): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  return [ORDER_CSV_HEADER, ...rows]
    .map((r) => r.map(esc).join(','))
    .join('\n');
}
