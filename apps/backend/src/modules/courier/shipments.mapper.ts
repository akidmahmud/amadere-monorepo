import { CourierProviderName, Prisma, ShipmentStatus } from '@amader/db';

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

export class ShipmentEventDto {
  status!: ShipmentStatus;
  note!: string | null;
  occurredAt!: Date;
}

export class ShipmentDto {
  id!: number;
  orderId!: number;
  provider!: CourierProviderName;
  status!: ShipmentStatus;
  consignmentId!: string | null;
  trackingCode!: string | null;
  cost!: string | null;
  weight!: string | null;
  codAmount!: string | null;
  returnReason!: string | null;
  errorMessage!: string | null;
  requestPayload!: unknown;
  rawResponse!: unknown;
  dispatchedAt!: Date | null;
  deliveredAt!: Date | null;
  createdAt!: Date;
  events!: ShipmentEventDto[];
}

export function toShipmentDto(shipment: ShipmentWithEvents): ShipmentDto {
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

export class ShipmentPerformanceDto {
  total!: number;
  delivered!: number;
  returned!: number;
  canceled!: number;
  successRate!: number | null;
  returnRate!: string | null;
  avgDeliveryHours!: number | null;
}
