import { IncompleteOrder } from '@amader/db';

const TRASH_RETENTION_DAYS = 30;

function daysUntilPurge(deletedAt: Date): number {
  const elapsedDays = (Date.now() - deletedAt.getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsedDays));
}

export class IncompleteOrderDto {
  id!: number;
  customerId!: number | null;
  /** Typed at checkout — for a guest this is the only name there is. */
  name!: string | null;
  phone!: string | null;
  email!: string | null;
  /** Partial shipping address the shopper typed before leaving. */
  address!: unknown;
  cart!: unknown;
  subtotal!: string;
  stage!: string;
  recovered!: boolean;
  recoveredOrderId!: number | null;
  /** Staff gave up on this cart. Canceled iff this is non-null. */
  canceledAt!: Date | null;
  cancelReason!: string | null;
  deletedAt!: Date | null;
  /** Days left before the nightly purge removes a trashed cart for good.
   *  Null for a live cart; floored at 0 so it never counts below zero while
   *  waiting for the 3am job. */
  daysRemaining!: number | null;
  recoveryAttempts!: number;
  lastSeenAt!: Date;
  createdAt!: Date;
}

export function toIncompleteOrderDto(row: IncompleteOrder): IncompleteOrderDto {
  return {
    id: row.id,
    customerId: row.customerId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    cart: row.cart,
    subtotal: row.subtotal.toString(),
    stage: row.stage,
    recovered: row.recovered,
    recoveredOrderId: row.recoveredOrderId,
    canceledAt: row.canceledAt,
    cancelReason: row.cancelReason,
    deletedAt: row.deletedAt,
    daysRemaining: row.deletedAt ? daysUntilPurge(row.deletedAt) : null,
    recoveryAttempts: row.recoveryAttempts,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
  };
}
