/**
 * Seeds product reviews straight into the database — for reviews collected
 * outside the storefront (existing customers, Facebook comments, etc.).
 *
 * Content lives in `data/reviews_seed_data.json`; this file is only the loader.
 *
 * WHY THERE IS STILL A CUSTOMER ROW PER REVIEWER
 * ---------------------------------------------
 * `reviews.customer_id` is NOT NULL with a foreign key to `customers`, and the
 * public reviewer name is rendered from `customer.first_name` (see
 * reviews.mapper.ts). A review with no customer is therefore not expressible
 * in the current schema — that would need a migration adding a nullable
 * `author_name`. So each distinct `reviewerName` in the JSON gets one customer
 * row, reused across every product that name reviews.
 *
 * Those rows are marked, and deliberately unreachable:
 *   - email `review-<name>@seed.invalid` — `.invalid` is reserved by RFC 2606
 *     and can never resolve, so no mail can ever be delivered to one
 *   - no phone and no password hash, so nobody can ever log in as one
 *
 * Find them later with:
 *   SELECT * FROM customers WHERE email LIKE '%@seed.invalid';
 *
 * `reviews.order_item_id` is NOT NULL and unique but has NO foreign key
 * (verified against the live schema — only product_license_codes has one), and
 * nothing in the codebase ever reads it back. Seeded reviews get a NEGATIVE
 * value, which keeps the unique index satisfied, can never collide with a real
 * autoincrement id, and reads as "this was not a real purchase".
 *
 * Usage — dry run first, always:
 *   pnpm --filter @amader/db seed:reviews -- --dry-run
 *   pnpm --filter @amader/db seed:reviews
 */
import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { createPrismaClient } from '../src/index';

config({ path: path.resolve(__dirname, '../../../.env') });

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface ReviewSeed {
  productSlug: string;
  reviewerName: string;
  rating: number;
  comment?: string;
  /** ISO date, e.g. "2026-06-14". Defaults to now. Set it so a whole batch
   *  doesn't land on the same timestamp. */
  createdAt?: string;
  /** Defaults to APPROVED — only APPROVED reviews are shown publicly or
   *  counted in the average rating. */
  status?: ReviewStatus;
  images?: string[];
}

const DRY_RUN = process.argv.includes('--dry-run');

/** "Ratul Ahmed" -> review-ratul-ahmed@seed.invalid */
function seedEmail(name: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  // A name written in Bengali normalises to an empty slug — fall back to a
  // stable hash so the email stays unique and re-runs stay idempotent.
  const hash = [...name]
    .reduce((h, c) => (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0, 7)
    .toString(36);
  return `review-${slug || `x${hash}`}@seed.invalid`;
}

/** The mapper renders `firstName lastName[0].` — "Ratul Ahmed" -> "Ratul A." */
function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') || null };
}

function validate(rows: unknown): ReviewSeed[] {
  if (!Array.isArray(rows)) throw new Error('Seed JSON must be an array.');
  const problems: string[] = [];

  rows.forEach((r: ReviewSeed, i) => {
    const at = `row ${i + 1}`;
    if (!r?.productSlug) problems.push(`${at}: productSlug is required`);
    if (!r?.reviewerName) problems.push(`${at}: reviewerName is required`);
    if (!Number.isInteger(r?.rating) || r.rating < 1 || r.rating > 5) {
      problems.push(
        `${at}: rating must be a whole number 1-5, got ${JSON.stringify(r?.rating)}`,
      );
    }
    if (r?.createdAt && Number.isNaN(Date.parse(r.createdAt))) {
      problems.push(`${at}: createdAt "${r.createdAt}" is not a valid date`);
    }
  });

  // One review per reviewer per product is a database-level unique constraint.
  // Catching it here names both offending rows instead of throwing a bare P2002.
  const seen = new Map<string, number>();
  rows.forEach((r: ReviewSeed, i) => {
    const key = `${r?.productSlug}::${r?.reviewerName}`;
    const first = seen.get(key);
    if (first !== undefined) {
      problems.push(
        `row ${i + 1}: "${r.reviewerName}" already reviews "${r.productSlug}" in row ${first + 1} — one review per person per product`,
      );
    } else {
      seen.set(key, i);
    }
  });

  if (problems.length) {
    throw new Error(`Seed data is invalid:\n  ${problems.join('\n  ')}`);
  }
  return rows as ReviewSeed[];
}

