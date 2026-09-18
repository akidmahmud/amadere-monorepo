"use client";
import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchAllOrders, useReportOrders, useReportSettings } from "@/hooks/useSalesReportV2";
import { buildSalesSheet } from "./salesSheet";
import { COLORS, FLAG, agentLabel, dmy, tk } from "./format";
import { FlagTag, StatusBadge } from "./Tags";
import { OrderDetail } from "./OrderDetailRow";
import type { TabProps } from "./ReportFilters";

export function OrdersTab({ f, money, onExport }: TabProps) {
  // q/open arrive in the URL when Exceptions jumps to an order; read once at mount.
  const params = useSearchParams();
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(() => Number(params.get("open")) || null);
  const { data } = useReportOrders(f, { q: q || undefined, sort, page });
  const rows = data?.rows ?? [];

  // Export = the owner's "Daily Sales Data" sheet layout, for EVERY order
  // matching the filters (not just this page). COD % comes from the rate card,
  // which only money viewers can read.
  const settings = useReportSettings(money);
  useEffect(() => {
    const codPct = Object.fromEntries(Object.entries(settings.data?.settings.rates ?? {}).map(([k, r]) => [k, r.cod]));
    onExport("sales-report", async () => buildSalesSheet((await fetchAllOrders(f)).rows, codPct, money));
  }, [f, money, settings.data, onExport]);

  const cols = money ? 11 : 8;
  const sorts: [string, string][] = [["newest", "Newest first"], ["sales", "Highest net sales first"], ...(money ? [["contrib", "Lowest contribution first"], ["over", "Biggest courier overcharge first"]] as [string, string][] : [])];
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <input type="search" aria-label="Search orders" placeholder="Search order ID, customer or phone" value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); setOpen(null); }}
          className="min-h-[34px] min-w-0 flex-1 rounded-[7px] border bg-white px-2 text-sm sm:min-w-[320px] sm:flex-none" style={{ borderColor: COLORS.line }} />
        <select aria-label="Sort" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="min-h-[34px] rounded-[7px] border bg-white px-2 text-sm" style={{ borderColor: COLORS.line }}>
          {sorts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span className="flex-1" />
        <span className="text-[13px]" style={{ color: COLORS.muted }}>{data?.total ?? 0} order(s)</span>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: COLORS.line }}>
        {rows.length === 0 ? (
          <div className="p-7 text-center" style={{ color: COLORS.ink2 }}>No orders match these filters. Widen the date range or clear filters.</div>
        ) : (
          <table className="w-full border-collapse text-[14.5px]">
            <thead><tr className="text-left text-[13.5px]" style={{ color: COLORS.muted, background: "#fbfcfb" }}>
              {["Order", "Status", "Channel", "Customer", "District", "Items"].map((h) => <th key={h} className="border-b px-3 py-2 font-medium" style={{ borderColor: COLORS.line }}>{h}</th>)}
              <th className="border-b px-3 text-right font-medium" style={{ borderColor: COLORS.line }}>Net sales</th>
              {money && ["Delivery paid", "Courier charge", "Contribution"].map((h) => <th key={h} className="border-b px-3 text-right font-medium" style={{ borderColor: COLORS.line }}>{h}</th>)}
              <th className="border-b px-3 font-medium" style={{ borderColor: COLORS.line }}>Flags</th>
            </tr></thead>
            <tbody>
              {rows.map((c) => {
                const isOpen = open === c.o.id;
                return (
                  <Fragment key={c.o.id}>
                    <tr tabIndex={0} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.o.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(isOpen ? null : c.o.id); } }}
                      className="cursor-pointer align-top hover:bg-[#fbfcfb]" style={isOpen ? { background: COLORS.greenWash } : undefined}>
                      <td className="whitespace-nowrap border-b px-3 py-2" style={{ borderColor: COLORS.line }}><b>{c.o.orderNumber}</b><div className="text-[13px]" style={{ color: COLORS.muted }}>{dmy(c.o.date)}</div></td>
                      <td className="border-b px-3 py-2" style={{ borderColor: COLORS.line }}><StatusBadge status={c.o.status} /></td>
                      <td className="border-b px-3 py-2" style={{ borderColor: COLORS.line }}>{c.o.channel}<div className="text-[13px]" style={{ color: COLORS.muted }}>{agentLabel(c.o.agentName)}</div></td>
                      <td className="min-w-[150px] border-b px-3 py-2" style={{ borderColor: COLORS.line }}>{c.o.customer}<div className="text-[13px]" style={{ color: COLORS.muted }}>{c.o.ctype}, {c.o.phone}</div></td>
                      <td className="border-b px-3 py-2" style={{ borderColor: COLORS.line }}>{c.o.district}<div className="text-[13px]" style={{ color: COLORS.muted }}>{c.zone}</div></td>
                      <td className="min-w-[170px] border-b px-3 py-2" style={{ borderColor: COLORS.line }}>{c.lines[0] ? `${c.lines[0].name} × ${c.lines[0].qty}` : "-"}{c.lines.length > 1 && <div className="text-[13px]" style={{ color: COLORS.muted }}>+ {c.lines.length - 1} more</div>}</td>
                      <td className="border-b px-3 py-2 text-right tabular-nums" style={{ borderColor: COLORS.line }}>{tk(c.netSales)}</td>
                      {money && <>
                        <td className="border-b px-3 py-2 text-right tabular-nums" style={{ borderColor: COLORS.line }}>{tk(c.o.delivery ?? 0)}</td>
                        <td className="border-b px-3 py-2 text-right tabular-nums" style={{ borderColor: COLORS.line }}>{c.shipped ? <>{tk(c.courierCharge)}{c.estimated && <span className="ml-1 text-[11.5px]" style={{ color: COLORS.amber }}>est.</span>}</> : <span style={{ color: COLORS.muted }}>-</span>}</td>
                        <td className="border-b px-3 py-2 text-right tabular-nums" style={{ borderColor: COLORS.line, color: c.contribution == null ? COLORS.muted : c.contribution < 0 ? COLORS.loss : COLORS.gain }}>{c.contribution == null ? "-" : tk(c.contribution)}</td>
                      </>}
                      <td className="border-b px-3 py-2" style={{ borderColor: COLORS.line }}>{c.flags.map((fl) => <FlagTag key={fl} flag={fl} />)}</td>
                    </tr>
                    {isOpen && <tr><td colSpan={cols} className="border-b px-4 pb-[18px] pt-3.5" style={{ background: "#fbfcfb", borderColor: COLORS.line }}><OrderDetail c={c} money={money} /></td></tr>}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {data && data.total > data.pageSize && (
        <div className="mt-2.5 flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-2 py-0.5 disabled:opacity-40" style={{ borderColor: COLORS.line }}>Previous</button>
          <span>Page {page} of {Math.ceil(data.total / data.pageSize)}</span>
          <button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)} className="rounded border px-2 py-0.5 disabled:opacity-40" style={{ borderColor: COLORS.line }}>Next</button>
        </div>
      )}
    </div>
  );
}
