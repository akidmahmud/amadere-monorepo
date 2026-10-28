import { buildSalesSheet } from '@amader/shared';
import { monthSheet, monthTab } from './order-sheet-sync.service';

// The live Google Sheet: the Export Excel rows, grouped by day under a date row.
const order = (n: string, date: string) => ({
  o: {
    orderNumber: n, date, status: 'Delivered', channel: 'WhatsApp', agentName: 'Jami',
    customer: 'C', phone: '017', ctype: 'New', district: 'Dhaka', payment: 'COD',
    courier: 'STEADFAST', delivery: 80, actual: null,
  },
  lines: [{ name: 'Chatu', sku: 'CH1', qty: 1, price: 350, disc: 0 }],
  netSales: 350,
});

describe('order sheet month tab', () => {
  it('names the tab by month', () => {
    expect(monthTab('2026-10')).toBe('Oct 2026');
    expect(monthTab('2027-01')).toBe('Jan 2027');
  });

  it('export headers, then each day oldest first under its own date row, rows exactly as the export', () => {
    const rows = [order('A', '2026-10-10'), order('B', '2026-10-11'), order('C', '2026-10-10')];
    const { values, dayRows } = monthSheet(rows, { STEADFAST: 1 });
    const exp = buildSalesSheet(rows, { STEADFAST: 1 }, true);
    expect(values.slice(0, 2)).toEqual(exp.slice(0, 2));
    expect(dayRows).toEqual([2, 5]);
    expect(values[2][0]).toBe('10 Oct, 2026');
    expect(values[2]).toHaveLength(exp[1].length);
    expect(values.slice(3, 5).map((r) => r[1])).toEqual(['A', 'C']);
    expect(values[5][0]).toBe('11 Oct, 2026');
    expect(values[6]).toEqual(exp[3]);
  });

  it('every order has its Address after District; a wholesale row shows its courier (AJR, Sundarban…)', () => {
    const wholesale = {
      ...order('WS-1', '2026-10-18'),
      o: { ...order('WS-1', '2026-10-18').o, channel: 'Wholesale', courier: null, shipVia: 'AJR Courier', address: 'Shop 4, Notun Bazar, Bandarban' },
    };
    const [, head, row] = buildSalesSheet([wholesale], {}, true);
    const col = (h: string) => head.indexOf(h);
    expect(col('Address')).toBe(col('District') + 1);
    expect(row[col('Address')]).toBe('Shop 4, Notun Bazar, Bandarban');
    expect(row[col('Courier')]).toBe('AJR Courier');
    // A retail order's courier still comes from `courier`.
    const [, , retail] = buildSalesSheet([order('A', '2026-10-18')], {}, true);
    expect(retail[col('Courier')]).toBe('Steadfast');
  });
});
