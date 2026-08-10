import { FraudCheck, FraudSaving } from '@amader/db';
import { toLocalBdPhone } from '@amader/shared';

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
    // Stored/looked-up as +8801XXXXXXXXX (see FraudService), but that reads
    // as "the wrong number" to an admin — reshaped to the local 01... form
    // they actually recognize (and the same shape Steadfast itself expects)
    // for display only; the cache key underneath is untouched.
    phone: toLocalBdPhone(row.phone) ?? row.phone,
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
    phone: toLocalBdPhone(row.phone) ?? row.phone,
    amount: row.amount.toString(),
    reason: row.reason,
    createdAt: row.createdAt,
  };
}
