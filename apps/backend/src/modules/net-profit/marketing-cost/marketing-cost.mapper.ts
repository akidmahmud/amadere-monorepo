import { MarketingCost, DailyProfitCache } from '@amader/db';

export class MarketingCostDto {
  id!: number;
  costDate!: string;
  adsCost!: string;
  otherCost!: string;
  note!: string | null;
  autoCarried!: boolean;
}

export function toMarketingCostDto(row: MarketingCost): MarketingCostDto {
  return {
    id: row.id,
    costDate: row.costDate.toISOString().slice(0, 10),
    adsCost: row.adsCost.toString(),
    otherCost: row.otherCost.toString(),
    note: row.note,
    autoCarried: row.autoCarried,
  };
}

export class DailyProfitCacheDto {
  reportDate!: string;
  totalRevenue!: string;
  totalBuyCost!: string;
  totalAdsCost!: string;
  totalOther!: string;
  totalShipping!: string;
  netProfit!: string;
  orderCount!: number;
  computedAt!: Date;
}

export function toDailyProfitCacheDto(row: DailyProfitCache): DailyProfitCacheDto {
  return {
    reportDate: row.reportDate.toISOString().slice(0, 10),
    totalRevenue: row.totalRevenue.toString(),
    totalBuyCost: row.totalBuyCost.toString(),
    totalAdsCost: row.totalAdsCost.toString(),
    totalOther: row.totalOther.toString(),
    totalShipping: row.totalShipping.toString(),
    netProfit: row.netProfit.toString(),
    orderCount: row.orderCount,
    computedAt: row.computedAt,
  };
}
