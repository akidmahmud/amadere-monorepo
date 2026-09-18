import { Prisma } from '@amader/db';
import { csvLineCells, lineUnitCost } from './order-csv';

// The CSV's Cost / kg and Cost Value columns come from this.
describe('lineUnitCost', () => {
  it('prefers the variant cost over the product cost', () => {
    expect(lineUnitCost(120, 999, 'PER_KG', 0.5)).toBe(120);
  });

  it('uses a flat product cost as-is', () => {
    expect(lineUnitCost(null, 300, null, 0.5)).toBe(300);
  });

  it('scales a per-kg / per-100g product rate by the line weight', () => {
    expect(lineUnitCost(null, 800, 'PER_KG', 0.5)).toBe(400);
    expect(lineUnitCost(null, 80, 'PER_100G', 0.5)).toBe(400);
  });

  it('is null when no cost exists, or a rate has no weight to scale by', () => {
    expect(lineUnitCost(null, null, null, 1)).toBeNull();
    expect(lineUnitCost(null, 800, 'PER_KG', 0)).toBeNull();
  });
});

describe('csvLineCells', () => {
  const D = (v: string) => new Prisma.Decimal(v);

  it('expresses a weighted line per kg, cost beside price', () => {
    expect(
      csvLineCells({
        unitPrice: D('790'),
        quantity: 2,
        skuSnapshot: null,
        variant: {
          weightOverride: D('0.5'),
          sku: 'V-1',
          costPerItem: D('500'),
        },
        product: null,
      }),
    ).toEqual(['V-1', '1', '1580.00', '1000.00', '1580.00', '1000.00']);
  });

  it('falls back to plain units without a weight, blank cost without one', () => {
    expect(
      csvLineCells({
        unitPrice: D('100'),
        quantity: 3,
        skuSnapshot: 'S',
        variant: null,
        product: {
          shippableWeight: null,
          sku: null,
          costPerItem: null,
          costPriceUnit: null,
        },
      }),
    ).toEqual(['S', '3', '100.00', '', '300.00', '']);
  });
});
