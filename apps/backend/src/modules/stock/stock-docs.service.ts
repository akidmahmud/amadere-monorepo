import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockService } from './stock.service';
import { internalBarcode } from './barcode.util';
import { assertStoreActive } from '../stores/store-scope';
import type { AdjustStockDto, CreateStockInDto } from './dto/stock-docs.dto';

export const ADJUST_REASONS = [
  'DAMAGED',
  'EXPIRED',
  'COUNT_CORRECTION',
  'LOST',
  'OTHER',
] as const;

export function docNumber(
  prefix: 'GRN' | 'TRF',
  storeCode: string,
  id: number,
): string {
  return `${prefix}-${storeCode}-${String(id).padStart(6, '0')}`;
}

/** Stock-in (goods receipt) and adjustments: document types on StockMovement. */
@Injectable()
export class StockDocsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  stockIn(storeId: number, dto: CreateStockInDto, adminId: number) {
    return this.prisma.client.$transaction(async (tx) => {
      const store = await tx.store.findUniqueOrThrow({
        where: { id: storeId },
      });
      assertStoreActive(store);
      // Number needs the id, so insert with a placeholder then set it.
      const doc = await tx.stockIn.create({
        data: {
          number: `tmp-${Date.now()}-${Math.random()}`,
          storeId,
          supplierPartyId: dto.supplierPartyId,
          note: dto.note,
          adminUserId: adminId,
        },
      });
      const number = docNumber('GRN', store.code, doc.id);
      await tx.stockIn.update({ where: { id: doc.id }, data: { number } });
      for (const l of dto.lines) {
        await this.stock.move(tx, {
          storeId,
          productId: l.productId,
          variantId: l.variantId ?? null,
          type: 'STOCK_IN',
          qty: l.qty,
          stockInId: doc.id,
          unitCost:
            l.unitCost !== undefined
              ? new Prisma.Decimal(l.unitCost)
              : undefined,
          adminUserId: adminId,
        });
      }
      return { id: doc.id, number };
    });
  }

  async adjust(
    storeId: number,
    dto: AdjustStockDto,
    adminId: number,
  ): Promise<void> {
    if (dto.reason === 'OTHER' && !dto.note?.trim())
      throw new BadRequestException('Explain the adjustment in the note');
    assertStoreActive(
      await this.prisma.client.store.findUniqueOrThrow({
        where: { id: storeId },
      }),
    );
    await this.prisma.client.$transaction((tx) =>
      this.stock.move(tx, {
        storeId,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
        type: 'ADJUSTMENT',
        qty: dto.qty,
        reason: dto.note ? `${dto.reason}: ${dto.note}` : dto.reason,
        adminUserId: adminId,
      }),
    );
  }

  /** Gives every SKU without a barcode an internal Code 128 one; never overwrites. */
  async generateBarcodes(productIds: number[]): Promise<{ generated: number }> {
    let generated = 0;
    const products = await this.prisma.client.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true },
    });
    for (const p of products) {
      if (p.hasVariants) {
        for (const v of p.variants.filter((x) => !x.barcode)) {
          await this.prisma.client.productVariant.update({
            where: { id: v.id },
            data: { barcode: internalBarcode(p.id, v.id) },
          });
          generated++;
        }
      } else if (!p.barcode) {
        await this.prisma.client.product.update({
          where: { id: p.id },
          data: { barcode: internalBarcode(p.id, null) },
        });
        generated++;
      }
    }
    return { generated };
  }

  movements(storeId: number | null, productId?: number, variantId?: number) {
    return this.prisma.client.stockMovement.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        ...(productId ? { productId } : {}),
        ...(variantId ? { variantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { store: { select: { name: true } } },
    });
  }
}
