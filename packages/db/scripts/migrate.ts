import { config } from 'dotenv';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { createPrismaClient } from '../src/index';
import { connectSource } from './migrate/mysql-source';
import { createReport } from './migrate/report';
import {
  migrateAttributes,
  migrateBrands,
  migrateCategories,
  migrateProductTags,
  migrateProducts,
} from './migrate/catalog';
import { migrateBlogCategories, migrateBlogTags, migrateBlogPosts, migratePages, migrateNewsletter } from './migrate/blog';
import { migrateCustomers, migrateCustomerAddresses } from './migrate/customers';
import { migrateOrders } from './migrate/orders';
import { migrateReviews } from './migrate/reviews';
import { migrateDiscounts } from './migrate/discounts';
import { migrateSeoMeta, migrateRedirects } from './migrate/misc';

config({ path: path.resolve(__dirname, '../../../.env') });

// B12 — one-time, idempotent ETL from the old Botble/Laravel/MariaDB dump
// (loaded into the mysql_source docker-compose service) into this new
// schema. Deliberately requires MIGRATION_DATABASE_URL rather than falling
// back to DATABASE_URL — the plan explicitly targets a copy database, not
// whatever the app's regular dev DB happens to be, and a silent fallback
// here is exactly the kind of mistake that's expensive to undo.
async function main() {
  const targetUrl = process.env.MIGRATION_DATABASE_URL;
  if (!targetUrl) {
    throw new Error(
      'MIGRATION_DATABASE_URL is required (point it at a copy database, e.g. ' +
        'postgresql://amader:amader@localhost:5433/amader_migration — never the ' +
        'regular DATABASE_URL used for dev/testing).',
    );
  }

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (!superAdminEmail) throw new Error('SUPER_ADMIN_EMAIL is required');

  const source = await connectSource();
  const prisma = createPrismaClient(targetUrl);
  const report = createReport();

  try {
    const superAdmin = await prisma.adminUser.findUniqueOrThrow({
      where: { email: superAdminEmail },
    });

    console.log('Migrating catalog...');
    const brandId = await migrateBrands(source, prisma, report);
    const categoryId = await migrateCategories(source, prisma, report);
    const productTagId = await migrateProductTags(source, prisma, report);
    const { attributeValueId } = await migrateAttributes(source, prisma, report);
    const { productId, variantRef } = await migrateProducts(
      source,
      prisma,
      report,
      brandId,
      categoryId,
      productTagId,
      attributeValueId,
    );

    console.log('Migrating blog + pages + newsletter...');
    const blogCategoryId = await migrateBlogCategories(source, prisma, report);
    const blogTagId = await migrateBlogTags(source, prisma, report);
    await migrateBlogPosts(source, prisma, report, superAdmin.id, blogCategoryId, blogTagId);
    await migratePages(source, prisma, report);
    await migrateNewsletter(source, prisma, report);

    console.log('Migrating customers...');
    const customerId = await migrateCustomers(source, prisma, report);
    await migrateCustomerAddresses(source, prisma, report, customerId);

    console.log('Migrating orders, items, addresses, payments, shipments...');
    await migrateOrders(source, prisma, report, customerId, productId, variantRef);

    // Two pre-existing data-integrity artifacts in the *old* database
    // (dangling foreign keys with no cascade) — confirmed directly against
    // the source, not a migration defect. Counted here so the report says
    // so explicitly instead of leaving an unexplained gap between source
    // and migrated counts.
    const [[{ c: orphanedAddresses }]] = await source.query<any[]>(
      'SELECT COUNT(*) c FROM ec_order_addresses oa LEFT JOIN ec_orders o ON o.id = oa.order_id WHERE o.id IS NULL',
    );
    const [[{ c: orphanedPayments }]] = await source.query<any[]>(
      'SELECT COUNT(*) c FROM payments p LEFT JOIN ec_orders o ON o.id = p.order_id WHERE o.id IS NULL AND p.order_id IS NOT NULL',
    );
    if (orphanedAddresses > 0) {
      report.notes.push(
        `${orphanedAddresses} ec_order_addresses row(s) reference an order_id that` +
          ` doesn't exist in ec_orders — a pre-existing dangling-FK artifact in the` +
          ` old database, not a migration defect. Correctly skipped (nothing valid to attach them to).`,
      );
    }
    if (orphanedPayments > 0) {
      report.notes.push(
        `${orphanedPayments} payments row(s) reference an order_id that doesn't` +
          ` exist in ec_orders — same pre-existing dangling-FK artifact. Correctly skipped.`,
      );
    }

    console.log('Migrating reviews...');
    await migrateReviews(source, prisma, report, customerId, productId, variantRef, superAdmin.id);
    if (report.reviewsUnmatched.length > 0) {
      report.notes.push(
        `${report.reviewsUnmatched.length} of ${report.counts.reviews?.source ?? 0} legacy` +
          ` reviews could not be matched to a real order item for that exact` +
          ` customer+product (spot-checked one by hand: the reviewing customer had` +
          ` real orders, just never one containing the reviewed product) — the old` +
          ` ec_reviews table had no order/order-item link at all, so it never` +
          ` actually enforced "verified purchase," despite the storefront likely` +
          ` presenting them as reviews. This is a genuine data-quality finding` +
          ` about the old site, not a migration defect; see reviewsUnmatched for` +
          ` the exact rows to review by hand.`,
      );
    }

    console.log('Migrating discounts...');
    await migrateDiscounts(source, prisma, report);

    console.log('Migrating SEO meta...');
    const pageRows = await prisma.page.findMany({ where: { legacyId: { not: null } } });
    const pageId = new Map(pageRows.map((p) => [p.legacyId!, p.id]));
    await migrateSeoMeta(source, prisma, report, {
      brandId,
      categoryId,
      productTagId,
      productId,
      blogCategoryId,
      pageId,
    });

    console.log('Building redirect map...');
    await migrateRedirects(source, prisma, report);

    const reportPath = path.resolve(__dirname, '../migrate-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nDone. Report written to ${reportPath}\n`);
    console.log(JSON.stringify(report.counts, null, 2));
    console.log(`Addresses defaulted to Dhaka: ${report.addressesDefaulted.length}`);
    console.log(`Reviews unmatched: ${report.reviewsUnmatched.length}`);
    console.log(`POS payments mapped to COD: ${report.posPaymentsMappedToCod}`);
    console.log(
      `Redirects created: ${report.redirectsCreated}, already matching (skipped): ${report.redirectsSkippedAlreadyMatching}`,
    );
  } finally {
    await source.end();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
