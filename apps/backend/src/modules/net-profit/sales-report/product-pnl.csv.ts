import { BadRequestException } from '@nestjs/common';
import { ProductPnlReport } from './product-pnl.service';

export const PNL_PERIODS = ['daily', 'weekly', 'monthly', 'custom'] as const;
export type PnlPeriod = (typeof PNL_PERIODS)[number];

/**
 * Kept a pure function, out of the service, for the same reason the shipping
 * matcher is: a date window that is off by a day silently reports the wrong
 * day's takings, and that deserves direct tests with no Nest around it.
 *
 * The window is always half-open [from, to) so an order placed at 23:59:59
 * counts and one at 00:00:00 the next day does not — the alternative,
 * `<= endOfDay`, drops anything in the final second.
 */
export function resolvePnlRange(
  period: PnlPeriod | undefined,
  from?: string,
  to?: string,
  now: Date = new Date(),
): { from: Date; to: Date } {
  // An explicit range always wins, whatever the period says — that is what
  // "custom" means, and it saves the caller having to send both.
  if (from || to) {
    const start = from ? new Date(from) : new Date(0);
    const end = to ? new Date(to) : new Date(now);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('from/to must be valid dates');
    }
    if (start > end) throw new BadRequestException('from must be before to');
    // A bare date ("2026-08-03") parses to midnight, which would exclude that
    // whole day. Push the end to the start of the NEXT day so `to` is
    // inclusive of the day the user named.
    return { from: startOfDay(start), to: startOfDay(addDays(end, 1)) };
  }

  const today = startOfDay(now);
  switch (period ?? 'daily') {
    case 'daily':
      return { from: today, to: addDays(today, 1) };
    case 'weekly': {
      // Week starts Saturday — the Bangladeshi working week, not Sunday or
      // Monday. getDay(): Sat = 6.
      const back = (now.getDay() + 1) % 7;
      const start = addDays(today, -back);
      return { from: start, to: addDays(start, 7) };
    }
    case 'monthly': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: start, to: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
    }
    case 'custom':
      throw new BadRequestException('custom requires from and/or to');
    default:
      throw new BadRequestException(`Unknown period: ${String(period)}`);
  }
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// ---------------------------------------------------------------------------

/** Exactly the columns the business's own spreadsheet uses, in its order. */
const HEADER = [
  'source',
  'product name',
  'Sum of Qty',
  'Total sales value',
  'avg value',
  'Product cost/kg',
  'Total Product Cost',
  'Delivery Cost',
  'Profit by Product',
  'Marketing & Inhouse Cost',
  'Net Profit',
];

function cell(value: string): string {
  // Quote anything that could break a column, and double any embedded quote.
  // Product names here are free text and DO contain commas and brackets.
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function line(values: (string | number)[]): string {
  return values.map((v) => cell(String(v))).join(',');
}

/**
 * The report as the spreadsheet lays it out: a block of product rows per
 * source, each followed by its Total row, then one Grand total.
 *
 * Blank cells are deliberate, not missing data — Delivery Cost only exists
 * per source, and Marketing/Net Profit only at the very bottom, exactly as
 * in the sheet this replaces.
 */
export function pnlToCsv(report: ProductPnlReport): string {
  const out: string[] = [];
  out.push(line([`Amader eBuy Limited — ${report.from} to ${report.to}`]));
  out.push('');
  out.push(line(HEADER));

  for (const block of report.sources) {
    block.rows.forEach((r, i) => {
      out.push(
        line([
          // The source label sits on the block's first row only, as it does
          // in the sheet.
          i === 0 ? block.source : '',
          r.productName,
          r.qty,
          r.salesValue,
          r.avgValue,
          r.costPerKg,
          r.totalProductCost,
          '',
          r.profitByProduct,
          '',
          '',
        ]),
      );
    });
    out.push(
      line([
        'Total',
        '',
        block.totals.qty,
        block.totals.salesValue,
        block.totals.avgValue,
        '',
        block.totals.totalProductCost,
        block.totals.deliveryCost,
        block.totals.profitByProduct,
        '0',
        '0',
      ]),
    );
    out.push('');
  }

  const g = report.grandTotal;
  out.push(
    line([
      'Grand total',
      '',
      g.qty,
      g.salesValue,
      g.avgValue,
      '',
      g.totalProductCost,
      g.deliveryCost,
      g.profitByProduct,
      g.marketingCost,
      g.netProfit,
    ]),
  );

  return out.join('\n');
}
