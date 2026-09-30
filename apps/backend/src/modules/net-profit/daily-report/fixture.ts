import type { BuildInput } from './build';

/**
 * Hand-checked expectations (see build.spec.ts):
 *  WEB_DIRECT: Atta 3kg ৳610 cost 450 | Salt 0.5kg ৳200 cost missing → subtotal
 *              qty 3.5, sales 810, cost 450, profit 360, delivery 130, net 230
 *  WHATSAPP:   Atta 3kg ৳600 cost 450 → profit 150, delivery 130, Salary 100 → net −80
 *  TIKTOK:     disabled → excluded entirely (order 4 not in orderIds)
 *  WHOLESALE:  Oil 10kg ৳2200 cost 1800 → profit 400, delivery 0, net 400
 *  SHOP:       no orders, Rent 30000/month on a 30-day month → net −1000
 *  Grand: qty 16.5, sales 3610, cost 2700, profit 910, delivery 260
 *  Report costs: Marketing (ledger) 500, VAT 5% of 3610 = 180.5; inactive skipped
 *  Net = (230 − 80 + 400 − 1000) − 680.5 = −1130.5
 */
export const FIXTURE_INPUT: BuildInput = {
  from: '2026-09-30',
  to: '2026-09-30',
  generatedAt: '2026-10-01T00:15:00.000+06:00',
  marketing: 500,
  sources: [
    { key: 'WEB_DIRECT', label: 'Website', enabled: true },
    { key: 'WHATSAPP', label: 'WhatsApp', enabled: true },
    { key: 'TIKTOK', label: 'TikTok', enabled: false },
    { key: 'WHOLESALE', label: 'Wholesale', enabled: true },
    { key: 'SHOP', label: 'Shop sale', enabled: true },
  ],
  fixedCosts: [
    {
      id: 'c1',
      name: 'Marketing & Inhouse',
      type: 'MARKETING_LEDGER',
      amount: 0,
      scope: 'REPORT',
      active: true,
    },
    {
      id: 'c2',
      name: 'VAT',
      type: 'PERCENT_OF_SALES',
      amount: 5,
      scope: 'REPORT',
      active: true,
    },
    {
      id: 'c3',
      name: 'Shop rent',
      type: 'PER_MONTH',
      amount: 30000,
      scope: 'SOURCE',
      sourceKey: 'SHOP',
      active: true,
    },
    {
      id: 'c4',
      name: 'Call staff',
      type: 'PER_DAY',
      amount: 100,
      scope: 'SOURCE',
      sourceKey: 'WHATSAPP',
      active: true,
    },
    {
      id: 'c5',
      name: 'Old cost',
      type: 'PER_DAY',
      amount: 999,
      scope: 'REPORT',
      active: false,
    },
  ],
  orders: [
    {
      id: 1,
      wholesale: false,
      source: 'WEB_DIRECT',
      delivery: 70,
      lines: [{ key: 'p1', name: 'Jober Atta', kg: 2, sales: 400, cost: 300 }],
    },
    {
      id: 2,
      wholesale: false,
      source: 'WEB_DIRECT',
      delivery: 60,
      lines: [
        { key: 'p1', name: 'Jober Atta', kg: 1, sales: 210, cost: 150 },
        { key: 'p2', name: 'Pink Salt', kg: 0.5, sales: 200, cost: null },
      ],
    },
    {
      id: 3,
      wholesale: false,
      source: 'WHATSAPP',
      delivery: 130,
      lines: [{ key: 'p1', name: 'Jober Atta', kg: 3, sales: 600, cost: 450 }],
    },
    {
      id: 4,
      wholesale: false,
      source: 'TIKTOK',
      delivery: 50,
      lines: [{ key: 'p1', name: 'Jober Atta', kg: 1, sales: 999, cost: 1 }],
    },
    {
      id: 101,
      wholesale: true,
      source: 'WHOLESALE',
      delivery: 0,
      lines: [
        { key: 'p3', name: 'Sorisher Tel', kg: 10, sales: 2200, cost: 1800 },
      ],
    },
  ],
};
