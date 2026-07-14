import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';

export interface InventoryRow {
  productId: number;
  variantId: number | null;
  slug: string;
  name: string;
  sku: string | null;
  stock: number;
  reservedStock: number;
  available: number;
  stockStatus: string;
}

export type InventoryFilter = 'all' | 'low' | 'out';

const OVERVIEW_DEFAULTS = { lowStockThreshold: 10 };

// ADDENDUM §B1 — reads the existing Product/ProductVariant stock columns
// directly (no parallel stock store); a simple product is one row, a
// variant product contributes one row per variant instead of the parent.
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
  ) {}

  async getThreshold(): Promise<number> {
    const cfg = await this.settings.getNamespace('overview', OVERVIEW_DEFAULTS);
    return cfg.lowStockThreshold;
  }

  async setThreshold(lowStockThreshold: number): Promise<{ lowStockThreshold: number }> {
    await this.settings.setNamespace('overview', { lowStockThreshold });
    return { lowStockThreshold };
  }

  private baseQuery(): Prisma.Sql {
    return Prisma.sql`
      SELECT p.id AS product_id, NULL::int AS variant_id, p.slug, COALESCE(pt.name, p.slug) AS name, p.sku,
             p.stock, p.reserved_stock, (p.stock - p.reserved_stock) AS available, p.stock_status::text AS stock_status
      FROM products p
      LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = 'EN'
      WHERE p.deleted_at IS NULL AND p.has_variants = false
      UNION ALL
      SELECT p.id AS product_id, v.id AS variant_id, p.slug, COALESCE(pt.name, p.slug) AS name, v.sku,
             v.stock, v.reserved_stock, (v.stock - v.reserved_stock) AS available, v.stock_status::text AS stock_status
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = 'EN'
      WHERE p.deleted_at IS NULL
    `;
  }

  private filterClause(filter: InventoryFilter, threshold: number): Prisma.Sql {
    if (filter === 'out') return Prisma.sql`WHERE available <= 0`;
    if (filter === 'low') return Prisma.sql`WHERE available > 0 AND available <= ${threshold}`;
    return Prisma.empty;
  }

  async list(filter: InventoryFilter, page: number, pageSize: number): Promise<PaginatedResult<InventoryRow>> {
    const threshold = await this.getThreshold();
    const base = this.baseQuery();
    const where = this.filterClause(filter, threshold);
    const offset = (page - 1) * pageSize;

    const [rows, countRows] = await Promise.all([
      this.prisma.client.$queryRaw<
        { product_id: number; variant_id: number | null; slug: string; name: string; sku: string | null; stock: number; reserved_stock: number; available: number; stock_status: string }[]
      >`SELECT * FROM (${base}) inv ${where} ORDER BY available ASC LIMIT ${pageSize} OFFSET ${offset}`,
      this.prisma.client.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint AS count FROM (${base}) inv ${where}`,
    ]);

    const items: InventoryRow[] = rows.map((r) => ({
      productId: r.product_id,
      variantId: r.variant_id,
      slug: r.slug,
      name: r.name,
      sku: r.sku,
      stock: r.stock,
      reservedStock: r.reserved_stock,
      available: r.available,
      stockStatus: r.stock_status,
    }));
    return { items, total: Number(countRows[0]?.count ?? 0), page, pageSize };
  }

  async exportCsv(filter: InventoryFilter): Promise<string> {
    const { items } = await this.list(filter, 1, 10_000);
    const header = 'Product,Variant ID,SKU,Stock,Reserved,Available,Status';
    const lines = items.map((r) => `"${r.name}",${r.variantId ?? ''},${r.sku ?? ''},${r.stock},${r.reservedStock},${r.available},${r.stockStatus}`);
    return [header, ...lines].join('\n');
  }
}
