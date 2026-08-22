/**
 * Repairs media URLs that contain characters a browser cannot fetch.
 *
 * The upload path used to paste `file.originalname` straight into the storage
 * key, so a file called "Sorishar tel Banner.webp" produced a URL with literal
 * spaces. The upload succeeded, the row was created with correct dimensions,
 * and the thumbnail rendered blank forever. media.service.ts now sanitizes
 * filenames, but rows written before that fix are still broken.
 *
 * The files themselves are fine and already in R2 under those keys — only the
 * stored URL string is unusable. So this percent-encodes the filename segment
 * rather than moving any object, which keeps it a pure database update with
 * nothing to roll back in storage.
 *
 * DRY RUN BY DEFAULT. Pass --apply to write.
 *
 *   pnpm --filter @amader/db exec tsx scripts/fix-media-urls.ts
 *   pnpm --filter @amader/db exec tsx scripts/fix-media-urls.ts --apply
 */
import { config } from 'dotenv';
import path from 'node:path';
import { createPrismaClient } from '../src/index';

config({ path: path.resolve(__dirname, '../../../.env') });

const APPLY = process.argv.includes('--apply');

/** Percent-encodes only the last path segment, leaving the origin and any
 * folder prefix alone. Already-encoded URLs are left untouched so the script
 * is safe to run twice. */
function encodeFilenameSegment(url: string): string {
  const lastSlash = url.lastIndexOf('/');
  if (lastSlash < 0) return url;
  const prefix = url.slice(0, lastSlash + 1);
  const name = url.slice(lastSlash + 1);
  // decodeURIComponent first so a re-run does not double-encode (%20 -> %2520).
  let decoded: string;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    decoded = name;
  }
  return prefix + encodeURIComponent(decoded);
}

/** A URL the browser can fetch as-is: no spaces, quotes, or other characters
 * that need encoding in a path segment. */
const NEEDS_FIX = /[ ()[\]{}#?&+%,'"<>^`|\\]/;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const prisma = createPrismaClient(databaseUrl);

  const rows = await prisma.media.findMany({
    select: { id: true, url: true, cardUrl: true, fullUrl: true },
    orderBy: { id: 'asc' },
  });

  const changes: { id: number; field: 'url' | 'cardUrl' | 'fullUrl'; from: string; to: string }[] = [];
  for (const row of rows) {
    for (const field of ['url', 'cardUrl', 'fullUrl'] as const) {
      const value = row[field];
      if (!value) continue;
      const lastSlash = value.lastIndexOf('/');
      const name = lastSlash >= 0 ? value.slice(lastSlash + 1) : value;
      if (!NEEDS_FIX.test(name)) continue;
      const next = encodeFilenameSegment(value);
      if (next !== value) changes.push({ id: row.id, field, from: value, to: next });
    }
  }

  console.log(`Scanned ${rows.length} media rows.`);
  console.log(`${changes.length} URL(s) need repair.\n`);
  for (const c of changes) {
    console.log(`  #${c.id} ${c.field}`);
    console.log(`    from: ${c.from.slice(c.from.lastIndexOf('/') + 1)}`);
    console.log(`      to: ${c.to.slice(c.to.lastIndexOf('/') + 1)}`);
  }

  if (changes.length === 0) {
    console.log('\nNothing to do.');
    await prisma.$disconnect();
    return;
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to save.');
    await prisma.$disconnect();
    return;
  }

  // One row at a time: a partial failure leaves already-fixed rows fixed,
  // and the script is idempotent so re-running finishes the job.
  let updated = 0;
  for (const c of changes) {
    await prisma.media.update({ where: { id: c.id }, data: { [c.field]: c.to } });
    updated += 1;
  }
  console.log(`\nUpdated ${updated} URL(s).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
