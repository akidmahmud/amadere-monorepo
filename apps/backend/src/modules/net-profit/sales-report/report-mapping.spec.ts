import { Prisma } from '@amader/db';
import {
  historyDates,
  spreadDiscount,
  toReportOrder,
  toReportStatus,
} from './report-mapping';

const D = (v: number) => new Prisma.Decimal(v);

describe('toReportStatus', () => {
  it("maps our statuses onto the report's six (spec D7)", () => {
    expect(toReportStatus('HOLD')).toBe('Confirmed');
    expect(toReportStatus('PROCESSING')).toBe('Shipped');
    expect(toReportStatus('COMPLETED')).toBe('Delivered');
    expect(toReportStatus('PARTIALLY_RETURNED')).toBe('Returned');
    expect(toReportStatus('CANCELED')).toBe('Cancelled');
  });
});

describe('spreadDiscount', () => {
  it('spreads the order discount by line value and sums back exactly', () => {
    expect(spreadDiscount([300, 100], 40)).toEqual([30, 10]);
    const parts = spreadDiscount([100, 100, 100], 10);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(10, 10);
  });
});

describe('historyDates', () => {
  it('uses the first entry into each status, in Dhaka dates', () => {
    const h = historyDates(
      [
        { status: 'CONFIRMED', createdAt: new Date('2026-08-01T05:00:00Z') },
        { status: 'PROCESSING', createdAt: new Date('2026-08-01T19:00:00Z') }, // 02/08 in Dhaka
        { status: 'COMPLETED', createdAt: new Date('2026-08-03T05:00:00Z') },
        { status: 'COMPLETED', createdAt: new Date('2026-08-05T05:00:00Z') },
      ],
      null,
    );
    expect(h).toEqual({
      confirmed: '2026-08-01',
      shipped: '2026-08-02',
      delivered: '2026-08-03',
    });
  });
});

describe('toReportOrder', () => {
  const zones = {
    zones: [
      { name: { en: 'Inside Dhaka', bn: '' }, fee: 80, districts: ['Dhaka'] },
    ],
    fallback: { name: { en: 'Outside Dhaka', bn: '' }, fee: 120 },
  };
  const resolver = {
    resolve: jest.fn().mockReturnValue({ unitCost: 180, ok: true }),
  };
  const row = {
    id: 5,
    orderNumber: 'AM-5',
    status: 'COMPLETED',
    channel: 'FACEBOOK',
    customerId: 9,
    createdAt: new Date('2026-08-01T04:00:00Z'),
    confirmedAt: null,
    shippingAmount: D(100),
    discountAmount: D(0),
    assignedAdmin: { id: 3, firstName: 'Jami', lastName: '' },
    addresses: [
      { recipientName: 'Limon', phone: '8801800000000', district: 'Dhaka' },
    ],
    items: [
      {
        productId: 1,
        variantId: null,
        productNameSnapshot: 'Jober Atta',
        unitPrice: D(350),
        quantity: 2,
        variant: null,
        product: { shippableWeight: D(1) },
      },
    ],
    statusHistory: [
      { status: 'COMPLETED', createdAt: new Date('2026-08-02T04:00:00Z') },
    ],
    shipments: [{ provider: 'STEADFAST', billedCharge: D(130) }],
    payments: [],
    advancePayment: null,
  };

  it('builds the engine input', () => {
    const o = toReportOrder(row as never, {
      resolver,
      zones,
      firstOrderAt: new Map([['c:9', new Date('2026-08-01T04:00:00Z')]]),
    });
    expect(o).toMatchObject({
      id: 5,
      orderNumber: 'AM-5',
      date: '2026-08-01',
      status: 'Delivered',
      channel: 'Facebook',
      agentId: 3,
      agentName: 'Jami',
      customer: 'Limon',
      ctype: 'New',
      district: 'Dhaka',
      zone: 'Inside Dhaka',
      delivery: 100,
      payment: 'COD',
      advance: 0,
      courier: 'STEADFAST',
      actual: 130,
      hist: { delivered: '2026-08-02' },
    });
    expect(o.lines[0]).toMatchObject({
      key: 'p1',
      qty: 2,
      price: 350,
      disc: 0,
      unitWeight: 1,
      unitCost: 180,
      costOk: true,
    });
  });

  it('marks a later order of the same customer as Repeat and a missing cost as null', () => {
    resolver.resolve.mockReturnValueOnce(null);
    const o = toReportOrder(row as never, {
      resolver,
      zones,
      firstOrderAt: new Map([['c:9', new Date('2026-07-01T00:00:00Z')]]),
    });
    expect(o.ctype).toBe('Repeat');
    expect(o.lines[0].unitCost).toBeNull();
  });
});
