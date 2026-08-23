import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  MediaStorage,
  PrivateObject,
  UploadedObject,
} from './media-storage.interface';

@Injectable()
export class R2MediaStorage implements MediaStorage {
  private client?: S3Client;
  private bucket?: string;
  private publicBaseUrl?: string;

  constructor(private readonly config: ConfigService) {}

  // Lazy: R2 credentials aren't required for the app to boot (they arrive
  // later, same as Payment/Courier) — only actually uploading needs them.
  private getClient(): {
    client: S3Client;
    bucket: string;
    publicBaseUrl: string;
  } {
    if (!this.client) {
      const accountId = this.config.getOrThrow<string>('R2_ACCOUNT_ID');
      this.bucket = this.config.getOrThrow<string>('R2_BUCKET');
      this.publicBaseUrl = this.config
        .getOrThrow<string>('R2_PUBLIC_BASE_URL')
        .replace(/\/$/, '');
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
          secretAccessKey: this.config.getOrThrow<string>(
            'R2_SECRET_ACCESS_KEY',
          ),
        },
      });
    }
    return {
      client: this.client,
      bucket: this.bucket!,
      publicBaseUrl: this.publicBaseUrl!,
    };
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<UploadedObject> {
    const { client, bucket, publicBaseUrl } = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Every key embeds a randomUUID (media.service.ts) and is never
        // overwritten in place — a re-upload gets a new key, an edit
        // creates a new Media row — so it's safe to cache forever. Flagged
        // live as one of the two largest Lighthouse opportunities on the
        // storefront (11.8MB/7.8MB "Use efficient cache lifetimes"), since
        // R2 wasn't setting this at all before.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return { url: `${publicBaseUrl}/${key}` };
  }

  async uploadPrivate(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<PrivateObject> {
    const { client, bucket } = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // No CacheControl and no public URL returned. The object is only ever
        // read back through getObjectStream() behind an entitlement check.
        CacheControl: 'private, no-store',
      }),
    );
    return { key };
  }

  async getObjectStream(key: string): Promise<Readable> {
    const { client, bucket } = this.getClient();
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    return res.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    const { client, bucket } = this.getClient();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}
