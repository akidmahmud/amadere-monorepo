import { FraudCheck, FraudSaving } from '@amader/db';

export class FraudCheckDto {
  id!: number;
  phone!: string;
  totalOrders!: number;
  delivered!: number;
  cancelled!: number;
  successRate!: number | null;
  riskLevel!: string;
  breakdown!: unknown;
  source!: string;
  checkedAt!: Date;
  expiresAt!: Date;
}

export function toFraudCheckDto(row: FraudCheck): FraudCheckDto {
  return {
    id: row.id,
    phone: row.phone,
    totalOrders: row.totalOrders,
    delivered: row.delivered,
    cancelled: row.cancelled,
    successRate: row.successRate,
    riskLevel: row.riskLevel,
    breakdown: row.breakdown,
    source: row.source,
    checkedAt: row.checkedAt,
    expiresAt: row.expiresAt,
  };
}

export class FraudSavingDto {
  id!: number;
  orderId!: number | null;
  phone!: string;
  amount!: string;
  reason!: string;
  createdAt!: Date;
}

export function toFraudSavingDto(row: FraudSaving): FraudSavingDto {
  return {
    id: row.id,
    orderId: row.orderId,
    phone: row.phone,
    amount: row.amount.toString(),
    reason: row.reason,
    createdAt: row.createdAt,
  };
}
