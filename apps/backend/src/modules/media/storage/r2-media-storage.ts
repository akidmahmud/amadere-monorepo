import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { MediaStorage, UploadedObject } from './media-storage.interface';

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
      }),
    );
    return { url: `${publicBaseUrl}/${key}` };
  }

  async delete(key: string): Promise<void> {
    const { client, bucket } = this.getClient();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}
