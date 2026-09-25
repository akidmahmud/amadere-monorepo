import { Prisma } from '@amader/db';
import { PosReportsService, toCsv } from './pos-reports.service';

describe('toCsv', () => {
  it('quotes commas, quotes and newlines; header from first row', () => {
    expect(
      toCsv([
        { name: 'Atta, 1kg', qty: 3 },
        { name: 'He said "hi"', qty: null },
      ]),
    ).toBe('name,qty\n"Atta, 1kg",3\n"He said ""hi""",\n');
  });

  it('empty input → empty string', () => expect(toCsv([])).toBe(''));
});

describe('PosReportsService.sales', () => {
  it('one row per store, returns kept separate from gross', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([
        {
          storeId: 2,
          _count: 3,
          _sum: {
            totalAmount: new Prisma.Decimal(300),
            taxAmount: new Prisma.Decimal(39),
          },
        },
      ])
      .mockResolvedValueOnce([
        { storeId: 2, _sum: { totalAmount: new Prisma.Decimal(50) } },
      ]);
    const prisma = {
      client: {
        order: { groupBy },
        store: {
          findMany: jest.fn().mockResolvedValue([{ id: 2, name: 'Dhanmondi' }]),
        },
      },
    };
    const svc = new PosReportsService(prisma as never, {} as never);
    expect(await svc.sales(2, '2026-09-01', '2026-09-25')).toEqual([
      {
        storeId: 2,
        storeName: 'Dhanmondi',
        orders: 3,
        gross: '300.00',
        vat: '39.00',
        returns: '50.00',
      },
    ]);
    expect(groupBy.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ channel: 'POS', storeId: 2 }),
    );
  });
});

describe('PosReportsService.sales — returns only', () => {
  it('a store whose only activity is a return still appears', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { storeId: 3, _sum: { totalAmount: new Prisma.Decimal(80) } },
      ]);
    const prisma = {
      client: {
        order: { groupBy },
        store: {
          findMany: jest.fn().mockResolvedValue([{ id: 3, name: 'Test' }]),
        },
      },
    };
    const svc = new PosReportsService(prisma as never, {} as never);
    expect(await svc.sales(3, '2026-09-01', '2026-09-25')).toEqual([
      {
        storeId: 3,
        storeName: 'Test',
        orders: 0,
        gross: '0.00',
        vat: '0.00',
        returns: '80.00',
      },
    ]);
  });
});

describe('PosReportsService.sales — dates', () => {
  it('uses Dhaka days; gross = sales made in range (incl. later returned), returns by the day they happened', async () => {
    const groupBy = jest.fn().mockResolvedValue([]);
    const prisma = {
      client: {
        order: { groupBy },
        store: { findMany: jest.fn().mockResolvedValue([]) },
      },
    };
    const svc = new PosReportsService(prisma as never, {} as never);
    await svc.sales(2, '2026-09-25', '2026-09-25');
    const [soldArgs, returnedArgs] = groupBy.mock.calls.map((c) => c[0].where);
    expect(soldArgs.createdAt.gte.toISOString()).toBe(
      '2026-09-24T18:00:00.000Z',
    );
    expect(soldArgs.status).toEqual({ not: 'CANCELED' });
    expect(returnedArgs.returnedAt.gte.toISOString()).toBe(
      '2026-09-24T18:00:00.000Z',
    );
    expect(returnedArgs.createdAt).toBeUndefined();
  });
});

describe('toCsv — spreadsheet formula safety', () => {
  it('neutralises cells that a spreadsheet would run as a formula', () => {
    expect(
      toCsv([
        { a: '=HYPERLINK("x")', b: '+1', c: '-2', d: '@SUM(A1)', e: 'ok' },
      ]),
    ).toBe('a,b,c,d,e\n"\'=HYPERLINK(""x"")",\'+1,\'-2,\'@SUM(A1),ok\n');
  });

  it('leaves real numbers alone (a refund total is a number, not text)', () => {
    expect(toCsv([{ amount: -50 }])).toBe('amount\n-50\n');
  });

  it('an empty sheet still has its header row when columns are given', () => {
    expect(toCsv([], ['name', 'phone'])).toBe('name,phone\n');
  });
});

