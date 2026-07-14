import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ProfitService } from '../profit/profit.service';
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
  profitPerUnit: string | null;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly profit: ProfitService,
  ) {}

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
    } else if (groupBy === 'hour') {
      // Hourly performance grid (Sales Report parity) — sales amount/order
      // count by hour-of-day (0-23), aggregated across every day in the
      // requested range, not a per-timestamp series.
      rows = await this.prisma.client.$queryRaw<RawSalesRow[]>`
        SELECT lpad(EXTRACT(HOUR FROM o.created_at)::text, 2, '0') AS label,
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
    return Promise.all(
      rows.map(async (r) => {
        const avgSellPrice = r.revenue.dividedBy(Number(r.quantity));
        const unitCost = await this.profit.resolveProductUnitCost(r.product_id, avgSellPrice);
        return {
          productId: r.product_id,
          name: r.name,
          quantity: Number(r.quantity),
          revenue: r.revenue.toString(),
          profitPerUnit: unitCost ? avgSellPrice.minus(unitCost).toString() : null,
        };
      }),
    );
  }

  async exportCsv(groupBy: SalesGroupBy, from?: Date, to?: Date): Promise<string> {
    const rows = await this.sales(groupBy, from, to);
    const header = 'Label,Orders,Revenue';
    const lines = rows.map((r) => `"${r.label}",${r.orders},${r.revenue}`);
    return [header, ...lines].join('\n');
  }

  // HTML export (Sales Report parity) — same styled summary the plugin
  // offers alongside CSV, for a report an admin wants to open/print/share
  // directly rather than import into a spreadsheet.
  async exportHtml(groupBy: SalesGroupBy, from?: Date, to?: Date): Promise<string> {
    const rows = await this.sales(groupBy, from, to);
    const totalRevenue = rows.reduce((sum, r) => sum + Number(r.revenue), 0);
    const totalOrders = rows.reduce((sum, r) => sum + r.orders, 0);
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const bodyRows = rows
      .map((r) => `<tr><td>${escape(r.label)}</td><td>${r.orders}</td><td>৳${Number(r.revenue).toLocaleString()}</td></tr>`)
      .join('');

    return `<!doctype html><html><head><meta charset="utf-8"><title>Sales Report</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f0fa;padding:40px 20px;color:#1e1b2e}
.wrap{max-width:900px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 24px rgba(143,0,255,0.08)}
h1{font-size:20px;font-weight:800;color:#8f00ff;margin-bottom:4px}p.sub{font-size:12px;color:#64748b;margin-bottom:24px}
table{width:100%;border-collapse:collapse;margin-bottom:28px}th{background:#8f00ff;color:#fff;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;text-align:left}
td{padding:10px 14px;font-size:13px;border-bottom:1px solid #eee}tr:nth-child(even){background:#faf8ff}
.sum-card{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px}
.sc{background:#faf8ff;border:1px solid #e8e5f0;border-radius:8px;padding:14px 16px}
.sc-l{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:4px}
.sc-v{font-size:18px;font-weight:800;color:#0b0412}</style></head>
<body><div class="wrap">
<h1>Sales Report</h1>
<p class="sub">Grouped by ${escape(groupBy)}${from ? ` · from ${from.toISOString().slice(0, 10)}` : ''}${to ? ` to ${to.toISOString().slice(0, 10)}` : ''}</p>
<div class="sum-card">
<div class="sc"><div class="sc-l">Total Orders</div><div class="sc-v">${totalOrders}</div></div>
<div class="sc"><div class="sc-l">Total Revenue</div><div class="sc-v">৳${totalRevenue.toLocaleString()}</div></div>
</div>
<table><thead><tr><th>Label</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>${bodyRows}</tbody></table>
</div></body></html>`;
  }

  private dateFilter(from?: Date, to?: Date, alias = 'o'): Prisma.Sql {
    const parts: Prisma.Sql[] = [];
    if (from) parts.push(Prisma.sql`AND ${Prisma.raw(alias)}.created_at >= ${from}`);
    if (to) parts.push(Prisma.sql`AND ${Prisma.raw(alias)}.created_at <= ${to}`);
    return parts.length > 0 ? Prisma.join(parts, ' ') : Prisma.empty;
  }
}
