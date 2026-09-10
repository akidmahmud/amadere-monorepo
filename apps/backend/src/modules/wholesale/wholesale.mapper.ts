import {
  Prisma,
  WholesaleCourier,
  WholesaleOrderChannel,
  WholesaleOrderStatus,
  WholesaleOrderType,
  WholesalePaymentMethod,
  WholesalePaymentStatus,
} from '@amader/db';

const ZERO = new Prisma.Decimal(0);

export class WholesaleCustomerDto {
  id!: number;
  name!: string;
  phone!: string | null;
  address!: string | null;
  email!: string | null;
  alternativePhone!: string | null;
  district!: string | null;
  thana!: string | null;
  landmark!: string | null;
  postCode!: string | null;
  creditLimit!: string | null;
  creditDays!: number | null;
  note!: string | null;
  isActive!: boolean;
  /** Orders placed, cancelled ones excluded. */
  orderCount!: number;
  /** Of `orderCount`, how many were each kind. */
  wholesaleCount!: number;
  cashCount!: number;
  /** Lifetime wholesale sales to this buyer. */
  purchaseTotal!: string;
  /** Outstanding, derived from the ledger — never a stored balance. */
  due!: string;
  /** When they last bought, or null if never. */
  lastOrderAt!: Date | null;
}

/**
 * The dashboard headline numbers.
 *
 * Counted over every order, not just the page on screen: the list is
 * paginated, so totalling the rows the client happens to be holding would
 * quietly under-report as soon as the business passed one page of orders.
 */
export class WholesaleStatsDto {
  orderCount!: number;
  wholesaleOrderCount!: number;
  cashSaleCount!: number;
  /** Grand total of every live order. */
  salesTotal!: string;
  /** Still outstanding across all buyers. */
  dueTotal!: string;
  customerCount!: number;
  /** Buyers with at least one live order of that kind. */
  wholesaleCustomerCount!: number;
  cashCustomerCount!: number;
}

export class WholesaleOrderItemDto {
  id!: number;
  productId!: number | null;
  variantId!: number | null;
  name!: string;
  sku!: string | null;
  unitPrice!: string;
  quantity!: number;
  /** Taka off this line, before the order-level discount. */
  discount!: string;
  lineTotal!: string;
  /** Read off the product now, not snapshotted — null once it is deleted. */
  imageUrl!: string | null;
}

/** Where an order went, frozen when it was placed. Null throughout only when
 *  no address was entered. */
export class WholesaleDeliveryDto {
  recipientName!: string | null;
  recipientPhone!: string | null;
  alternativePhone!: string | null;
  recipientEmail!: string | null;
  addressLine!: string | null;
  district!: string | null;
  thana!: string | null;
  landmark!: string | null;
  postCode!: string | null;
}

export class WholesaleOrderDto {
  id!: number;
  orderNumber!: string;
  partyId!: number;
  customerName!: string;
  customerPhone!: string | null;
  status!: WholesaleOrderStatus;
  type!: WholesaleOrderType;
  channel!: WholesaleOrderChannel | null;
  paymentMethod!: WholesalePaymentMethod | null;
  paymentStatus!: WholesalePaymentStatus;
  transactionId!: string | null;
  /** Counter-sale voucher number. Cash sales only. */
  gpNumber!: string | null;
  /** Null on a cash sale — nothing is couriered. */
  courier!: WholesaleCourier | null;
  consignmentId!: string | null;
  delivery!: WholesaleDeliveryDto;
  subtotal!: string;
  deliveryCharge!: string;
  discount!: string;
  total!: string;
  /** Collected so far against this order's receivable. */
  paid!: string;
  /** total − paid. Zero once settled; never negative. */
  due!: string;
  /** Doc number of the receivable this order raised, for cross-reference in Accounts. */
  invoiceDocNo!: string | null;
  note!: string | null;
  placedAt!: Date;
  items!: WholesaleOrderItemDto[];
}

type OrderRow = Prisma.WholesaleOrderGetPayload<{
  include: {
    party: { select: { id: true; name: true; phone: true } };
    items: {
      include: {
        product: {
          select: { media: { select: { media: { select: { url: true } } } } };
        };
      };
    };
    dues: { select: { id: true; docNo: true; voidedAt: true; kind: true } };
  };
}>;

export function toWholesaleOrderDto(row: OrderRow, paid: Prisma.Decimal): WholesaleOrderDto {
  const liveDue = row.dues.find((d) => !d.voidedAt) ?? null;

  // A cancelled order owes nothing: cancelling voids its receivable, and the
  // goods went back on the shelf. Deriving `total − paid` regardless reported
  // the full value of a cancelled order as outstanding — which also made the
  // list offer a "Collect" button for money nobody owes.
  //
  // Clamped at zero for live orders too, so an over-collection (possible via
  // a manual ledger entry in Accounts) reads as settled rather than negative.
  const outstanding = row.status === 'CANCELLED' ? ZERO : row.total.minus(paid);

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    partyId: row.partyId,
    customerName: row.party.name,
    customerPhone: row.party.phone,
    status: row.status,
    type: row.type,
    channel: row.channel,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    transactionId: row.transactionId,
    gpNumber: row.gpNumber,
    courier: row.courier,
    consignmentId: row.consignmentId,
    delivery: {
      recipientName: row.recipientName,
      recipientPhone: row.recipientPhone,
      alternativePhone: row.alternativePhone,
      recipientEmail: row.recipientEmail,
      addressLine: row.addressLine,
      district: row.district,
      thana: row.thana,
      landmark: row.landmark,
      postCode: row.postCode,
    },
    subtotal: row.subtotal.toFixed(2),
    deliveryCharge: row.deliveryCharge.toFixed(2),
    discount: row.discount.toFixed(2),
    total: row.total.toFixed(2),
    paid: paid.toFixed(2),
    due: outstanding.isNegative() ? '0.00' : outstanding.toFixed(2),
    invoiceDocNo: liveDue?.docNo ?? null,
    note: row.note,
    placedAt: row.placedAt,
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.nameSnapshot,
      sku: item.skuSnapshot,
      unitPrice: item.unitPrice.toFixed(2),
      quantity: item.quantity,
      discount: item.discount.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
      imageUrl: item.product?.media[0]?.media.url ?? null,
    })),
  };
}
