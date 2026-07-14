import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';

const Decimal = Prisma.Decimal;

export interface OverviewKpis {
  revenue: string;
  netProfit: string;
  orders: number;
  avgOrderValue: string;
  deliveryChargeEarned: string;
  codRiskExposure: string;
  fraudSavings: string;
  blockedAuto: number;
  blockedManual: number;
  recentBlockedPhones: string[];
  recoveredOrders: number;
  recoveredValue: string;
  incompleteOrders: number;
  incompleteValue: string;
  otpVerified: number;
  vpnDetected: number;
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

export interface OrderStatusBreakdownRow {
  status: string;
  count: number;
  amount: string;
}

export interface HourlyPerformanceSlot {
  label: string;
  orders: number;
  revenue: string;
  isPeak: boolean;
  barWidth: number;
}

const HOURLY_DEFAULTS = { hourlySlotHours: 2 };

// Composes reads from every other Net Profit service's own tables — no new
// tables of its own (§7.1). Deliberately the *last* module built (M8), per
// the spec's own build order: it has nothing to compose until M1-M7 exist.
@Injectable()
export class OverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
  ) {}

  async kpis(from: Date, to: Date): Promise<OverviewKpis> {
    const [
      orderAgg,
      deliveryAgg,
      netProfitAgg,
      codRiskRows,
      fraudSavingsAgg,
      blockRuleGroups,
      recentBlockedRows,
      incompleteRows,
      otpVerified,
      vpnDetected,
      smsAgg,
    ] = await Promise.all([
      this.prisma.client.order.aggregate({
        where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELED' } },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.client.order.aggregate({
        where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELED' } },
        _sum: { shippingAmount: true },
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
      // Plugin parity: "Auto Blocks" vs "Manual Blocks" counters — BlockRule.source
      // is our exact analog of the plugin's block_source column.
      this.prisma.client.blockRule.groupBy({
        by: ['source'],
        where: { createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      this.prisma.client.blockRule.findMany({
        where: { type: 'PHONE', createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { value: true },
      }),
      this.prisma.client.incompleteOrder.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { subtotal: true, recovered: true },
      }),
      // "OTP Verified" — plugin counts checkout-verification OTPs only, so
      // this is scoped to COD_VERIFICATION (not login/register OTPs).
      this.prisma.client.otp.count({
        where: { purpose: 'COD_VERIFICATION', consumedAt: { not: null }, createdAt: { gte: from, lte: to } },
      }),
      // ponytail: no dedicated "VPN block" table exists in our schema (the
      // plugin's blocker_entries has a block_type='vpn' row; ours only
      // records the VPN detection outcome on the Otp row that triggered it).
      // Closest honest analog — upgrade to a real BlockRule-based count if a
      // VPN BlockType is ever added.
      this.prisma.client.otp.count({
        where: { isVpn: true, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.client.smsLog.aggregate({
        where: { createdAt: { gte: from, lte: to } },
        _sum: { cost: true },
      }),
    ]);

    const recoveredRows = incompleteRows.filter((r) => r.recovered);
    const recoveredValue = recoveredRows.reduce((sum, r) => sum.plus(r.subtotal), new Decimal(0));
    const incompleteValue = incompleteRows.reduce((sum, r) => sum.plus(r.subtotal), new Decimal(0));
    const revenue = orderAgg._sum.totalAmount ?? new Decimal(0);
    const orders = orderAgg._count._all;
    const blockedAuto = blockRuleGroups.find((g) => g.source === 'AUTO')?._count._all ?? 0;
    const blockedManual = blockRuleGroups.find((g) => g.source === 'MANUAL')?._count._all ?? 0;

    return {
      revenue: revenue.toString(),
      netProfit: (netProfitAgg._sum.netProfit ?? new Decimal(0)).toString(),
      orders,
      avgOrderValue: (orders > 0 ? revenue.div(orders) : new Decimal(0)).toFixed(2),
      deliveryChargeEarned: (deliveryAgg._sum.shippingAmount ?? new Decimal(0)).toString(),
      codRiskExposure: (codRiskRows[0]?.total ?? new Decimal(0)).toString(),
      fraudSavings: (fraudSavingsAgg._sum.amount ?? new Decimal(0)).toString(),
      blockedAuto,
      blockedManual,
      recentBlockedPhones: recentBlockedRows.map((r) => r.value),
      recoveredOrders: recoveredRows.length,
      recoveredValue: recoveredValue.toString(),
      incompleteOrders: incompleteRows.length,
      incompleteValue: incompleteValue.toString(),
      otpVerified,
      vpnDetected,
      smsSpend: (smsAgg._sum.cost ?? new Decimal(0)).toString(),
    };
  }

  async orderStatusBreakdown(from: Date, to: Date): Promise<OrderStatusBreakdownRow[]> {
    const rows = await this.prisma.client.$queryRaw<{ status: string; count: bigint; amount: Prisma.Decimal | null }[]>`
      SELECT status::text AS status, count(*)::bigint AS count, sum(total_amount) AS amount
      FROM orders
      WHERE created_at BETWEEN ${from} AND ${to}
      GROUP BY status
      ORDER BY count DESC
    `;
    return rows.map((r) => ({ status: r.status, count: Number(r.count), amount: (r.amount ?? new Decimal(0)).toString() }));
  }

  async getHourlySlotHours(): Promise<number> {
    const cfg = await this.settings.getNamespace('overview', HOURLY_DEFAULTS);
    return cfg.hourlySlotHours;
  }

  async setHourlySlotHours(hourlySlotHours: number): Promise<{ hourlySlotHours: number }> {
    await this.settings.setNamespace('overview', { hourlySlotHours });
    return { hourlySlotHours };
  }

  // Time-of-day profile (bucketed by hour across every day in the range),
  // not a per-day timeline — matches the plugin's get_time_performance().
  async hourlyPerformance(from: Date, to: Date): Promise<HourlyPerformanceSlot[]> {
    const slotHours = await this.getHourlySlotHours();
    const rows = await this.prisma.client.$queryRaw<{ slot: number; orders: bigint; revenue: Prisma.Decimal | null }[]>`
      SELECT floor(EXTRACT(HOUR FROM created_at) / ${slotHours})::int AS slot,
             count(*)::bigint AS orders,
             sum(total_amount) AS revenue
      FROM orders
      WHERE status != 'CANCELED' AND created_at BETWEEN ${from} AND ${to}
      GROUP BY 1
      ORDER BY 1
    `;
    const bySlot = new Map(rows.map((r) => [r.slot, r]));
    const slotCount = Math.ceil(24 / slotHours);
    const slots = Array.from({ length: slotCount }, (_, i) => {
      const row = bySlot.get(i);
      return { orders: row ? Number(row.orders) : 0, revenue: row?.revenue ?? new Decimal(0) };
    });
    const maxOrders = Math.max(1, ...slots.map((s) => s.orders));

    return slots.map((s, i) => {
      const startHour = i * slotHours;
      const endHour = Math.min(24, startHour + slotHours);
      return {
        label: `${formatHour(startHour)} - ${formatHour(endHour)}`,
        orders: s.orders,
        revenue: s.revenue.toString(),
        isPeak: s.orders === maxOrders && maxOrders > 0,
        barWidth: Math.round((s.orders / maxOrders) * 100),
      };
    });
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

function formatHour(hour: number): string {
  const h = hour % 24;
  const period = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${period}`;
}
