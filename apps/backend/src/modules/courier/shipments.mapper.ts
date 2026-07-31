import { CourierProviderName, OrderStatus, Prisma, ShipmentStatus } from '@amader/db';

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

// One row per ORDER (not per shipment) — the dispatch-queue table needs to
// show orders that have never been sent to a courier at all (so staff can
// send them from here) alongside ones already dispatched, matching the
// reference's single unified "SteadFast" list.
export class ShipmentQueueShipmentDto {
  id!: number;
  provider!: CourierProviderName;
  status!: ShipmentStatus;
  consignmentId!: string | null;
  trackingCode!: string | null;
}

export class ShipmentQueueRowDto {
  id!: number;
  orderNumber!: string;
  createdAt!: Date;
  status!: OrderStatus;
  recipientName!: string | null;
  shippingPhone!: string | null;
  totalAmount!: string;
  // What would actually be collected on dispatch (pending-COD orders only)
  // — the editable "Amount" cell in the reference table. Null for orders
  // that are already fully paid or use a non-COD method, same as
  // ShipmentsService.dispatch()'s own codAmount = 0 fallback.
  pendingCodAmount!: string | null;
  shipment!: ShipmentQueueShipmentDto | null;
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
