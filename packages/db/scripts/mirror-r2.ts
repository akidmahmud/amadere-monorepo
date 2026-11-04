import { config } from 'dotenv';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

config({ path: path.resolve(__dirname, '../../../.env') });

// One-time (re-runnable): copy every object in the R2 bucket to the VPS
// mirror that MirroredMediaStorage keeps from now on, so the cdn.amadere.com
// Worker has something to fall back on for files uploaded before the mirror
// existed. Skips files already on disk. Digital-product PDFs (`digital/`) go
// to the private folder, which is never served.
//
//   MEDIA_MIRROR_DIR=/var/www/amadere-media pnpm --filter @amader/db mirror:r2
async function main() {
  const root = process.env.MEDIA_MIRROR_DIR;
  if (!root) throw new Error('Set MEDIA_MIRROR_DIR (the same folder the backend uses)');
  const bucket = process.env.R2_BUCKET;
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!bucket || !accountId || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
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

  let token: string | undefined;
  let copied = 0;
  let skipped = 0;
  let failed = 0;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    );
    for (const obj of page.Contents ?? []) {
      const key = obj.Key!;
      const dir = key.startsWith('digital/') ? 'private' : 'public';
      const file = path.join(path.resolve(root), dir, key);
      if (existsSync(file)) {
        skipped++;
        continue;
      }
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const body = Buffer.from(await res.Body!.transformToByteArray());
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, body);
        copied++;
        if (copied % 100 === 0) console.log(`  ${copied} copied…`);
      } catch (e) {
        failed++;
        console.warn(`  failed ${key}: ${(e as Error).message}`);
      }
    }
    token = page.NextContinuationToken;
  } while (token);

  console.log(`copied ${copied}, already there ${skipped}, failed ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
