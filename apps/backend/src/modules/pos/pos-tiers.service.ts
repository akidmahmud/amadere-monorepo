import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  DEFAULT_TIERS,
  type PosTier,
  tierFor,
  tierKeyOf,
  type TierStats,
} from './pos-tiers';

const KEY = 'pos.tiers';

export interface StoreStats extends TierStats {
  customerId: number;
  storeId: number;
  last: Date;
}

/**
 * The POS tier list (one list; each customer's tier is worked out PER STORE
 * from their completed, not-deleted till purchases there).
 */
@Injectable()
export class PosTiersService {
  constructor(private readonly prisma: PrismaService) {}

  async getTiers(): Promise<PosTier[]> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: KEY } });
    return (row?.value as unknown as PosTier[] | undefined) ?? DEFAULT_TIERS;
  }

  async setTiers(input: Partial<PosTier>[]): Promise<PosTier[]> {
    if (!input.length) throw new BadRequestException('Add at least one tier');
    const tiers: PosTier[] = input.map((t) => {
      const name = String(t.name ?? '').trim();
      return {
        key: t.key || tierKeyOf(name),
        name,
        minOrders: Math.max(0, Math.floor(Number(t.minOrders) || 0)),
        minSpent: Math.max(0, Number(t.minSpent) || 0),
        color: /^#[0-9a-f]{6}$/i.test(t.color ?? '') ? t.color! : '#1d7a46',
      };
    });
    if (tiers.some((t) => !t.name))
      throw new BadRequestException('Every tier needs a name');
    if (new Set(tiers.map((t) => t.key)).size !== tiers.length)
      throw new BadRequestException('Tier names must be different');
    await this.prisma.client.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: tiers as unknown as Prisma.InputJsonValue },
      update: { value: tiers as unknown as Prisma.InputJsonValue },
    });
    return tiers;
  }

  /** All-time purchases/spend per (customer, store) at the till. */
  async stats(opts: { storeId?: number | null; customerIds?: number[] }): Promise<StoreStats[]> {
    const groups = await this.prisma.client.order.groupBy({
      by: ['customerId', 'storeId'],
      where: {
        channel: 'POS',
        deletedAt: null,
        status: 'COMPLETED',
        customerId: opts.customerIds ? { in: opts.customerIds } : { not: null },
        ...(opts.storeId ? { storeId: opts.storeId } : { storeId: { not: null } }),
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
      _max: { createdAt: true },
    });
    return groups.map((g) => ({
      customerId: g.customerId!,
      storeId: g.storeId!,
      orders: g._count._all,
      spent: Number(g._sum.totalAmount ?? 0),
      last: g._max.createdAt!,
    }));
  }

  tierOf = tierFor;
}
