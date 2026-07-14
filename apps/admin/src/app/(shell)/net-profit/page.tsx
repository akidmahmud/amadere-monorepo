"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart, Button, Card, RiskBadge, StatCard, Tabs } from "@amader/admin-ui";
import type { RiskLevel } from "@amader/admin-ui";
import { useNetProfitOverview, type OverviewRange } from "@/hooks/useNetProfitOverview";
import { inventoryExportUrl, useInventory, useSetLowStockThreshold, useUpdateInventoryStock, type InventoryFilter, type InventoryRow } from "@/hooks/useInventory";
import { returnedOrdersExportUrl, useReturnedOrders } from "@/hooks/useReturnedOrders";

const RANGES: { value: OverviewRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

const QUICK_LINKS = [
  { href: "/net-profit/fraud", label: "Courier Fraud Detection" },
  { href: "/net-profit/orders", label: "Order Manager" },
  { href: "/net-profit/blocker", label: "Order Blocker" },
  { href: "/net-profit/sms", label: "SMS" },
  { href: "/net-profit/payments", label: "Payments" },
  { href: "/net-profit/recovery", label: "Recovery" },
  { href: "/net-profit/profit", label: "Profit Manager" },
  { href: "/net-profit/reports", label: "Sales Report" },
];

// The real KPI cockpit (§7.1/M8) — composes every M1-M7 feature's own
// data, no fake numbers. Every card/chart moves when the range changes.
function DashboardTab() {
  const [range, setRange] = useState<OverviewRange>("7d");
  const { data, isLoading } = useNetProfitOverview(range);
  const kpis = data?.kpis;

  const chartData = (data?.revenueVsProfit ?? []).map((p) => ({
    label: p.date.slice(5),
    current: Number(p.revenue),
    compare: Number(p.netProfit),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRange(r.value)}
            className={`rounded-pill px-3 py-1.5 text-xs font-semibold ${
              range === r.value ? "bg-brand-500 text-white" : "bg-surface-2 text-secondary"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue" value={`৳${Number(kpis?.revenue ?? 0).toLocaleString()}`} />
        <StatCard label="Net Profit" value={`৳${Number(kpis?.netProfit ?? 0).toLocaleString()}`} />
        <StatCard label="Orders" value={String(kpis?.orders ?? 0)} />
        <StatCard label="COD Risk Exposure" value={`৳${Number(kpis?.codRiskExposure ?? 0).toLocaleString()}`} />
        <StatCard label="Fraud Savings" value={`৳${Number(kpis?.fraudSavings ?? 0).toLocaleString()}`} />
        <StatCard label="Recovered Orders" value={`${kpis?.recoveredOrders ?? 0} (৳${Number(kpis?.recoveredValue ?? 0).toLocaleString()})`} />
        <StatCard label="SMS Spend" value={`৳${Number(kpis?.smsSpend ?? 0).toLocaleString()}`} />
      </div>

      <BarChart
        title="Revenue vs Net Profit"
        currentLabel="Revenue"
        compareLabel="Net Profit"
        data={chartData.length > 0 ? chartData : [{ label: "—", current: 0, compare: 0 }]}
      />

      <Card>
        <div className="mb-3 font-ui text-sm font-semibold text-text">Orders by risk level</div>
        <div className="flex flex-wrap gap-3">
          {data && data.ordersByRisk.length === 0 && <p className="text-sm text-muted">No orders in this range.</p>}
          {data?.ordersByRisk.map((r) => (
            <div key={r.riskLevel} className="flex items-center gap-2">
              <RiskBadge level={r.riskLevel as RiskLevel} />
              <span className="text-sm text-text">{r.orders}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {QUICK_LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="py-3 text-center text-xs font-semibold text-text transition-shadow hover:shadow-pop">{l.label}</Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

const INVENTORY_FILTERS: { value: InventoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
];

function StockEditor({ row }: { row: InventoryRow }) {
  const updateStock = useUpdateInventoryStock();
  const [draft, setDraft] = useState<string>("");
  const editing = draft !== "";

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        placeholder={String(row.stock)}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-8 w-20 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none focus:border-brand-500"
      />
      {editing && (
        <Button
          type="button"
          variant="ghost"
          disabled={updateStock.isPending}
          onClick={() =>
            updateStock.mutate(
              { productId: row.productId, variantId: row.variantId, stock: Number(draft) },
              { onSuccess: () => setDraft("") },
            )
          }
        >
          Save
        </Button>
      )}
    </div>
  );
}

function InventoryTab() {
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const { data, isLoading } = useInventory(filter);
  const setThreshold = useSetLowStockThreshold();
  const [thresholdDraft, setThresholdDraft] = useState<string>("");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {INVENTORY_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-pill px-3 py-1.5 text-xs font-semibold ${
                filter === f.value ? "bg-brand-500 text-white" : "bg-surface-2 text-secondary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted">Low-stock threshold: {data?.lowStockThreshold ?? "—"}</span>
          <input
            type="number"
            min={0}
            placeholder="New threshold"
            value={thresholdDraft}
            onChange={(e) => setThresholdDraft(e.target.value)}
            className="h-9 w-28 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500"
          />
          <Button
            type="button"
            variant="ghost"
            disabled={setThreshold.isPending || !thresholdDraft}
            onClick={() => setThreshold.mutate(Number(thresholdDraft), { onSuccess: () => setThresholdDraft("") })}
          >
            Save
          </Button>
          <a href={inventoryExportUrl(filter)} download>
            <Button type="button" variant="ghost">Export CSV</Button>
          </a>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {data && data.items.length === 0 && <p className="text-sm text-muted">Nothing in this view.</p>}

      <div className="flex flex-col gap-2">
        {data?.items.map((r) => (
          <Card key={`${r.productId}-${r.variantId ?? "base"}`} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm text-text">
              {r.name}
              {r.variantId && <span className="text-muted"> (variant #{r.variantId})</span>}
            </span>
            <span className="text-xs text-muted">{r.sku ?? "—"}</span>
            <StockEditor row={r} />
            <span className="num text-xs text-secondary">Reserved {r.reservedStock}</span>
            <span className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${r.available <= 0 ? "bg-danger/10 text-danger" : r.available <= (data?.lowStockThreshold ?? 10) ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
              {r.available} available
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ReturnedTab() {
  const [range, setRange] = useState<OverviewRange>("7d");
  const { data, isLoading } = useReturnedOrders(range);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRange(r.value)}
            className={`rounded-pill px-3 py-1.5 text-xs font-semibold ${
              range === r.value ? "bg-brand-500 text-white" : "bg-surface-2 text-secondary"
            }`}
          >
            {r.label}
          </button>
        ))}
        <a className="ml-auto" href={returnedOrdersExportUrl(range)} download>
          <Button type="button" variant="ghost">Export CSV</Button>
        </a>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Shipped" value={String(data?.summary.shipped ?? 0)} />
        <StatCard label="Returned" value={String(data?.summary.returned ?? 0)} />
        <StatCard label="Return rate" value={`${data?.summary.returnRate ?? 0}%`} />
        <StatCard label="Returned value" value={`৳${Number(data?.summary.returnedValue ?? 0).toLocaleString()}`} />
      </div>

      <BarChart
        title="Returns trend"
        currentLabel="Returned"
        compareLabel="Returned"
        data={(data?.trend ?? []).map((p) => ({ label: p.date.slice(5), current: p.returned, compare: p.returned }))}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <div className="mb-3 font-ui text-sm font-semibold text-text">Returns by courier</div>
          <div className="flex flex-col gap-2">
            {data?.byCourier.map((c) => (
              <div key={c.provider} className="flex items-center justify-between text-sm">
                <span className="text-text">{c.provider}</span>
                <span className="num text-secondary">{c.returned}</span>
              </div>
            ))}
            {data && data.byCourier.length === 0 && <p className="text-sm text-muted">No returns in this range.</p>}
          </div>
        </Card>

        <Card>
          <div className="mb-3 font-ui text-sm font-semibold text-text">Top return reasons</div>
          <div className="flex flex-col gap-2">
            {data?.topReasons.map((r) => (
              <div key={r.reason} className="flex items-center justify-between text-sm">
                <span className="min-w-0 flex-1 truncate text-text">{r.reason}</span>
                <span className="num text-secondary">{r.count}</span>
              </div>
            ))}
            {data && data.topReasons.length === 0 && <p className="text-sm text-muted">No return reasons logged.</p>}
          </div>
        </Card>

        <Card>
          <div className="mb-3 font-ui text-sm font-semibold text-text">Returns by product</div>
          <div className="flex flex-col gap-2">
            {data?.byProduct.map((p) => (
              <div key={p.productId} className="flex items-center justify-between text-sm">
                <span className="min-w-0 flex-1 truncate text-text">{p.name}</span>
                <span className="num text-secondary">{p.returnedQty}</span>
              </div>
            ))}
            {data && data.byProduct.length === 0 && <p className="text-sm text-muted">No returned products.</p>}
          </div>
        </Card>

        <Card>
          <div className="mb-3 font-ui text-sm font-semibold text-text">Returns by area</div>
          <div className="flex flex-col gap-2">
            {data?.byArea.map((a) => (
              <div key={`${a.division}-${a.district}`} className="flex items-center justify-between text-sm">
                <span className="text-text">{a.district}, {a.division}</span>
                <span className="num text-secondary">{a.returned}</span>
              </div>
            ))}
            {data && data.byArea.length === 0 && <p className="text-sm text-muted">No returns in this range.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function NetProfitOverviewPage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        options={[
          { value: "dashboard", label: "Dashboard" },
          { value: "inventory", label: "Inventory" },
          { value: "returned", label: "Returned" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "dashboard" && <DashboardTab />}
      {tab === "inventory" && <InventoryTab />}
      {tab === "returned" && <ReturnedTab />}
    </div>
  );
}
