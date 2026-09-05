import { BadRequestException } from '@nestjs/common';
import { resolvePnlRange, pnlToCsv } from './product-pnl.csv';
import type { ProductPnlReport } from './product-pnl.service';

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('resolvePnlRange', () => {
  // A Tuesday.
  const now = new Date(2026, 7, 4, 15, 30);

  it('covers exactly one day for daily', () => {
    const r = resolvePnlRange('daily', undefined, undefined, now);
    expect(iso(r.from)).toBe('2026-08-04');
    expect(iso(r.to)).toBe('2026-08-05');
  });

  it('starts the week on Saturday, not Sunday or Monday', () => {
    const r = resolvePnlRange('weekly', undefined, undefined, now);
    // Saturday 1 Aug 2026 through Saturday 8 Aug (exclusive).
    expect(iso(r.from)).toBe('2026-08-01');
    expect(r.from.getDay()).toBe(6);
    expect(iso(r.to)).toBe('2026-08-08');
  });

  it('covers the calendar month for monthly', () => {
    const r = resolvePnlRange('monthly', undefined, undefined, now);
    expect(iso(r.from)).toBe('2026-08-01');
    expect(iso(r.to)).toBe('2026-09-01');
  });

  // The bug this guards: a bare "to" date parses to midnight, so an
  // inclusive-looking range would silently drop that whole day's orders.
  it('includes the whole of the `to` day', () => {
    const r = resolvePnlRange('custom', '2026-08-03', '2026-08-03', now);
    expect(iso(r.from)).toBe('2026-08-03');
    expect(iso(r.to)).toBe('2026-08-04');
  });

  it('lets an explicit range override the period', () => {
    const r = resolvePnlRange('monthly', '2026-08-03', '2026-08-03', now);
    expect(iso(r.from)).toBe('2026-08-03');
    expect(iso(r.to)).toBe('2026-08-04');
  });

  it('rejects a backwards or unusable range rather than returning nothing', () => {
    expect(() => resolvePnlRange('custom', '2026-08-09', '2026-08-01', now)).toThrow(BadRequestException);
    expect(() => resolvePnlRange('custom', undefined, undefined, now)).toThrow(BadRequestException);
    expect(() => resolvePnlRange('daily', 'not-a-date', undefined, now)).toThrow(BadRequestException);
  });
});

describe('pnlToCsv', () => {
  const report: ProductPnlReport = {
    from: '2026-08-03',
    to: '2026-08-03',
    sources: [
      {
        source: 'FB, WA & Call',
        rows: [
          {
            productName: 'Gomer Lal Atta',
            qty: '35',
            salesValue: '4205',
            avgValue: '120.14',
            costPerKg: '70',
            totalProductCost: '2450',
            profitByProduct: '1755',
          },
          {
            // Free text with a comma — the case that silently shifts every
            // later column if it is not quoted.
            productName: 'Sorisher Tel (Khater Ghani), 1L',
            qty: '28',
            salesValue: '8400',
            avgValue: '300',
            costPerKg: '240',
            totalProductCost: '6720',
            profitByProduct: '1680',
          },
        ],
        totals: {
          qty: '63',
          salesValue: '12605',
          avgValue: '200.08',
          totalProductCost: '9170',
          deliveryCost: '4535',
          profitByProduct: '3435',
        },
      },
    ],
    grandTotal: {
      qty: '63',
      salesValue: '12605',
      avgValue: '200.08',
      totalProductCost: '9170',
      deliveryCost: '4535',
      profitByProduct: '-1100',
      marketingCost: '21000',
      netProfit: '-22100',
    },
  };

  const lines = () => pnlToCsv(report).split('\n');

  it('uses the spreadsheet header, in the spreadsheet order', () => {
    expect(lines()[2]).toBe(
      'source,product name,Sum of Qty,Total sales value,avg value,Product cost/kg,Total Product Cost,Delivery Cost,Profit by Product,Marketing & Inhouse Cost,Net Profit',
    );
  });

  it('labels the source on the first row of its block only', () => {
    const l = lines();
    expect(l[3].startsWith('"FB, WA & Call",Gomer Lal Atta,35')).toBe(true);
    expect(l[4].startsWith(',')).toBe(true);
  });

  it('quotes product names containing a comma so columns do not shift', () => {
    const row = lines()[4];
    expect(row).toContain('"Sorisher Tel (Khater Ghani), 1L"');
    // 11 columns, with the one embedded comma safely inside quotes.
    expect(row.split(',').length).toBe(12);
  });

  it('puts delivery on the source total and marketing only on the grand total', () => {
    const l = lines();
    const total = l.find((x) => x.startsWith('Total,'))!;
    const grand = l.find((x) => x.startsWith('Grand total,'))!;
    expect(total.split(',')[7]).toBe('4535');
    expect(grand.split(',')[9]).toBe('21000');
    expect(grand.split(',')[10]).toBe('-22100');
  });
});
