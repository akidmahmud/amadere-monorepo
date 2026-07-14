import { CourierProviderName, OrderStatus, PaymentProvider, Prisma, RiskLevel } from '@amader/db';

export const ORDER_MANAGER_INCLUDE = {
  addresses: { where: { type: 'SHIPPING' as const } },
  payments: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  shipments: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} as const;

export type OrderManagerRow = Prisma.OrderGetPayload<{
  include: typeof ORDER_MANAGER_INCLUDE;
}>;

export class OrderManagerRowDto {
  id!: number;
  orderNumber!: string;
  status!: OrderStatus;
  totalAmount!: string;
  createdAt!: Date;
  shippingPhone!: string | null;
  division!: string | null;
  paymentProvider!: PaymentProvider | null;
  courierProvider!: CourierProviderName | null;
  riskLevel!: RiskLevel;
}

export function toOrderManagerRowDto(
  row: OrderManagerRow,
  riskLevel: RiskLevel = 'UNKNOWN',
): OrderManagerRowDto {
  const shippingAddress = row.addresses[0];
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    totalAmount: row.totalAmount.toString(),
    createdAt: row.createdAt,
    shippingPhone: shippingAddress?.phone ?? null,
    division: shippingAddress?.division ?? null,
    paymentProvider: row.payments[0]?.provider ?? null,
    courierProvider: row.shipments[0]?.provider ?? null,
    riskLevel,
  };
}
