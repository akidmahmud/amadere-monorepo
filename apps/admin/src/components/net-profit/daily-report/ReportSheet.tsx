import {
  fixedCostLabel,
  type DailyReportAppliedCost,
  type DailyReportSnapshot,
  type DailyReportTotals,
} from "@amader/shared";
import { money, qty } from "./format";

const num = "px-2 py-1 text-right tabular-nums";
const HEAD = [
  "Source",
  "SKU",
  "Qty (kg)",
  "Sales",
  "Avg",
  "Cost/kg",
  "Product cost",
  "Delivery",
  "Product profit",
  "Fixed costs",
  "Net profit",
];

function TotalRow({
  label,
  t,
  fixed,
  net,
  strong,
}: {
  label: string;
  t: DailyReportTotals;
  fixed?: number;
  net?: number;
  strong?: boolean;
}) {
  return (
    <tr
      className={
        strong ? "bg-[#cfe3d4] font-bold" : "bg-[#eaf4ec] font-semibold"
      }
    >
      <td className="px-2 py-1">{label}</td>
      <td />
      <td className={num}>{qty(t.qty)}</td>
      <td className={num}>{money(t.sales)}</td>
      <td className={num}>{money(t.avg)}</td>
      <td />
      <td className={num}>{money(t.cost)}</td>
      <td className={num}>{money(t.delivery)}</td>
      <td className={num}>{money(t.profit)}</td>
      <td className={num}>{fixed ? money(fixed) : ""}</td>
      <td className={`${num} ${net != null && net < 0 ? "text-danger" : ""}`}>
        {net != null ? money(net) : ""}
      </td>
    </tr>
  );
}

// Fixed costs are real deductions, so they read like the rows they reduce:
// dark text, labelled with what they are ("VAT — 5% of sales").
const CostRow = ({ c }: { c: DailyReportAppliedCost }) => (
  <tr className="border-b border-border bg-amber-50/60 font-medium text-text">
    <td />
    <td className="px-2 py-1.5">Less: {fixedCostLabel(c)}</td>
    <td colSpan={7} />
    <td className={`${num} font-semibold text-danger`}>−{money(c.value)}</td>
    <td />
  </tr>
);

export function ReportSheet({ s }: { s: DailyReportSnapshot }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#1d5230] text-xs text-white">
            {HEAD.map((h) => (
              <th key={h} className="px-2 py-2 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.sources.map((b, bi) => (
            <FragmentBlock
              key={b.key}
              b={b}
              tint={bi % 2 ? "#E2EFDA" : "#C6E0B4"}
            />
          ))}
          {s.sources.length === 0 && (
            <tr>
              <td colSpan={11} className="py-8 text-center text-muted">
                No sales in this period.
              </td>
            </tr>
          )}
          {/* Fixed costs / Net here are the sources' own; the whole-report
              costs below come off this net to give NET PROFIT. */}
          <TotalRow
            label="GRAND TOTAL"
            t={s.grandTotal}
            fixed={s.sources.reduce(
              (a, b) => a + b.fixedCosts.reduce((x, f) => x + f.value, 0),
              0,
            )}
            net={s.sources.reduce((a, b) => a + b.net, 0)}
            strong
          />
          {s.reportFixedCosts.map((c) => (
            <CostRow key={c.id} c={c} />
          ))}
          <tr className="text-base font-bold">
            <td className="px-2 py-2">NET PROFIT</td>
            <td colSpan={9} className="px-2 text-xs font-normal text-muted">
              = Product profit − Delivery − all fixed costs
            </td>
            <td className={`${num} ${s.netProfit < 0 ? "text-danger" : ""}`}>
              {money(s.netProfit)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function FragmentBlock({
  b,
  tint,
}: {
  b: DailyReportSnapshot["sources"][number];
  tint: string;
}) {
  const fixed = b.fixedCosts.reduce((a, f) => a + f.value, 0);
  return (
    <>
      {b.products.length === 0 && (
        <tr>
          <td className="px-2 py-1" style={{ background: tint }}>
            {b.label}
          </td>
          <td colSpan={10} className="px-2 text-muted">
            No sales
          </td>
        </tr>
      )}
      {b.products.map((p, i) => (
        <tr key={p.key} className="border-b border-border">
          <td
            className="px-2 py-1"
            style={i === 0 ? { background: tint } : undefined}
          >
            {i === 0 ? b.label : ""}
          </td>
          {/* SKU in place of the name (owner); the name on hover. Reports
              saved before SKUs were recorded fall back to the name. */}
          <td className="px-2 py-1" title={p.name}>
            {p.sku || p.name}
            {p.estimated > 0 && (
              <span
                className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800"
                title="No product cost on record — counted as ৳0"
              >
                est.
              </span>
            )}
          </td>
          <td className={num}>{qty(p.qty)}</td>
          <td className={num}>{money(p.sales)}</td>
          <td className={num}>{money(p.avg)}</td>
          <td className={num}>{money(p.costPerKg)}</td>
          <td className={num}>{money(p.cost)}</td>
          <td />
          <td className={num}>{money(p.profit)}</td>
          <td colSpan={2} />
        </tr>
      ))}
      <TotalRow label="total" t={b.subtotal} fixed={fixed} net={b.net} />
      {b.fixedCosts.map((c) => (
        <CostRow key={c.id} c={c} />
      ))}
      <tr>
        <td colSpan={11} className="h-3" />
      </tr>
    </>
  );
}
