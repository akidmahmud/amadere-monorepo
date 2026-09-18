import { OrderStatus, Prisma } from '@amader/db';
import { dhakaDate } from '../../product-cost-history/dhaka-date';
import type { CostResolver } from '../../product-cost-history/product-cost-history.service';
import type { ShippingZonesConfig } from '../../shipping-zones/shipping-zones.types';
import { zoneOf } from './report-settings.service';
import type { ReportHistory, ReportOrder, ReportStatus } from './engine/types';

export function toReportStatus(s: OrderStatus): ReportStatus {
  switch (s) {
    case 'PENDING':
      return 'Pending';
    case 'CONFIRMED':
    case 'HOLD':
      return 'Confirmed';
    case 'PROCESSING':
      return 'Shipped';
    case 'COMPLETED':
      return 'Delivered';
    case 'RETURNED':
    case 'PARTIALLY_RETURNED':
      return 'Returned';
    case 'CANCELED':
      return 'Cancelled';
  }
}

export const CHANNEL_LABEL: Record<string, string> = {
  WEBSITE: 'Website',
  WHATSAPP: 'WhatsApp',
  PHONE: 'Call',
  MARKETPLACE: 'Marketplace',
  POS: 'POS',
  APP: 'App',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
};
export const channelLabel = (c: string) =>
  CHANNEL_LABEL[c] ?? c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, ' ');

/** The order discount split across lines by value; the parts sum to the discount exactly. */
export function spreadDiscount(grosses: number[], discount: number): number[] {
  const total = grosses.reduce((a, b) => a + b, 0);
  if (!discount || !total) return grosses.map(() => 0);
  const parts = grosses.map(
    (g) => Math.round(((discount * g) / total) * 100) / 100,
  );
  parts[parts.length - 1] += discount - parts.reduce((a, b) => a + b, 0);
  return parts;
}

const FIRST: Partial<Record<OrderStatus, keyof ReportHistory>> = {
  CONFIRMED: 'confirmed',
  HOLD: 'confirmed',
  PROCESSING: 'shipped',
  COMPLETED: 'delivered',
  RETURNED: 'returned',
  PARTIALLY_RETURNED: 'returned',
  CANCELED: 'cancelled',
};

export function historyDates(
  entries: { status: OrderStatus; createdAt: Date }[],
  confirmedAt: Date | null,
): ReportHistory {
  const h: ReportHistory = {};
  for (const e of [...entries].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )) {
    const k = FIRST[e.status];
    if (k && !h[k]) h[k] = dhakaDate(e.createdAt);
  }
  if (!h.confirmed && confirmedAt) h.confirmed = dhakaDate(confirmedAt);
  return h;
}

export const LOADER_INCLUDE = {
  assignedAdmin: { select: { id: true, firstName: true, lastName: true } },
  addresses: {
    where: { type: 'SHIPPING' as const },
    take: 1,
    select: { recipientName: true, phone: true, district: true },
  },
  items: {
    orderBy: { id: 'asc' as const },
    select: {
      productId: true,
      variantId: true,
      productNameSnapshot: true,
      unitPrice: true,
      quantity: true,
      variant: { select: { weightOverride: true } },
      product: { select: { shippableWeight: true } },
    },
  },
  statusHistory: { select: { status: true, createdAt: true } },
  shipments: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { provider: true, billedCharge: true },
  },
  payments: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { provider: true },
  },
  advancePayment: { select: { paid: true } },
} satisfies Prisma.OrderInclude;

export type LoaderRow = Prisma.OrderGetPayload<{
  include: typeof LOADER_INCLUDE;
}>;

/** Customer identity for New/Repeat: the account, else the shipping phone. */
export const customerKey = (
  customerId: number | null,
  phone: string | null | undefined,
) => (customerId ? `c:${customerId}` : phone ? `p:${phone}` : null);

export function toReportOrder(
  row: LoaderRow,
  ctx: {
    resolver: CostResolver;
    zones: ShippingZonesConfig;
    firstOrderAt: Map<string, Date>;
  },
): ReportOrder {
  const date = dhakaDate(row.createdAt);
  const addr = row.addresses[0];
  const grosses = row.items.map((i) => Number(i.unitPrice) * i.quantity);
  const discs = spreadDiscount(grosses, Number(row.discountAmount));
  const key = customerKey(row.customerId, addr?.phone);
  const first = key ? ctx.firstOrderAt.get(key) : undefined;
  const shipment = row.shipments[0];
  const agentName = row.assignedAdmin
    ? `${row.assignedAdmin.firstName ?? ''} ${row.assignedAdmin.lastName ?? ''}`.trim()
    : null;
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    date,
    status: toReportStatus(row.status),
    channel: channelLabel(row.channel),
    agentId: row.assignedAdmin?.id ?? null,
    agentName,
    customer: addr?.recipientName ?? '',
    phone: addr?.phone ?? '',
    ctype:
      !first || row.createdAt.getTime() <= first.getTime() ? 'New' : 'Repeat',
    district: addr?.district ?? '',
    zone: zoneOf(ctx.zones, addr?.district),
    lines: row.items.map((i, idx) => {
      const unitWeight = Number(
        i.variant?.weightOverride ?? i.product?.shippableWeight ?? 0,
      );
      const cost = ctx.resolver.resolve(
        {
          productId: i.productId,
          variantId: i.variantId,
          unitWeightKg: unitWeight,
        },
        date,
      );
      return {
        key: i.variantId
          ? `v${i.variantId}`
          : i.productId
            ? `p${i.productId}`
            : `n:${i.productNameSnapshot}`,
        name: i.productNameSnapshot,
        qty: i.quantity,
        price: Number(i.unitPrice),
        disc: discs[idx],
        unitWeight,
        unitCost: cost ? cost.unitCost : null,
        costOk: cost ? cost.ok : false,
      };
    }),
    delivery: Number(row.shippingAmount),
    payment: row.payments[0]?.provider ?? 'COD',
    advance: row.advancePayment ? Number(row.advancePayment.paid) : 0,
    courier: shipment?.provider ?? null,
    actual:
      shipment?.billedCharge != null ? Number(shipment.billedCharge) : null,
    hist: historyDates(row.statusHistory, row.confirmedAt),
  };
}
