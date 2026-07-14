"use client";

import { useState } from "react";
import { Card } from "@amader/admin-ui";
import { useSalesReport, useTopProducts, type SalesGroupBy } from "@/hooks/useSalesReport";

const GROUP_OPTIONS: { value: SalesGroupBy; label: string }[] = [
  { value: "day", label: "By day" },
  { value: "week", label: "By week" },
  { value: "month", label: "By month" },
  { value: "courier", label: "By courier" },
  { value: "area", label: "By area" },
  { value: "payment", label: "By payment method" },
];

export default function SalesReportPage() {
  const [groupBy, setGroupBy] = useState<SalesGroupBy>("day");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading } = useSalesReport(groupBy, from || undefined, to || undefined);
  const { data: topProducts } = useTopProducts(from || undefined, to || undefined);

  const exportParams = new URLSearchParams({ groupBy, ...(from ? { from } : {}), ...(to ? { to } : {}) });
  const totalRevenue = data?.reduce((sum, r) => sum + Number(r.revenue), 0) ?? 0;
  const totalOrders = data?.reduce((sum, r) => sum + r.orders, 0) ?? 0;
  const maxRevenue = Math.max(1, ...(data?.map((r) => Number(r.revenue)) ?? [1]));

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Group by</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as SalesGroupBy)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            {GROUP_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <a
          href={`/api/backend/admin/net-profit/reports/sales/export?${exportParams.toString()}`}
          download
          className="ml-auto h-10 rounded-sm border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-2 inline-flex items-center"
        >
          Export CSV
        </a>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col items-center gap-1 py-4">
          <span className="text-2xl font-semibold text-text">৳{totalRevenue.toLocaleString()}</span>
          <span className="text-xs text-muted">Revenue</span>
        </Card>
        <Card className="flex flex-col items-center gap-1 py-4">
          <span className="text-2xl font-semibold text-text">{totalOrders.toLocaleString()}</span>
          <span className="text-xs text-muted">Orders</span>
        </Card>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <Card className="flex flex-col gap-2">
        {data?.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs text-secondary">{r.label}</span>
            <div className="h-5 flex-1 overflow-hidden rounded-sm bg-surface-2">
              <div className="h-full rounded-sm bg-brand-500" style={{ width: `${(Number(r.revenue) / maxRevenue) * 100}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right text-xs text-secondary">৳{Number(r.revenue).toLocaleString()}</span>
            <span className="w-14 shrink-0 text-right text-xs text-muted">{r.orders} ord.</span>
          </div>
        ))}
      </Card>

      <div>
        <p className="mb-2 text-xs font-semibold text-secondary">Top products</p>
        <div className="flex flex-col gap-2">
          {topProducts?.map((p) => (
            <Card key={p.productId} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-text">{p.name}</span>
              <span className="text-xs text-secondary">{p.quantity} sold</span>
              <span className="text-sm font-semibold text-text">৳{Number(p.revenue).toLocaleString()}</span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
