import { config } from 'dotenv';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

config({ path: path.resolve(__dirname, '../../../.env') });

// DB backup strategy (AGENTS.md §6 "Backups: DB dump strategy + off-server
// target"): pg_dump -> gzip locally, then best-effort upload to R2 (the
// same off-server target Media already uses) if credentials are present.
// Intended to run from cron/CI, not the app process — hence a bare script,
// same pattern as prisma/seed.ts.
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required to back up');

  const outDir = process.env.BACKUP_DIR ?? path.resolve(__dirname, '../../../backups');
  mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `amader-${timestamp}.sql.gz`;
  const filePath = path.join(outDir, filename);

  console.log(`Dumping database to ${filePath} ...`);
  await dumpToGzip(databaseUrl, filePath);
  console.log('Local backup written.');

  await maybeUploadToR2(filePath, filename);
}

function dumpToGzip(databaseUrl: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dump = spawn('pg_dump', [
      `--dbname=${databaseUrl}`,
      '--format=plain',
      '--no-owner',
      '--no-privileges',
    ]);
    dump.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk));

    let spawnFailed = false;
    dump.on('error', (err) => {
      spawnFailed = true;
      reject(
        new Error(
          `Failed to launch pg_dump (is the PostgreSQL client installed and on PATH?): ${err.message}`,
        ),
      );
    });

    // Registered synchronously (not inside the pipeline's .then()) so a
    // fast-exiting process can't fire 'close' before anything is listening —
    // that race left this promise unsettled on small dumps.
    const closed = new Promise<number | null>((res) => {
      dump.on('close', (code) => res(code));
    });

    pipeline(dump.stdout, createGzip(), createWriteStream(filePath))
      .then(() => closed)
      .then((code) => {
        if (spawnFailed) return;
        if (code === 0) resolve();
        else reject(new Error(`pg_dump exited with code ${code}`));
      })
      .catch((err: unknown) => {
        if (!spawnFailed) reject(err as Error);
      });
  });
}

async function maybeUploadToR2(filePath: string, filename: string): Promise<void> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    console.log(
      'R2 credentials not configured — backup left local-only. Set R2_* env vars to also upload off-server.',
    );
    return;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  const key = `backups/${filename}`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: readFileSync(filePath),
      ContentType: 'application/gzip',
    }),
  );
  console.log(`Uploaded off-server to R2: ${key}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
