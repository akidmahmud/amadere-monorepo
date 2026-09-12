import { Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { OrderManagerService } from './order-manager.service';

/**
 * The Order Manager stat cards read this one call for both the counts and the
 * money. The aggregation over the rows is the part worth pinning: a cancelled
 * order still has to be COUNTED (its own card says so) while never being
 * added to the value, and the money has to stay exact.
 */
function serviceReturning(rows: unknown[]) {
  const prisma = {
    client: { $queryRaw: jest.fn().mockResolvedValue(rows) },
  } as unknown as PrismaService;
  const stub = {} as never;
  return new OrderManagerService(prisma, stub, stub, stub, stub);
}

const row = (status: string, count: number, value: string) => ({
  status,
  count: BigInt(count),
  value: new Prisma.Decimal(value),
});

describe('OrderManagerService.statusCounts', () => {
  it('returns a count per status alongside the value behind them', async () => {
    const service = serviceReturning([
      row('PENDING', 3, '1500.50'),
      row('COMPLETED', 2, '2000.25'),
    ]);

    const result = await service.statusCounts({});

    expect(result.counts).toEqual({ PENDING: 3, COMPLETED: 2 });
    expect(result.totalValue).toBe('3500.75');
  });

  it('counts cancelled orders but keeps them out of the value', async () => {
    const service = serviceReturning([
      row('COMPLETED', 2, '2000.00'),
      row('CANCELED', 5, '9999.99'),
    ]);

    const result = await service.statusCounts({});

    expect(result.counts.CANCELED).toBe(5);
    expect(result.totalValue).toBe('2000.00');
  });

  it('adds money exactly, without float drift', async () => {
    const service = serviceReturning([
      row('PENDING', 1, '0.10'),
      row('CONFIRMED', 1, '0.20'),
    ]);

    // 0.1 + 0.2 in JS floats is 0.30000000000000004.
    expect((await service.statusCounts({})).totalValue).toBe('0.30');
  });

  it('reports zero rather than nothing when no orders match the filters', async () => {
    const result = await serviceReturning([]).statusCounts({});

    expect(result.counts).toEqual({});
    expect(result.totalValue).toBe('0.00');
  });

  it('survives a status group whose sum came back null', async () => {
    const service = serviceReturning([
      { status: 'PENDING', count: BigInt(1), value: null },
    ]);

    const result = await service.statusCounts({});

    expect(result.counts.PENDING).toBe(1);
    expect(result.totalValue).toBe('0.00');
  });
});
