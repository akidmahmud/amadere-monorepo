import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  dhakaDayEnd,
  dhakaDayStart,
} from '../../product-cost-history/dhaka-date';
import { ProductCostHistoryService } from '../../product-cost-history/product-cost-history.service';
import { ReportSettingsService } from './report-settings.service';
import { LOADER_INCLUDE, toReportOrder } from './report-mapping';
import type { Basis } from './engine/rows';
import type { ReportOrder } from './engine/types';

export interface LoadOptions {
  from?: string;
  to?: string;
  /** HH:mm, Dhaka. Narrows the first / last day; absent = whole day. */
  fromTime?: string;
  toTime?: string;
  basis: Basis;
  /** Exceptions: every order ever, date range ignored (spec §8). */
  ignoreDate?: boolean;
  /** view_own scope. */
  agentId?: number;
}

@Injectable()
export class ReportLoaderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costs: ProductCostHistoryService,
    private readonly settings: ReportSettingsService,
  ) {}

  async load(opts: LoadOptions): Promise<ReportOrder[]> {
    const where: Prisma.OrderWhereInput = { deletedAt: null };
    if (opts.agentId !== undefined) where.assignedAdminId = opts.agentId;
    if (!opts.ignoreDate && opts.from && opts.to) {
      const range = {
        gte: opts.fromTime
          ? new Date(`${opts.from}T${opts.fromTime}:00+06:00`)
          : dhakaDayStart(opts.from),
        // Inclusive of the whole chosen end minute.
        lte: opts.toTime
          ? new Date(`${opts.to}T${opts.toTime}:59.999+06:00`)
          : dhakaDayEnd(opts.to),
      };
      if (opts.basis === 'order') where.createdAt = range;
      else
        where.statusHistory = {
          some: {
            status: { in: ['COMPLETED', 'RETURNED', 'PARTIALLY_RETURNED'] },
            createdAt: range,
          },
        };
    }
    // ponytail: one read of every matching order; Exceptions (ignoreDate) reads all
    // orders ever — fine at ~100 orders/day, add a status/age bound if it slows.
    const rows = await this.prisma.client.order.findMany({
      where,
      include: LOADER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    if (rows.length === 0) return [];

    const productIds = [
      ...new Set(
        rows
          .flatMap((r) => r.items.map((i) => i.productId))
          .filter((x): x is number => x !== null),
      ),
    ];
    const variantIds = [
      ...new Set(
        rows
          .flatMap((r) => r.items.map((i) => i.variantId))
          .filter((x): x is number => x !== null),
      ),
    ];
    const [resolver, zones, firstOrderAt] = await Promise.all([
      this.costs.loadResolver(productIds, variantIds),
      this.settings.zoneConfig(),
      this.firstOrders(rows),
    ]);
    return rows.map((row) =>
      toReportOrder(row, { resolver, zones, firstOrderAt }),
    );
  }

  /** Earliest non-cancelled order per customer (account, else shipping phone). */
  private async firstOrders(
    rows: {
      customerId: number | null;
      addresses: { phone: string | null }[];
    }[],
  ): Promise<Map<string, Date>> {
    const customerIds = [
      ...new Set(
        rows.map((r) => r.customerId).filter((x): x is number => x !== null),
      ),
    ];
    const phones = [
      ...new Set(
        rows
          .filter((r) => !r.customerId)
          .map((r) => r.addresses[0]?.phone)
          .filter((x): x is string => !!x),
      ),
    ];
    const found = await this.prisma.client.$queryRaw<
      { k: string; first: Date }[]
    >`
      SELECT CASE WHEN o.customer_id IS NOT NULL THEN 'c:' || o.customer_id ELSE 'p:' || a.phone END AS k,
             MIN(o.created_at) AS first
      FROM orders o
      LEFT JOIN order_addresses a ON a.order_id = o.id AND a.type = 'SHIPPING'
      WHERE o.deleted_at IS NULL AND o.status <> 'CANCELED'
        AND (o.customer_id = ANY(${customerIds}::int[]) OR (o.customer_id IS NULL AND a.phone = ANY(${phones}::text[])))
      GROUP BY 1`;
    // Keys follow report-mapping's customerKey: 'c:<customerId>' or 'p:<phone>'.
    return new Map(found.map((f) => [f.k, f.first]));
  }
}
