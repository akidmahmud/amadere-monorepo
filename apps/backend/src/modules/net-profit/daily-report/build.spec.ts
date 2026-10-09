import { buildSnapshot, fixedCostValue } from './build';
import { FIXTURE_INPUT } from './fixture';

describe('buildSnapshot', () => {
  const s = buildSnapshot(FIXTURE_INPUT);
  const block = (key: string) => s.sources.find((b) => b.key === key)!;

  it('keeps settings order and drops disabled sources', () => {
    expect(s.sources.map((b) => b.key)).toEqual([
      'WEB_DIRECT',
      'WHATSAPP',
      'WHOLESALE',
      'SHOP',
    ]);
    expect(s.orderIds).toEqual([1, 2, 3]);
    expect(s.wholesaleOrderIds).toEqual([101]);
  });

  it('groups lines per product, heaviest first, and flags missing cost', () => {
    const web = block('WEB_DIRECT');
    expect(web.products).toEqual([
      {
        key: 'p1',
        name: 'Jober Atta',
        sku: null,
        qty: 3,
        sales: 610,
        avg: 203.33,
        costPerKg: 150,
        cost: 450,
        profit: 160,
        estimated: 0,
      },
      {
        key: 'p2',
        name: 'Pink Salt',
        sku: null,
        qty: 0.5,
        sales: 200,
        avg: 400,
        costPerKg: 0,
        cost: 0,
        profit: 200,
        estimated: 1,
      },
    ]);
    expect(web.subtotal).toEqual({
      qty: 3.5,
      sales: 810,
      avg: 231.43,
      cost: 450,
      delivery: 130,
      profit: 360,
    });
    expect(web.net).toBe(230);
    expect(s.estimatedLines).toBe(1);
  });

  it('applies a source-scoped fixed cost to that source only', () => {
    const wa = block('WHATSAPP');
    expect(wa.fixedCosts).toEqual([
      {
        id: 'c4',
        name: 'Call staff',
        type: 'PER_DAY',
        amount: 100,
        value: 100,
      },
    ]);
    expect(wa.net).toBe(-80);
  });

  it('keeps an enabled source with no orders when it carries a fixed cost', () => {
    const shop = block('SHOP');
    expect(shop.products).toEqual([]);
    expect(shop.subtotal).toEqual({
      qty: 0,
      sales: 0,
      avg: 0,
      cost: 0,
      delivery: 0,
      profit: 0,
    });
    expect(shop.fixedCosts[0].value).toBe(1000);
    expect(shop.net).toBe(-1000);
  });

  it('computes the grand total, report costs and net profit', () => {
    expect(s.grandTotal).toEqual({
      qty: 16.5,
      sales: 3610,
      avg: 218.79,
      cost: 2700,
      delivery: 260,
      profit: 910,
    });
    expect(s.reportFixedCosts.map((c) => [c.name, c.value])).toEqual([
      ['Marketing & Inhouse', 500],
      ['VAT', 180.5],
    ]);
    expect(s.netProfit).toBe(-1130.5);
  });

  it('drops an enabled source with no orders and no fixed cost', () => {
    const t = buildSnapshot({ ...FIXTURE_INPUT, fixedCosts: [] });
    expect(t.sources.map((b) => b.key)).toEqual([
      'WEB_DIRECT',
      'WHATSAPP',
      'WHOLESALE',
    ]);
  });

  it('empty day → zero report, not a crash', () => {
    const t = buildSnapshot({ ...FIXTURE_INPUT, orders: [], fixedCosts: [] });
    expect(t.sources).toEqual([]);
    expect(t.netProfit).toBe(0);
    expect(t.grandTotal.avg).toBe(0);
  });
});

describe('fixedCostValue', () => {
  const base = { id: 'x', name: 'x', scope: 'REPORT' as const, active: true };
  it('PER_MONTH splits each day by its own month length', () => {
    const v = fixedCostValue(
      { ...base, type: 'PER_MONTH', amount: 30000 },
      {
        days: ['2026-09-30', '2026-10-01'],
        sales: 0,
        marketing: 0,
      },
    );
    expect(v).toBeCloseTo(1000 + 30000 / 31, 6);
  });
  it('PER_DAY multiplies by the number of days', () => {
    expect(
      fixedCostValue(
        { ...base, type: 'PER_DAY', amount: 250 },
        { days: ['a', 'b', 'c'], sales: 0, marketing: 0 },
      ),
    ).toBe(750);
  });
  it('MARKETING_LEDGER ignores amount', () => {
    expect(
      fixedCostValue(
        { ...base, type: 'MARKETING_LEDGER', amount: 9 },
        { days: ['a'], sales: 0, marketing: 42 },
      ),
    ).toBe(42);
  });
});

describe('buildSnapshot — arithmetic identities', () => {
  const s = buildSnapshot(FIXTURE_INPUT);
  const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;

  it('each row: profit = sales − cost; avg = sales / kg; cost/kg = cost / kg', () => {
    for (const b of s.sources)
      for (const p of b.products) {
        expect(p.profit).toBe(r2(p.sales - p.cost));
        if (p.qty) {
          expect(p.avg).toBe(r2(p.sales / p.qty));
          expect(p.costPerKg).toBe(r2(p.cost / p.qty));
        }
      }
  });

  it('each source total is the sum of its rows; net = profit − delivery − its fixed costs', () => {
    for (const b of s.sources) {
      expect(b.subtotal.sales).toBe(r2(sum(b.products.map((p) => p.sales))));
      expect(b.subtotal.cost).toBe(r2(sum(b.products.map((p) => p.cost))));
      expect(b.subtotal.profit).toBe(r2(b.subtotal.sales - b.subtotal.cost));
      expect(b.net).toBe(
        r2(
          b.subtotal.profit -
            b.subtotal.delivery -
            sum(b.fixedCosts.map((f) => f.value)),
        ),
      );
    }
  });

  it('grand total = sum of sources; net profit = profit − delivery − ALL fixed costs', () => {
    const g = s.grandTotal;
    for (const k of ['sales', 'cost', 'delivery', 'profit'] as const)
      expect(g[k]).toBe(r2(sum(s.sources.map((b) => b.subtotal[k]))));
    const allFixed = sum(
      [...s.sources.flatMap((b) => b.fixedCosts), ...s.reportFixedCosts].map(
        (f) => f.value,
      ),
    );
    expect(s.netProfit).toBe(r2(g.profit - g.delivery - allFixed));
  });
});

describe('buildSnapshot — SKU', () => {
  it('a product row carries its SKU (first one seen)', () => {
    const s = buildSnapshot({
      ...FIXTURE_INPUT,
      fixedCosts: [],
      orders: [
        {
          id: 1,
          wholesale: false,
          source: 'WEB_DIRECT',
          delivery: 0,
          lines: [
            {
              key: 'p1',
              name: 'Jober Atta',
              sku: 'ATTA-01',
              kg: 1,
              sales: 100,
              cost: 50,
            },
          ],
        },
        {
          id: 2,
          wholesale: false,
          source: 'WEB_DIRECT',
          delivery: 0,
          lines: [
            {
              key: 'p1',
              name: 'Jober Atta',
              sku: null,
              kg: 1,
              sales: 100,
              cost: 50,
            },
            { key: 'p2', name: 'Pink Salt', kg: 1, sales: 80, cost: 40 },
          ],
        },
      ],
    });
    const rows = s.sources[0].products;
    expect(rows.find((r) => r.key === 'p1')?.sku).toBe('ATTA-01');
    expect(rows.find((r) => r.key === 'p2')?.sku).toBeNull();
  });
});
