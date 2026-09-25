/**
 * POS receipt/invoice templates: staff-written HTML with {{tags}}. Same
 * convention as the admin invoice template (lib/invoice-template.ts): plain
 * string substitution, with multi-row / conditional parts ({{itemsRows}},
 * {{discountRow}}, {{vatRow}}, {{changeRow}}) pre-rendered as <tr> fragments.
 * The template HTML is sanitised server-side on save; every value substituted
 * here is HTML-escaped.
 */

export interface PosInvoiceData {
  store: { name: string; address?: string | null; phone?: string | null };
  receiptNo: string;
  createdAt: string | Date;
  cashier: string;
  customer?: { name: string; phone?: string | null } | null;
  status: string;
  items: {
    name: string;
    variant?: string | null;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: number;
  vat: number;
  vatRatePercent: number;
  vatIncluded: boolean;
  total: number;
  paidBy: string;
  tendered?: number | null;
  change?: number | null;
  trxRef?: string | null;
}

export const POS_INVOICE_TAGS: { tag: string; desc: string }[] = [
  { tag: "storeName", desc: "Store name" },
  { tag: "storeAddress", desc: "Store address" },
  { tag: "storePhone", desc: "Store phone" },
  { tag: "receiptNo", desc: "Receipt / order number" },
  { tag: "date", desc: "Sale date (DD/MM/YYYY)" },
  { tag: "time", desc: "Sale time" },
  { tag: "cashier", desc: "Cashier name" },
  { tag: "customerName", desc: "Customer name (empty for walk-ins)" },
  { tag: "customerPhone", desc: "Customer phone" },
  {
    tag: "itemsRows",
    desc: "Item lines as <tr> rows: name + variant, qty × price, line total",
  },
  { tag: "itemCount", desc: "Total quantity of items" },
  { tag: "subtotal", desc: "Subtotal before discount" },
  { tag: "discount", desc: "Discount amount" },
  {
    tag: "discountRow",
    desc: "<tr> Discount row — only when there is a discount",
  },
  { tag: "vat", desc: "VAT amount" },
  { tag: "vatLabel", desc: '"VAT 15%" or "incl. VAT 15%"' },
  { tag: "vatRow", desc: "<tr> VAT row — only when VAT is charged" },
  { tag: "total", desc: "Amount paid" },
  { tag: "paidBy", desc: "Cash / Card / Mobile Banking" },
  { tag: "tendered", desc: "Cash received (cash sales)" },
  { tag: "change", desc: "Change given (cash sales)" },
  {
    tag: "changeRow",
    desc: "<tr> Cash received + change rows — only for cash with change",
  },
  { tag: "trxRef", desc: "Card slip / bKash TrxID" },
  { tag: "refRow", desc: "<tr> \"Ref: …\" row — only when there is a reference" },
  { tag: "status", desc: "Empty, or RETURNED for a returned sale" },
];

const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const money = (n: number | null | undefined) => Number(n ?? 0).toFixed(2);
const row = (label: string, value: string) =>
  `<tr><td>${esc(label)}</td><td style="text-align:right">${esc(value)}</td></tr>`;

export function renderPosInvoice(html: string, d: PosInvoiceData): string {
  const at = new Date(d.createdAt);
  const vatLabel = `${d.vatIncluded ? "incl. " : ""}VAT ${Number(d.vatRatePercent)}%`;
  const hasChange = d.tendered != null && Number(d.change ?? 0) > 0;
  const values: Record<string, string> = {
    storeName: esc(d.store.name),
    storeAddress: esc(d.store.address),
    storePhone: esc(d.store.phone),
    receiptNo: esc(d.receiptNo),
    date: esc(at.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })),
    time: esc(
      at.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Dhaka",
        hour: "2-digit",
        minute: "2-digit",
      }),
    ),
    cashier: esc(d.cashier),
    customerName: esc(d.customer?.name),
    customerPhone: esc(d.customer?.phone),
    itemsRows: d.items
      .map(
        (i) =>
          `<tr><td colspan="2">${esc(i.name)}${i.variant ? ` <span class="variant">${esc(i.variant)}</span>` : ""}</td></tr>` +
          `<tr><td>${i.qty} × ${money(i.unitPrice)}</td><td style="text-align:right">${money(i.lineTotal)}</td></tr>`,
      )
      .join(""),
    itemCount: String(d.items.reduce((s, i) => s + i.qty, 0)),
    subtotal: money(d.subtotal),
    discount: money(d.discount),
    discountRow: d.discount > 0 ? row("Discount", `-${money(d.discount)}`) : "",
    vat: money(d.vat),
    vatLabel: esc(vatLabel),
    vatRow: d.vat > 0 ? row(vatLabel, money(d.vat)) : "",
    total: money(d.total),
    paidBy: esc(d.paidBy),
    tendered: d.tendered != null ? money(d.tendered) : "",
    change: d.change != null ? money(d.change) : "",
    changeRow: hasChange
      ? row("Cash received", money(d.tendered)) + row("Change", money(d.change))
      : "",
    trxRef: esc(d.trxRef),
    refRow: d.trxRef ? `<tr><td colspan="2">Ref: ${esc(d.trxRef)}</td></tr>` : "",
    status: d.status === "RETURNED" ? "RETURNED" : "",
  };
  return html.replace(/\{\{(\w+)\}\}/g, (m, tag: string) =>
    tag in values ? values[tag] : m,
  );
}

