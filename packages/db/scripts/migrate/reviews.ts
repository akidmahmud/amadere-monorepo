import type { Connection } from 'mysql2/promise';
import type { PrismaClient } from '../../src/index';
import type { VariantRef } from './catalog';
import { bump, type MigrationReport } from './report';

export async function migrateReviews(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
  customerId: Map<number, number>,
  productId: Map<number, number>,
  variantRef: Map<number, VariantRef>,
  adminUserId: number,
): Promise<void> {
  const [rows] = await source.query<any[]>('SELECT * FROM ec_reviews');
  const [replyRows] = await source.query<any[]>('SELECT * FROM ec_review_replies');
  bump(report, 'reviews', 'source', rows.length);

  for (const row of rows) {
    const newCustomerId = row.customer_id ? customerId.get(row.customer_id) : undefined;
    const newProductId = variantRef.get(row.product_id)?.productId ?? productId.get(row.product_id);

    if (!newCustomerId || !newProductId) {
      report.reviewsUnmatched.push({
        legacyReviewId: row.id,
        customerLegacyId: row.customer_id,
        productLegacyId: row.product_id,
      });
      bump(report, 'reviews', 'skipped');
      continue;
    }

    // Schema requires a unique, non-null orderItemId (proves verified
    // purchase, B8) — the old system had no such link. Best-effort: the
    // customer's most recent order item for this product, any status.
    const orderItem = await prisma.orderItem.findFirst({
      where: { productId: newProductId, order: { customerId: newCustomerId } },
      orderBy: { id: 'desc' },
    });
    if (!orderItem) {
      report.reviewsUnmatched.push({
        legacyReviewId: row.id,
        customerLegacyId: row.customer_id,
        productLegacyId: row.product_id,
      });
      bump(report, 'reviews', 'skipped');
      continue;
    }

    const existing = await prisma.review.findUnique({
      where: { productId_customerId: { productId: newProductId, customerId: newCustomerId } },
    });
    if (existing) {
      bump(report, 'reviews', 'skipped');
      continue;
    }

    const images: string[] = (() => {
      try {
        return row.images ? (JSON.parse(row.images) as string[]) : [];
      } catch {
        return [];
      }
    })();

    const review = await prisma.review.create({
      data: {
        productId: newProductId,
        customerId: newCustomerId,
        orderItemId: orderItem.id,
        orderId: orderItem.orderId,
        rating: Math.round(row.star ?? 5),
        comment: row.comment,
        images: images.map((p) => `legacy://${p}`),
        status: 'APPROVED',
        createdAt: row.created_at ?? new Date(),
      },
    });
    bump(report, 'reviews', 'migrated');

    const reply = replyRows.find((r) => r.review_id === row.id);
    if (reply) {
      await prisma.reviewReply.upsert({
        where: { reviewId: review.id },
        create: {
          reviewId: review.id,
          adminUserId,
          message: reply.message,
          createdAt: reply.created_at ?? new Date(),
        },
        update: {},
      });
    }
  }
}
