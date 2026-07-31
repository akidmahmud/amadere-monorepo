import {
  CourierProviderName,
  OrderAddressType,
  OrderChannel,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ShipmentStatus,
} from '@amader/db';

export const ORDER_INCLUDE = {
  items: {
    include: {
      product: {
        select: {
          shippableWeight: true,
          media: { where: { isPrimary: true }, take: 1, select: { media: { select: { url: true } } } },
        },
      },
      variant: { select: { weightOverride: true } },
    },
  },
  addresses: true,
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
    include: { adminUser: { select: { firstName: true, lastName: true } } },
  },
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
  // Variant weightOverride falls back to the product's shippableWeight —
  // same precedence as ShipmentsService.computeOrderWeight (courier
  // charging). Null when neither is configured.
  weight!: string | null;
  // Product's primary image at read time (not a snapshot — reflects
  // whatever the product currently has, same as every other product-image
  // read in this codebase). Null for deleted products or ones with no image.
  imageUrl!: string | null;
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
  adminName!: string | null;
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
  consignmentId!: string | null;
  trackingCode!: string | null;
  cost!: string | null;
  weight!: string | null;
  codAmount!: string | null;
  dispatchedAt!: Date | null;
  deliveredAt!: Date | null;
  updatedAt!: Date;
  events!: OrderShipmentEventDto[];
  // Courier's own public tracking page — null for providers with no public
  // page to link to (nothing worse than a broken/guessed link). Only
  // Steadfast is a real, live integration today (see AGENTS.md); Pathao/RedX
  // have no configured provider yet.
  trackingUrl!: string | null;
}

const COURIER_TRACKING_URLS: Partial<Record<CourierProviderName, string>> = {
  STEADFAST: 'https://steadfast.com.bd/tracking',
};

export class OrderDto {
  id!: number;
  orderNumber!: string;
  customerId!: number | null;
  status!: OrderStatus;
  channel!: OrderChannel;
  subTotal!: string;
  discountAmount!: string;
  taxAmount!: string;
  codFee!: string;
  shippingAmount!: string;
  totalAmount!: string;
  currency!: string;
  couponCode!: string | null;
  shippingMethod!: string | null;
  customerNote!: string | null;
  staffNote!: string | null;
  cancelReason!: string | null;
  codVerifiedAt!: Date | null;
  confirmedAt!: Date | null;
  completedAt!: Date | null;
  canceledAt!: Date | null;
  createdAt!: Date;
  // Attribution — captured at checkout time (see checkout.service.ts /
  // apps/web utm.ts); all null for staff-created manual orders, which have
  // no browser context to capture from.
  ipAddress!: string | null;
  utmSource!: string | null;
  utmMedium!: string | null;
  utmCampaign!: string | null;
  landingDomain!: string | null;
  landingPage!: string | null;
  referrerUrl!: string | null;
  referrerDomain!: string | null;
  items!: OrderItemDto[];
  // Sum of each item's weight × quantity (items with no configured weight
  // contribute 0) — same formula ShipmentsService uses at dispatch time, so
  // this is a live preview of what a courier shipment will end up costing,
  // available before any shipment exists.
  totalWeight!: string;
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
    channel: order.channel,
    subTotal: order.subTotal.toString(),
    discountAmount: order.discountAmount.toString(),
    taxAmount: order.taxAmount.toString(),
    codFee: order.codFee.toString(),
    shippingAmount: order.shippingAmount.toString(),
    totalAmount: order.totalAmount.toString(),
    currency: order.currency,
    couponCode: order.couponCode,
    shippingMethod: order.shippingMethod,
    customerNote: order.customerNote,
    staffNote: order.staffNote,
    cancelReason: order.cancelReason,
    codVerifiedAt: order.codVerifiedAt,
    confirmedAt: order.confirmedAt,
    completedAt: order.completedAt,
    canceledAt: order.canceledAt,
    createdAt: order.createdAt,
    ipAddress: order.ipAddress,
    utmSource: order.utmSource,
    utmMedium: order.utmMedium,
    utmCampaign: order.utmCampaign,
    landingDomain: order.landingDomain,
    landingPage: order.landingPage,
    referrerUrl: order.referrerUrl,
    referrerDomain: order.referrerDomain,
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      name: i.productNameSnapshot,
      sku: i.skuSnapshot,
      unitPrice: i.unitPrice.toString(),
      quantity: i.quantity,
      taxAmount: i.taxAmount.toString(),
      weight: decimalToString(i.variant?.weightOverride ?? i.product?.shippableWeight),
      imageUrl: i.product?.media[0]?.media.url ?? null,
    })),
    totalWeight: order.items
      .reduce((sum, i) => {
        const w = i.variant?.weightOverride ?? i.product?.shippableWeight;
        return w ? sum.plus(w.times(i.quantity)) : sum;
      }, new Prisma.Decimal(0))
      .toString(),
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
      adminName: h.adminUser ? `${h.adminUser.firstName} ${h.adminUser.lastName}`.trim() : null,
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
          consignmentId: shipment.consignmentId,
          trackingCode: shipment.trackingCode,
          cost: decimalToString(shipment.cost),
          weight: decimalToString(shipment.weight),
          codAmount: decimalToString(shipment.codAmount),
          dispatchedAt: shipment.dispatchedAt,
          deliveredAt: shipment.deliveredAt,
          updatedAt: shipment.updatedAt,
          events: shipment.events.map((e) => ({
            status: e.status,
            note: e.note,
            occurredAt: e.occurredAt,
          })),
          trackingUrl: COURIER_TRACKING_URLS[shipment.provider] ?? null,
        }
      : null,
  };
}
