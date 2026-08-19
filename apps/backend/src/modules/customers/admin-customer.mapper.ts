import { Prisma } from '@amader/db';
import { ApiProperty } from '@nestjs/swagger';
import { frequencyScore, monetaryScore, rfmScore } from './customer-score.util';

export const ADMIN_CUSTOMER_LIST_INCLUDE = {
  tier: true,
  assignedAdmin: true,
} as const;

export type CustomerWithTier = Prisma.CustomerGetPayload<{
  include: typeof ADMIN_CUSTOMER_LIST_INCLUDE;
}>;

export const ADMIN_CUSTOMER_DETAIL_INCLUDE = {
  tier: true,
  assignedAdmin: true,
  notes: { orderBy: { createdAt: 'desc' as const } },
  callLogs: { orderBy: { createdAt: 'desc' as const } },
  orders: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      statusHistory: { orderBy: { createdAt: 'asc' as const } },
      // Feeds purchasedProducts below. Added to the orders include rather
      // than fetched as its own grouped query precisely because these
      // orders are already being loaded — the aggregation is a fold over
      // data that was on the wire regardless.
      items: {
        select: {
          productId: true,
          productNameSnapshot: true,
          skuSnapshot: true,
          quantity: true,
          unitPrice: true,
        },
      },
    },
  },
  // Same "isDefault first" pick CustomersService.adminUpdate() uses to
  // decide which saved address is "the" one — exposed here so the New Order
  // form can prefill shipping fields for a preselected customer.
  addresses: { orderBy: { isDefault: 'desc' as const } },
} as const;

export type CustomerWithDetail = Prisma.CustomerGetPayload<{
  include: typeof ADMIN_CUSTOMER_DETAIL_INCLUDE;
}>;

/** Per-customer data the list query can't get from the Customer row alone —
 * assembled in CustomersService.adminList via a handful of grouped queries
 * over the current page's customer IDs, not fetched per-row. */
export interface AdminCustomerListExtras {
  address: string | null;
  lastOrderDate: Date | null;
  topProduct: string | null;
  lifetimeSpend: number;
}

export class AdminCustomerListItemDto {
  id!: number;
  name!: string;
  phone!: string | null;
  email!: string | null;
  tier!: string | null;
  completedOrderCount!: number;
  createdAt!: Date;

  // CRM fields
  isFavorite!: boolean;
  dob!: Date | null;
  address!: string | null;
  topProduct!: string | null;
  assignedAdminId!: number | null;
  assignedAdminName!: string | null;
  lastOrderDate!: Date | null;
  nextCallTarget!: Date | null;
  followUpCadenceDays!: number | null;
  hasNewOrder!: boolean;
  newOrderAt!: Date | null;
  priority!: string | null;
  crmStatus!: string | null;
  behaviour!: string | null;
  customerFeedback!: string | null;
  amaderFeedback!: string | null;
  familyDetails!: string | null;
  purchaseReason!: string | null;
  facebookProfileUrl!: string | null;
  fScore!: number;
  mScore!: number;
  rfmScore!: string;
}

function fullName(c: { firstName: string | null; lastName: string | null }): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || '(no name)';
}

export function toAdminCustomerListItemDto(c: CustomerWithTier, extras: AdminCustomerListExtras): AdminCustomerListItemDto {
  const fScore = frequencyScore(c.completedOrderCount);
  const mScore = monetaryScore(extras.lifetimeSpend);
  return {
    id: c.id,
    name: fullName(c),
    // phone/email are nulled out while soft-deleted (see customers.service
    // ts's adminBulkAction — frees them up for a new registration to reuse);
    // the Deleted Customers trash tab still needs to show who this was, so
    // fall back to the snapshot taken at delete time.
    phone: c.phone ?? c.deletedPhone,
    email: c.email ?? c.deletedEmail,
    tier: c.tier?.label ?? null,
    completedOrderCount: c.completedOrderCount,
    createdAt: c.createdAt,

    isFavorite: c.isFavorite,
    dob: c.dob,
    address: extras.address,
    topProduct: extras.topProduct,
    assignedAdminId: c.assignedAdminId,
    assignedAdminName: c.assignedAdmin ? `${c.assignedAdmin.firstName} ${c.assignedAdmin.lastName}`.trim() : null,
    lastOrderDate: extras.lastOrderDate,
    nextCallTarget: c.nextCallTarget,
    followUpCadenceDays: c.followUpCadenceDays,
    hasNewOrder: c.hasNewOrder,
    newOrderAt: c.newOrderAt,
    priority: c.priority,
    crmStatus: c.crmStatus,
    behaviour: c.behaviour,
    customerFeedback: c.customerFeedback,
    amaderFeedback: c.amaderFeedback,
    familyDetails: c.familyDetails,
    purchaseReason: c.purchaseReason,
    facebookProfileUrl: c.facebookProfileUrl,
    fScore,
    mScore,
    rfmScore: rfmScore(fScore, mScore),
  };
}

