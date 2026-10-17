import type {
  DailyReportAppliedCost,
  DailyReportFixedCost,
  DailyReportProductRow,
  DailyReportSnapshot,
  DailyReportSourceBlock,
  DailyReportTotals,
} from '@amader/shared';
import { daysInMonth, periodDays } from './period';

export interface BuildLine {
  key: string;
  name: string;
  /** The product's SKU; null when none is set. */
  sku?: string | null;
  kg: number;
  sales: number;
  /** Whole-line cost (unit cost × quantity); null = no cost on record. */
  cost: number | null;
}

export interface BuildOrder {
  id: number;
  wholesale: boolean;
  source: string;
  delivery: number;
  lines: BuildLine[];
}

export interface BuildInput {
  from: string;
  to: string;
  generatedAt: string;
  orders: BuildOrder[];
  sources: { key: string; label: string; enabled: boolean }[];
  fixedCosts: DailyReportFixedCost[];
  /** Σ MarketingCost (ads + other) over the period. */
  marketing: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
const div = (a: number, b: number) => (b ? r2(a / b) : 0);

export function fixedCostValue(
  c: DailyReportFixedCost,
  ctx: { days: string[]; sales: number; marketing: number },
): number {
  switch (c.type) {
    case 'PER_DAY':
      return c.amount * ctx.days.length;
    case 'PER_MONTH':
      return sum(ctx.days.map((d) => c.amount / daysInMonth(d)));
    case 'PERCENT_OF_SALES':
      return (ctx.sales * c.amount) / 100;
    case 'MARKETING_LEDGER':
      return ctx.marketing;
  }
}

function apply(
  c: DailyReportFixedCost,
  ctx: { days: string[]; sales: number; marketing: number },
): DailyReportAppliedCost {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    amount: c.amount,
    value: r2(fixedCostValue(c, ctx)),
  };
}

function totals(
  rows: { qty: number; sales: number; cost: number; profit: number }[],
  delivery: number,
): DailyReportTotals {
  const qty = r3(sum(rows.map((r) => r.qty)));
  const sales = r2(sum(rows.map((r) => r.sales)));
  return {
    qty,
    sales,
    avg: div(sales, qty),
    cost: r2(sum(rows.map((r) => r.cost))),
    delivery: r2(delivery),
    profit: r2(sum(rows.map((r) => r.profit))),
  };
}

export function buildSnapshot(input: BuildInput): DailyReportSnapshot {
  const days = periodDays(input.from, input.to);
  const active = input.fixedCosts.filter((c) => c.active);
  const blocks: DailyReportSourceBlock[] = [];
  const orderIds: number[] = [];
  const wholesaleOrderIds: number[] = [];
  let estimatedLines = 0;

  for (const src of input.sources) {
    if (!src.enabled) continue;
    const orders = input.orders.filter((o) => o.source === src.key);
    const scoped = active.filter(
      (c) => c.scope === 'SOURCE' && c.sourceKey === src.key,
    );
    // A source-scoped cost (shop rent) is still owed on a day with no sales.
    if (!orders.length && !scoped.length) continue;

    const byKey = new Map<
      string,
      {
        name: string;
        sku: string | null;
        qty: number;
        sales: number;
        cost: number;
        estimated: number;
      }
    >();
    let delivery = 0;
    for (const o of orders) {
      (o.wholesale ? wholesaleOrderIds : orderIds).push(o.id);
      delivery += o.delivery;
      for (const l of o.lines) {
        const row = byKey.get(l.key) ?? {
          name: l.name,
          sku: l.sku ?? null,
          qty: 0,
          sales: 0,
          cost: 0,
          estimated: 0,
        };
        row.sku ??= l.sku ?? null; // first SKU seen wins
        row.qty += l.kg;
        row.sales += l.sales;
        row.cost += l.cost ?? 0;
        if (l.cost == null) {
          row.estimated++;
          estimatedLines++;
        }
        byKey.set(l.key, row);
      }
    }

    const products: DailyReportProductRow[] = [...byKey.entries()]
      .map(([key, v]) => {
        const qty = r3(v.qty);
        const sales = r2(v.sales);
        const cost = r2(v.cost);
        return {
          key,
          name: v.name,
          sku: v.sku,
          qty,
          sales,
          avg: div(sales, qty),
          costPerKg: div(cost, qty),
          cost,
          profit: r2(sales - cost),
          estimated: v.estimated,
        };
      })
      .sort((a, b) => b.qty - a.qty);

    const subtotal = totals(products, delivery);
    const fixedCosts = scoped.map((c) =>
      apply(c, { days, sales: subtotal.sales, marketing: input.marketing }),
    );
    blocks.push({
      key: src.key,
      label: src.label,
      products,
      subtotal,
      fixedCosts,
      net: r2(
        subtotal.profit -
          subtotal.delivery -
          sum(fixedCosts.map((f) => f.value)),
      ),
    });
  }

  const grandTotal = totals(
    blocks.map((b) => b.subtotal),
    sum(blocks.map((b) => b.subtotal.delivery)),
  );
  const reportFixedCosts = active
    .filter((c) => c.scope === 'REPORT')
    .map((c) =>
      apply(c, { days, sales: grandTotal.sales, marketing: input.marketing }),
    );

  return {
    from: input.from,
    to: input.to,
    generatedAt: input.generatedAt,
    sources: blocks,
    grandTotal,
    reportFixedCosts,
    netProfit: r2(
      sum(blocks.map((b) => b.net)) - sum(reportFixedCosts.map((c) => c.value)),
    ),
    estimatedLines,
    orderIds,
    wholesaleOrderIds,
  };
}
