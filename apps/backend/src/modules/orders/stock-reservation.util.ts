import { ConflictException } from '@nestjs/common';
import { Prisma } from '@amader/db';

// Atomic hold: only succeeds if enough stock is actually available, so
// concurrent order creation (storefront checkout or admin manual order)
// can never oversell (AGENTS.md §6). Extracted from CheckoutService so both
// call sites share one implementation.
export async function reserveStock(
  tx: Prisma.TransactionClient,
  productId: number,
  variantId: number | null,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return;

  if (variantId) {
    const affected = await tx.$executeRaw`
      UPDATE product_variants SET reserved_stock = reserved_stock + ${quantity}
      WHERE id = ${variantId} AND stock - reserved_stock >= ${quantity}
    `;
    if (affected === 0)
      throw new ConflictException(`Insufficient stock for variant #${variantId}`);
    return;
  }

  const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  if (!product.trackInventory) return;

  const affected = await tx.$executeRaw`
    UPDATE products SET reserved_stock = reserved_stock + ${quantity}
    WHERE id = ${productId} AND (allow_backorder OR stock - reserved_stock >= ${quantity})
  `;
  if (affected === 0)
    throw new ConflictException(`Insufficient stock for "${product.slug}"`);
}

// Counterpart to reserveStock — releasing a hold never fails a capacity
// check, so this is a plain decrement (used when an existing order line's
// quantity is reduced or the line is removed entirely, unlike
// OrdersService's releaseReservations which releases a whole order's items
// on cancel).
export async function releaseStock(
  tx: Prisma.TransactionClient,
  productId: number,
  variantId: number | null,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return;

  if (variantId) {
    await tx.productVariant.update({
      where: { id: variantId },
      data: { reservedStock: { decrement: quantity } },
    });
    return;
  }

  const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  if (!product.trackInventory) return;

  await tx.product.update({
    where: { id: productId },
    data: { reservedStock: { decrement: quantity } },
  });
}
