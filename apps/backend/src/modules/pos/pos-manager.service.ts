import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentProvider, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { dhakaTimeRange } from './dhaka-range';
import { PosTiersService } from './pos-tiers.service';
import { tierFor } from './pos-tiers';

export const POS_ORDER_STATUSES = ['COMPLETED', 'RETURNED'] as const;
const TENDER: Record<'CASH' | 'CARD' | 'MOBILE', PaymentProvider> = {
  CASH: 'CASH',
  CARD: 'CARD',
  MOBILE: 'BKASH',
};

interface TimeFilter {
  from?: string;
  to?: string;
  /** "HH:MM", Dhaka time. */
  fromTime?: string;
  toTime?: string;
}

export interface PosOrdersQuery extends TimeFilter {
  status?: (typeof POS_ORDER_STATUSES)[number];
  tender?: keyof typeof TENDER;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface PosCustomersQuery extends TimeFilter {
  /** Only customers in this tier (at the store, or at any store). */
  tier?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

const customerSearch = (q: string): Prisma.CustomerWhereInput => ({
  OR: [
    { phone: { contains: q } },
    { firstName: { contains: q, mode: 'insensitive' } },
    { lastName: { contains: q, mode: 'insensitive' } },
  ],
});

/**
 * The POS Order Manager and Customer Manager: every store's till sales (or
 * one store's), kept apart from the website Order Manager.
 * storeId null = all stores (pos.all_stores); otherwise that store only.
 */
@Injectable()
export class PosManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tiers: PosTiersService,
  ) {}

  private orderWhere(
    storeId: number | null,
    q: PosOrdersQuery,
    withStatus: boolean,
  ): Prisma.OrderWhereInput {
    const term = q.q?.trim();
    const range = dhakaTimeRange(q);
    return {
      channel: 'POS',
      deletedAt: null,
      ...(storeId ? { storeId } : {}),
      ...(withStatus && q.status ? { status: q.status as OrderStatus } : {}),
      ...(q.tender
        ? { payments: { some: { provider: TENDER[q.tender] } } }
        : {}),
      ...(range ? { createdAt: range } : {}),
      ...(term
        ? {
            OR: [
              { orderNumber: { contains: term, mode: 'insensitive' } },
              { customer: customerSearch(term) },
            ],
          }
        : {}),
    };
  }

  async orders(storeId: number | null, q: PosOrdersQuery) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const where = this.orderWhere(storeId, q, true);
    const [rows, total, byStatus] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          status: true,
          subTotal: true,
          discountAmount: true,
          taxAmount: true,
          totalAmount: true,
          store: { select: { id: true, name: true } },
          customer: { select: { firstName: true, lastName: true, phone: true } },
          assignedAdmin: { select: { firstName: true, lastName: true } },
          items: { select: { quantity: true } },
          payments: {
            select: { provider: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.client.order.count({ where }),
      this.prisma.client.order.groupBy({
        by: ['status'],
        where: this.orderWhere(storeId, q, false),
        _count: { _all: true },
      }),
    ]);
    const counts = Object.fromEntries(
      byStatus.map((g) => [g.status, g._count._all]),
    );
    return {
      ...toPaginatedResult(
        rows.map(({ customer, assignedAdmin, items, payments, ...o }) => ({
          ...o,
          customer: customer
            ? {
                name:
                  [customer.firstName, customer.lastName]
                    .filter(Boolean)
                    .join(' ') || 'Customer',
                phone: customer.phone,
              }
            : null,
          cashier: assignedAdmin
            ? `${assignedAdmin.firstName} ${assignedAdmin.lastName}`.trim()
            : null,
          itemCount: items.reduce((s, i) => s + i.quantity, 0),
          tender: payments[0]?.provider ?? null,
        })),
        total,
        page,
        pageSize,
      ),
      counts: {
        ALL: byStatus.reduce((s, g) => s + g._count._all, 0),
        COMPLETED: counts.COMPLETED ?? 0,
        RETURNED: counts.RETURNED ?? 0,
      },
    };
  }

  /** Customers who bought at the till: visits, spend, last visit, stores. */
  async customers(storeId: number | null, q: PosCustomersQuery) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const term = q.q?.trim();
    const range = dhakaTimeRange(q);
    const tierList = await this.tiers.getTiers();
    // Tier filter: all-time stats at the store(s) decide who is in the tier.
    const inTier = q.tier
      ? [
          ...new Set(
            (await this.tiers.stats({ storeId }))
              .filter((s) => tierFor(s, tierList)?.key === q.tier)
              .map((s) => s.customerId),
          ),
        ]
      : null;
    // Returned sales don't count as purchases.
    const where: Prisma.OrderWhereInput = {
      channel: 'POS',
      deletedAt: null,
      status: 'COMPLETED',
      customerId: inTier ? { in: inTier } : { not: null },
      ...(storeId ? { storeId } : {}),
      ...(term ? { customer: customerSearch(term) } : {}),
      // A period = customers who bought in it (and their spend in it).
      ...(range ? { createdAt: range } : {}),
    };
    const [groups, all] = await Promise.all([
      this.prisma.client.order.groupBy({
        by: ['customerId'],
        where,
        _count: { _all: true },
        _sum: { totalAmount: true },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: 'desc' } },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.order.groupBy({ by: ['customerId'], where }),
    ]);
    const ids = groups.map((g) => g.customerId!);
    const [people, storePairs] = await Promise.all([
      this.prisma.client.customer.findMany({
        where: { id: { in: ids } },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      }),
      this.prisma.client.order.groupBy({
        by: ['customerId', 'storeId'],
        where: { ...where, customerId: { in: ids } },
      }),
    ]);
    const storeIds = [...new Set(storePairs.map((p) => p.storeId!))];
    const storeNames = new Map(
      (
        await this.prisma.client.store.findMany({
          where: { id: { in: storeIds } },
          select: { id: true, name: true },
        })
      ).map((s) => [s.id, s.name]),
    );
    const byId = new Map(people.map((p) => [p.id, p]));
    // Tier per store from ALL-TIME purchases there (not the filtered period).
    const tierRows = await this.tiers.stats({ storeId, customerIds: ids });
    const allNames = new Map(
      (
        await this.prisma.client.store.findMany({
          where: { id: { in: [...new Set(tierRows.map((t) => t.storeId))] } },
          select: { id: true, name: true },
        })
      ).map((s) => [s.id, s.name]),
    );
    return toPaginatedResult(
      groups.map((g) => {
        const c = byId.get(g.customerId!);
        return {
          id: g.customerId!,
          name:
            [c?.firstName, c?.lastName].filter(Boolean).join(' ') || 'Customer',
          phone: c?.phone ?? null,
          email: c?.email ?? null,
          purchases: g._count._all,
          spent: (g._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(2),
          lastPurchase: g._max.createdAt,
          stores: storePairs
            .filter((p) => p.customerId === g.customerId)
            .map((p) => storeNames.get(p.storeId!) ?? '')
            .filter(Boolean),
          tiers: tierRows
            .filter((t) => t.customerId === g.customerId)
            .map((t) => {
              const tier = tierFor(t, tierList);
              return {
                store: allNames.get(t.storeId) ?? '',
                key: tier?.key ?? null,
                name: tier?.name ?? null,
                color: tier?.color ?? null,
              };
            }),
        };
      }),
      all.length,
      page,
      pageSize,
    );
  }
}
