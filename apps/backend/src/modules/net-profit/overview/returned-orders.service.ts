import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';

const Decimal = Prisma.Decimal;

export interface ReturnedSummary {
  shipped: number;
  returned: number;
  returnRate: number; // percent, 0-100
  returnedValue: string;
  deliveryChargeEarned: string;
  returnedQuantity: number;
}

export interface ReturnTrendPoint {
  date: string;
  returned: number;
}

export interface ReturnsByCourier {
  provider: string;
  returned: number;
}

export interface ReturnReason {
  reason: string;
  count: number;
}

export interface ReturnsByProduct {
  productId: number;
  name: string;
  returnedQty: number;
  avgUnitPrice: string;
  amount: string;
}

export interface ReturnedOrderRow {
  orderId: number;
  orderNumber: string;
  recipientName: string;
  phone: string;
  totalAmount: string;
  quantity: number;
  returnedAt: string;
}

export interface ReturnsByArea {
  division: string;
  district: string;
  returned: number;
}

// ADDENDUM §B2 — derived entirely from existing Shipment (returned status +
// return_reason, per the §F inbound webhooks) and Order/OrderItem/
// OrderAddress data; no new "returns" table.
@Injectable()
export class ReturnedOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(from: Date, to: Date): Promise<ReturnedSummary> {
    const [counts, valueAgg, qtyAgg] = await Promise.all([
      this.prisma.client.$queryRaw<{ shipped: bigint; returned: bigint }[]>`
        SELECT
          count(*) FILTER (WHERE s.dispatched_at IS NOT NULL) AS shipped,
          count(*) FILTER (WHERE s.status = 'RETURNED') AS returned
        FROM shipments s
        WHERE s.created_at BETWEEN ${from} AND ${to}
      `,
      this.prisma.client.$queryRaw<{ total: Prisma.Decimal | null; delivery: Prisma.Decimal | null }[]>`
        SELECT sum(o.total_amount) AS total, sum(o.shipping_amount) AS delivery
        FROM shipments s
        JOIN orders o ON o.id = s.order_id
        WHERE s.status = 'RETURNED' AND s.created_at BETWEEN ${from} AND ${to}
      `,
      this.prisma.client.$queryRaw<{ qty: bigint | null }[]>`
        SELECT sum(oi.quantity)::bigint AS qty
        FROM shipments s
        JOIN order_items oi ON oi.order_id = s.order_id
        WHERE s.status = 'RETURNED' AND s.created_at BETWEEN ${from} AND ${to}
      `,
    ]);
    const shipped = Number(counts[0]?.shipped ?? 0);
    const returned = Number(counts[0]?.returned ?? 0);
    return {
      shipped,
      returned,
      returnRate: shipped > 0 ? Math.round((returned / shipped) * 10000) / 100 : 0,
      returnedValue: (valueAgg[0]?.total ?? new Decimal(0)).toString(),
      deliveryChargeEarned: (valueAgg[0]?.delivery ?? new Decimal(0)).toString(),
      returnedQuantity: Number(qtyAgg[0]?.qty ?? 0),
    };
  }

  async trend(from: Date, to: Date): Promise<ReturnTrendPoint[]> {
    const rows = await this.prisma.client.$queryRaw<{ date: string; returned: bigint }[]>`
      SELECT to_char(date_trunc('day', s.updated_at), 'YYYY-MM-DD') AS date, count(*)::bigint AS returned
      FROM shipments s
      WHERE s.status = 'RETURNED' AND s.updated_at BETWEEN ${from} AND ${to}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows.map((r) => ({ date: r.date, returned: Number(r.returned) }));
  }

  async byCourier(from: Date, to: Date): Promise<ReturnsByCourier[]> {
    const rows = await this.prisma.client.$queryRaw<{ provider: string; returned: bigint }[]>`
      SELECT s.provider::text AS provider, count(*)::bigint AS returned
      FROM shipments s
      WHERE s.status = 'RETURNED' AND s.updated_at BETWEEN ${from} AND ${to}
      GROUP BY 1
      ORDER BY returned DESC
    `;
    return rows.map((r) => ({ provider: r.provider, returned: Number(r.returned) }));
  }

  async topReasons(from: Date, to: Date, limit = 10): Promise<ReturnReason[]> {
    const rows = await this.prisma.client.$queryRaw<{ reason: string; count: bigint }[]>`
      SELECT s.return_reason AS reason, count(*)::bigint AS count
      FROM shipments s
      WHERE s.status = 'RETURNED' AND s.return_reason IS NOT NULL AND s.updated_at BETWEEN ${from} AND ${to}
      GROUP BY 1
      ORDER BY count DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({ reason: r.reason, count: Number(r.count) }));
  }

  async byProduct(from: Date, to: Date, limit = 10): Promise<ReturnsByProduct[]> {
    const rows = await this.prisma.client.$queryRaw<
      { product_id: number; name: string; returned_qty: bigint; avg_unit_price: Prisma.Decimal | null; amount: Prisma.Decimal | null }[]
    >`
      SELECT oi.product_id, oi.product_name_snapshot AS name, sum(oi.quantity)::bigint AS returned_qty,
             avg(oi.unit_price) AS avg_unit_price, sum(oi.unit_price * oi.quantity) AS amount
      FROM shipments s
      JOIN order_items oi ON oi.order_id = s.order_id
      WHERE s.status = 'RETURNED' AND oi.product_id IS NOT NULL AND s.updated_at BETWEEN ${from} AND ${to}
      GROUP BY oi.product_id, oi.product_name_snapshot
      ORDER BY returned_qty DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      productId: r.product_id,
      name: r.name,
      returnedQty: Number(r.returned_qty),
      avgUnitPrice: (r.avg_unit_price ?? new Decimal(0)).toString(),
      amount: (r.amount ?? new Decimal(0)).toString(),
    }));
  }

  // Order-level table (plugin's "Returned Orders" list) — distinct from the
  // aggregate byProduct/byCourier/topReasons/byArea breakdowns above.
  async returnedOrdersList(from: Date, to: Date, page: number, pageSize: number): Promise<PaginatedResult<ReturnedOrderRow>> {
    const offset = (page - 1) * pageSize;
    const [rows, countRows] = await Promise.all([
      this.prisma.client.$queryRaw<
        { order_id: number; order_number: string; recipient_name: string | null; phone: string | null; total_amount: Prisma.Decimal; quantity: bigint; returned_at: Date }[]
      >`
        SELECT o.id AS order_id, o.order_number, oa.recipient_name, oa.phone, o.total_amount,
               COALESCE(qty.quantity, 0)::bigint AS quantity, s.updated_at AS returned_at
        FROM shipments s
        JOIN orders o ON o.id = s.order_id
        LEFT JOIN order_addresses oa ON oa.order_id = o.id AND oa.type = 'SHIPPING'
        LEFT JOIN (
          SELECT order_id, sum(quantity) AS quantity FROM order_items GROUP BY order_id
        ) qty ON qty.order_id = o.id
        WHERE s.status = 'RETURNED' AND s.updated_at BETWEEN ${from} AND ${to}
        ORDER BY s.updated_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      this.prisma.client.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint AS count FROM shipments s WHERE s.status = 'RETURNED' AND s.updated_at BETWEEN ${from} AND ${to}
      `,
    ]);
    const items: ReturnedOrderRow[] = rows.map((r) => ({
      orderId: r.order_id,
      orderNumber: r.order_number,
      recipientName: r.recipient_name ?? '—',
      phone: r.phone ?? '—',
      totalAmount: r.total_amount.toString(),
      quantity: Number(r.quantity),
      returnedAt: r.returned_at.toISOString(),
    }));
    return { items, total: Number(countRows[0]?.count ?? 0), page, pageSize };
  }

  async byArea(from: Date, to: Date): Promise<ReturnsByArea[]> {
    const rows = await this.prisma.client.$queryRaw<{ division: string; district: string; returned: bigint }[]>`
      SELECT oa.division, oa.district, count(DISTINCT s.order_id)::bigint AS returned
      FROM shipments s
      JOIN order_addresses oa ON oa.order_id = s.order_id AND oa.type = 'SHIPPING'
      WHERE s.status = 'RETURNED' AND s.updated_at BETWEEN ${from} AND ${to}
      GROUP BY oa.division, oa.district
      ORDER BY returned DESC
    `;
    return rows.map((r) => ({ division: r.division, district: r.district, returned: Number(r.returned) }));
  }

  async exportCsv(from: Date, to: Date): Promise<string> {
    const rows = await this.trend(from, to);
    const header = 'Date,Returned';
    const lines = rows.map((r) => `${r.date},${r.returned}`);
    return [header, ...lines].join('\n');
  }
}
