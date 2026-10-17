import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@amader/db';

/** A weight over this is treated as a typo (kg). */
export const MAX_WEIGHED_KG = 50;

/** Price of a weighed line: price per kg × weight, half up to whole taka. */
export function weighedLinePrice(
  perKg: Prisma.Decimal,
  kg: Prisma.Decimal | number | string,
): Prisma.Decimal {
  return perKg.times(kg).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Sold-by-weight rules for sale lines: such a product needs a weight in
 * (0, 50] kg on a line of its own (quantity 1); anything else has none.
 */
export function assertWeighedLines(
  items: { productId: number; quantity: number; weighedKg?: number | null }[],
  product: (id: number) => { soldByWeight: boolean; name: string } | undefined,
): void {
  for (const i of items) {
    const p = product(i.productId);
    if (!p) continue;
    if (!p.soldByWeight) {
      if (i.weighedKg != null)
        throw new BadRequestException(`${p.name} is not sold by weight`);
      continue;
    }
    if (i.weighedKg == null)
      throw new BadRequestException(
        `${p.name} is sold by weight — enter its weight`,
      );
    if (!(i.weighedKg > 0 && i.weighedKg <= MAX_WEIGHED_KG))
      throw new BadRequestException(
        `${p.name}: weight must be between 0 and ${MAX_WEIGHED_KG} kg`,
      );
    if (i.quantity !== 1)
      throw new BadRequestException(
        `${p.name} is sold by weight — one line per item, quantity 1`,
      );
  }
}
