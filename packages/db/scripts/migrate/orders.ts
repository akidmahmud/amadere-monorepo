import type { Connection } from 'mysql2/promise';
import type { PrismaClient } from '../../src/index';
import { Prisma } from '../../src/index';
import { mapRawCourierStatus } from '@amader/shared';
import { detectDivisionDistrict } from './bd-geo';
import type { VariantRef } from './catalog';
import { bump, type MigrationReport } from './report';

const Decimal = Prisma.Decimal;

function mapOrderStatus(
  status: string,
): 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELED' {
  switch (status) {
    case 'completed':
      return 'COMPLETED';
    case 'canceled':
      return 'CANCELED';
    case 'processing':
      return 'PROCESSING';
    default:
      return 'PENDING';
  }
}

function mapPaymentProvider(
  channel: string | null,
  report: MigrationReport,
): 'COD' | 'BKASH' | 'BANK_TRANSFER' {
  switch (channel) {
    case 'bkashpay':
      return 'BKASH';
    case 'bank_transfer':
      return 'BANK_TRANSFER';
    case 'pos_cash':
    case 'pos_card':
      report.posPaymentsMappedToCod += 1;
      return 'COD';
    default:
      return 'COD';
  }
}

function resolveProductRef(
  legacyProductId: number | null,
  productId: Map<number, number>,
  variantRef: Map<number, VariantRef>,
): { productId: number | null; variantId: number | null } {
  if (legacyProductId == null) return { productId: null, variantId: null };
  const variant = variantRef.get(legacyProductId);
  if (variant) return { productId: variant.productId, variantId: variant.variantId };
  const product = productId.get(legacyProductId);
  if (product) return { productId: product, variantId: null };
  return { productId: null, variantId: null };
}

