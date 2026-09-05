import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { chargeableWeightKg, quoteShippingRule } from '@amader/shared';
import { ShippingRulesService } from '../../shipping-rules/shipping-rules.service';

const Decimal = Prisma.Decimal;

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The per-source, per-product P&L the business already keeps by hand in a
 * spreadsheet (Amader eBuy Limited, "source / product name / Sum of Qty /
 * ... / Net Profit").
 *
 * Quantities are in KILOGRAMS, not units — this is a grocery business that
 * sells atta, chal and tel by weight, and its own sheet has rows like 5.5
 * and 0.25. So a line's quantity is multiplied by that variant's weight, and
 * cost is a rate per kg, which is exactly what `Product.costPriceUnit`
 * already means.
 */

/** The sheet's three buckets. Order matters — it is the order they appear in
 *  the report, and it matches the spreadsheet. */
export const PNL_SOURCES = ['FB, WA & Call', 'wholesale', 'website', 'other'] as const;
export type PnlSource = (typeof PNL_SOURCES)[number];

const CHANNEL_TO_SOURCE: Record<string, PnlSource> = {
  FACEBOOK: 'FB, WA & Call',
  WHATSAPP: 'FB, WA & Call',
  PHONE: 'FB, WA & Call',
  WEBSITE: 'website',
  APP: 'website',
};

export interface PnlProductRow {
  productName: string;
  qty: string;
  salesValue: string;
  avgValue: string;
  costPerKg: string;
  totalProductCost: string;
  profitByProduct: string;
}

export interface PnlSourceBlock {
  source: string;
  rows: PnlProductRow[];
  totals: {
    qty: string;
    salesValue: string;
    avgValue: string;
    totalProductCost: string;
    deliveryCost: string;
    profitByProduct: string;
  };
}

export interface ProductPnlReport {
  from: string;
  to: string;
  sources: PnlSourceBlock[];
  grandTotal: {
    qty: string;
    salesValue: string;
    avgValue: string;
    totalProductCost: string;
    deliveryCost: string;
    /** Product profit LESS delivery — matches how the spreadsheet's grand
     *  total behaves (its per-source subtotals do not deduct delivery, but
     *  the grand total does). */
    profitByProduct: string;
    marketingCost: string;
    netProfit: string;
  };
}

interface RawLine {
  source: string;
  product_name: string;
  qty: Prisma.Decimal | null;
  sales_value: Prisma.Decimal | null;
  cost_per_unit: Prisma.Decimal | null;
  cost_price_unit: string | null;
}

/** costPerItem is a rate per this much weight; normalise every variant to a
 *  per-KG rate so one column can hold them all. */
function costUnitToKg(unit: string | null): Prisma.Decimal {
  switch (unit) {
    case 'PER_G':
      return new Decimal(1000);
    case 'PER_100G':
      return new Decimal(10);
    default:
      // PER_KG, PER_LITRE-style units, and null (a flat per-item cost) all
      // need no scaling — for null the "per kg" column is really "per item",
      // which is what the spreadsheet does too.
      return new Decimal(1);
  }
}

@Injectable()
export class ProductPnlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shippingRules: ShippingRulesService,
  ) {}

  async report(from: Date, to: Date): Promise<ProductPnlReport> {
    const [retail, wholesale, deliveryBySource, marketingCost] = await Promise.all([
      this.retailLines(from, to),
      this.wholesaleLines(from, to),
      this.deliveryCost(from, to),
      this.marketingCost(from, to),
    ]);

    const grouped = new Map<string, Map<string, { qty: Prisma.Decimal; sales: Prisma.Decimal; costPerKg: Prisma.Decimal }>>();

    for (const line of [...retail, ...wholesale]) {
      const source = line.source;
      const name = line.product_name || '(unnamed)';
      const bucket = grouped.get(source) ?? new Map();
      grouped.set(source, bucket);

      const qty = line.qty ?? new Decimal(0);
      const sales = line.sales_value ?? new Decimal(0);
      const costPerKg = (line.cost_per_unit ?? new Decimal(0)).times(
        costUnitToKg(line.cost_price_unit),
      );

      const existing = bucket.get(name);
      if (existing) {
        existing.qty = existing.qty.plus(qty);
        existing.sales = existing.sales.plus(sales);
        // Last non-zero rate wins; the cost column is a property of the
        // product, not of the individual sale.
        if (!costPerKg.isZero()) existing.costPerKg = costPerKg;
      } else {
        bucket.set(name, { qty, sales, costPerKg });
      }
    }

    const sources: PnlSourceBlock[] = [];
    let gQty = new Decimal(0);
    let gSales = new Decimal(0);
    let gCost = new Decimal(0);
    let gDelivery = new Decimal(0);
    let gProfit = new Decimal(0);

    for (const source of PNL_SOURCES) {
      const bucket = grouped.get(source);
      if (!bucket || bucket.size === 0) continue;

      const rows: PnlProductRow[] = [];
      let sQty = new Decimal(0);
      let sSales = new Decimal(0);
      let sCost = new Decimal(0);
      let sProfit = new Decimal(0);

      // Heaviest sellers first, as the spreadsheet orders them.
      const entries = [...bucket.entries()].sort((a, b) => b[1].qty.comparedTo(a[1].qty));
      for (const [name, v] of entries) {
        const totalCost = v.costPerKg.times(v.qty);
        const profit = v.sales.minus(totalCost);
        rows.push({
          productName: name,
          qty: v.qty.toDecimalPlaces(3).toString(),
          salesValue: v.sales.toDecimalPlaces(2).toString(),
          // Sales per kg. The spreadsheet's own subtotal for this column is a
          // pivot artefact (it SUMS the per-row averages, which means
          // nothing); the weighted average is used instead.
          avgValue: v.qty.isZero() ? '0' : v.sales.dividedBy(v.qty).toDecimalPlaces(2).toString(),
          costPerKg: v.costPerKg.toDecimalPlaces(2).toString(),
          totalProductCost: totalCost.toDecimalPlaces(2).toString(),
          profitByProduct: profit.toDecimalPlaces(2).toString(),
        });
        sQty = sQty.plus(v.qty);
        sSales = sSales.plus(v.sales);
        sCost = sCost.plus(totalCost);
        sProfit = sProfit.plus(profit);
      }

      const delivery = deliveryBySource.get(source) ?? new Decimal(0);
      sources.push({
        source,
        rows,
        totals: {
          qty: sQty.toDecimalPlaces(3).toString(),
          salesValue: sSales.toDecimalPlaces(2).toString(),
          avgValue: sQty.isZero() ? '0' : sSales.dividedBy(sQty).toDecimalPlaces(2).toString(),
          totalProductCost: sCost.toDecimalPlaces(2).toString(),
          deliveryCost: delivery.toDecimalPlaces(2).toString(),
          profitByProduct: sProfit.toDecimalPlaces(2).toString(),
        },
      });

      gQty = gQty.plus(sQty);
      gSales = gSales.plus(sSales);
      gCost = gCost.plus(sCost);
      gDelivery = gDelivery.plus(delivery);
      gProfit = gProfit.plus(sProfit);
    }

    // Delivery is deducted once, at the grand total — the same place the
    // spreadsheet deducts it (its source subtotals deliberately do not).
    const profitAfterDelivery = gProfit.minus(gDelivery);

    return {
      // Local date parts, not toISOString(): the window is built in local
      // time, and UTC-formatting a local midnight in +06 reports the
      // PREVIOUS day — a September report labelled 2026-08-31.
      from: localDate(from),
      // `to` is exclusive; the label should name the last day included.
      to: localDate(new Date(to.getTime() - 86_400_000)),
      sources,
      grandTotal: {
        qty: gQty.toDecimalPlaces(3).toString(),
        salesValue: gSales.toDecimalPlaces(2).toString(),
        avgValue: gQty.isZero() ? '0' : gSales.dividedBy(gQty).toDecimalPlaces(2).toString(),
        totalProductCost: gCost.toDecimalPlaces(2).toString(),
        deliveryCost: gDelivery.toDecimalPlaces(2).toString(),
        profitByProduct: profitAfterDelivery.toDecimalPlaces(2).toString(),
        marketingCost: marketingCost.toDecimalPlaces(2).toString(),
        netProfit: profitAfterDelivery.minus(marketingCost).toDecimalPlaces(2).toString(),
      },
    };
  }

  // ------------------------------------------------------------------

  /** Storefront/manual orders. Cancelled orders are excluded — they are not
   *  sales — but everything else counts, so the report matches the order
   *  list rather than only fulfilled revenue. */
  private async retailLines(from: Date, to: Date): Promise<RawLine[]> {
    const rows = await this.prisma.client.$queryRaw<RawLine[]>`
      SELECT
        o.channel::text AS source,
        COALESCE(NULLIF(oi.product_name_snapshot, ''), pr.sku, '(unnamed)') AS product_name,
        SUM(COALESCE(pv.weight_override, pr.shippable_weight, 1) * oi.quantity) AS qty,
        SUM(oi.unit_price * oi.quantity) AS sales_value,
        MAX(pr.cost_per_item) AS cost_per_unit,
        MAX(pr.cost_price_unit::text) AS cost_price_unit
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN product_variants pv ON pv.id = oi.variant_id
      LEFT JOIN products pr ON pr.id = COALESCE(pv.product_id, oi.product_id)
      WHERE o.deleted_at IS NULL
        AND o.status <> 'CANCELED'
        AND o.created_at >= ${from}
        AND o.created_at < ${to}
      GROUP BY o.channel, 1, 2
    `;
    return rows.map((r) => ({
      ...r,
      source: CHANNEL_TO_SOURCE[r.source] ?? 'other',
    }));
  }

  private async wholesaleLines(from: Date, to: Date): Promise<RawLine[]> {
    return this.prisma.client.$queryRaw<RawLine[]>`
      SELECT
        'wholesale' AS source,
        COALESCE(NULLIF(wi.name_snapshot, ''), '(unnamed)') AS product_name,
        SUM(COALESCE(pv.weight_override, pr.shippable_weight, 1) * wi.quantity) AS qty,
        SUM(wi.line_total) AS sales_value,
        MAX(pr.cost_per_item) AS cost_per_unit,
        MAX(pr.cost_price_unit::text) AS cost_price_unit
      FROM wholesale_orders wo
      JOIN wholesale_order_items wi ON wi.order_id = wo.id
      LEFT JOIN product_variants pv ON pv.id = wi.variant_id
      LEFT JOIN products pr ON pr.id = COALESCE(pv.product_id, wi.product_id)
      WHERE wo.cancelled_at IS NULL
        AND wo.placed_at >= ${from}
        AND wo.placed_at < ${to}
      GROUP BY 1, 2
    `;
  }

  /**
   * What the courier bills us, per source — priced off the Shipping Rules
   * card rather than off what the customer was charged, because a
   * free-delivery order still costs us a full delivery.
   */
  private async deliveryCost(from: Date, to: Date): Promise<Map<string, Prisma.Decimal>> {
    const config = await this.shippingRules.getConfig();
    const rows = await this.prisma.client.$queryRaw<
      { source: string; district: string | null; kg: Prisma.Decimal | null }[]
    >`
      SELECT
        o.channel::text AS source,
        oa.district AS district,
        (
          SELECT COALESCE(SUM(COALESCE(pv.weight_override, pr.shippable_weight, 1) * oi.quantity), 0)
          FROM order_items oi
          LEFT JOIN product_variants pv ON pv.id = oi.variant_id
          LEFT JOIN products pr ON pr.id = COALESCE(pv.product_id, oi.product_id)
          WHERE oi.order_id = o.id
        ) AS kg
      FROM orders o
      LEFT JOIN order_addresses oa ON oa.order_id = o.id AND oa.type = 'SHIPPING'
      WHERE o.deleted_at IS NULL
        AND o.status <> 'CANCELED'
        AND o.created_at >= ${from}
        AND o.created_at < ${to}
        AND EXISTS (SELECT 1 FROM shipments sh WHERE sh.order_id = o.id)
    `;

    const out = new Map<string, Prisma.Decimal>();
    for (const r of rows) {
      const source = CHANNEL_TO_SOURCE[r.source] ?? 'other';
      const quote = quoteShippingRule(config, {
        district: r.district,
        weightKg: chargeableWeightKg(r.kg ? r.kg.toNumber() : 0),
      });
      if (!quote) continue;
      out.set(source, (out.get(source) ?? new Decimal(0)).plus(quote.amount));
    }
    return out;
  }

  /** Ads + other marketing spend over the window — the spreadsheet's
   *  "Marketing & Inhouse Cost", which it only shows at the grand total. */
  private async marketingCost(from: Date, to: Date): Promise<Prisma.Decimal> {
    const rows = await this.prisma.client.$queryRaw<
      { total: Prisma.Decimal | null }[]
    >`
      SELECT COALESCE(SUM(ads_cost + other_cost), 0) AS total
      FROM marketing_costs
      WHERE cost_date >= ${from} AND cost_date < ${to}
    `;
    return rows[0]?.total ?? new Decimal(0);
  }
}
