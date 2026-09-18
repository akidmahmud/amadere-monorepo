import { calcOrder, rateFor } from './calc';
import { demoOrder, demoSettings } from './demo.fixture';

// Expected values were produced by running the demo's own engine
// (amadere-sales-report-demo.html) on the same orders.
describe('rateFor', () => {
  const rc = demoSettings().rates.Steadfast;
  it('charges the small rate up to smallMax, the first-kg rate up to 1 kg, then +extra per started kg', () => {
    expect(rateFor(rc, 'Inside Dhaka', 0.1)).toBe(80);
    expect(rateFor(rc, 'Inside Dhaka', 1)).toBe(105);
    expect(rateFor(rc, 'Inside Dhaka', 1.01)).toBe(125);
    expect(rateFor(rc, 'Inside Dhaka', 5)).toBe(185);
  });
  it('is null without a courier or a rate for the zone', () => {
    expect(rateFor(null, 'Inside Dhaka', 1)).toBeNull();
    expect(rateFor(rc, 'Mars', 1)).toBeNull();
  });
});

describe('calcOrder', () => {
  const S = demoSettings();

  it('delivered order: agreed charge, overcharge and contribution (D56505)', () => {
    const c = calcOrder(demoOrder('D56505'), S);
    expect(c).toMatchObject({
      netSales: 315,
      weight: 1,
      rate: 105,
      cod: 3.15,
      expected: 108.15,
      courierCharge: 145,
      overcharge: 36.85,
      cogs: 180,
      contribution: 70,
      subsidy: 65,
      receivable: 250,
      unconfirmed: true,
    });
  });

  it('5 kg parcel undercharged by 6 (D56509)', () => {
    const c = calcOrder(demoOrder('D56509'), S);
    expect(c).toMatchObject({
      weight: 5,
      rate: 185,
      cod: 16,
      expected: 201,
      overcharge: -6,
      contribution: 605,
    });
  });

  it('a return costs the courier charge and no product cost (D56521)', () => {
    const c = calcOrder(demoOrder('D56521'), S);
    expect(c).toMatchObject({
      expected: 105,
      courierCharge: 130,
      contribution: -130,
      receivable: -130,
    });
  });

  it('an order not shipped yet has no courier charge and no contribution (D56503)', () => {
    const c = calcOrder(demoOrder('D56503'), S);
    expect(c).toMatchObject({
      shipped: false,
      courierCharge: 0,
      contribution: null,
      estimated: false,
    });
  });

  it('a shipped order with no bill uses the estimate and says so', () => {
    const o = { ...demoOrder('D56512'), actual: null };
    const c = calcOrder(o, S);
    expect(c.estimated).toBe(true);
    expect(c.courierCharge).toBe(c.expected);
  });

  it('a missing line cost leaves contribution null but keeps the subsidy', () => {
    const base = demoOrder('D56512');
    const o = {
      ...base,
      lines: base.lines.map((l) => ({ ...l, unitCost: null })),
    };
    const c = calcOrder(o, S);
    expect(c.cogs).toBeNull();
    expect(c.contribution).toBeNull();
    expect(c.subsidy).not.toBeNull();
  });
});
