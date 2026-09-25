import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StockMovementType } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';

export type StockTx = Prisma.TransactionClient;

export interface StockMoveInput {
  storeId: number;
  productId: number;
  variantId: number | null;
  type: StockMovementType;
  /** Signed: + in, - out. */
  qty: number;
  adminUserId: number | null;
  reason?: string;
  orderId?: number;
  transferId?: number;
  stockInId?: number;
  unitCost?: Prisma.Decimal;
}

export function stockKey(productId: number, variantId: number | null): string {
  return `${productId}:${variantId ?? 0}`;
}

/**
 * The only writer of per-store stock. The online store's stock is the
 * existing Product.stock / ProductVariant.stock columns (so cart, checkout
 * and reports keep working untouched); every other store's is store_stock.
 * Outflows are a single conditional UPDATE, so two tills selling the last
 * unit at once cannot both succeed.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async onlineStoreId(): Promise<number> {
    const s = await this.prisma.client.store.findFirstOrThrow({
      where: { isOnlineStore: true },
      select: { id: true },
    });
    return s.id;
  }

  async move(tx: StockTx, input: StockMoveInput): Promise<void> {
    if (input.qty === 0) return;
    const store = await tx.store.findUniqueOrThrow({
      where: { id: input.storeId },
    });
    const product = await tx.product.findUniqueOrThrow({
      where: { id: input.productId },
    });
    // A store-only product can only ever hold stock at its own store.
    // Sales/returns are exempt: a sale made before a product was reassigned
    // must still be returnable to the store it came from.
    if (
      product.storeId !== null &&
      product.storeId !== undefined &&
      product.storeId !== input.storeId &&
      input.type !== 'SALE' &&
      input.type !== 'RETURN'
    ) {
      throw new BadRequestException(
        `Product #${input.productId} is only sold at another store`,
      );
    }
    // Stock is per variant for variant products and per product otherwise;
    // a mismatched pair would move some other SKU's stock.
    if (product.hasVariants !== (input.variantId !== null)) {
      throw new BadRequestException(
        product.hasVariants
          ? `Product #${input.productId} has variants — pick one`
          : `Product #${input.productId} has no variants`,
      );
    }
    if (
      input.variantId !== null &&
      !(await tx.productVariant.findFirst({
        where: { id: input.variantId, productId: input.productId },
      }))
    ) {
      throw new BadRequestException(
        `Variant #${input.variantId} does not belong to product #${input.productId}`,
      );
    }
    // Same rule as reserveStock/commitReservations: no shelf, no stock.
    if (!product.trackInventory || product.productType === 'DIGITAL') return;

    const q = input.qty;
    const v = input.variantId;
    let affected: number;
    if (store.isOnlineStore) {
      // Online outflow must leave room for units already reserved by open
      // website checkouts, exactly like reserveStock does.
      affected = v
        ? await tx.$executeRaw`
            UPDATE product_variants SET stock = stock + ${q}
            WHERE id = ${v} AND (${q} > 0 OR ${product.allowBackorder} OR stock - reserved_stock + ${q} >= 0)`
        : await tx.$executeRaw`
            UPDATE products SET stock = stock + ${q}
            WHERE id = ${input.productId} AND (${q} > 0 OR allow_backorder OR stock - reserved_stock + ${q} >= 0)`;
    } else if (q > 0) {
      affected = await tx.$executeRaw`
        INSERT INTO store_stock (store_id, product_id, variant_id, quantity)
        VALUES (${input.storeId}, ${input.productId}, ${v}, ${q})
        ON CONFLICT (store_id, product_id, (COALESCE(variant_id, 0)))
        DO UPDATE SET quantity = store_stock.quantity + EXCLUDED.quantity`;
    } else {
      affected = await tx.$executeRaw`
        UPDATE store_stock SET quantity = quantity + ${q}
        WHERE store_id = ${input.storeId} AND product_id = ${input.productId}
          AND COALESCE(variant_id, 0) = ${v ?? 0} AND quantity + ${q} >= 0`;
    }
    if (affected === 0) {
      throw new BadRequestException(
        `Not enough stock at ${store.name} for product #${input.productId}`,
      );
    }

    await tx.stockMovement.create({
      data: {
        storeId: input.storeId,
        productId: input.productId,
        variantId: v,
        type: input.type,
        qty: q,
        reason: input.reason,
        orderId: input.orderId,
        transferId: input.transferId,
        stockInId: input.stockInId,
        unitCost: input.unitCost,
        adminUserId: input.adminUserId,
      },
    });
  }

  /** Sellable quantity per SKU at a store, keyed by stockKey(). Missing = 0. */
  async quantities(
    storeId: number,
    keys: { productId: number; variantId: number | null }[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (keys.length === 0) return out;
    const store = await this.prisma.client.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    const productIds = [...new Set(keys.map((k) => k.productId))];
    if (store.isOnlineStore) {
      const [products, variants] = await Promise.all([
        this.prisma.client.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, stock: true, reservedStock: true },
        }),
        this.prisma.client.productVariant.findMany({
          where: { productId: { in: productIds } },
          select: {
            id: true,
            productId: true,
            stock: true,
            reservedStock: true,
          },
        }),
      ]);
      for (const p of products)
        out.set(stockKey(p.id, null), p.stock - p.reservedStock);
      for (const v of variants)
        out.set(stockKey(v.productId, v.id), v.stock - v.reservedStock);
    } else {
      const rows = await this.prisma.client.storeStock.findMany({
        where: { storeId, productId: { in: productIds } },
      });
      for (const r of rows)
        out.set(stockKey(r.productId, r.variantId), r.quantity);
    }
    return out;
  }
}
