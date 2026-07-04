import { Prisma } from '@amader/db';

export const SHIPMENT_INCLUDE = {
  events: { orderBy: { occurredAt: 'asc' as const } },
} as const;

export type ShipmentWithEvents = Prisma.ShipmentGetPayload<{
  include: typeof SHIPMENT_INCLUDE;
}>;

function decimalToString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  return value ? value.toString() : null;
}

export function toShipmentDto(shipment: ShipmentWithEvents) {
  return {
    id: shipment.id,
    orderId: shipment.orderId,
    provider: shipment.provider,
    status: shipment.status,
    consignmentId: shipment.consignmentId,
    trackingCode: shipment.trackingCode,
    cost: decimalToString(shipment.cost),
    weight: decimalToString(shipment.weight),
    codAmount: decimalToString(shipment.codAmount),
    returnReason: shipment.returnReason,
    errorMessage: shipment.errorMessage,
    requestPayload: shipment.requestPayload,
    rawResponse: shipment.rawResponse,
    dispatchedAt: shipment.dispatchedAt,
    deliveredAt: shipment.deliveredAt,
    createdAt: shipment.createdAt,
    events: shipment.events.map((e) => ({
      status: e.status,
      note: e.note,
      occurredAt: e.occurredAt,
    })),
  };
}
