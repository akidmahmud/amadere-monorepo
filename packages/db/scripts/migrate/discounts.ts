import type { Connection } from 'mysql2/promise';
import type { PrismaClient } from '../../src/index';
import { Prisma } from '../../src/index';
import { bump, type MigrationReport } from './report';

const Decimal = Prisma.Decimal;

export async function migrateDiscounts(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
): Promise<void> {
  const [rows] = await source.query<any[]>('SELECT * FROM ec_discounts');
  bump(report, 'discounts', 'source', rows.length);

  for (const row of rows) {
    // All 16 legacy rows are target='all-orders' with no product/category
    // scoping — nothing to migrate into DiscountProduct/DiscountCategory.
    await prisma.discount.upsert({
      where: { legacyId: row.id },
      create: {
        legacyId: row.id,
        code: row.code,
        type: row.type === 'promotion' ? 'PROMOTION' : 'COUPON',
        valueType: row.type_option === 'shipping' ? 'FREE_SHIPPING' : 'PERCENTAGE',
        value: new Decimal(row.value ?? 0),
        minOrderAmount: row.min_order_price ? new Decimal(row.min_order_price) : null,
        maxUsesTotal: row.quantity ?? null,
        usedCount: row.total_used ?? 0,
        startsAt: row.start_date,
        endsAt: row.end_date,
        status: 'PUBLISHED',
      },
      update: {
        usedCount: row.total_used ?? 0,
      },
    });
    bump(report, 'discounts', 'migrated');
  }
}
