import { BadRequestException } from '@nestjs/common';
import { phoneKey, redeemCoupon, releaseOrderCoupons } from './coupon-redemption';

function mockTx(discount: Record<string, unknown>, priorUses = 0) {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 7 }]),
    discount: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 7, usedCount: 0, maxUsesTotal: null, maxUsesPerCustomer: null, ...discount }),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    discountRedemption: {
      count: jest.fn().mockResolvedValue(priorUses),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
}

const details = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    return ((e as BadRequestException).getResponse() as { details: { reason: string } }).details;
  }
  throw new Error('expected a rejection');
};

describe('phoneKey', () => {
  it('reduces every Bangladeshi format to the same 10 digits', () => {
    expect(phoneKey('01712345678')).toBe('1712345678');
    expect(phoneKey('+880 1712-345678')).toBe('1712345678');
    expect(phoneKey('8801712345678')).toBe('1712345678');
    expect(phoneKey('12345')).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });
});

describe('redeemCoupon', () => {
  it('refuses a guest whose mobile number already used a once-per-customer coupon', async () => {
    const tx = mockTx({ maxUsesPerCustomer: 1 }, 1);
    const d = await details(redeemCoupon(tx as never, { code: 'X', orderId: 1, customerId: null, phone: '+8801712345678' }));
    expect(d.reason).toBe('ALREADY_REDEEMED');
    // Counted by phone (no account), ignoring released uses.
    expect(tx.discountRedemption.count).toHaveBeenCalledWith({
      where: { discountId: 7, releasedAt: null, OR: [{ phone: '1712345678' }] },
    });
    expect(tx.discountRedemption.create).not.toHaveBeenCalled();
  });

  it('counts account OR phone for a logged-in customer', async () => {
    const tx = mockTx({ maxUsesPerCustomer: 2 }, 1);
    await redeemCoupon(tx as never, { code: 'X', orderId: 1, customerId: 5, phone: '01712345678' });
    expect(tx.discountRedemption.count.mock.calls[0][0].where.OR).toEqual([{ customerId: 5 }, { phone: '1712345678' }]);
    expect(tx.discountRedemption.create).toHaveBeenCalledWith({
      data: { discountId: 7, customerId: 5, orderId: 1, phone: '1712345678' },
    });
    expect(tx.discount.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { usedCount: { increment: 1 } } });
  });

  it('refuses once the total limit is reached, re-checked under the row lock', async () => {
    const tx = mockTx({ maxUsesTotal: 1, usedCount: 1 });
    expect((await details(redeemCoupon(tx as never, { code: 'X', orderId: 1, customerId: null, phone: null }))).reason).toBe('USED_UP');
    expect(tx.$queryRaw).toHaveBeenCalled(); // SELECT ... FOR UPDATE
  });

  it('places no per-customer limit when the coupon has none', async () => {
    const tx = mockTx({}, 5);
    await redeemCoupon(tx as never, { code: 'X', orderId: 1, customerId: null, phone: '01712345678' });
    expect(tx.discountRedemption.count).not.toHaveBeenCalled();
    expect(tx.discountRedemption.create).toHaveBeenCalled();
  });
});

describe('releaseOrderCoupons', () => {
  it("gives the cancelled order's use back and never takes usedCount below zero", async () => {
    const tx = mockTx({});
    tx.discountRedemption.findMany.mockResolvedValue([{ id: 3, discountId: 7 }]);
    await releaseOrderCoupons(tx as never, 42);
    expect(tx.discountRedemption.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { releasedAt: expect.any(Date) } });
    expect(tx.discount.updateMany).toHaveBeenCalledWith({
      where: { id: 7, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });
});
