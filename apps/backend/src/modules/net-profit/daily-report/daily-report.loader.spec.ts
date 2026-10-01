import { DailyReportLoader } from './daily-report.loader';

const item = (over: Record<string, unknown> = {}) => ({
  productId: 5,
  variantId: null,
  productNameSnapshot: 'Atta',
  unitPrice: 200,
  quantity: 2,
  restockedQuantity: 0,
  variant: null,
  product: { shippableWeight: 1 },
  ...over,
});

const order = (over: Record<string, unknown> = {}) => ({
  id: 1,
  channel: 'POS',
  utmSource: null,
  referrerDomain: null,
  createdAt: new Date('2026-09-30T06:00:00Z'),
  discountAmount: 0,
  posRefundedAmount: 0,
  addresses: [],
  shipments: [],
  items: [item()],
  ...over,
});

function make(retail: unknown[], wholesale: unknown[] = []) {
  const prisma = {
    client: {
      order: { findMany: jest.fn().mockResolvedValue(retail) },
      wholesaleOrder: { findMany: jest.fn().mockResolvedValue(wholesale) },
      productVariant: { findMany: jest.fn().mockResolvedValue([]) },
    },
  };
  // ৳100 per unit for every line.
  const costs = {
    loadResolver: jest.fn().mockResolvedValue({
      resolve: () => ({ unitCost: 100, ok: true }),
    }),
  };
  const shippingRules = {
    getConfig: jest.fn().mockResolvedValue({ rules: [] }),
  };
  return new DailyReportLoader(
    prisma as never,
    costs as never,
    shippingRules as never,
  );
}

describe('DailyReportLoader', () => {
  it('POS partial return: only the kept quantity counts (refund incl. VAT is not subtracted)', async () => {
    // 2 × ৳200 ex-VAT, one returned; the refund of ৳230 carries 15% VAT.
    const [o] = await make([
      order({
        posRefundedAmount: 230,
        items: [item({ restockedQuantity: 1 })],
      }),
    ]).load('2026-09-30', '2026-09-30');
    expect(o.lines).toEqual([
      { key: 'p5', name: 'Atta', kg: 1, sales: 200, cost: 100 },
    ]);
    expect(o.delivery).toBe(0);
  });

  it('POS full return: the line leaves the report', async () => {
    const [o] = await make([
      order({
        posRefundedAmount: 460,
        items: [item({ restockedQuantity: 2 })],
      }),
    ]).load('2026-09-30', '2026-09-30');
    expect(o.lines).toEqual([]);
  });

  it('POS discount is spread on the kept share only', async () => {
    const [o] = await make([
      order({ discountAmount: 40, items: [item({ restockedQuantity: 1 })] }),
    ]).load('2026-09-30', '2026-09-30');
    expect(o.lines[0].sales).toBe(180); // (400 − 40) × 1/2
  });

  it('website orders ignore restockedQuantity (spec D1: placed = sold)', async () => {
    const [o] = await make([
      order({ channel: 'WEBSITE', items: [item({ restockedQuantity: 1 })] }),
    ]).load('2026-09-30', '2026-09-30');
    expect(o.lines[0]).toMatchObject({ kg: 2, sales: 400, cost: 200 });
  });

  it('wholesale delivery is a pass-through (customer pays it), so it costs 0', async () => {
    const w = {
      id: 9,
      type: 'WHOLESALE',
      channelId: null,
      placedAt: new Date('2026-09-30T00:00:00Z'),
      discount: 0,
      deliveryCharge: 140,
      items: [
        {
          productId: 5,
          variantId: null,
          nameSnapshot: 'Atta',
          quantity: 3,
          lineTotal: 600,
          product: { shippableWeight: 1 },
        },
      ],
    };
    const [o] = await make([], [w]).load('2026-09-30', '2026-09-30');
    expect(o).toMatchObject({
      wholesale: true,
      source: 'WHOLESALE',
      delivery: 0,
    });
    expect(o.lines[0]).toMatchObject({ kg: 3, sales: 600, cost: 300 });
  });
  it('reads retail orders in the 8 PM → 8 PM business window', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const loader = new DailyReportLoader(
      {
        client: {
          order: { findMany },
          wholesaleOrder: { findMany: jest.fn().mockResolvedValue([]) },
          productVariant: { findMany: jest.fn().mockResolvedValue([]) },
        },
      } as never,
      {
        loadResolver: jest.fn().mockResolvedValue({ resolve: () => null }),
      } as never,
      { getConfig: jest.fn().mockResolvedValue({ rules: [] }) } as never,
    );
    await loader.load('2026-10-02', '2026-10-02');
    const [args] = findMany.mock.calls[0] as [
      { where: { createdAt: unknown } },
    ];
    expect(args.where.createdAt).toEqual({
      gte: new Date('2026-10-01T14:00:00Z'),
      lt: new Date('2026-10-02T14:00:00Z'),
    });
  });
});
