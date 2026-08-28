import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';

const KEY_PREFIX = 'net_profit.';

/**
 * The WP-options replacement (spec §7.13, §3 translation table): every
 * Net Profit feature's config lives here instead of a dedicated table,
 * namespaced ("fraud.enabled", "sms.provider", ...) on top of the existing
 * generic `Setting` key/value store (packages/db, already used by
 * modules/settings for site name/logo) — not a parallel `NetProfitSetting`
 * model.
 *
 * NO IN-MEMORY CACHE, deliberately.
 *
 * There used to be a process-local `Map` with no TTL and no cross-process
 * invalidation. It made every Net Profit setting unreliable the moment the
 * API ran more than one instance:
 *
 *   1. A GET lands on instance B. The key has no row yet, so B caches the
 *      DEFAULT — permanently, since nothing ever expired it.
 *   2. The admin flips the setting; the PUT lands on instance A. A writes the
 *      database and updates *A's* map.
 *   3. The page refetches, load-balanced back to B, which still answers from
 *      its stale map.
 *   4. The toggle silently snaps back to its old value.
 *
 * Reported as "the OTP toggle turns itself off", but it applied to all twelve
 * namespaces — fraud, blocker, advance payment, cleanup, sms, otp, VAT, COD
 * fee, cart campaigns, marketing cost, overview.
 *
 * The cache is not replaced with a TTL because a TTL only shortens the window
 * in which the admin is lied to; it does not close it. `getNamespace` is now a
 * SINGLE indexed range scan over ~12 rows, which is cheaper than the N
 * separate `findUnique` calls the cached version made on every cold process
 * anyway. Correct and faster is not a trade.
 */
@Injectable()
export class NetProfitSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string, defaultValue: T): Promise<T> {
    const row = await this.prisma.client.setting.findUnique({
      where: { key: KEY_PREFIX + key },
    });
    return row ? (row.value as T) : defaultValue;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.prisma.client.setting.upsert({
      where: { key: KEY_PREFIX + key },
      create: { key: KEY_PREFIX + key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
  }

  /**
   * Every "<namespace>.*" key in one query. Keys never written fall back to
   * `defaults`.
   *
   * The trailing dot in the prefix is load-bearing: without it the namespace
   * "overview" would also match "overview_hourly", and one namespace would
   * quietly inherit another's fields.
   */
  async getNamespace<T extends object>(namespace: string, defaults: T): Promise<T> {
    const prefix = `${KEY_PREFIX}${namespace}.`;
    const rows = await this.prisma.client.setting.findMany({
      where: { key: { startsWith: prefix } },
      select: { key: true, value: true },
    });
    const stored = new Map(rows.map((r) => [r.key.slice(prefix.length), r.value]));

    const result = { ...defaults };
    for (const field of Object.keys(defaults) as (keyof T)[]) {
      const name = String(field);
      // `has`, not a truthiness check: `false` and `0` are legitimate stored
      // values and must win over the default.
      if (stored.has(name)) result[field] = stored.get(name) as T[keyof T];
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
