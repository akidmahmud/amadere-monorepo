// Mirrors the Prisma-generated ShipmentStatus enum's string values exactly
// (packages/shared can't depend on @amader/db — db depends on shared, not
// the other way around) so this stays usable both by the backend app
// (apps/backend/src/modules/courier/shipments.service.ts) and by the B12
// migration script (packages/db/scripts/migrate/orders.ts), which is the
// whole point of having one shared mapping instead of two.
export type ShipmentStatusValue =
  | 'PENDING'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'PARTIALLY_DELIVERED'
  | 'RETURNED'
  | 'CANCELED'
  | 'FAILED';

// Maps a courier's raw status string to our generic ShipmentStatus. Unknown
// values fall back to DISPATCHED (safe middle ground) rather than guessing.
export function mapRawCourierStatus(raw: string): ShipmentStatusValue {
  const normalized = raw.trim().toLowerCase();
  if (['pending', 'in_review', 'hold'].includes(normalized)) return 'PENDING';
  if (['delivered'].includes(normalized)) return 'DELIVERED';
  if (['partial_delivered', 'partially_delivered'].includes(normalized)) return 'PARTIALLY_DELIVERED';
  if (['cancelled', 'canceled'].includes(normalized)) return 'CANCELED';
  if (['returned', 'return'].includes(normalized)) return 'RETURNED';
  if (['in_transit', 'on_the_way', 'picked'].includes(normalized)) return 'IN_TRANSIT';
  return 'DISPATCHED';
}
