import { AdvancePayment } from '@amader/db';

export class AdvancePaymentDto {
  id!: number;
  orderId!: number;
  required!: string;
  paid!: string;
  status!: string;
  reason!: string | null;
  createdAt!: Date;
}

export function toAdvancePaymentDto(row: AdvancePayment): AdvancePaymentDto {
  return {
    id: row.id,
    orderId: row.orderId,
    required: row.required.toString(),
    paid: row.paid.toString(),
    status: row.status,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}
