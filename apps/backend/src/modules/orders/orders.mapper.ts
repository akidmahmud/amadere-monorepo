import { Prisma } from '@amader/db';

export const ORDER_INCLUDE = {
  items: true,
  addresses: true,
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  payments: { orderBy: { createdAt: 'asc' as const } },
} as const;

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof ORDER_INCLUDE;
}>;

function decimalToString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  return value ? value.toString() : null;
}

export function toOrderDto(order: OrderWithRelations) {
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
  };
}
