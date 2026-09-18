import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { ProductCostHistoryService } from './product-cost-history.service';
import { dhakaDate } from './dhaka-date';

const D = (v: number) => new Prisma.Decimal(v);
const row = (o: Partial<Record<string, unknown>>) => ({
  id: 1,
  productId: 7,
  variantId: null,
  scopeKey: 'p:7',
  cost: D(100),
  costPriceUnit: null,
  effectiveFrom: new Date('2026-07-01T00:00:00Z'),
  confirmed: true,
  createdBy: null,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  ...o,
});

function make(rows: ReturnType<typeof row>[] = []) {
  const prisma = {
    client: {
      productCostHistory: {
        findMany: jest.fn().mockResolvedValue(rows),
        findUnique: jest.fn(),
        upsert: jest
          .fn()
          .mockImplementation(({ create }) =>
            Promise.resolve(row({ ...create, id: 99 })),
          ),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve(row({ ...data }))),
        delete: jest.fn(),
        count: jest.fn(),
      },
      product: { update: jest.fn() },
      productVariant: { update: jest.fn() },
      order: {
        aggregate: jest
          .fn()
          .mockResolvedValue({
            _min: { createdAt: new Date('2025-09-28T06:00:00Z') },
          }),
      },
    },
  };
  return { svc: new ProductCostHistoryService(prisma as never), prisma };
}

describe('dhakaDate', () => {
  it('is the calendar day in Asia/Dhaka (UTC+6)', () => {
    expect(dhakaDate(new Date('2026-08-01T18:30:00Z'))).toBe('2026-08-02');
    expect(dhakaDate(new Date('2026-08-01T17:59:00Z'))).toBe('2026-08-01');
  });
});

describe('loadResolver', () => {
  it('prefers the variant row, then the product row, active on the date', async () => {
    const { svc } = make([
      row({
        id: 1,
        scopeKey: 'p:7',
        cost: D(100),
        effectiveFrom: new Date('2026-07-01T00:00:00Z'),
      }),
      row({
        id: 2,
        scopeKey: 'p:7',
        cost: D(120),
        effectiveFrom: new Date('2026-08-05T00:00:00Z'),
        confirmed: false,
      }),
      row({
        id: 3,
        scopeKey: 'v:70',
        variantId: 70,
        cost: D(55),
        effectiveFrom: new Date('2026-07-01T00:00:00Z'),
      }),
    ]);
    const r = await svc.loadResolver([7], [70]);
    expect(
      r.resolve(
        { productId: 7, variantId: null, unitWeightKg: 1 },
        '2026-08-04',
      ),
    ).toEqual({ unitCost: 100, ok: true });
    expect(
      r.resolve(
        { productId: 7, variantId: null, unitWeightKg: 1 },
        '2026-08-05',
      ),
    ).toEqual({ unitCost: 120, ok: false });
    expect(
      r.resolve({ productId: 7, variantId: 70, unitWeightKg: 1 }, '2026-08-05'),
    ).toEqual({ unitCost: 55, ok: true });
    expect(
      r.resolve(
        { productId: 7, variantId: null, unitWeightKg: 1 },
        '2026-06-30',
      ),
    ).toBeNull();
  });

  it('scales a per-kg product rate by the line weight; null without a weight', async () => {
    const { svc } = make([row({ cost: D(800), costPriceUnit: 'PER_KG' })]);
    const r = await svc.loadResolver([7], []);
    expect(
      r.resolve(
        { productId: 7, variantId: null, unitWeightKg: 0.5 },
        '2026-08-01',
      ),
    ).toEqual({ unitCost: 400, ok: true });
    expect(
      r.resolve(
        { productId: 7, variantId: null, unitWeightKg: 0 },
        '2026-08-01',
      ),
    ).toBeNull();
  });
});

describe('recordIfChanged', () => {
  it("adds a row effective today when the cost differs from today's", async () => {
    const { svc, prisma } = make([row({ cost: D(100) })]);
    await svc.recordIfChanged({ productId: 7, cost: 110 });
    expect(prisma.client.productCostHistory.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scopeKey_effectiveFrom: {
            scopeKey: 'p:7',
            effectiveFrom: new Date(`${dhakaDate(new Date())}T00:00:00Z`),
          },
        },
      }),
    );
  });

  // A product's FIRST cost (e.g. typed into the product form) covers its past
  // orders too — same rule as the migration backfill — otherwise every order
  // sold before today stays "Product cost missing" forever.
  it('dates the first-ever cost from the earliest order, not today', async () => {
    const { svc, prisma } = make([]);
    await svc.recordIfChanged({ productId: 8, cost: 250 });
    expect(prisma.client.productCostHistory.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scopeKey_effectiveFrom: {
            scopeKey: 'p:8',
            effectiveFrom: new Date('2025-09-28T00:00:00Z'),
          },
        },
      }),
    );
  });

  it('does nothing when the cost is unchanged', async () => {
    const { svc, prisma } = make([row({ cost: D(100) })]);
    await svc.recordIfChanged({ productId: 7, cost: 100 });
    expect(prisma.client.productCostHistory.upsert).not.toHaveBeenCalled();
  });
});

describe('remove', () => {
  it('refuses to remove the earliest row while later ones exist', async () => {
    const { svc, prisma } = make();
    prisma.client.productCostHistory.findUnique.mockResolvedValue(
      row({ id: 1 }),
    );
    prisma.client.productCostHistory.count
      .mockResolvedValueOnce(0) // rows before it
      .mockResolvedValueOnce(2); // rows after it
    await expect(svc.remove(1)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('syncCurrent', () => {
  it("mirrors today's product-level row onto Product.costPerItem/costPriceUnit", async () => {
    const { svc, prisma } = make([
      row({ cost: D(130), costPriceUnit: 'PER_KG' }),
    ]);
    await svc.syncCurrent(7, null);
    expect(prisma.client.product.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { costPerItem: D(130), costPriceUnit: 'PER_KG' },
    });
  });
});
