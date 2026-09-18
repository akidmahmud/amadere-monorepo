import type { OrderRow } from "@/hooks/useSalesReportV2";
// Explicit .ts so node --test (tests/sales-report-sheet.test.mjs) can load it too.
import { agentLabel, courierLabel } from "./format.ts";

// The Orders export, laid out like the owner's hand-kept "Daily Sales Data.xlsx"
// (26 columns A–Z under a row of group labels) but filled from the report's
// engine. Two deliberate differences from the sheet: Gain/Loss is only filled
// for delivered/returned orders (the sheet also counted undelivered orders as
// profit), and a multi-product order becomes one row per product with the
// order-level money (P–W, Z) on its first row only, so column totals stay true.

type Cell = string | number;

const GROUPS: Record<number, string> = {
  12: "Actual value - Sale value",
  15: "from Customer",
  16: "Actual Cost SF",
  17: "As per courier logic",
};

const HEAD = [
  "Date", "OrderID", "Order Status", "Sales Channel", "Sales Agent", "Customer Type", "CustomerName",
  "CustomerPhone", "District", "Product", "Qty", "Sale Value", "Discount", "Payment Method", "Courier",
  "Delivery Charged from Customer", "Charged by Courier", "Agreed charge", "COD Charged", "COD Charge",
  "Total Charge should be", "Charged vs Actual Cost (Loss)", "Courier Payout", "Product Cost/Kg", "TotalCost",
  "Gain/Loss",
];
// Agents (view_own) get the sales columns only — the money ones never reach them.
const SALES_COLS = 15;

const PAYMENT_LABEL: Record<string, string> = { COD: "COD", BKASH: "Bkash", NAGAD: "Nagad", ROCKET: "Rocket", UPAY: "Upay", SSLCOMMERZ: "SSLCommerz", BANK_TRANSFER: "Bank transfer" };
const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const num = (n: number | null | undefined): Cell => (n == null ? "" : r2(n));
const sheetDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });

/** `codPct` is each courier's COD % from the rate card (keyed like `o.courier`). */
export function buildSalesSheet(rows: OrderRow[], codPct: Record<string, number>, money: boolean): Cell[][] {
  const width = money ? HEAD.length : SALES_COLS;
  const groups = Array.from({ length: width }, (_, i) => GROUPS[i] ?? "");
  const out: Cell[][] = [groups, HEAD.slice(0, width)];
  for (const c of rows) {
    const o = c.o;
    const lines = c.lines.length ? c.lines : [null];
    lines.forEach((l, i) => {
      const first = i === 0;
      const weight = l ? l.qty * (l.unitWeight ?? 0) : 0;
      const row: Cell[] = [
        sheetDate(o.date), o.orderNumber, o.status, o.channel, agentLabel(o.agentName),
        o.ctype === "Repeat" ? "Repeated" : "New", o.customer, o.phone, o.district,
        l?.name ?? "", l ? (weight > 0 ? r3(weight) : l.qty) : "",
        l ? r2(l.qty * l.price - l.disc) : "", l && l.disc ? r2(l.disc) : "",
        PAYMENT_LABEL[o.payment] ?? o.payment, o.courier ? courierLabel(o.courier) : "",
      ];
      if (money) {
        const pct = o.courier ? codPct[o.courier] : undefined;
        const unitWeight = l?.unitWeight ?? 0;
        const vsActual = c.expected != null && o.actual != null ? c.expected - o.actual : null;
        row.push(
          ...(first
            ? [num(o.delivery), num(o.actual), num(c.rate), pct == null ? "" : `${pct}%`, c.rate == null ? "" : num(c.cod),
                num(c.expected), num(vsActual), num(c.receivable)]
            : ["", "", "", "", "", "", "", ""]),
          l?.unitCost == null ? "" : num(unitWeight > 0 ? l.unitCost / unitWeight : l.unitCost),
          num(l?.cogs),
          first ? num(c.contribution) : "",
        );
      }
      out.push(row);
    });
  }
  return out;
}
