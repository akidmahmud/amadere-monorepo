import { lineUnitCost } from './order-manager.service';

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