describe('PosReportsService — store profit, sales sheet, customer sheet', () => {
  const D = (n: number) => new Prisma.Decimal(n);

  it('profit = (gross − returns − VAT on what was kept) − store expenses', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([
        {
          storeId: 2,
          _count: 3,
          _sum: { totalAmount: D(1150), taxAmount: D(150) },
        },
      ]) // sold
      .mockResolvedValueOnce([
        { storeId: 2, _sum: { totalAmount: D(115), taxAmount: D(15) } },
      ]); // returned
    const expenseGroup = jest
      .fn()
      .mockResolvedValue([{ costCentreId: 9, _sum: { netAmount: D(300) } }]);
    const prisma = {
      client: {
        order: { groupBy },
        expense: { groupBy: expenseGroup },
        store: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 2, name: 'Dhanmondi', costCentreId: 9 }]),
        },
      },
    };
    const svc = new PosReportsService(prisma as never, {} as never);
    expect(await svc.profit(2, '2026-09-01', '2026-09-25')).toEqual([
      {
        storeId: 2,
        storeName: 'Dhanmondi',
        gross: '1150.00',
        returns: '115.00',
        vat: '135.00',
        netSales: '900.00',
        expenses: '300.00',
        profit: '600.00',
      },
    ]);
    const ew = expenseGroup.mock.calls[0][0].where;
    expect(ew.voidedAt).toBeNull();
    expect(ew.costCentreId).toEqual({ in: [9] });
  });

  it('sales sheet: one row per line, with variant, customer and payment', async () => {
    const orders = [
      {
        orderNumber: 'ORD-1',
        createdAt: new Date('2026-09-24T19:30:00Z'),
        status: 'COMPLETED',
        totalAmount: D(1998),
        store: { name: 'Dhanmondi' },
        assignedAdmin: { firstName: 'Rahim', lastName: 'U' },
        customer: { firstName: 'Karim', lastName: null, phone: '017' },
        payments: [{ provider: 'CASH', transactionRef: null }],
        items: [
          {
            productNameSnapshot: 'Honey',
            skuSnapshot: 'H1',
            quantity: 2,
            unitPrice: D(999),
            variant: {
              attributeValues: [
                { attributeValue: { translations: [{ value: '1KG' }] } },
              ],
            },
          },
        ],
      },
    ];
    const prisma = {
      client: { order: { findMany: jest.fn().mockResolvedValue(orders) } },
    };
    const svc = new PosReportsService(prisma as never, {} as never);
    const rows = await svc.salesLines(2, '2026-09-25', '2026-09-25');
    expect(rows).toEqual([
      expect.objectContaining({
        date: '2026-09-25',
        receipt: 'ORD-1',
        customer: 'Karim',
        phone: '017',
        product: 'Honey',
        variant: '1KG',
        qty: 2,
        unitPrice: '999.00',
        lineTotal: '1998.00',
        payment: 'Cash',
      }),
    ]);
  });

  it('customer sheet: one row per customer; returns and walk-ins excluded', async () => {
    const o = (
      id: number | null,
      total: number,
      status: string,
      at: string,
      qty = 1,
    ) => ({
      customerId: id,
      totalAmount: D(total),
      status,
      createdAt: new Date(at),
      items: [{ quantity: qty }],
      customer: id
        ? { firstName: `C${id}`, lastName: null, phone: `01${id}`, email: null }
        : null,
    });
    const prisma = {
      client: {
        order: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              o(1, 100, 'COMPLETED', '2026-09-02T05:00:00Z', 2),
              o(1, 50, 'COMPLETED', '2026-09-10T05:00:00Z'),
              o(1, 70, 'RETURNED', '2026-09-11T05:00:00Z'),
              o(null, 30, 'COMPLETED', '2026-09-12T05:00:00Z'),
            ]),
        },
      },
    };
    const svc = new PosReportsService(prisma as never, {} as never);
    expect(await svc.customers(2, '2026-09-01', '2026-09-30')).toEqual([
      {
        name: 'C1',
        phone: '011',
        email: '',
        purchases: 2,
        items: 3,
        totalSpent: '150.00',
        firstPurchase: '2026-09-02',
        lastPurchase: '2026-09-10',
      },
    ]);
  });
});

describe('toCsv — readable headers', () => {
  it('uses header labels when given, keeping column order', () => {
    expect(
      toCsv([{ unitPrice: 5, qty: 2 }], ['qty', 'unitPrice'], {
        qty: 'Qty',
        unitPrice: 'Unit price',
      }),
    ).toBe('Qty,Unit price\n2,5\n');
  });
});

describe('PosReportsService — only orders still returned count as returns', () => {
  it('sales and profit both filter returns by status as well as returnedAt', async () => {
    const groupBy = jest.fn().mockResolvedValue([]);
    const prisma = {
      client: {
        order: { groupBy },
        expense: { groupBy: jest.fn().mockResolvedValue([]) },
        store: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 2, name: 'S', costCentreId: null }]),
        },
      },
    };
    const svc = new PosReportsService(prisma as never, {} as never);
    await svc.sales(2, '2026-09-25', '2026-09-25');
    await svc.profit(2, '2026-09-25', '2026-09-25');
    const returnQueries = groupBy.mock.calls
      .map((c) => c[0].where)
      .filter((w) => w.returnedAt);
    expect(returnQueries).toHaveLength(2);
    for (const w of returnQueries)
      expect(w.status).toEqual({ in: ['RETURNED', 'PARTIALLY_RETURNED'] });
  });
});
