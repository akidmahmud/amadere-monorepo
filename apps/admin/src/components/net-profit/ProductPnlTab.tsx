"use client";

import { Fragment, useState } from "react";
import { Card, Icon } from "@amader/admin-ui";
import { useProductPnl, type PnlPeriod } from "@/hooks/useProductPnl";

const INK = "#12261a";
const MUTED = "#5c7266";
const GREEN = "#1e7439";
const LINE = "#dfe7e1";

const PERIODS: { value: PnlPeriod; label: string }[] = [
  { value: "daily", label: "Today" },
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
  { value: "custom", label: "Custom" },
];

const th =
  "px-2.5 py-2 text-[0.7rem] font-bold uppercase tracking-wide text-left whitespace-nowrap";
const td = "px-2.5 py-1.5 text-[0.8rem] whitespace-nowrap";
const num = "num text-right tabular-nums";

function money(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString("en-BD", { maximumFractionDigits: 2 });
}

/**
 * The per-source, per-product P&L, laid out exactly like the spreadsheet the
 * business already keeps by hand — product rows per source, a Total row for
 * each, one Grand total at the bottom.
 *
 * The CSV export writes these same columns in this same order, deliberately:
 * an export that differs from what is on screen is a second, unverifiable
 * report.
 */
export function ProductPnlTab() {
  const [period, setPeriod] = useState<PnlPeriod>("monthly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const custom = period === "custom";
  const { data, isLoading, error } = useProductPnl(
    period,
    custom ? from : undefined,
    custom ? to : undefined,
    !custom || Boolean(from || to),
  );

  // Same plain <a download> the other report exports use — the browser
  // streams it straight from the API, so no blob juggling here.
  const exportParams = new URLSearchParams({ period });
  if (custom && from) exportParams.set("from", from);
  if (custom && to) exportParams.set("to", to);

  return (
    <div className="flex flex-col gap-[18px]">
      <Card className="flex flex-wrap items-end justify-between gap-3 p-4">
        <div>
          <h2 className="text-[1.05rem] font-extrabold tracking-tight" style={{ color: INK }}>
            Product P&amp;L by source
          </h2>
          <p className="text-[0.78rem]" style={{ color: MUTED }}>
            Quantities are in kg. Delivery is what the courier bills us (Shipping
            Rules), deducted once at the grand total.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className="rounded-lg border px-3 py-1.5 text-[0.78rem] font-semibold transition-colors"
              style={
                period === p.value
                  ? { borderColor: GREEN, background: "#eaf4ed", color: GREEN }
                  : { borderColor: LINE, background: "#fff", color: MUTED }
              }
            >
              {p.label}
            </button>
          ))}
          {custom && (
            <>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border px-2 py-1.5 text-[0.78rem]"
                style={{ borderColor: LINE, color: INK }}
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border px-2 py-1.5 text-[0.78rem]"
                style={{ borderColor: LINE, color: INK }}
              />
            </>
          )}
          <a
            href={`/api/backend/admin/net-profit/reports/sales/pnl/export?${exportParams.toString()}`}
            download
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.78rem] font-bold text-white"
            style={{ background: GREEN }}
          >
            <Icon name="download" size={16} />
            Export CSV
          </a>
        </div>
      </Card>

      {isLoading && (
        <Card className="flex items-center gap-3 p-6" style={{ color: MUTED }}>
          <Icon name="progress_activity" className="animate-spin" size={20} />
          <span className="text-sm">Building report…</span>
        </Card>
      )}

      {error && (
        <Card className="p-6 text-sm" style={{ color: "#d0555f" }}>
          {error instanceof Error ? error.message : "Couldn't build the report"}
        </Card>
      )}

      {data && !isLoading && (
        <Card className="overflow-x-auto p-0">
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${LINE}` }}>
            <span className="text-[0.9rem] font-bold" style={{ color: INK }}>
              {data.from === data.to ? data.from : `${data.from} → ${data.to}`}
            </span>
          </div>
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr style={{ background: "#eaf1ec", color: INK }}>
                <th className={th}>source</th>
                <th className={th}>product name</th>
                <th className={`${th} text-right`}>Sum of Qty</th>
                <th className={`${th} text-right`}>Total sales value</th>
                <th className={`${th} text-right`}>avg value</th>
                <th className={`${th} text-right`}>Product cost/kg</th>
                <th className={`${th} text-right`}>Total Product Cost</th>
                <th className={`${th} text-right`}>Delivery Cost</th>
                <th className={`${th} text-right`}>Profit by Product</th>
                <th className={`${th} text-right`}>Marketing &amp; Inhouse</th>
                <th className={`${th} text-right`}>Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.length === 0 && (
                <tr>
                  <td className={`${td} py-6 text-center`} colSpan={11} style={{ color: MUTED }}>
                    No sales in this period.
                  </td>
                </tr>
              )}
              {data.sources.map((block) => (
                <Fragment key={block.source}>
                  {block.rows.map((r, i) => (
                    <tr key={`${block.source}-${r.productName}`} style={{ borderTop: `1px solid ${LINE}` }}>
                      {/* Source label on the block's first row only, as in the sheet. */}
                      <td className={td} style={{ color: INK, fontWeight: i === 0 ? 700 : 400 }}>
                        {i === 0 ? block.source : ""}
                      </td>
                      <td className={td} style={{ color: INK }}>{r.productName}</td>
                      <td className={`${td} ${num}`}>{money(r.qty)}</td>
                      <td className={`${td} ${num}`}>{money(r.salesValue)}</td>
                      <td className={`${td} ${num}`} style={{ color: MUTED }}>{money(r.avgValue)}</td>
                      <td className={`${td} ${num}`} style={{ color: MUTED }}>{money(r.costPerKg)}</td>
                      <td className={`${td} ${num}`}>{money(r.totalProductCost)}</td>
                      <td className={td} />
                      <td
                        className={`${td} ${num} font-semibold`}
                        style={{ color: Number(r.profitByProduct) < 0 ? "#d0555f" : INK }}
                      >
                        {money(r.profitByProduct)}
                      </td>
                      <td className={td} />
                      <td className={td} />
                    </tr>
                  ))}
                  <tr style={{ background: "#dbe9f5", borderTop: `1px solid ${LINE}` }}>
                    <td className={`${td} font-bold`} style={{ color: INK }}>Total</td>
                    <td className={td} />
                    <td className={`${td} ${num} font-bold`}>{money(block.totals.qty)}</td>
                    <td className={`${td} ${num} font-bold`}>{money(block.totals.salesValue)}</td>
                    <td className={`${td} ${num}`}>{money(block.totals.avgValue)}</td>
                    <td className={td} />
                    <td className={`${td} ${num} font-bold`}>{money(block.totals.totalProductCost)}</td>
                    <td className={`${td} ${num} font-bold`}>{money(block.totals.deliveryCost)}</td>
                    <td className={`${td} ${num} font-bold`}>{money(block.totals.profitByProduct)}</td>
                    <td className={td} />
                    <td className={td} />
                  </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#cfe0ef", borderTop: `2px solid ${LINE}` }}>
                <td className={`${td} font-extrabold`} style={{ color: INK }}>Grand total</td>
                <td className={td} />
                <td className={`${td} ${num} font-extrabold`}>{money(data.grandTotal.qty)}</td>
                <td className={`${td} ${num} font-extrabold`}>{money(data.grandTotal.salesValue)}</td>
                <td className={`${td} ${num}`}>{money(data.grandTotal.avgValue)}</td>
                <td className={td} />
                <td className={`${td} ${num} font-extrabold`}>{money(data.grandTotal.totalProductCost)}</td>
                <td className={`${td} ${num} font-extrabold`}>{money(data.grandTotal.deliveryCost)}</td>
                <td
                  className={`${td} ${num} font-extrabold`}
                  title="Product profit less delivery"
                  style={{ color: Number(data.grandTotal.profitByProduct) < 0 ? "#d0555f" : INK }}
                >
                  {money(data.grandTotal.profitByProduct)}
                </td>
                <td className={`${td} ${num} font-extrabold`}>{money(data.grandTotal.marketingCost)}</td>
                <td
                  className={`${td} ${num} font-extrabold`}
                  style={{ color: Number(data.grandTotal.netProfit) < 0 ? "#d0555f" : GREEN }}
                >
                  {money(data.grandTotal.netProfit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  );
}
