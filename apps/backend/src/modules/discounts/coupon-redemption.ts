import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@amader/db';

// Every place an order spends or gives back a coupon use goes through here,
// so the limits are enforced the same way for storefront checkout and
// staff-created orders.

/** "01712345678", "+8801712345678", "8801712345678" -> "1712345678"; null if not a full number. */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? digits : null;
}

/**
 * The storefront shows this as a popup (details.couponUnavailable) rather than
 * a plain error line, with a one-click "remove coupon and continue".
 */
function unavailable(reason: 'ALREADY_REDEEMED' | 'USED_UP', message: string, sub: string) {
  return new BadRequestException({
    message,
    details: { couponUnavailable: true, reason, heading: message, sub },
  });
}

/**
 * Records one use of `code` for `orderId`, re-checking the limits under a row
 * lock on the discount. The cart already checked them, but only here — in the
 * order's own transaction, with the row locked — can two checkouts in the same
 * second not both take the last use.
 *
 * Per-customer limit: a previous use counts if it was by the same account OR
 * the same phone number, so a guest can't reuse a "once per customer" code by
 * checking out again without logging in. Released uses (cancelled or deleted
 * orders) don't count.
 */
export async function redeemCoupon(
  tx: Prisma.TransactionClient,
  input: { code: string; orderId: number; customerId: number | null; phone: string | null | undefined },
): Promise<void> {
  const locked = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM discounts WHERE code = ${input.code} FOR UPDATE`;
  if (locked.length === 0) return;
  const discount = await tx.discount.findUniqueOrThrow({ where: { id: locked[0].id } });

  if (discount.maxUsesTotal !== null && discount.usedCount >= discount.maxUsesTotal) {
    throw unavailable(
      'USED_UP',
      'This coupon has already been used',
      'Its usage limit has been reached. Remove it to place your order at the regular price.',
    );
  }

  const phone = phoneKey(input.phone);
  if (discount.maxUsesPerCustomer) {
    const who: Prisma.DiscountRedemptionWhereInput[] = [];
    if (input.customerId) who.push({ customerId: input.customerId });
    if (phone) who.push({ phone });
    if (who.length > 0) {
      const used = await tx.discountRedemption.count({
        where: { discountId: discount.id, releasedAt: null, OR: who },
      });
      if (used >= discount.maxUsesPerCustomer) {
        throw unavailable(
          'ALREADY_REDEEMED',
          'Coupon already redeemed',
          discount.maxUsesPerCustomer === 1
            ? 'This coupon has already been used with this mobile number.'
            : `This coupon can be used ${discount.maxUsesPerCustomer} times per mobile number, and they have all been used.`,
        );
      }
    }
  }

  await tx.discountRedemption.create({
    data: { discountId: discount.id, customerId: input.customerId, orderId: input.orderId, phone },
  });
  await tx.discount.update({ where: { id: discount.id }, data: { usedCount: { increment: 1 } } });
}

/** Gives back the coupon use(s) of a cancelled/deleted order. Idempotent. */
export async function releaseOrderCoupons(tx: Prisma.TransactionClient, orderId: number): Promise<void> {
  const live = await tx.discountRedemption.findMany({ where: { orderId, releasedAt: null } });
  for (const r of live) {
    await tx.discountRedemption.update({ where: { id: r.id }, data: { releasedAt: new Date() } });
    await tx.discount.updateMany({
      where: { id: r.discountId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }
}

/**
 * The reverse, when a cancelled/deleted order is restored: the order kept its
 * discount, so it takes its use back. Not re-checked against the limit — the
 * money was already given on this order; refusing now would not un-give it.
 * ponytail: can push usedCount one past maxUsesTotal if the use was re-issued meanwhile.
 */
export async function reclaimOrderCoupons(tx: Prisma.TransactionClient, orderId: number): Promise<void> {
  const released = await tx.discountRedemption.findMany({ where: { orderId, releasedAt: { not: null } } });
  for (const r of released) {
    await tx.discountRedemption.update({ where: { id: r.id }, data: { releasedAt: null } });
    await tx.discount.update({ where: { id: r.discountId }, data: { usedCount: { increment: 1 } } });
  }
}
