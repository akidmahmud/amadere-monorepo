import { Prisma } from '@amader/db';
import { computeDiscountAmount } from './pricing.service';

const D = (n: number) => new Prisma.Decimal(n);
const coupon = (over: Record<string, unknown>) =>
  ({
    valueType: 'PERCENTAGE',
    value: D(5),
    maxDiscountAmount: null,
    ...over,
  }) as never;

describe('computeDiscountAmount — max discount cap', () => {
  it('owner example: 5% of ৳10,000 is ৳500, capped at ৳200', () => {
    const d = computeDiscountAmount(
      coupon({ maxDiscountAmount: D(200) }),
      D(10000),
    );
    expect(d.toString()).toBe('200');
  });

  it('under the cap the full percentage applies', () => {
    const d = computeDiscountAmount(
      coupon({ maxDiscountAmount: D(200) }),
      D(2000),
    );
    expect(d.toString()).toBe('100');
  });

  it('no cap set → unchanged percentage', () => {
    expect(computeDiscountAmount(coupon({}), D(10000)).toString()).toBe('500');
  });

  it('fixed-amount coupons still never exceed the cart', () => {
    const d = computeDiscountAmount(
      coupon({
        valueType: 'FIXED_AMOUNT',
        value: D(300),
        maxDiscountAmount: D(200),
      }),
      D(150),
    );
    expect(d.toString()).toBe('150');
  });
});
