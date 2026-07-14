import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DailyProfitCacheDto, toDailyProfitCacheDto } from './marketing-cost.mapper';
import { dayKey, MarketingCostService } from './marketing-cost.service';

const Decimal = Prisma.Decimal;

// ADDENDUM §D — day-level roll-up that Overview/Profit dashboards read
// instead of live-summing OrderProfit on every request. Rebuilt from
// completed orders' already-snapshotted OrderProfit rows (revenue/cogs/
// shipping) plus that day's MarketingCost (ads/other); never recomputes
// COGS itself — ProfitService.computeForOrder already owns that on the
// COMPLETED transition.
@Injectable()
export class DailyProfitCacheService {
  private readonly logger = new Logger(DailyProfitCacheService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketingCost: MarketingCostService,
  ) {}

  async recomputeForDate(date: Date): Promise<DailyProfitCacheDto> {
    const reportDate = dayKey(date);
    const nextDay = new Date(reportDate.getTime() + 86_400_000);

    const [orders, costRow, settings] = await Promise.all([
      this.prisma.client.order.findMany({
        where: { status: 'COMPLETED', completedAt: { gte: reportDate, lt: nextDay } },
        include: { profit: true },
      }),
      this.prisma.client.marketingCost.findUnique({ where: { costDate: reportDate } }),
      this.marketingCost.getSettings(),
    ]);

    let totalRevenue = new Decimal(0);
    let totalBuyCost = new Decimal(0);
    let totalShipping = new Decimal(0);
    for (const order of orders) {
      totalRevenue = totalRevenue.plus(order.profit?.revenue ?? order.totalAmount);
      totalBuyCost = totalBuyCost.plus(order.profit?.cogs ?? 0);
      totalShipping = totalShipping.plus(order.profit?.shipping ?? order.shippingAmount);
    }
    // No entry for this day at all (not even a carried-forward one) — fall
    // back to the admin-configured default rather than silently assuming
    // ৳0 ad spend for the day.
    const totalAdsCost = costRow?.adsCost ?? new Decimal(settings.defaultMarketingCost);
    const totalOther = costRow?.otherCost ?? new Decimal(0);
    const netProfit = totalRevenue.minus(totalBuyCost).minus(totalAdsCost).minus(totalOther).minus(totalShipping);

    const row = await this.prisma.client.dailyProfitCache.upsert({
      where: { reportDate },
      create: {
        reportDate,
        totalRevenue,
        totalBuyCost,
        totalAdsCost,
        totalOther,
        totalShipping,
        netProfit,
        orderCount: orders.length,
      },
      update: { totalRevenue, totalBuyCost, totalAdsCost, totalOther, totalShipping, netProfit, orderCount: orders.length, computedAt: new Date() },
    });
    return toDailyProfitCacheDto(row);
  }

  async recomputeRange(from: Date, to: Date): Promise<DailyProfitCacheDto[]> {
    const results: DailyProfitCacheDto[] = [];
    let cursor = dayKey(from);
    const end = dayKey(to);
    while (cursor <= end) {
      results.push(await this.recomputeForDate(cursor));
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
    return results;
  }

  async list(from: Date, to: Date): Promise<DailyProfitCacheDto[]> {
    const rows = await this.prisma.client.dailyProfitCache.findMany({
      where: { reportDate: { gte: dayKey(from), lte: dayKey(to) } },
      orderBy: { reportDate: 'asc' },
    });
    return rows.map(toDailyProfitCacheDto);
  }

  // Cron 3 of §G — recomputes today and yesterday every day (yesterday
  // covers orders completed after the previous run, e.g. late-night COD
  // confirmations); on-demand backfill via the admin endpoint covers
  // anything older.
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async dailyRecompute(): Promise<void> {
    const today = dayKey(new Date());
    const yesterday = new Date(today.getTime() - 86_400_000);
    await this.recomputeForDate(yesterday);
    await this.recomputeForDate(today);
    this.logger.log(`Recomputed daily profit cache for ${yesterday.toISOString().slice(0, 10)} and ${today.toISOString().slice(0, 10)}`);
  }
}
