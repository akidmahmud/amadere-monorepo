import type { ReportOrder, ReportSettings } from './types';

// The 19 orders the demo reproduces from Daily_Sales_Data.xlsx (01/08/2026) and
// its default settings, copied from amadere-sales-report-demo.html so the engine
// is checked against the figures the owner has already seen (৳3,438).
const SKUS: Record<string, { name: string; weight: number }> = {
  JA1: { name: 'Jober Atta 1 kg', weight: 1 },
  JC1: { name: 'Jober Chatu 1 kg', weight: 1 },
  JC05: { name: 'Jober Chatu 500 g', weight: 0.5 },
  MC1: { name: 'Mixed Chatu 1 kg', weight: 1 },
  MC05: { name: 'Mixed Chatu 500 g', weight: 0.5 },
  JCH1: { name: 'Jober Chal 1 kg', weight: 1 },
  GA1: { name: 'Gomer Lal Atta 1 kg', weight: 1 },
  GA5: { name: 'Gomer Lal Atta 5 kg', weight: 5 },
  AC5: { name: 'Amon Chal Full Fiber 5 kg', weight: 5 },
  AG100: { name: 'Arjun Gura 100 g', weight: 0.1 },
};

const COSTS: Record<string, { from: string; cost: number; ok: boolean }[]> = {
  JA1: [
    { from: '2026-07-01', cost: 180, ok: true },
    { from: '2026-08-05', cost: 190, ok: true },
  ],
  JC1: [{ from: '2026-07-01', cost: 220, ok: true }],
  JC05: [{ from: '2026-07-01', cost: 110, ok: true }],
  MC1: [{ from: '2026-07-01', cost: 180, ok: false }],
  MC05: [{ from: '2026-07-01', cost: 90, ok: false }],
  JCH1: [{ from: '2026-07-01', cost: 180, ok: true }],
  GA1: [{ from: '2026-07-01', cost: 70, ok: true }],
  GA5: [{ from: '2026-07-01', cost: 350, ok: true }],
  AC5: [{ from: '2026-07-01', cost: 375, ok: true }],
  AG100: [{ from: '2026-07-01', cost: 36, ok: true }],
};

const ZONE: Record<string, string> = {
  Dhaka: 'Inside Dhaka',
  Gazipur: 'Sub Dhaka',
  Narayanganj: 'Sub Dhaka',
};
const AGENT_ID: Record<string, number> = {
  Jami: 1,
  Arafat: 2,
  Mim: 3,
  Sanowar: 4,
  Tahrima: 5,
};

export const DEMO_TODAY = '2026-08-07';

export function demoSettings(): ReportSettings {
  const zones = () =>
    Object.fromEntries(
      ['Inside Dhaka', 'Sub Dhaka', 'Outside Dhaka'].map((z) => [
        z,
        { smallMax: 0.2, small: 80, first: 105, extra: 20 },
      ]),
    );
  return {
    rates: Object.fromEntries(
      ['Steadfast', 'Sundarban', 'AJR'].map((c) => [
        c,
        { cod: 1, codBase: 'product' as const, returnPct: 100, zones: zones() },
      ]),
    ),
    packaging: 0,
    fees: { COD: 0, BKASH: 0, NAGAD: 0 },
    th: { low: 50, over: 5, pending: 2, bill: 3 },
  };
}

type Item = [sku: string, qty: number, price: number, disc?: number];
interface Opt {
  payment?: string;
  advance?: number;
  courier?: string | null;
  actual?: number;
  hist?: ReportOrder['hist'];
}

let seq = 0;
function X(
  id: string,
  status: ReportOrder['status'],
  channel: string,
  agent: string | null,
  customer: string,
  ctype: ReportOrder['ctype'],
  district: string,
  items: Item[],
  delivery: number,
  opt: Opt = {},
): ReportOrder {
  const date = '2026-08-01';
  return {
    id: ++seq,
    orderNumber: `ORD-20260801-${id}`,
    date,
    status,
    channel,
    agentId: agent ? AGENT_ID[agent] : null,
    agentName: agent,
    customer,
    phone: '',
    ctype,
    district,
    zone: ZONE[district] ?? 'Outside Dhaka',
    lines: items.map(([sku, qty, price, disc]) => {
      const c = COSTS[sku]
        .filter((h) => h.from <= date)
        .sort((a, b) => b.from.localeCompare(a.from))[0];
      return {
        key: sku,
        name: SKUS[sku].name,
        qty,
        price,
        disc: disc ?? 0,
        unitWeight: SKUS[sku].weight,
        unitCost: c ? c.cost : null,
        costOk: c ? c.ok : false,
      };
    }),
    delivery,
    payment: opt.payment ?? 'COD',
    advance: opt.advance ?? 0,
    courier: opt.courier === undefined ? 'Steadfast' : opt.courier,
    actual: opt.actual ?? null,
    hist: opt.hist ?? {},
  };
}

const DEL = (d: string) => ({
  confirmed: '2026-08-01',
  shipped: '2026-08-01',
  delivered: d,
});

