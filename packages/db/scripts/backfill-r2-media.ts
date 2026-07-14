import { config } from 'dotenv';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createPrismaClient } from '../src/index';

config({ path: path.resolve(__dirname, '../../../.env') });

// One-time follow-up to B12's migration ETL (AGENTS.md §8/§B12): every
// migrated media reference was stored as a `legacy://{path}` placeholder
// pointing at a file that still only exists on the old Botble site
// (confirmed live: `legacy://{path}` == `https://www.amadere.com/storage/{path}`
// on the still-running legacy site). Now that real R2 credentials exist,
// this downloads each real file from the legacy site and re-uploads it to
// R2, then rewrites every column that held the `legacy://` placeholder to
// the new real R2 URL. Idempotent-ish: re-running only touches rows that
// still start with `legacy://` (already-migrated rows are left alone), so a
// partial failure can just be re-run.
//
// Covers every place a legacy image reference can live, confirmed by a
// full-database dump grep, not just the "obviously product-shaped" columns —
// customer avatars and review photos are just as real as product images and
// were missed on the first pass specifically because reviews.images is a
// String[] array, not a plain string column like the other five.
const LEGACY_ORIGIN = 'https://www.amadere.com/storage/';

const STRING_COLUMNS: { table: string; column: string }[] = [
  { table: 'media', column: 'url' },
  { table: 'brands', column: 'logo_url' },
  { table: 'categories', column: 'image_url' },
  { table: 'blog_posts', column: 'image_url' },
  { table: 'seo_meta', column: 'og_image_url' },
  { table: 'customers', column: 'avatar_url' },
];

const ARRAY_COLUMNS: { table: string; column: string }[] = [{ table: 'reviews', column: 'images' }];

const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const prisma = createPrismaClient(databaseUrl);

  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (!accountId || !bucket || !publicBaseUrl || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2_* env vars are required');
  }
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  // Phase 1: collect every distinct legacy:// path across every column shape.
  const paths = new Set<string>();
  for (const { table, column } of STRING_COLUMNS) {
    const rows = await prisma.$queryRawUnsafe<{ v: string }[]>(
      `SELECT DISTINCT "${column}" AS v FROM "${table}" WHERE "${column}" LIKE 'legacy://%'`,
    );
    for (const row of rows) paths.add(row.v);
  }
  for (const { table, column } of ARRAY_COLUMNS) {
    const rows = await prisma.$queryRawUnsafe<{ v: string[] }[]>(
      `SELECT DISTINCT unnest("${column}") AS v FROM "${table}" WHERE EXISTS (SELECT 1 FROM unnest("${column}") x WHERE x LIKE 'legacy://%')`,
    );
    for (const row of rows) {
      const v = row.v as unknown as string;
      if (v.startsWith('legacy://')) paths.add(v);
    }
  }

  console.log(`${paths.size} distinct legacy file(s) to migrate.`);

  const urlMap = new Map<string, string>(); // legacy:// -> real R2 url
  const failed: { legacyUrl: string; reason: string }[] = [];

  // Phase 2: download from the legacy origin, re-upload to R2. Small
  // concurrency window — polite to the legacy origin, still fast.
  const list = [...paths];
  const CONCURRENCY = 6;
  let cursor = 0;
  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= list.length) return;
      const legacyUrl = list[i];
      const relPath = legacyUrl.slice('legacy://'.length).replace(/^\.?\//, '');
      try {
        const res = await fetch(LEGACY_ORIGIN + relPath);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const body = Buffer.from(await res.arrayBuffer());
        const ext = relPath.split('.').pop()?.toLowerCase() ?? '';
        const contentType = CONTENT_TYPES[ext] ?? res.headers.get('content-type') ?? 'application/octet-stream';
        const key = `legacy/${relPath}`;

        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
        urlMap.set(legacyUrl, `${publicBaseUrl}/${key}`);
        console.log(`OK   ${relPath} (${body.length} bytes)`);
      } catch (err) {
        failed.push({ legacyUrl, reason: err instanceof Error ? err.message : String(err) });
        console.log(`FAIL ${relPath}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Phase 3: rewrite every column to point at the new R2 urls.
  for (const [legacyUrl, newUrl] of urlMap) {
    for (const { table, column } of STRING_COLUMNS) {
      await prisma.$executeRawUnsafe(`UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" = $2`, newUrl, legacyUrl);
    }
  }
  for (const { table, column } of ARRAY_COLUMNS) {
    const rows = await prisma.$queryRawUnsafe<{ id: number; v: string[] }[]>(
      `SELECT id, "${column}" AS v FROM "${table}" WHERE EXISTS (SELECT 1 FROM unnest("${column}") x WHERE x LIKE 'legacy://%')`,
    );
    for (const row of rows) {
      const next = row.v.map((url) => urlMap.get(url) ?? url);
      await prisma.$executeRawUnsafe(`UPDATE "${table}" SET "${column}" = $1 WHERE id = $2`, next, row.id);
    }
  }

  console.log(`\nDone. ${urlMap.size} succeeded, ${failed.length} failed.`);
  if (failed.length > 0) {
    console.log('Failures:');
    for (const f of failed) console.log(`  ${f.legacyUrl} — ${f.reason}`);
  }

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