/** Today's 80mm receipt, expressed as a template — also the "Load built-in" starting point. */
export const BUILTIN_POS_INVOICE = `<style>
  .r { width: 72mm; margin: 0 auto; font: 12px/1.35 monospace; color: #000; }
  .r h1 { font-size: 15px; margin: 0; text-align: center; }
  .r .c { text-align: center; }
  .r hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .r table { width: 100%; border-collapse: collapse; }
  .r td { padding: 1px 0; vertical-align: top; }
  .r .total td { font-size: 14px; font-weight: bold; }
  .r .variant { color: #333; }
</style>
<div class="r">
  <h1>Amader®</h1>
  <div class="c">{{storeName}}<br>{{storeAddress}}<br>{{storePhone}}</div>
  <hr>
  <div>Receipt: {{receiptNo}}</div>
  <div>{{date}} {{time}}</div>
  <div>Cashier: {{cashier}}</div>
  <div>{{customerName}} {{customerPhone}}</div>
  <div><b>{{status}}</b></div>
  <hr>
  <table>{{itemsRows}}</table>
  <hr>
  <table>
    <tr><td>Subtotal ({{itemCount}} items)</td><td style="text-align:right">{{subtotal}}</td></tr>
    {{discountRow}}
    {{vatRow}}
    <tr class="total"><td>TOTAL (BDT)</td><td style="text-align:right">{{total}}</td></tr>
    <tr><td>Paid by {{paidBy}}</td><td style="text-align:right">{{total}}</td></tr>
    {{changeRow}}
    {{refRow}}
  </table>
  <hr>
  <div class="c">Thank you for shopping with Amader®</div>
</div>`;

export const SAMPLE_POS_INVOICE: PosInvoiceData = {
  store: {
    name: "Dhanmondi Store",
    address: "House 12, Road 5, Dhanmondi, Dhaka",
    phone: "01700-000000",
  },
  receiptNo: "ORD-20260925-SAMPLE",
  createdAt: "2026-09-25T08:30:00Z",
  cashier: "Rahim Uddin",
  customer: { name: "Karim Ahmed", phone: "01711-111111" },
  status: "COMPLETED",
  items: [
    {
      name: "Amader Mustard Oil",
      variant: "1 Ltr",
      qty: 2,
      unitPrice: 320,
      lineTotal: 640,
    },
    {
      name: "Amader Honey",
      variant: "500 gram",
      qty: 1,
      unitPrice: 699,
      lineTotal: 699,
    },
  ],
  subtotal: 1339,
  discount: 39,
  vat: 195,
  vatRatePercent: 15,
  vatIncluded: false,
  total: 1495,
  paidBy: "Cash",
  tendered: 1500,
  change: 5,
  trxRef: null,
};
