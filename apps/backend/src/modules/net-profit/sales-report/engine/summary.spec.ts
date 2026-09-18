import { calcOrder } from './calc';
import { DEMO_EXCEL_DAY, DEMO_TODAY, demoSettings } from './demo.fixture';
import { diffDays, flagsOf, summarize } from './summary';

const S = demoSettings();
const day = DEMO_EXCEL_DAY.map((o) => calcOrder(o, S));

describe("summarize — the demo's 01/08 Excel day", () => {
  const s = summarize(day, S);

  it('reproduces the reconciled contribution of ৳3,438', () => {
    expect(Math.round(s.contrib)).toBe(3438);
  });

  it('matches every other headline figure the demo shows', () => {
    expect(s).toMatchObject({
      n: 19,
      net: 10965,
      deliveryPaid: 1109,
      courierCost: 2555,
      cogs: 5951,
      retLoss: 130,
      subsidy: 1446,
      overN: 12,
      dN: 15,
      rN: 1,
      cN: 0,
      missing: 0,
      est: 0,
      newN: 10,
      repN: 9,
      aov: 731,
      lossRate: 0.0625,
    });
    expect(s.st).toEqual({
      Pending: 1,
      Confirmed: 2,
      Shipped: 0,
      Delivered: 15,
      Returned: 1,
      Cancelled: 0,
    });
    expect(s.overPos).toBeCloseTo(330.85, 2);
    expect(s.margin).toBeCloseTo(0.31354, 4);
  });
});

describe('flagsOf', () => {
  it('raises exactly the flags the demo raises on 01/08, as of 07/08', () => {
    const flagged = day
      .map((c) => [
        c.o.orderNumber.slice(-6),
        flagsOf(c, S, DEMO_TODAY).join('|'),
      ])
      .filter(([, f]) => f);
    expect(flagged).toEqual([
      ['D56503', 'stuck'],
      ['D56504', 'stuck'],
      ['D56505', 'over|unconf'],
      ['D56506', 'nocourier'],
      ['D56507', 'stuck'],
      ['D56508', 'over'],
      ['D56511', 'low|over'],
      ['D56512', 'over'],
      ['D56513', 'over'],
      ['D56514', 'over'],
      ['D56516', 'over'],
      ['D56517', 'over|unconf'],
      ['D56518', 'low|over'],
      ['D56519', 'over'],
      ['D56520', 'over|unconf'],
      ['D56521', 'over|unconf'],
    ]);
  });

  it('flags a delivered order with a missing cost as nocost, not loss', () => {
    const base = DEMO_EXCEL_DAY[11];
    const c = calcOrder(
      { ...base, lines: base.lines.map((l) => ({ ...l, unitCost: null })) },
      S,
    );
    expect(flagsOf(c, S, DEMO_TODAY)).toContain('nocost');
    expect(flagsOf(c, S, DEMO_TODAY)).not.toContain('loss');
  });

  // Real data (not the demo's): delivered with no courier and no bill, so the
  // courier charge is unknown. That is a courier problem, not a missing cost.
  it('a delivered order with no courier is flagged nocourier, not nocost', () => {
    const base = DEMO_EXCEL_DAY[11];
    const c = calcOrder({ ...base, courier: null, actual: null }, S);
    expect(c.contribution).toBeNull();
    const flags = flagsOf(c, S, DEMO_TODAY);
    expect(flags).toContain('nocourier');
    expect(flags).not.toContain('nocost');
  });

  it('flags a delivered order still on its estimate after the bill threshold', () => {
    const base = DEMO_EXCEL_DAY[11]; // delivered 03/08
    const c = calcOrder({ ...base, actual: null }, S);
    expect(flagsOf(c, S, DEMO_TODAY)).toContain('nobill');
  });
});

describe('diffDays', () => {
  it('counts whole days between two dates', () => {
    expect(diffDays('2026-08-01', '2026-08-07')).toBe(6);
  });
});
