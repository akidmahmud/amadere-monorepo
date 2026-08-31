import { Prisma, WholesaleCourier, WholesaleOrderStatus } from '@amader/db';

const ZERO = new Prisma.Decimal(0);

export class WholesaleCustomerDto {
  id!: number;
  name!: string;
  phone!: string | null;
  address!: string | null;
  creditLimit!: string | null;
  creditDays!: number | null;
  note!: string | null;
  isActive!: boolean;
  /** Orders placed, cancelled ones excluded. */
  orderCount!: number;
  /** Lifetime wholesale sales to this buyer. */
  purchaseTotal!: string;
  /** Outstanding, derived from the ledger — never a stored balance. */
  due!: string;
}

export class WholesaleOrderItemDto {
  id!: number;
  productId!: number | null;
  variantId!: number | null;
  name!: string;
  sku!: string | null;
  unitPrice!: string;
  quantity!: number;
  lineTotal!: string;
}

export class WholesaleOrderDto {
  id!: number;
  orderNumber!: string;
  partyId!: number;
  customerName!: string;
  customerPhone!: string | null;
  status!: WholesaleOrderStatus;
  courier!: WholesaleCourier;
  consignmentId!: string | null;
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
    items: true;
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
    courier: row.courier,
    consignmentId: row.consignmentId,
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
      lineTotal: item.lineTotal.toFixed(2),
    })),
  };
}