async function main() {
  const targetUrl = process.env.DATABASE_URL;
  if (!targetUrl) throw new Error('DATABASE_URL is required in .env');

  const jsonPath = path.resolve(__dirname, 'data/reviews_seed_data.json');
  if (!fs.existsSync(jsonPath)) throw new Error(`Seed JSON not found at ${jsonPath}`);
  const rows = validate(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));

  console.log(
    `${DRY_RUN ? 'DRY RUN — nothing will be written' : 'Seeding'} ${rows.length} review(s)`,
  );
  console.log(`Database: ${targetUrl.replace(/\/\/[^@]*@/, '//***@')}\n`);

  const prisma = createPrismaClient(targetUrl);
  try {
    // Resolve every slug BEFORE writing anything. A typo in a product name
    // should abort the whole run, not leave half the reviews inserted.
    const slugs = [...new Set(rows.map((r) => r.productSlug))];
    const products = await prisma.product.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true },
    });
    const productIdBySlug = new Map(products.map((p) => [p.slug, p.id]));
    const missing = slugs.filter((s) => !productIdBySlug.has(s));
    if (missing.length) {
      throw new Error(
        `These product slugs do not exist — nothing was written:\n  ${missing.join('\n  ')}\n` +
          `Check them against: SELECT slug FROM products;`,
      );
    }

    // order_item_id has no foreign key but is unique. Start further negative
    // than any review already seeded so repeated runs never collide.
    const lowest = await prisma.review.aggregate({
      _min: { orderItemId: true },
    });
    let nextOrderItemId = Math.min(lowest._min.orderItemId ?? 0, 0) - 1;

    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const productId = productIdBySlug.get(row.productSlug)!;
      const email = seedEmail(row.reviewerName);
      const { firstName, lastName } = splitName(row.reviewerName);
      const createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
      const status = row.status ?? 'APPROVED';

      if (DRY_RUN) {
        console.log(
          `  would seed  ${row.rating}*  ${row.reviewerName} (${email})  ->  ${row.productSlug}  [${status}]`,
        );
        continue;
      }

      const customer = await prisma.customer.upsert({
        where: { email },
        create: { email, firstName, lastName },
        update: { firstName, lastName },
        select: { id: true },
      });

      const existing = await prisma.review.findUnique({
        where: { productId_customerId: { productId, customerId: customer.id } },
        select: { id: true },
      });

      if (existing) {
        await prisma.review.update({
          where: { id: existing.id },
          data: {
            rating: row.rating,
            comment: row.comment ?? null,
            images: row.images ?? [],
            status,
            createdAt,
          },
        });
        updated += 1;
        console.log(`  updated  ${row.rating}*  ${row.reviewerName}  ->  ${row.productSlug}`);
      } else {
        await prisma.review.create({
          data: {
            productId,
            customerId: customer.id,
            orderItemId: nextOrderItemId--,
            rating: row.rating,
            comment: row.comment ?? null,
            images: row.images ?? [],
            status,
            createdAt,
          },
        });
        created += 1;
        console.log(`  created  ${row.rating}*  ${row.reviewerName}  ->  ${row.productSlug}`);
      }
    }

    if (DRY_RUN) {
      console.log(
        `\nDry run OK — ${rows.length} row(s) valid, every product slug resolved.`,
      );
    } else {
      console.log(`\nDone. ${created} created, ${updated} updated.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`\nSeeding failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
