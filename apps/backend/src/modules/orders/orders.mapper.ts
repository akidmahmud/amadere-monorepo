import {
  CourierProviderName,
  OrderAddressType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ShipmentStatus,
} from '@amader/db';

export const ORDER_INCLUDE = {
  items: true,
  addresses: true,
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  payments: { orderBy: { createdAt: 'asc' as const } },
  // Most recent shipment only — an order can theoretically get re-dispatched
  // (e.g. after a return), so `shipments` is a list, but customers/admins
  // only need the current one here. Status is whatever the last Steadfast
  // webhook synced (courier-webhooks.controller.ts), not a live call to
  // Steadfast on every read — this endpoint is public/unauthenticated
  // (phone-matched only), so it must stay cheap and can't safely trigger an
  // outbound call + DB write per request.
  shipments: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: { events: { orderBy: { occurredAt: 'asc' as const } } },
  },
} as const;

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof ORDER_INCLUDE;
}>;

function decimalToString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  return value ? value.toString() : null;
}

export class OrderItemDto {
  id!: number;
  productId!: number | null;
  variantId!: number | null;
  name!: string;
  sku!: string | null;
  unitPrice!: string;
  quantity!: number;
  taxAmount!: string;
}

export class OrderAddressDto {
  type!: OrderAddressType;
  recipientName!: string;
  phone!: string;
  email!: string | null;
  division!: string;
  district!: string;
  area!: string | null;
  landmark!: string | null;
  addressLine!: string;
  postCode!: string | null;
}

export class OrderStatusHistoryEntryDto {
  status!: OrderStatus;
  note!: string | null;
  createdAt!: Date;
}

export class OrderPaymentDto {
  provider!: PaymentProvider;
  status!: PaymentStatus;
  amount!: string;
  refundedAmount!: string | null;
  createdAt!: Date;
}

export class OrderShipmentEventDto {
  status!: ShipmentStatus;
  note!: string | null;
  occurredAt!: Date;
}

export class OrderShipmentDto {
  provider!: CourierProviderName;
  status!: ShipmentStatus;
  trackingCode!: string | null;
  dispatchedAt!: Date | null;
  deliveredAt!: Date | null;
  events!: OrderShipmentEventDto[];
}

export class OrderDto {
  id!: number;
  orderNumber!: string;
  customerId!: number | null;
  status!: OrderStatus;
  subTotal!: string;
  discountAmount!: string;
  taxAmount!: string;
  shippingAmount!: string;
  totalAmount!: string;
  currency!: string;
  couponCode!: string | null;
  shippingMethod!: string | null;
  customerNote!: string | null;
  cancelReason!: string | null;
  codVerifiedAt!: Date | null;
  confirmedAt!: Date | null;
  completedAt!: Date | null;
  canceledAt!: Date | null;
  createdAt!: Date;
  items!: OrderItemDto[];
  addresses!: OrderAddressDto[];
  statusHistory!: OrderStatusHistoryEntryDto[];
  payments!: OrderPaymentDto[];
  shipment!: OrderShipmentDto | null;
}

export function toOrderDto(order: OrderWithRelations): OrderDto {
  const shipment = order.shipments[0];
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    status: order.status,
    subTotal: order.subTotal.toString(),
    discountAmount: order.discountAmount.toString(),
    taxAmount: order.taxAmount.toString(),
    shippingAmount: order.shippingAmount.toString(),
    totalAmount: order.totalAmount.toString(),
    currency: order.currency,
    couponCode: order.couponCode,
    shippingMethod: order.shippingMethod,
    customerNote: order.customerNote,
    cancelReason: order.cancelReason,
    codVerifiedAt: order.codVerifiedAt,
    confirmedAt: order.confirmedAt,
    completedAt: order.completedAt,
    canceledAt: order.canceledAt,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      name: i.productNameSnapshot,
      sku: i.skuSnapshot,
      unitPrice: i.unitPrice.toString(),
      quantity: i.quantity,
      taxAmount: i.taxAmount.toString(),
    })),
    addresses: order.addresses.map((a) => ({
      type: a.type,
      recipientName: a.recipientName,
      phone: a.phone,
      email: a.email,
      division: a.division,
      district: a.district,
      area: a.area,
      landmark: a.landmark,
      addressLine: a.addressLine,
      postCode: a.postCode,
    })),
    statusHistory: order.statusHistory.map((h) => ({
      status: h.status,
      note: h.note,
      createdAt: h.createdAt,
    })),
    payments: order.payments.map((p) => ({
      provider: p.provider,
      status: p.status,
      amount: p.amount.toString(),
      refundedAmount: decimalToString(p.refundedAmount),
      createdAt: p.createdAt,
    })),
    shipment: shipment
      ? {
          provider: shipment.provider,
          status: shipment.status,
          trackingCode: shipment.trackingCode,
          dispatchedAt: shipment.dispatchedAt,
          deliveredAt: shipment.deliveredAt,
          events: shipment.events.map((e) => ({
            status: e.status,
            note: e.note,
            occurredAt: e.occurredAt,
          })),
        }
      : null,
  };
}
