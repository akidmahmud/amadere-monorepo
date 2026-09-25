import { Injectable, NotFoundException } from '@nestjs/common';
import { Locale, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockService, stockKey } from '../stock/stock.service';
import { dhakaRange } from './dhaka-range';

/** Same threshold as ProductsService.LOW_STOCK_THRESHOLD. */
export const POS_LOW_STOCK = 10;

export interface PosProduct {
  productId: number;
  variantId: number | null;
  name: string;
  variantLabel: string | null;
  sku: string | null;
  barcode: string | null;
  price: string;
  salePrice: string | null;
  imageUrl: string | null;
  categoryIds: number[];
  /** Sellable at this store. Untracked products report 9999. */
  stock: number;
  storeOnly: boolean;
}

const INCLUDE = {
  translations: { where: { locale: Locale.EN }, take: 1 },
  variants: {
    include: {
      attributeValues: {
        include: {
          attributeValue: {
            include: {
              translations: { where: { locale: Locale.EN }, take: 1 },
            },
          },
        },
      },
    },
  },
  media: {
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    take: 1,
    include: { media: true },
  },
  categories: { select: { categoryId: true } },
} satisfies Prisma.ProductInclude;

type Row = Prisma.ProductGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class PosCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async list(
    storeId: number,
    q?: string,
    categoryId?: number,
    sort: 'popular' | 'name' | 'price' = 'popular',
    take = 200,
  ): Promise<PosProduct[]> {
    // Shared catalogue + this store's own products; never DRAFT/ARCHIVED.
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      status: { in: ['PUBLISHED', 'ADMIN_ONLY'] },
      // A counter sells physical goods; ebooks/downloads stay online-only.
      productType: { not: 'DIGITAL' },
      OR: [{ storeId: null }, { storeId }],
    };
    if (categoryId) where.categories = { some: { categoryId } };
    if (q) {
      where.AND = [
        {
          OR: [
            {
              translations: {
                some: { name: { contains: q, mode: 'insensitive' } },
              },
            },
            { sku: { contains: q, mode: 'insensitive' } },
            { barcode: q },
            {
              variants: {
                some: {
                  OR: [
                    { sku: { contains: q, mode: 'insensitive' } },
                    { barcode: q },
                  ],
                },
              },
            },
          ],
        },
      ];
    }
    const rows = await this.prisma.client.product.findMany({
      where,
      include: INCLUDE,
      // ponytail: "popular" = newest first until a sales-count column is worth adding
      orderBy:
        sort === 'price'
          ? { price: 'asc' }
          : sort === 'name'
            ? { slug: 'asc' }
            : { createdAt: 'desc' },
      take,
    });
    return this.toPos(storeId, rows);
  }

  /** Scanner/typed code → exact barcode or SKU first, else the first search hit. */
  async lookup(storeId: number, code: string): Promise<PosProduct> {
    const c = code.trim();
    const all = await this.list(storeId, c);
    // Exact barcode, then exact SKU — never the first fuzzy search hit, which
    // could put the wrong item in the cart on a partial scan.
    const hit =
      all.find((p) => p.barcode === c) ?? all.find((p) => p.sku === c);
    if (!hit) throw new NotFoundException(`No product with code "${c}"`);
    return hit;
  }

  async categories() {
    const rows = await this.prisma.client.category.findMany({
      where: { deletedAt: null, status: 'PUBLISHED' },
      include: { translations: { where: { locale: Locale.EN }, take: 1 } },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.translations[0]?.name ?? c.slug,
    }));
  }

  async stats(storeId: number) {
    const items = await this.list(
      storeId,
      undefined,
      undefined,
      'popular',
      10_000,
    );
    const sales = await this.prisma.client.order.aggregate({
      where: {
        storeId,
        channel: 'POS',
        createdAt: dhakaRange(),
        status: { notIn: ['CANCELED', 'RETURNED'] },
      },
      _sum: { totalAmount: true },
    });
    return {
      totalProducts: items.length,
      lowStock: items.filter((p) => p.stock <= POS_LOW_STOCK).length,
      todaySales: (sales._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(2),
    };
  }

  private async toPos(storeId: number, rows: Row[]): Promise<PosProduct[]> {
    const lines = rows.flatMap((p) =>
      p.hasVariants
        ? p.variants.map((v) => ({ p, v }))
        : [{ p, v: null as Row['variants'][number] | null }],
    );
    const qty = await this.stock.quantities(
      storeId,
      lines.map(({ p, v }) => ({ productId: p.id, variantId: v?.id ?? null })),
    );
    return lines.map(({ p, v }) => ({
      productId: p.id,
      variantId: v?.id ?? null,
      name: p.translations[0]?.name ?? p.slug,
      variantLabel: v
        ? v.attributeValues
            .map((a) => a.attributeValue.translations[0]?.value)
            .filter(Boolean)
            .join(' / ') || null
        : null,
      sku: v?.sku ?? p.sku,
      barcode: v ? v.barcode : p.barcode,
      price: (v?.price ?? p.price ?? new Prisma.Decimal(0)).toFixed(2),
      salePrice: (v ? v.salePrice : p.salePrice)?.toFixed(2) ?? null,
      imageUrl: p.media[0]?.media.cardUrl ?? p.media[0]?.media.url ?? null,
      categoryIds: p.categories.map((c) => c.categoryId),
      stock: p.trackInventory
        ? (qty.get(stockKey(p.id, v?.id ?? null)) ?? 0)
        : 9999,
      storeOnly: p.storeId !== null,
    }));
  }
}