// Trend % is only computed for cohort-based metrics (created-this-month vs
// created-last-month) — cleanly derivable from createdAt alone. Active/
// Repeat/AOV are point-in-time STATE, not a creation cohort, so a month-
// over-month trend for them would need a historical snapshot table this
// phase doesn't have. Rather than fabricate a number, those trend fields
// are always null and the frontend hides the trend line when null.
export class AdminCustomerStatsDto {
  totalCustomers!: number;
  totalCustomersTrendPct!: number | null;
  newCustomersThisMonth!: number;
  newCustomersTrendPct!: number | null;
  activeCustomers!: number;
  repeatCustomers!: number;
  averageOrderValue!: number;
}

export class AdminCustomerNoteDto {
  id!: number;
  type!: string;
  body!: string;
  authorAdminId!: number;
  createdAt!: Date;
}

export class AdminCustomerCallLogDto {
  id!: number;
  phoneCalled!: string;
  outcome!: string;
  notes!: string | null;
  authorAdminId!: number;
  createdAt!: Date;
}

export class AdminCustomerOrderSummaryDto {
  id!: number;
  orderNumber!: string;
  status!: string;
  totalAmount!: string;
  createdAt!: Date;
}

// Internal-only shape used while building the timeline — NOT the DTO field
// type. NestJS Swagger generates schemas from `@ApiProperty()`-decorated
// class fields via reflection; a plain TS union type has no runtime
// metadata to reflect, so it would come out wrong (or missing) in the
// generated OpenAPI doc a later task's typegen reads from.
// `AdminCustomerDto.activity` below is typed as `Record<string, unknown>[]`
// instead — same pattern already used for other free-form JSON fields in
// this codebase (e.g. `PublicProductDetailDto.structuredData`). The
// frontend narrows on `.type` at render time.
type ActivityEntry =
  | { type: 'ORDER'; orderId: number; orderNumber: string; status: string; occurredAt: Date }
  | { type: 'NOTE'; noteId: number; noteType: string; body: string; occurredAt: Date }
  | { type: 'CALL'; callId: number; outcome: string; occurredAt: Date };

export class AdminCustomerAddressSummaryDto {
  recipientName!: string;
  phone!: string;
  addressLine!: string;
  division!: string;
  district!: string;
  area!: string | null;
  landmark!: string | null;
  postCode!: string | null;
  alternativePhone!: string | null;
}

// One row per distinct product this customer has actually bought, folded
// across all of their orders — the detail page previously showed order
// history only, so answering "what does this person actually buy" meant
// opening every order in turn.
export class AdminCustomerPurchasedProductDto {
  /** Null once the product row itself is deleted (OrderItem.productId is SetNull) — the snapshot name survives. */
  productId!: number | null;
  name!: string;
  sku!: string | null;
  totalQuantity!: number;
  orderCount!: number;
  totalSpent!: string;
  lastPurchasedAt!: Date;
}

export class AdminCustomerDto {
  id!: number;
  name!: string;
  phone!: string | null;
  email!: string | null;
  dob!: Date | null;
  tier!: string | null;
  completedOrderCount!: number;
  createdAt!: Date;
  defaultAddress!: AdminCustomerAddressSummaryDto | null;
  orders!: AdminCustomerOrderSummaryDto[];
  purchasedProducts!: AdminCustomerPurchasedProductDto[];
  notes!: AdminCustomerNoteDto[];
  callLogs!: AdminCustomerCallLogDto[];
  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  activity!: Record<string, unknown>[];

  isFavorite!: boolean;
  assignedAdminId!: number | null;
  assignedAdminName!: string | null;
  nextCallTarget!: Date | null;
  followUpCadenceDays!: number | null;
  hasNewOrder!: boolean;
  newOrderAt!: Date | null;
  priority!: string | null;
  crmStatus!: string | null;
  behaviour!: string | null;
  customerFeedback!: string | null;
  amaderFeedback!: string | null;
  familyDetails!: string | null;
  purchaseReason!: string | null;
  facebookProfileUrl!: string | null;
}

// CANCELED and RETURNED orders are excluded: the goods either never shipped
// or came back, so counting them would tell staff this customer buys things
// they don't actually have. PARTIALLY_RETURNED is kept whole — Order.status
// alone doesn't say WHICH line was returned, and silently dropping the entire
// order would understate it worse than leaving it in.
const NON_PURCHASE_STATUSES = new Set(['CANCELED', 'RETURNED']);

