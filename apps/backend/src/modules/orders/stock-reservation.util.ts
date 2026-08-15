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

  // trackInventory/allowBackorder are product-wide settings (the admin form
  // only ever edits them once, at the product level — ProductVariant has no
  // columns of its own for either) — so a variant's availability must honor
  // its PARENT's flags, not just its own stock column. Bug fixed here: the
  // variant branch previously ignored both flags entirely and unconditionally
  // required stock - reservedStock >= quantity, so a backorder-enabled (or
  // even trackInventory-disabled) variant with 0 stock could never be
  // reserved — checkout always 409'd regardless of the product's settings,
  // while the simple-product branch below already honored them correctly.
  const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  if (!product.trackInventory) return;

  if (variantId) {
    const affected = await tx.$executeRaw`
      UPDATE product_variants SET reserved_stock = reserved_stock + ${quantity}
      WHERE id = ${variantId} AND (${product.allowBackorder} OR stock - reserved_stock >= ${quantity})
    `;
    if (affected === 0)
      throw new ConflictException(`Insufficient stock for variant #${variantId}`);
    return;
  }

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

  // Mirrors reserveStock's early return: when trackInventory is off, nothing
  // was ever incremented (for either a variant or the plain product), so
  // decrementing here would drift reservedStock negative over time.
  const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  if (!product.trackInventory) return;

  if (variantId) {
    await tx.productVariant.update({
      where: { id: variantId },
      data: { reservedStock: { decrement: quantity } },
    });
    return;
  }

  await tx.product.update({
    where: { id: productId },
    data: { reservedStock: { decrement: quantity } },
  });
}
