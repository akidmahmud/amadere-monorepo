import { config } from 'dotenv';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { generateImageDerivatives } from '@amader/shared/image-derivatives';
import { createPrismaClient } from '../src/index';

config({ path: path.resolve(__dirname, '../../../.env') });

// One-time follow-up to the media upload pipeline gaining card/full WebP
// derivatives (media.service.ts) — every Media row created before that
// change has cardUrl/fullUrl still null. Downloads each original from its
// already-public R2 url, generates the same two derivatives new uploads get,
// re-uploads them, and fills in the row. Idempotent: only rows with
// cardUrl IS NULL are selected, so a partial run (or a new upload landing
// mid-run) can't be double-processed by re-running this.
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

  const rows = await prisma.media.findMany({
    where: { type: 'IMAGE', cardUrl: null, url: { startsWith: 'http' } },
    select: { id: true, url: true },
  });
  console.log(`${rows.length} image(s) missing derivatives.`);

  let succeeded = 0;
  const failed: { id: number; url: string; reason: string }[] = [];

  const CONCURRENCY = 6;
  let cursor = 0;
  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= rows.length) return;
      const row = rows[i];
      try {
        const res = await fetch(row.url);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const original = Buffer.from(await res.arrayBuffer());

        const derivatives = await generateImageDerivatives(original);
        if (!derivatives) {
          console.log(`SKIP ${row.id} ${row.url} — not a decodable raster format`);
          continue;
        }

        // Same id already embedded in the original's own key/filename
        // (media.service.ts's `${type}/${id}-${name}`) — reuse it here so a
        // human scanning the bucket can tell a derivative apart from an
        // unrelated upload at a glance, same convention new uploads use.
        const cardKey = `image/backfill-${row.id}-card.webp`;
        const fullKey = `image/backfill-${row.id}-full.webp`;
        await Promise.all([
          s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: cardKey,
            Body: derivatives.card.buffer,
            ContentType: derivatives.card.contentType,
            CacheControl: 'public, max-age=31536000, immutable',
          })),
          s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: fullKey,
            Body: derivatives.full.buffer,
            ContentType: derivatives.full.contentType,
            CacheControl: 'public, max-age=31536000, immutable',
          })),
        ]);

        await prisma.media.update({
          where: { id: row.id },
          data: { cardUrl: `${publicBaseUrl}/${cardKey}`, fullUrl: `${publicBaseUrl}/${fullKey}` },
        });
        succeeded++;
        console.log(`OK   ${row.id} (${original.length} -> ${derivatives.card.buffer.length}/${derivatives.full.buffer.length} bytes)`);
      } catch (err) {
        failed.push({ id: row.id, url: row.url, reason: err instanceof Error ? err.message : String(err) });
        console.log(`FAIL ${row.id} ${row.url}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\nDone. ${succeeded} succeeded, ${failed.length} failed.`);
  if (failed.length > 0) {
    console.log('Failures:');
    for (const f of failed) console.log(`  ${f.id} ${f.url} — ${f.reason}`);
  }

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
