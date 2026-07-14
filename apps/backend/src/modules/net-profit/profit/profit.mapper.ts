import { OrderProfit } from '@amader/db';

export class OrderProfitDto {
  id!: number;
  orderId!: number;
  revenue!: string;
  cogs!: string;
  shipping!: string;
  fees!: string;
  adSpend!: string;
  netProfit!: string;
  hasEstimatedCost!: boolean;
  computedAt!: Date;
}

export function toOrderProfitDto(row: OrderProfit): OrderProfitDto {
  return {
    id: row.id,
    orderId: row.orderId,
    revenue: row.revenue.toString(),
    cogs: row.cogs.toString(),
    shipping: row.shipping.toString(),
    fees: row.fees.toString(),
    adSpend: row.adSpend.toString(),
    netProfit: row.netProfit.toString(),
    hasEstimatedCost: row.hasEstimatedCost,
    computedAt: row.computedAt,
  };
}
