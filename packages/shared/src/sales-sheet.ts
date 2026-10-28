// The Sales Report 'Orders' export layout (the owner's 'Daily Sales Data'
// sheet). Shared so the admin's Export Excel and the live Google Sheet
// (backend OrderSheetSyncService) produce exactly the same rows.
//
// Laid out like the owner's hand-kept 'Daily Sales Data.xlsx'
// (26 columns A–Z under a row of group labels) but filled from the report's
// engine. Two deliberate differences from the sheet: Gain/Loss is only filled
// for delivered/returned orders (the sheet also counted undelivered orders as
// profit), and a multi-product order becomes one row per product with the
// order-level money (P–W, Z) on its first row only, so column totals stay true.

export const COURIER_LABEL: Record<string, string> = {
  STEADFAST: 'Steadfast',
  PATHAO: 'Pathao',
  REDX: 'RedX',
  ECOURIER: 'eCourier',
};
const courierLabel = (c: string) => COURIER_LABEL[c] ?? c;
const agentLabel = (name: string | null) => name || 'Website (no agent)';

/** The fields of a report order row (sales-report v2 `orders`) the sheet reads. */
export interface SalesSheetRow {
  o: {
    orderNumber: string;
    date: string;
    status: string;
    channel: string;
    agentName: string | null;
    customer: string;
    phone: string;
    ctype: string;
    district: string;
    /** Street, thana, post code: enough to write a delivery receipt. */
    address?: string;
    payment: string;
    courier: string | null;
    /** Shown in Courier when `courier` is empty: a wholesale order's courier
     *  (Sundarban, AJR…), kept out of `courier` so courier costing ignores it. */
    shipVia?: string | null;
    delivery?: number;
    actual?: number | null;
  };
  lines: {
    name: string;
    sku?: string | null;
    qty: number;
    price: number;
    disc: number;
    unitWeight?: number;
    unitCost?: number | null;
    cogs?: number | null;
  }[];
  netSales: number;
  rate?: number | null;
  cod?: number;
  expected?: number | null;
  contribution?: number | null;
  receivable?: number | null;
}

export type SalesSheetCell = string | number;
type Cell = SalesSheetCell;

const GROUPS: Record<number, string> = {
  13: 'Actual value - Sale value',
  16: 'from Customer',
  17: 'Actual Cost SF',
  18: 'As per courier logic',
};

const HEAD = [
  'Date',
  'OrderID',
  'Order Status',
  'Sales Channel',
  'Sales Agent',
  'Customer Type',
  'CustomerName',
  'CustomerPhone',
  'District',
  'Address',
  'Product SKU',
  'Qty',
  'Sale Value',
  'Discount',
  'Payment Method',
  'Courier',
  'Delivery Charged from Customer',
  'Charged by Courier',
  'Agreed charge',
  'COD Charged',
  'COD Charge',
  'Total Charge should be',
  'Charged vs Actual Cost (Loss)',
  'Courier Payout',
  'Product Cost/Kg',
  'TotalCost',
  'Gain/Loss',
];
// Agents (view_own) get the sales columns only — the money ones never reach them.
const SALES_COLS = 16;
/** Where Invoice Value is inserted in the full view: right after 'Sale Value'. */
export const INVOICE_COL = 13;

const PAYMENT_LABEL: Record<string, string> = {
  COD: 'COD',
  BKASH: 'Bkash',
  NAGAD: 'Nagad',
  ROCKET: 'Rocket',
  UPAY: 'Upay',
  SSLCOMMERZ: 'SSLCommerz',
  BANK_TRANSFER: 'Bank transfer',
  CASH: 'Cash (POS)',
  CARD: 'Card (POS)',
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const num = (n: number | null | undefined): Cell => (n == null ? '' : r2(n));
const sheetDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** `codPct` is each courier's COD % from the rate card (keyed like `o.courier`). */
export function buildSalesSheet(
  rows: SalesSheetRow[],
  codPct: Record<string, number>,
  money: boolean,
): Cell[][] {
  // 'Invoice Value' (sale value + delivery charged from the customer) sits
  // right after Sale Value. Full view only: agents never receive the delivery
  // charge, so for them it could only ever be a wrong number.
  const head = money
    ? [...HEAD.slice(0, INVOICE_COL), 'Invoice Value', ...HEAD.slice(INVOICE_COL)]
    : HEAD.slice(0, SALES_COLS);
  const groups = head.map(
    (_, i) => GROUPS[money && i >= INVOICE_COL ? i - 1 : i] ?? '',
  );
  if (money) groups[INVOICE_COL] = '';
  const out: Cell[][] = [groups, head];
  for (const c of rows) {
    const o = c.o;
    const lines = c.lines.length ? c.lines : [null];
    lines.forEach((l, i) => {
      const first = i === 0;
      const weight = l ? l.qty * (l.unitWeight ?? 0) : 0;
      const row: Cell[] = [
        sheetDate(o.date),
        o.orderNumber,
        o.status,
        o.channel,
        agentLabel(o.agentName),
        o.ctype === 'Repeat' ? 'Repeated' : 'New',
        o.customer,
        o.phone,
        o.district,
        o.address ?? '',
        // SKU, not the full name; a product with no SKU entered keeps its name.
        l ? l.sku || l.name : '',
        l ? (weight > 0 ? r3(weight) : l.qty) : '',
        l ? r2(l.qty * l.price - l.disc) : '',
        l && l.disc ? r2(l.disc) : '',
        PAYMENT_LABEL[o.payment] ?? o.payment,
        o.courier ? courierLabel(o.courier) : (o.shipVia ?? ''),
      ];
      if (money) {
        const pct = o.courier ? codPct[o.courier] : undefined;
        const unitWeight = l?.unitWeight ?? 0;
        const vsActual =
          c.expected != null && o.actual != null ? c.expected - o.actual : null;
        row.push(
          ...(first
            ? [
                num(o.delivery),
                num(o.actual),
                num(c.rate),
                pct == null ? '' : `${pct}%`,
                c.rate == null ? '' : num(c.cod),
                num(c.expected),
                num(vsActual),
                num(c.receivable),
              ]
            : ['', '', '', '', '', '', '', '']),
          l?.unitCost == null
            ? ''
            : num(unitWeight > 0 ? l.unitCost / unitWeight : l.unitCost),
          num(l?.cogs),
          first ? num(c.contribution) : '',
        );
        // Order-level, so on the first line only — like the other order money.
        row.splice(INVOICE_COL, 0, first ? r2(c.netSales + (o.delivery ?? 0)) : '');
      }
      out.push(row);
    });
  }
  return out;
}
