import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import {
  MediaStorage,
  PrivateObject,
  UploadedObject,
} from './media-storage.interface';
import { R2MediaStorage } from './r2-media-storage';

/** Where the VPS copy lives. `public/` is served at /media-mirror (main.ts). */
export const mediaMirrorDir = (config: ConfigService): string =>
  path.resolve(config.get<string>('MEDIA_MIRROR_DIR') ?? 'media-mirror');

type Pending =
  | { op: 'upload'; key: string; private: boolean; contentType: string }
  | { op: 'delete'; key: string };

/**
 * R2 with a full copy on the VPS disk.
 *
 * Every file is written to disk as well as R2, so when R2 is unreachable
 * (the subscription was dropped on 2026-11-04 and every uncached image
 * broke) the cdn.amadere.com Worker serves the disk copy instead, and
 * uploads still succeed. Whatever could not reach R2 is queued and pushed
 * by the sync job once R2 is back. URLs never change: they always point at
 * the R2 public base; only who answers them does.
 */
@Injectable()
export class MirroredMediaStorage implements MediaStorage {
  private readonly logger = new Logger(MirroredMediaStorage.name);
  private readonly root: string;
  private syncing = false;

  constructor(
    private readonly r2: R2MediaStorage,
    config: ConfigService,
  ) {
    this.root = mediaMirrorDir(config);
  }

  private file(key: string, priv: boolean): string {
    const base = path.join(this.root, priv ? 'private' : 'public');
    const p = path.resolve(base, key);
    if (!p.startsWith(base + path.sep)) throw new Error(`Bad media key: ${key}`);
    return p;
  }

  private async save(key: string, priv: boolean, body: Buffer): Promise<void> {
    const p = this.file(key, priv);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body);
  }

  private async queue(job: Pending): Promise<void> {
    const dir = path.join(this.root, 'pending');
    await mkdir(dir, { recursive: true });
    const id = createHash('sha1').update(`${job.op}:${job.key}`).digest('hex');
    await writeFile(path.join(dir, `${id}.json`), JSON.stringify(job));
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<UploadedObject> {
    await this.save(key, false, body);
    try {
      return await this.r2.upload(key, body, contentType);
    } catch (e) {
      this.logger.warn(`R2 upload failed, kept on disk: ${key} (${(e as Error).message})`);
      await this.queue({ op: 'upload', key, private: false, contentType });
      return { url: this.r2.publicUrl(key) };
    }
  }

  async uploadPrivate(key: string, body: Buffer, contentType: string): Promise<PrivateObject> {
    await this.save(key, true, body);
    try {
      return await this.r2.uploadPrivate(key, body, contentType);
    } catch (e) {
      this.logger.warn(`R2 upload failed, kept on disk: ${key} (${(e as Error).message})`);
      await this.queue({ op: 'upload', key, private: true, contentType });
      return { key };
    }
  }

  async getObjectStream(key: string): Promise<Readable> {
    try {
      return await this.r2.getObjectStream(key);
    } catch (e) {
      // Private files (digital products) first, then public ones.
      for (const priv of [true, false]) {
        const p = this.file(key, priv);
        if (existsSync(p)) return createReadStream(p);
      }
      throw e;
    }
  }

  async copy(fromKey: string, toKey: string): Promise<UploadedObject> {
    const from = this.file(fromKey, false);
    if (existsSync(from)) {
      const to = this.file(toKey, false);
      await mkdir(path.dirname(to), { recursive: true });
      await copyFile(from, to);
    }
    try {
      return await this.r2.copy(fromKey, toKey);
    } catch (e) {
      if (!existsSync(from)) throw e;
      await this.queue({ op: 'upload', key: toKey, private: false, contentType: contentTypeOf(toKey) });
      return { url: this.r2.publicUrl(toKey) };
    }
  }

  async delete(key: string): Promise<void> {
    for (const priv of [false, true]) await rm(this.file(key, priv), { force: true });
    try {
      await this.r2.delete(key);
    } catch {
      await this.queue({ op: 'delete', key });
    }
  }

  /** Push what was queued while R2 was down. Stops at the first failure. */
  @Cron('0 */5 * * * *')
  async syncPending(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const dir = path.join(this.root, 'pending');
      const names = existsSync(dir) ? await readdir(dir) : [];
      for (const name of names) {
        const at = path.join(dir, name);
        const job = JSON.parse(await readFile(at, 'utf8')) as Pending;
        if (job.op === 'upload' && !existsSync(this.file(job.key, job.private))) {
          await rm(at, { force: true }); // deleted since; nothing to push
          continue;
        }
        try {
          if (job.op === 'delete') await this.r2.delete(job.key);
          else {
            const body = await readFile(this.file(job.key, job.private));
            if (job.private) await this.r2.uploadPrivate(job.key, body, job.contentType);
            else await this.r2.upload(job.key, body, job.contentType);
          }
          await rm(at, { force: true });
          this.logger.log(`Synced to R2: ${job.op} ${job.key}`);
        } catch (e) {
          // ponytail: R2 still down (or the disk file vanished); retry next run.
          this.logger.warn(`R2 sync paused: ${(e as Error).message}`);
          return;
        }
      }
    } finally {
      this.syncing = false;
    }
  }
}

const TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
};
const contentTypeOf = (key: string) =>
  TYPES[key.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
