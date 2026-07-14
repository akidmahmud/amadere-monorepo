import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const KEY_PREFIX = 'credential.';

// Encryption-at-rest for third-party API secrets (courier/SMS gateway keys)
// that need to be admin-editable instead of `.env`-only — same gap the
// WPFOK plugin closes with its own AES-256-CBC helper; this uses GCM
// (authenticated, catches tampering/corruption on decrypt) keyed off a
// dedicated CREDENTIALS_ENCRYPTION_KEY, deliberately separate from the JWT
// secrets so rotating one doesn't affect the other. Ciphertext is stored as
// a plain string value in the existing generic `Setting` table — no new
// table, matching the same reuse-over-fork pattern as NetProfitSettingsService.
@Injectable()
export class CredentialsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getKey(): Buffer {
    const secret = this.config.getOrThrow<string>('CREDENTIALS_ENCRYPTION_KEY');
    return scryptSync(secret, 'amader-credentials-v1', 32);
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }

  // Blank/undefined never overwrites an existing credential — mirrors the
  // plugin's "leave blank to keep existing" masked-password field UX.
  async saveCredential(key: string, value: string | undefined): Promise<void> {
    if (!value) return;
    const ciphertext = this.encrypt(value);
    await this.prisma.client.setting.upsert({
      where: { key: KEY_PREFIX + key },
      create: { key: KEY_PREFIX + key, value: ciphertext },
      update: { value: ciphertext },
    });
  }

  async getCredential(key: string): Promise<string | null> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: KEY_PREFIX + key } });
    if (!row || typeof row.value !== 'string') return null;
    try {
      return this.decrypt(row.value);
    } catch {
      return null;
    }
  }

  async hasCredential(key: string): Promise<boolean> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: KEY_PREFIX + key } });
    return row !== null;
  }

  async deleteCredential(key: string): Promise<void> {
    await this.prisma.client.setting.deleteMany({ where: { key: KEY_PREFIX + key } });
  }
}
