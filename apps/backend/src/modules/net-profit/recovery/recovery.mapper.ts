import { IncompleteOrder } from '@amader/db';

export class IncompleteOrderDto {
  id!: number;
  customerId!: number | null;
  phone!: string | null;
  email!: string | null;
  cart!: unknown;
  subtotal!: string;
  stage!: string;
  recovered!: boolean;
  recoveredOrderId!: number | null;
  recoveryAttempts!: number;
  lastSeenAt!: Date;
  createdAt!: Date;
}

export function toIncompleteOrderDto(row: IncompleteOrder): IncompleteOrderDto {
  return {
    id: row.id,
    customerId: row.customerId,
    phone: row.phone,
    email: row.email,
    cart: row.cart,
    subtotal: row.subtotal.toString(),
    stage: row.stage,
    recovered: row.recovered,
    recoveredOrderId: row.recoveredOrderId,
    recoveryAttempts: row.recoveryAttempts,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
  };
}
