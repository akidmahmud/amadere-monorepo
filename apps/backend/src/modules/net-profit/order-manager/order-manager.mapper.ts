import { CourierProviderName, OrderStatus, PaymentProvider, PaymentStatus, RiskLevel } from '@amader/db';

export interface OrderManagerCourierAttempt {
  provider: CourierProviderName;
  status: string;
  shipmentId: number;
}

/** One line of an order — what was bought, as snapshotted at purchase time. */
export class OrderManagerLineDto {
  name!: string;
  sku!: string | null;
  quantity!: number;
  unitPrice!: string;
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
  /** COD the courier collects, minus goods (sub-total less discount). Null
   *  until the order is consigned and a COD figure exists. */
  courierCharge!: string | null;
  /** The raw COD figure the courier is collecting, for context in the cell. */
  codAmount!: string | null;
  paymentProvider!: PaymentProvider | null;
  paymentStatus!: PaymentStatus | null;
  courierProvider!: CourierProviderName | null;
  shipmentId!: number | null;
  courierStatus!: string | null;
  courierAttempts!: OrderManagerCourierAttempt[];
  riskLevel!: RiskLevel;
  staffNote!: string | null;
  utmSource!: string | null;
  utmCampaign!: string | null;
  assignedAdminId!: number | null;
  assignedAdminName!: string | null;
  /** Every line on the order, in order. Empty only for a corrupt order. */
  items!: OrderManagerLineDto[];
  /** Set only in the "Deleted Orders" tab's listing — null everywhere else. */
  deletedAt!: Date | null;
}
