import { BadRequestException } from '@nestjs/common';

// Store-wide ceiling on one cart line, on top of each product's own
// maxOrderQuantity (which is blank — unlimited — on most products). Stops
// junk like 1222 × honey reaching carts, checkout and the Recovery list.
// Chosen from real data: across 5,185 order lines the largest ever was 21.
// Admin-editable via Settings → Checkout (generic Setting key below).
export const DEFAULT_MAX_QTY_PER_ITEM = 30;
export const MAX_QTY_SETTING_KEY = 'cart_max_quantity_per_item';

/** A stored setting value → a usable limit; anything invalid means the default. */
export function parseStoreMax(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isInteger(n) && n > 0
    ? n
    : DEFAULT_MAX_QTY_PER_ITEM;
}

/** The lower of the product's own max (if set) and the store limit. */
export function lineLimit(
  productMax: number | null | undefined,
  storeMax: number,
): number {
  return productMax && productMax > 0 ? Math.min(productMax, storeMax) : storeMax;
}

/** Rejects a cart line whose TOTAL quantity would exceed its limit. */
export function assertLineQuantity(quantity: number, limit: number): void {
  if (quantity > limit) {
    throw new BadRequestException(
      `You can order at most ${limit} of this item. For bulk orders please contact us.`,
    );
  }
}