function toPurchasedProducts(c: CustomerWithDetail): AdminCustomerPurchasedProductDto[] {
  const byProduct = new Map<string, AdminCustomerPurchasedProductDto & { orderIds: Set<number> }>();

  for (const order of c.orders) {
    if (NON_PURCHASE_STATUSES.has(order.status)) continue;
    for (const item of order.items) {
      // Keyed on productId where there is one so a product that was renamed
      // between orders still folds into a single row; falls back to the
      // snapshot name for items whose product row has since been deleted.
      const key = item.productId !== null ? `id:${item.productId}` : `name:${item.productNameSnapshot}`;
      const lineTotal = Number(item.unitPrice) * item.quantity;
      const existing = byProduct.get(key);
      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.totalSpent = (Number(existing.totalSpent) + lineTotal).toFixed(2);
        existing.orderIds.add(order.id);
        // c.orders is ordered createdAt desc, so the first order to touch a
        // product is its most recent purchase — keep that date and that
        // order's spelling of the name.
      } else {
        byProduct.set(key, {
          productId: item.productId,
          name: item.productNameSnapshot,
          sku: item.skuSnapshot,
          totalQuantity: item.quantity,
          orderCount: 0,
          totalSpent: lineTotal.toFixed(2),
          lastPurchasedAt: order.createdAt,
          orderIds: new Set([order.id]),
        });
      }
    }
  }

  return [...byProduct.values()]
    .map(({ orderIds, ...row }) => ({ ...row, orderCount: orderIds.size }))
    .sort(
      (a, b) =>
        b.totalQuantity - a.totalQuantity ||
        b.lastPurchasedAt.getTime() - a.lastPurchasedAt.getTime(),
    );
}

export function toAdminCustomerDto(c: CustomerWithDetail): AdminCustomerDto {
  const activity: ActivityEntry[] = [
    ...c.orders.flatMap((o) =>
      o.statusHistory.map((h) => ({
        type: 'ORDER' as const,
        orderId: o.id,
        orderNumber: o.orderNumber,
        status: h.status,
        occurredAt: h.createdAt,
      })),
    ),
    ...c.notes.map((n) => ({
      type: 'NOTE' as const,
      noteId: n.id,
      noteType: n.type,
      body: n.body,
      occurredAt: n.createdAt,
    })),
    ...c.callLogs.map((call) => ({
      type: 'CALL' as const,
      callId: call.id,
      outcome: call.outcome,
      occurredAt: call.createdAt,
    })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  return {
    id: c.id,
    name: fullName(c),
    // Same deletedPhone/deletedEmail fallback as the list mapper above.
    phone: c.phone ?? c.deletedPhone,
    email: c.email ?? c.deletedEmail,
    dob: c.dob,
    tier: c.tier?.label ?? null,
    completedOrderCount: c.completedOrderCount,
    createdAt: c.createdAt,
    defaultAddress: c.addresses[0]
      ? {
          recipientName: c.addresses[0].recipientName,
          phone: c.addresses[0].phone,
          addressLine: c.addresses[0].addressLine,
          division: c.addresses[0].division,
          district: c.addresses[0].district,
          area: c.addresses[0].area,
          landmark: c.addresses[0].landmark,
          postCode: c.addresses[0].postCode,
          alternativePhone: c.addresses[0].alternativePhone,
        }
      : null,
    orders: c.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalAmount: o.totalAmount.toString(),
      createdAt: o.createdAt,
    })),
    purchasedProducts: toPurchasedProducts(c),
    notes: c.notes.map((n) => ({
      id: n.id,
      type: n.type,
      body: n.body,
      authorAdminId: n.authorAdminId,
      createdAt: n.createdAt,
    })),
    callLogs: c.callLogs.map((call) => ({
      id: call.id,
      phoneCalled: call.phoneCalled,
      outcome: call.outcome,
      notes: call.notes,
      authorAdminId: call.authorAdminId,
      createdAt: call.createdAt,
    })),
    activity,

    isFavorite: c.isFavorite,
    assignedAdminId: c.assignedAdminId,
    assignedAdminName: c.assignedAdmin ? `${c.assignedAdmin.firstName} ${c.assignedAdmin.lastName}`.trim() : null,
    nextCallTarget: c.nextCallTarget,
    followUpCadenceDays: c.followUpCadenceDays,
    hasNewOrder: c.hasNewOrder,
    newOrderAt: c.newOrderAt,
    priority: c.priority,
    crmStatus: c.crmStatus,
    behaviour: c.behaviour,
    customerFeedback: c.customerFeedback,
    amaderFeedback: c.amaderFeedback,
    familyDetails: c.familyDetails,
    purchaseReason: c.purchaseReason,
    facebookProfileUrl: c.facebookProfileUrl,
  };
}
