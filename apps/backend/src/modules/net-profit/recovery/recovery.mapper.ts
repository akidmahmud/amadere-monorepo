import { IncompleteOrder } from '@amader/db';
import { FraudCheckDto } from '../fraud/fraud.mapper';

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
  /** Where this cart came from, so staff can see which ad they are chasing
   *  and prioritise accordingly. */
  utmSource!: string | null;
  utmCampaign!: string | null;
  lastSeenAt!: Date;
  createdAt!: Date;

  /**
   * Courier-fraud risk for this cart's phone, read from the cache ONLY.
   *
   * Null means nobody has ever checked that number — not that it is safe.
   * The list deliberately never triggers a lookup: the provider is a paid
   * per-call API, and a page of 50 carts would be 50 calls on every render.
   * Checking is an explicit act, from the row's own Check risk button.
   */
  riskLevel!: string | null;
  /** 0..1, or null when the cached check found no courier history. */
  riskSuccessRate!: number | null;
  /** When that cached check was made — a badge from six months ago should
   *  not be read with the same confidence as one from this morning. */
  riskCheckedAt!: Date | null;
}

export function toIncompleteOrderDto(
  row: IncompleteOrder,
  risk?: FraudCheckDto,
): IncompleteOrderDto {
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
    utmSource: row.utmSource,
    utmCampaign: row.utmCampaign,
    riskLevel: risk?.riskLevel ?? null,
    riskSuccessRate: risk?.successRate ?? null,
    riskCheckedAt: risk?.checkedAt ?? null,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
  };
}