export async function migrateOrders(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
  customerId: Map<number, number>,
  productId: Map<number, number>,
  variantRef: Map<number, VariantRef>,
): Promise<Map<number, number>> {
  const [orderRows] = await source.query<any[]>('SELECT * FROM ec_orders');
  const [itemRows] = await source.query<any[]>('SELECT * FROM ec_order_product');
  const [addressRows] = await source.query<any[]>('SELECT * FROM ec_order_addresses');
  const [paymentRows] = await source.query<any[]>('SELECT * FROM payments');
  const [shipmentRows] = await source.query<any[]>('SELECT * FROM steadfasts');

  const itemsByOrder = groupBy(itemRows, 'order_id');
  const addressesByOrder = groupBy(addressRows, 'order_id');
  const paymentsByOrder = groupBy(paymentRows, 'order_id');
  const shipmentsByOrder = groupBy(shipmentRows, 'order_id');

  const orderIdMap = new Map<number, number>();
  bump(report, 'orders', 'source', orderRows.length);
  bump(report, 'order_items', 'source', itemRows.length);
  bump(report, 'order_addresses', 'source', addressRows.length);
  bump(report, 'payments', 'source', paymentRows.length);
  bump(report, 'shipments', 'source', shipmentRows.length);

  for (const row of orderRows) {
    const existing = await prisma.order.findUnique({ where: { legacyId: row.id } });
    const isFresh = !existing;

    const order = await prisma.order.upsert({
      where: { legacyId: row.id },
      create: {
        legacyId: row.id,
        orderNumber: row.code || `LEGACY-${row.id}`,
        customerId: row.user_id ? (customerId.get(row.user_id) ?? null) : null,
        status: mapOrderStatus(row.status),
        subTotal: new Decimal(row.sub_total ?? row.amount ?? 0),
        discountAmount: new Decimal(row.discount_amount ?? 0),
        taxAmount: new Decimal(row.tax_amount ?? 0),
        shippingAmount: new Decimal(row.shipping_amount ?? 0),
        totalAmount: new Decimal(row.amount ?? 0),
        currency: 'BDT',
        couponCode: row.coupon_code || null,
        shippingMethod: row.shipping_method || null,
        customerNote: row.description || null,
        cancelReason: row.cancellation_reason || null,
        confirmedAt: row.is_confirmed ? row.created_at : null,
        completedAt: row.completed_at,
        canceledAt: row.status === 'canceled' ? row.updated_at : null,
        createdAt: row.created_at ?? new Date(),
        updatedAt: row.updated_at ?? new Date(),
      },
      update: {
        status: mapOrderStatus(row.status),
      },
    });
    orderIdMap.set(row.id, order.id);
    bump(report, 'orders', 'migrated');

    if (!isFresh) continue; // children are immutable snapshots; only populate once

    for (const item of itemsByOrder.get(row.id) ?? []) {
      const ref = resolveProductRef(item.product_id, productId, variantRef);
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: ref.productId,
          variantId: ref.variantId,
          productNameSnapshot: item.product_name,
          skuSnapshot: null,
          unitPrice: new Decimal(item.price ?? 0),
          quantity: item.qty ?? 1,
          taxAmount: new Decimal(item.tax_amount ?? 0),
          restockedQuantity: item.restock_quantity ?? 0,
        },
      });
      bump(report, 'order_items', 'migrated');
    }

    for (const addr of addressesByOrder.get(row.id) ?? []) {
      const addressText = addr.address ?? '';
      const { division, district, matched } = detectDivisionDistrict(addressText);
      if (!matched) {
        report.addressesDefaulted.push({
          model: 'OrderAddress',
          legacyId: addr.id,
          addressLine: addressText,
        });
      }
      const type = addr.type === 'billing_address' ? 'BILLING' : 'SHIPPING';
      // A handful of legacy orders have more than one row of the same type
      // (an old data-entry/edit artifact) — upsert so the later one wins
      // instead of violating the (orderId, type) unique constraint.
      await prisma.orderAddress.upsert({
        where: { orderId_type: { orderId: order.id, type } },
        create: {
          orderId: order.id,
          type,
          recipientName: addr.name,
          phone: addr.phone ?? '',
          email: addr.email || null,
          division,
          district,
          addressLine: addressText,
          postCode: addr.zip_code || null,
        },
        update: {
          recipientName: addr.name,
          division,
          district,
          addressLine: addressText,
        },
      });
      bump(report, 'order_addresses', 'migrated');
    }

    for (const payment of paymentsByOrder.get(row.id) ?? []) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: mapPaymentProvider(payment.payment_channel, report),
          status: payment.status === 'completed' ? 'CAPTURED' : payment.status === 'canceled' ? 'FAILED' : 'PENDING',
          amount: new Decimal(payment.amount ?? 0),
          currency: payment.currency || 'BDT',
          transactionRef: payment.charge_id || null,
          refundedAmount: payment.refunded_amount ? new Decimal(payment.refunded_amount) : null,
          createdAt: payment.created_at ?? row.created_at ?? new Date(),
        },
      });
      bump(report, 'payments', 'migrated');
    }

    for (const shipment of shipmentsByOrder.get(row.id) ?? []) {
      const status = mapRawCourierStatus(shipment.stdf_delivery_status ?? 'pending');
      const created = await prisma.shipment.create({
        data: {
          orderId: order.id,
          provider: 'STEADFAST',
          status,
          consignmentId: shipment.steadfast_consignment_id || null,
          trackingCode: shipment.tracking_code || null,
          cost: shipment.steadfast_amount ? new Decimal(shipment.steadfast_amount) : null,
          errorMessage: shipment.error || null,
          // requestPayload/rawResponse intentionally omitted (-> NULL):
          // the old system never captured these (that gap is exactly why
          // B7 added the columns) — not a migration miss.
          dispatchedAt: shipment.steadfast_is_sent ? shipment.created_at : null,
          deliveredAt: status === 'DELIVERED' ? shipment.updated_at : null,
          createdAt: shipment.created_at ?? row.created_at ?? new Date(),
        },
      });
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: created.id,
          status,
          note: `Migrated from legacy steadfasts row #${shipment.id}`,
          occurredAt: shipment.updated_at ?? shipment.created_at ?? new Date(),
        },
      });
      bump(report, 'shipments', 'migrated');
    }
  }

  return orderIdMap;
}

function groupBy<T extends Record<string, any>>(rows: T[], key: string): Map<any, T[]> {
  const map = new Map<any, T[]>();
  for (const row of rows) {
    const list = map.get(row[key]) ?? [];
    list.push(row);
    map.set(row[key], list);
  }
  return map;
}
