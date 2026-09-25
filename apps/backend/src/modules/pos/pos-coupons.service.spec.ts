import { BadRequestException, ConflictException } from '@nestjs/common';
import { PosCouponsService } from './pos-coupons.service';

function make(existing: Record<string, unknown> | null = null) {
  const discount = {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(existing),
    create: jest.fn((a: { data: object }) =>
      Promise.resolve({ id: 1, ...a.data }),
    ),
    update: jest.fn((a: { data: object }) =>
      Promise.resolve({ id: 1, ...a.data }),
    ),
    delete: jest.fn(),
  };
  return {
    svc: new PosCouponsService({ client: { discount } } as never),
    discount,
  };
}

const base = {
  code: 'store10',
  valueType: 'PERCENTAGE',
  value: 10,
  active: true,
} as const;

describe('PosCouponsService', () => {
  it('creates a POS-only, published coupon with an upper-cased code', async () => {
    const { svc, discount } = make();
    await svc.create({ ...base, storeId: 3 });
    expect(discount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'STORE10',
        type: 'COUPON',
        channel: 'POS',
        status: 'PUBLISHED',
        storeId: 3,
      }),
    });
  });

  it('an inactive coupon is saved as DRAFT (never applies)', async () => {
    const { svc, discount } = make();
    await svc.create({ ...base, active: false });
    expect(
      (discount.create.mock.calls[0][0] as { data: { status: string } }).data
        .status,
    ).toBe('DRAFT');
  });

  it('refuses a percentage over 100 and a code already in use', async () => {
    await expect(
      make().svc.create({ ...base, value: 120 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      make({ id: 9, code: 'STORE10' }).svc.create(base),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses an end date before the start date', async () => {
    await expect(
      make().svc.create({
        ...base,
        startsAt: '2026-10-10',
        endsAt: '2026-10-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists only POS coupons', async () => {
    const { svc, discount } = make();
    await svc.list();
    expect(discount.findMany.mock.calls[0][0].where).toEqual({
      channel: 'POS',
      type: 'COUPON',
    });
  });

  it('only a never-used coupon can be deleted (otherwise switch it off)', async () => {
    const used = make({ id: 1, channel: 'POS', usedCount: 2 });
    await expect(used.svc.remove(1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const fresh = make({ id: 1, channel: 'POS', usedCount: 0 });
    await fresh.svc.remove(1);
    expect(fresh.discount.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("can't edit or delete a website coupon through the POS screen", async () => {
    const web = make({ id: 1, channel: 'ALL', usedCount: 0 });
    await expect(web.svc.remove(1)).rejects.toThrow(/not a POS coupon/);
    await expect(web.svc.update(1, base)).rejects.toThrow(/not a POS coupon/);
  });
});

describe('PosCouponsService.available (till list)', () => {
  const D = (n: number) => ({ toString: () => String(n) });
  const row = (o: Record<string, unknown>) => ({
    code: 'X', type: 'COUPON', status: 'PUBLISHED', channel: 'POS', storeId: null, valueType: 'PERCENTAGE', value: D(10),
    minOrderAmount: null, startsAt: null, endsAt: null, maxUsesTotal: null, usedCount: 0, ...o,
  });

  it('asks only for published, in-date coupons usable at this store, not tied to customers', async () => {
    const { svc, discount } = make();
    await svc.available(4, new Date('2026-09-26T10:00:00Z'));
    const where = discount.findMany.mock.calls[0][0].where;
    expect(where).toEqual(
      expect.objectContaining({
        type: 'COUPON',
        status: 'PUBLISHED',
        code: { not: null },
        customers: { none: {} },
        valueType: { in: ['PERCENTAGE', 'FIXED_AMOUNT'] },
        AND: expect.arrayContaining([
          { OR: [{ storeId: null }, { storeId: 4 }] },
          { OR: [{ startsAt: null }, { startsAt: { lte: new Date('2026-09-26T10:00:00Z') } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: new Date('2026-09-26T10:00:00Z') } }] },
        ]),
      }),
    );
  });

  it('drops used-up codes; this store first, then all-store POS, then website coupons; only till-safe fields', async () => {
    const { svc, discount } = make();
    discount.findMany.mockResolvedValue([
      row({ code: 'WEB5', channel: 'ALL', value: D(5) }),
      row({ code: 'POSALL', storeId: null }),
      row({ code: 'MINE', storeId: 4, valueType: 'FIXED_AMOUNT', value: D(50), minOrderAmount: D(500) }),
      row({ code: 'GONE', maxUsesTotal: 3, usedCount: 3 }),
    ]);
    const out = await svc.available(4);
    expect(out.map((c) => c.code)).toEqual(['MINE', 'POSALL', 'WEB5']);
    expect(out[0]).toEqual({ code: 'MINE', valueType: 'FIXED_AMOUNT', value: '50', minOrderAmount: '500', endsAt: null, scope: 'store' });
    expect(out[2].scope).toBe('all');
  });
});
