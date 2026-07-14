import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';

const Decimal = Prisma.Decimal;

export interface OverviewKpis {
  revenue: string;
  netProfit: string;
  orders: number;
  codRiskExposure: string;
  fraudSavings: string;
  recoveredOrders: number;
  recoveredValue: string;
  smsSpend: string;
}

export interface RevenueProfitPoint {
  date: string;
  revenue: string;
  netProfit: string;
}

export interface OrdersByRisk {
  riskLevel: string;
  orders: number;
}

// Composes reads from every other Net Profit service's own tables — no new
// tables of its own (§7.1). Deliberately the *last* module built (M8), per
// the spec's own build order: it has nothing to compose until M1-M7 exist.
@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async kpis(from: Date, to: Date): Promise<OverviewKpis> {
    const [orderAgg, netProfitAgg, codRiskRows, fraudSavingsAgg, recoveredRows, smsAgg] = await Promise.all([
      this.prisma.client.order.aggregate({
        where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELED' } },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      // ADDENDUM §D — reads the DailyProfitCache roll-up (rebuilt by a daily
      // cron + on-demand backfill in the marketing-cost module), not a live
      // per-order OrderProfit sum.
      this.prisma.client.dailyProfitCache.aggregate({
        where: { reportDate: { gte: from, lte: to } },
        _sum: { netProfit: true },
      }),
      this.prisma.client.$queryRaw<{ total: Prisma.Decimal | null }[]>`
        SELECT sum(o.total_amount) AS total
        FROM orders o
        LEFT JOIN order_addresses oa ON oa.order_id = o.id AND oa.type = 'SHIPPING'
        LEFT JOIN LATERAL (
          SELECT provider FROM payments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
        ) p ON true
        LEFT JOIN fraud_checks fc ON fc.phone = '+88' || oa.phone
        WHERE o.status IN ('PENDING','CONFIRMED','PROCESSING','HOLD')
          AND p.provider = 'COD'
          AND fc.risk_level = 'HIGH'
      `,
      this.prisma.client.fraudSaving.aggregate({
        where: { createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      this.prisma.client.incompleteOrder.findMany({
        where: { recovered: true, createdAt: { gte: from, lte: to } },
        select: { subtotal: true },
      }),
      this.prisma.client.smsLog.aggregate({
        where: { createdAt: { gte: from, lte: to } },
        _sum: { cost: true },
      }),
    ]);

    const recoveredValue = recoveredRows.reduce((sum, r) => sum.plus(r.subtotal), new Decimal(0));

    return {
      revenue: (orderAgg._sum.totalAmount ?? new Decimal(0)).toString(),
      netProfit: (netProfitAgg._sum.netProfit ?? new Decimal(0)).toString(),
      orders: orderAgg._count._all,
      codRiskExposure: (codRiskRows[0]?.total ?? new Decimal(0)).toString(),
      fraudSavings: (fraudSavingsAgg._sum.amount ?? new Decimal(0)).toString(),
      recoveredOrders: recoveredRows.length,
      recoveredValue: recoveredValue.toString(),
      smsSpend: (smsAgg._sum.cost ?? new Decimal(0)).toString(),
    };
  }

  async revenueVsProfit(from: Date, to: Date): Promise<RevenueProfitPoint[]> {
    // ADDENDUM §D — net_profit comes from the DailyProfitCache roll-up
    // (keyed by report_date, a DATE column) rather than a live per-order
    // sum; revenue stays a live sum over order.created_at (any non-canceled
    // status), since the two are deliberately different definitions
    // (all orders vs. completed-only).
    const rows = await this.prisma.client.$queryRaw<
      { date: string; revenue: Prisma.Decimal | null; net_profit: Prisma.Decimal | null }[]
    >`
      SELECT to_char(d, 'YYYY-MM-DD') AS date,
             COALESCE(rev.revenue, 0) AS revenue,
             COALESCE(dpc.net_profit, 0) AS net_profit
      FROM generate_series(date_trunc('day', ${from}::timestamp), date_trunc('day', ${to}::timestamp), interval '1 day') d
      LEFT JOIN (
        SELECT date_trunc('day', o.created_at) AS day, sum(o.total_amount) AS revenue
        FROM orders o
        WHERE o.status != 'CANCELED' AND o.created_at BETWEEN ${from} AND ${to}
        GROUP BY 1
      ) rev ON rev.day = d
      LEFT JOIN daily_profit_cache dpc ON dpc.report_date = d
      ORDER BY d ASC
    `;
    return rows.map((r) => ({
      date: r.date,
      revenue: (r.revenue ?? new Decimal(0)).toString(),
      netProfit: (r.net_profit ?? new Decimal(0)).toString(),
    }));
  }

  async ordersByRisk(from: Date, to: Date): Promise<OrdersByRisk[]> {
    const rows = await this.prisma.client.$queryRaw<{ risk_level: string; orders: bigint }[]>`
      SELECT COALESCE(fc.risk_level::text, 'UNKNOWN') AS risk_level, count(*)::bigint AS orders
      FROM orders o
      LEFT JOIN order_addresses oa ON oa.order_id = o.id AND oa.type = 'SHIPPING'
      LEFT JOIN fraud_checks fc ON fc.phone = '+88' || oa.phone
      WHERE o.status != 'CANCELED' AND o.created_at BETWEEN ${from} AND ${to}
      GROUP BY 1
      ORDER BY orders DESC
    `;
    return rows.map((r) => ({ riskLevel: r.risk_level, orders: Number(r.orders) }));
  }
}