export const DEMO_EXCEL_DAY: ReportOrder[] = [
  X(
    'D56503',
    'Pending',
    'Facebook',
    'Jami',
    'Limon Yakin',
    'New',
    'Dhaka',
    [['JA1', 2, 350]],
    100,
  ),
  X(
    'D56504',
    'Confirmed',
    'Facebook',
    'Jami',
    'Shafiul Islam',
    'New',
    'Dhaka',
    [['JA1', 2, 350]],
    100,
    {
      payment: 'BKASH',
      advance: 800,
      courier: 'AJR',
      hist: { confirmed: '2026-08-01' },
    },
  ),
  X(
    'D56505',
    'Delivered',
    'WhatsApp',
    'Jami',
    'Estiyak',
    'New',
    'Dhaka',
    [['MC1', 1, 350, 35]],
    80,
    { courier: 'Sundarban', actual: 145, hist: DEL('2026-08-02') },
  ),
  X(
    'D56506',
    'Delivered',
    'Facebook',
    'Arafat',
    'Mozzamel Hoq',
    'New',
    'Dhaka',
    [['JC1', 1, 450]],
    100,
    { courier: null, actual: 145, hist: DEL('2026-08-02') },
  ),
  X(
    'D56507',
    'Confirmed',
    'WhatsApp',
    'Jami',
    'Jannatul Ferdous',
    'New',
    'Gazipur',
    [['JC05', 1, 230]],
    100,
    { hist: { confirmed: '2026-08-01' } },
  ),
  X(
    'D56508',
    'Delivered',
    'WhatsApp',
    'Mim',
    'Md. Emon',
    'New',
    'Gazipur',
    [['JA1', 2, 350]],
    0,
    { actual: 145, hist: DEL('2026-08-02') },
  ),
  X(
    'D56509',
    'Delivered',
    'Call',
    'Sanowar',
    'Rashedul Haque',
    'New',
    'Gazipur',
    [['JCH1', 5, 320]],
    100,
    { actual: 195, hist: DEL('2026-08-02') },
  ),
  X(
    'D56510',
    'Delivered',
    'WhatsApp',
    'Mim',
    'Kaniz Fatema Nadia',
    'New',
    'Rajshahi',
    [['GA5', 1, 500]],
    100,
    { actual: 190, hist: DEL('2026-08-03') },
  ),
  X(
    'D56511',
    'Delivered',
    'WhatsApp',
    'Mim',
    'Tauhida',
    'New',
    'Rajshahi',
    [['GA1', 2, 110]],
    100,
    { actual: 175, hist: DEL('2026-08-03') },
  ),
  X(
    'D56512',
    'Delivered',
    'Call',
    'Tahrima',
    'Abdullah Imam Khan',
    'New',
    'Rajshahi',
    [['JA1', 1, 350]],
    100,
    { actual: 130, hist: DEL('2026-08-03') },
  ),
  X(
    'D56513',
    'Delivered',
    'Call',
    'Arafat',
    'Salma Rahman',
    'Repeat',
    'Rajshahi',
    [['AC5', 1, 550]],
    100,
    { actual: 205, hist: DEL('2026-08-04') },
  ),
  X(
    'D56514',
    'Delivered',
    'Call',
    'Arafat',
    'Ruksana Sheikh',
    'Repeat',
    'Rajshahi',
    [['JA1', 2, 350]],
    100,
    { actual: 160, hist: DEL('2026-08-03') },
  ),
  X(
    'D56515',
    'Delivered',
    'Facebook',
    'Mim',
    'Amina Sheikh',
    'Repeat',
    'Rajshahi',
    [['GA5', 1, 500]],
    100,
    { actual: 190, hist: DEL('2026-08-04') },
  ),
  X(
    'D56516',
    'Delivered',
    'Call',
    'Jami',
    'Md. Gias Uddin',
    'Repeat',
    'Rajshahi',
    [['JC1', 4, 450]],
    0,
    { actual: 190, hist: DEL('2026-08-03') },
  ),
  X(
    'D56517',
    'Delivered',
    'WhatsApp',
    'Jami',
    'Siam',
    'Repeat',
    'Rajshahi',
    [['MC1', 3, 350]],
    50,
    { actual: 175, hist: DEL('2026-08-04') },
  ),
  X(
    'D56518',
    'Delivered',
    'Website',
    null,
    'Md Solaiman',
    'Repeat',
    'Rajshahi',
    [['AG100', 1, 130]],
    72,
    { actual: 145, hist: DEL('2026-08-03') },
  ),
  X(
    'D56519',
    'Delivered',
    'Website',
    null,
    'Kusum',
    'Repeat',
    'Rajshahi',
    [['JA1', 3, 350]],
    50,
    { actual: 190, hist: DEL('2026-08-03') },
  ),
  X(
    'D56520',
    'Delivered',
    'Website',
    null,
    'Ahnaf',
    'Repeat',
    'Rajshahi',
    [['MC1', 3, 350]],
    57,
    { actual: 175, hist: DEL('2026-08-04') },
  ),
  X(
    'D56521',
    'Returned',
    'Website',
    null,
    'Sadia',
    'Repeat',
    'Rajshahi',
    [['MC05', 1, 200]],
    68,
    {
      actual: 130,
      hist: {
        confirmed: '2026-08-01',
        shipped: '2026-08-01',
        returned: '2026-08-04',
      },
    },
  ),
];

export const demoOrder = (suffix: string): ReportOrder => {
  const o = DEMO_EXCEL_DAY.find((x) => x.orderNumber.endsWith(suffix));
  if (!o) throw new Error(`no demo order ${suffix}`);
  return o;
};
