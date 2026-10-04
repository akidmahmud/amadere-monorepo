import { calcOrder } from './engine/calc';
import { flagsOf } from './engine/summary';
import { wholesaleChannelLabel } from './report-mapping';
import type { ReportOrder, ReportSettings } from './engine/types';

const S: ReportSettings = {
  rates: {},
  packaging: 15,
  fees: {},
  th: { low: 50, over: 10, pending: 3, bill: 7 },
};
const order = (extra: Partial<ReportOrder> = {}): ReportOrder => ({
  id: 1,
  orderNumber: 'ORD-1',
  date: '2026-10-04',
  status: 'Delivered',
  channel: 'Amader Shimultoli',
  agentId: null,
  agentName: null,
  customer: '',
  phone: '',
  ctype: 'New',
  district: '',
  zone: 'Inside Dhaka',
  lines: [
    { key: 'p1', name: 'Oil', qty: 2, price: 100, disc: 0, unitWeight: 1, unitCost: 60, costOk: true },
  ],
  delivery: 0,
  payment: 'CASH',
  advance: 0,
  courier: null,
  actual: null,
  hist: {},
  ...extra,
});

describe('counter sales (POS shops, wholesale) in the sales report', () => {
  it('a delivered counter sale has a contribution: no courier charge, no packaging', () => {
    const c = calcOrder(order({ counter: true }), S);
    expect(c.courierCharge).toBe(0);
    expect(c.packaging).toBe(0);
    expect(c.contribution).toBe(80); // 200 − 120 cost
  });

  it('without the flag it was "missing" (no courier rate) — why POS showed ৳0', () => {
    expect(calcOrder(order(), S).contribution).toBeNull();
  });

  it('a counter sale is never flagged "no courier" or "no bill"', () => {
    const c = calcOrder(order({ counter: true, hist: { delivered: '2026-09-01' } }), S);
    expect(flagsOf(c, S, '2026-10-04')).not.toContain('nocourier');
    expect(flagsOf(c, S, '2026-10-04')).not.toContain('nobill');
  });

  it('wholesale channels read "Daraz (Wholesale)"; plain wholesale "Wholesale"', () => {
    expect(wholesaleChannelLabel({ type: 'CHANNEL', salesChannel: { name: 'Daraz' } })).toBe('Daraz (Wholesale)');
    expect(wholesaleChannelLabel({ type: 'CHANNEL', salesChannel: { name: 'Cash Sale' } })).toBe('Cash Sale (Wholesale)');
    expect(wholesaleChannelLabel({ type: 'WHOLESALE', salesChannel: null })).toBe('Wholesale');
  });
});
