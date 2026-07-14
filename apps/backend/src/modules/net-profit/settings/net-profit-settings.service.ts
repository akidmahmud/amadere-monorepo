import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';

const KEY_PREFIX = 'net_profit.';

// The WP-options replacement (spec §7.13, §3 translation table): every
// Net Profit feature's config lives here instead of a dedicated table,
// namespaced ("fraud.enabled", "sms.provider", ...) on top of the existing
// generic `Setting` key/value store (packages/db, already used by
// modules/settings for site name/logo) — not a parallel `NetProfitSetting`
// model. In-memory cache, invalidated on every write.
@Injectable()
export class NetProfitSettingsService {
  private readonly cache = new Map<string, unknown>();

  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string, defaultValue: T): Promise<T> {
    if (this.cache.has(key)) return this.cache.get(key) as T;
    const row = await this.prisma.client.setting.findUnique({
      where: { key: KEY_PREFIX + key },
    });
    const value = row ? (row.value as T) : defaultValue;
    this.cache.set(key, value);
    return value;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.prisma.client.setting.upsert({
      where: { key: KEY_PREFIX + key },
      create: { key: KEY_PREFIX + key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
    this.cache.set(key, value);
  }

  // Bulk fetch for a namespace's settings page, e.g. namespace="fraud" reads
  // every "fraud.*" key at once. Keys not yet written fall back per `defaults`.
  async getNamespace<T extends object>(namespace: string, defaults: T): Promise<T> {
    const result = { ...defaults };
    for (const field of Object.keys(defaults) as (keyof T)[]) {
      result[field] = await this.get(`${namespace}.${String(field)}`, defaults[field]);
    }
    return result;
  }

  // Only writes fields that are actually present — a partial update DTO
  // with unset optional fields must never blank out the rest of the
  // namespace's settings.
  async setNamespace(namespace: string, values: object): Promise<void> {
    for (const [field, value] of Object.entries(values)) {
      if (value === undefined) continue;
      await this.set(`${namespace}.${field}`, value);
    }
  }
}
