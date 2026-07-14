import { CourierProviderName, OrderStatus, PaymentProvider, RiskLevel } from '@amader/db';

export interface OrderManagerCourierAttempt {
  provider: CourierProviderName;
  status: string;
  shipmentId: number;
}

export class OrderManagerRowDto {
  id!: number;
  orderNumber!: string;
  status!: OrderStatus;
  totalAmount!: string;
  createdAt!: Date;
  recipientName!: string | null;
  shippingPhone!: string | null;
  addressLine!: string | null;
  district!: string | null;
  division!: string | null;
  postCode!: string | null;
  thumbnailUrl!: string | null;
  origin!: string;
  paymentProvider!: PaymentProvider | null;
  courierProvider!: CourierProviderName | null;
  shipmentId!: number | null;
  courierStatus!: string | null;
  courierAttempts!: OrderManagerCourierAttempt[];
  riskLevel!: RiskLevel;
}
