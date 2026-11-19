import { Prisma } from '@amader/db';
import { PosReportsService } from './pos-reports.service';

const D = (n: number) => new Prisma.Decimal(n);

describe('PosReportsService.salesByDay', () => {
  it('buckets by Dhaka day, keeps empty days, newest first', async () => {
    const findMany = jest
      .fn()
      // 2026-10-01 23:30 Dhaka = 17:30 UTC; 2026-10-02 00:30 Dhaka = 18:30 UTC on 10-01.
      .mockResolvedValueOnce([
        { createdAt: new Date('2026-10-01T17:30:00Z'), totalAmount: D(100), taxAmount: D(0) },
        { createdAt: new Date('2026-10-01T18:30:00Z'), totalAmount: D(300), taxAmount: D(5) },
      ])
      .mockResolvedValueOnce([
        { returnedAt: new Date('2026-10-03T04:00:00Z'), posRefundedAmount: D(50), posRefundedVat: D(0) },
      ]);
    const svc = new PosReportsService({ client: { order: { findMany } } } as never, {} as never, {} as never);
    const rows = await svc.salesByDay(4, '2026-10-01', '2026-10-03');
    expect(rows).toEqual([
      { date: '2026-10-03', orders: 0, gross: '0.00', vat: '0.00', returns: '50.00', net: '-50.00' },
      { date: '2026-10-02', orders: 1, gross: '300.00', vat: '5.00', returns: '0.00', net: '300.00' },
      { date: '2026-10-01', orders: 1, gross: '100.00', vat: '0.00', returns: '0.00', net: '100.00' },
    ]);
  });
});

describe('PosReportsService.profitByDay', () => {
  it("net sales minus that day's store expenses", async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([
        { createdAt: new Date('2026-10-02T04:00:00Z'), totalAmount: D(1000), taxAmount: D(50) },
      ])
      .mockResolvedValueOnce([
        { returnedAt: new Date('2026-10-02T05:00:00Z'), posRefundedAmount: D(210), posRefundedVat: D(10) },
      ]);
    const prisma = {
      client: {
        order: { findMany },
        store: { findMany: jest.fn().mockResolvedValue([{ costCentreId: 3 }]) },
        expense: {
          groupBy: jest.fn().mockResolvedValue([
            { expenseDate: new Date('2026-10-02T00:00:00Z'), _sum: { netAmount: D(100) } },
          ]),
        },
      },
    };
    const svc = new PosReportsService(prisma as never, {} as never, {} as never);
    const [d2, d1] = await svc.profitByDay(4, '2026-10-01', '2026-10-02');
    // VAT kept 40; net sales 1000 - 210 - 40 = 750; profit 750 - 100.
    expect(d2).toEqual({
      date: '2026-10-02', gross: '1000.00', returns: '210.00', vat: '40.00',
      netSales: '750.00', expenses: '100.00', profit: '650.00',
    });
    expect(d1.profit).toBe('0.00');
  });
});
