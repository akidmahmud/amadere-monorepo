import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SalesGroupBy } from './dto/sales-report-query.dto';

export interface SalesReportRow {
  label: string;
  orders: number;
  revenue: string;
}

export interface TopProductRow {
  productId: number;
  name: string;
  quantity: number;
  revenue: string;
}

interface RawSalesRow {
  label: string;
  orders: bigint;
  revenue: Prisma.Decimal | null;
}

// Read-only aggregations over the real Order/OrderItem/Payment/Shipment
// tables — no duplication of order data, no new schema (§7.9). CANCELED
// orders are excluded (a canceled order was never real sales); every other
// status counts, including in-flight ones, so today's numbers move as
// orders come in rather than only after fulfilment completes.
@Injectable()
export class SalesReportService {
  constructor(private readonly prisma: PrismaService) {}

  async sales(groupBy: SalesGroupBy, from?: Date, to?: Date): Promise<SalesReportRow[]> {
    const dateFilter = this.dateFilter(from, to);
    let rows: RawSalesRow[];

    if (groupBy === 'day' || groupBy === 'week' || groupBy === 'month') {
      rows = await this.prisma.client.$queryRaw<RawSalesRow[]>`
        SELECT to_char(date_trunc(${groupBy}, o.created_at), 'YYYY-MM-DD') AS label,
               count(*)::bigint AS orders,
               sum(o.total_amount) AS revenue
        FROM orders o
        WHERE o.status != 'CANCELED' ${dateFilter}
        GROUP BY 1
        ORDER BY 1 ASC
      `;
    } else if (groupBy === 'courier') {
      rows = await this.prisma.client.$queryRaw<RawSalesRow[]>`
        SELECT COALESCE(s.provider::text, 'Not dispatched') AS label,
               count(DISTINCT o.id)::bigint AS orders,
               sum(o.total_amount) AS revenue
        FROM orders o
        LEFT JOIN LATERAL (
          SELECT provider FROM shipments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
        ) s ON true
        WHERE o.status != 'CANCELED' ${dateFilter}
        GROUP BY 1
        ORDER BY revenue DESC NULLS LAST
      `;
    } else if (groupBy === 'area') {
      rows = await this.prisma.client.$queryRaw<RawSalesRow[]>`
        SELECT COALESCE(oa.division, 'Unknown') AS label,
               count(DISTINCT o.id)::bigint AS orders,
               sum(o.total_amount) AS revenue
        FROM orders o
        LEFT JOIN order_addresses oa ON oa.order_id = o.id AND oa.type = 'SHIPPING'
        WHERE o.status != 'CANCELED' ${dateFilter}
        GROUP BY 1
        ORDER BY revenue DESC NULLS LAST
      `;
    } else {
      rows = await this.prisma.client.$queryRaw<RawSalesRow[]>`
        SELECT COALESCE(p.provider::text, 'Unknown') AS label,
               count(DISTINCT o.id)::bigint AS orders,
               sum(o.total_amount) AS revenue
        FROM orders o
        LEFT JOIN LATERAL (
          SELECT provider FROM payments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
        ) p ON true
        WHERE o.status != 'CANCELED' ${dateFilter}
        GROUP BY 1
        ORDER BY revenue DESC NULLS LAST
      `;
    }

    return rows.map((r) => ({ label: r.label, orders: Number(r.orders), revenue: (r.revenue ?? new Prisma.Decimal(0)).toString() }));
  }

  async topProducts(from?: Date, to?: Date, limit = 10): Promise<TopProductRow[]> {
    const dateFilter = this.dateFilter(from, to, 'o');
    const rows = await this.prisma.client.$queryRaw<
      { product_id: number; name: string; quantity: bigint; revenue: Prisma.Decimal }[]
    >`
      SELECT oi.product_id, oi.product_name_snapshot AS name,
             sum(oi.quantity)::bigint AS quantity,
             sum(oi.unit_price * oi.quantity) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status != 'CANCELED' AND oi.product_id IS NOT NULL ${dateFilter}
      GROUP BY oi.product_id, oi.product_name_snapshot
      ORDER BY revenue DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      productId: r.product_id,
      name: r.name,
      quantity: Number(r.quantity),
      revenue: r.revenue.toString(),
    }));
  }

  async exportCsv(groupBy: SalesGroupBy, from?: Date, to?: Date): Promise<string> {
    const rows = await this.sales(groupBy, from, to);
    const header = 'Label,Orders,Revenue';
    const lines = rows.map((r) => `"${r.label}",${r.orders},${r.revenue}`);
    return [header, ...lines].join('\n');
  }

  private dateFilter(from?: Date, to?: Date, alias = 'o'): Prisma.Sql {
    const parts: Prisma.Sql[] = [];
    if (from) parts.push(Prisma.sql`AND ${Prisma.raw(alias)}.created_at >= ${from}`);
    if (to) parts.push(Prisma.sql`AND ${Prisma.raw(alias)}.created_at <= ${to}`);
    return parts.length > 0 ? Prisma.join(parts, ' ') : Prisma.empty;
  }
}
