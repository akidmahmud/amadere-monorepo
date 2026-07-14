"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart, Button, Card, DoughnutChart, PageHeader, RiskBadge, StatCard, Tabs } from "@amader/admin-ui";
import type { RiskLevel } from "@amader/admin-ui";
import { useNetProfitOverview, type OverviewRange } from "@/hooks/useNetProfitOverview";
import {
  inventoryExportUrl,
  useInventory,
  useSetLowStockThreshold,
  useUpdateInventoryStock,
  type InventoryFilter,
  type InventoryRow,
} from "@/hooks/useInventory";
import { returnedOrdersExportUrl, useReturnedOrders, useReturnedOrdersList } from "@/hooks/useReturnedOrders";

const chartIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M4 19V9m6 10V5m6 14v-7" strokeLinecap="round" />
  </svg>
);
const takaIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M8 4v16M8 4c3 0 5 1.5 5 4M6 10h6M6 14h8l-4 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const boxIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M21 8 12 3 3 8l9 5 9-5Z M3 8v8l9 5m0-13v13m9-13v8l-9 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const shieldIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M12 3 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6l-8-3Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const savingsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7" strokeLinecap="round" />
  </svg>
);
const recoveryIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const clockIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const smsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RANGES: { value: OverviewRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#9ca3af",
  CONFIRMED: "#0c8ce9",
  PROCESSING: "#f5a623",
  HOLD: "#8b5cf6",
  COMPLETED: "#22b07d",
  PARTIALLY_RETURNED: "#f97316",
  RETURNED: "#e5484d",
  CANCELED: "#6b5f7a",
};

const QUICK_LINKS = [
  { href: "/net-profit/fraud", label: "Courier Fraud Detection" },
  { href: "/net-profit/orders", label: "Order Manager" },
  { href: "/net-profit/blocker", label: "Order Blocker" },
  { href: "/net-profit/sms", label: "SMS" },
  { href: "/net-profit/payments", label: "Payments" },
  { href: "/net-profit/recovery", label: "Recovery" },
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

  const statusSlices = (data?.orderStatusBreakdown ?? []).map((s) => ({
    label: `${s.status} (${s.count})`,
    value: s.count,
    color: STATUS_COLORS[s.status] ?? "#9ca3af",
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
        <StatCard variant="primary" icon={takaIcon} label="Revenue" value={`৳${Number(kpis?.revenue ?? 0).toLocaleString()}`} />
        <StatCard variant="success" icon={savingsIcon} label="Net Profit" value={`৳${Number(kpis?.netProfit ?? 0).toLocaleString()}`} />
        <StatCard variant="info" icon={boxIcon} label="Orders" value={String(kpis?.orders ?? 0)} />
        <StatCard variant="dark" icon={boxIcon} label="Avg Order Value" value={`৳${Number(kpis?.avgOrderValue ?? 0).toLocaleString()}`} />
        <StatCard variant="warning" icon={shieldIcon} label="COD Risk Exposure" value={`৳${Number(kpis?.codRiskExposure ?? 0).toLocaleString()}`} />
        <StatCard variant="success" icon={shieldIcon} label="Fraud Savings" value={`৳${Number(kpis?.fraudSavings ?? 0).toLocaleString()}`} />
        <StatCard variant="recovery" icon={recoveryIcon} label="Recovered Orders" value={`${kpis?.recoveredOrders ?? 0} (৳${Number(kpis?.recoveredValue ?? 0).toLocaleString()})`} />
        <StatCard variant="dark" icon={smsIcon} label="SMS Spend" value={`৳${Number(kpis?.smsSpend ?? 0).toLocaleString()}`} />
        <StatCard variant="primary" icon={takaIcon} label="Delivery Charge Earned" value={`৳${Number(kpis?.deliveryChargeEarned ?? 0).toLocaleString()}`} />
        <StatCard variant="warning" icon={recoveryIcon} label="Incomplete Orders" value={`${kpis?.incompleteOrders ?? 0} (৳${Number(kpis?.incompleteValue ?? 0).toLocaleString()})`} />
        <StatCard variant="info" icon={shieldIcon} label="OTP Verified" value={String(kpis?.otpVerified ?? 0)} />
        <StatCard variant="dark" icon={shieldIcon} label="VPN Detected" value={String(kpis?.vpnDetected ?? 0)} />
        <StatCard
          variant="success"
          icon={shieldIcon}
          label="Blocked (Auto / Manual)"
          value={`${kpis?.blockedAuto ?? 0} / ${kpis?.blockedManual ?? 0}`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-3 font-ui text-sm font-semibold text-text">Order status distribution</div>
          <DoughnutChart slices={statusSlices} centerLabel={String(kpis?.orders ?? 0)} centerCaption="orders" />
        </Card>

        <Card>
          <div className="mb-3 font-ui text-sm font-semibold text-text">Recently blocked phones</div>
          <div className="flex flex-col gap-1.5">
            {kpis?.recentBlockedPhones.map((phone) => (
              <div key={phone} className="num text-sm text-text">{phone}</div>
            ))}
            {kpis && kpis.recentBlockedPhones.length === 0 && <p className="text-sm text-muted">No blocked phones in this range.</p>}
          </div>
        </Card>
      </div>

      <BarChart
        title="Revenue vs Net Profit"
        currentLabel="Revenue"
        compareLabel="Net Profit"
        data={chartData.length > 0 ? chartData : [{ label: "—", current: 0, compare: 0 }]}
      />

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-brand-500 text-brand-500">
              {clockIcon}
            </span>
            <span className="font-ui text-sm font-semibold text-text">Hourly Sales Performance</span>
          </div>
          <span className="text-xs italic text-muted">Sales amount and order count by hour of day.</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data?.hourlyPerformance.map((slot) => (
            <div
              key={slot.label}
              className="rounded-inner p-4 text-white"
              style={{ background: "linear-gradient(135deg, var(--wpfok-black, #0b0412) 0%, #3d1a66 55%, var(--brand-500) 100%)" }}
            >
              <div className="text-xs font-semibold text-white/85">{slot.label}</div>
              <div className="num mt-1.5 text-lg font-bold">৳ {Number(slot.revenue).toFixed(2)}</div>
              <div className="my-2.5 h-1 overflow-hidden rounded-pill bg-white/20">
                <div className="h-full rounded-pill bg-white" style={{ width: `${Math.max(slot.barWidth, slot.orders > 0 ? 6 : 2)}%` }} />
              </div>
              <div className="text-xs text-white/75">{slot.orders} orders</div>
            </div>
          ))}
        </div>
      </Card>

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
  const [search, setSearch] = useState("");
  const [stockMin, setStockMin] = useState("");
  const [stockMax, setStockMax] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data, isLoading } = useInventory({
    filter,
    search: search || undefined,
    stockMin: stockMin ? Number(stockMin) : undefined,
    stockMax: stockMax ? Number(stockMax) : undefined,
    page,
    pageSize,
  });
  const setThreshold = useSetLowStockThreshold();
  const [thresholdDraft, setThresholdDraft] = useState<string>("");

  function updateFilter(f: InventoryFilter) {
    setFilter(f);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard variant="info" icon={boxIcon} label="All items" value={String(data?.counts.all ?? 0)} />
        <StatCard variant="warning" icon={shieldIcon} label="Low stock" value={String(data?.counts.low ?? 0)} />
        <StatCard variant="dark" icon={shieldIcon} label="Out of stock" value={String(data?.counts.out ?? 0)} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {INVENTORY_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => updateFilter(f.value)}
              className={`rounded-pill px-3 py-1.5 text-xs font-semibold ${
                filter === f.value ? "bg-brand-500 text-white" : "bg-surface-2 text-secondary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Search</span>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name or SKU"
            className="h-9 w-44 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Stock min</span>
          <input
            type="number"
            value={stockMin}
            onChange={(e) => { setStockMin(e.target.value); setPage(1); }}
            className="num h-9 w-20 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Stock max</span>
          <input
            type="number"
            value={stockMax}
            onChange={(e) => { setStockMax(e.target.value); setPage(1); }}
            className="num h-9 w-20 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
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

      {data && data.total > pageSize && (
        <Card className="flex items-center justify-between">
          <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-xs text-secondary">Page {page} of {Math.max(1, Math.ceil(data.total / pageSize))}</span>
          <Button type="button" variant="ghost" disabled={page * pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </Card>
      )}
    </div>
  );
}

function ReturnedOrdersList({ range }: { range: OverviewRange }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { data, isLoading } = useReturnedOrdersList(range, page, pageSize);

  return (
    <Card>
      <div className="mb-3 font-ui text-sm font-semibold text-text">Returned orders</div>
      <div className="flex flex-col gap-2">
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {data?.items.map((o) => (
          <div key={o.orderId} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="num font-semibold text-text">{o.orderNumber}</div>
              <div className="truncate text-xs text-muted">{o.recipientName} · {o.phone}</div>
            </div>
            <span className="text-xs text-secondary">{new Date(o.returnedAt).toLocaleString()}</span>
            <span className="num text-xs text-secondary">Qty {o.quantity}</span>
            <span className="num text-sm font-semibold text-text">৳{Number(o.totalAmount).toLocaleString()}</span>
          </div>
        ))}
        {data && data.items.length === 0 && <p className="text-sm text-muted">No returned orders in this range.</p>}
      </div>
      {data && data.total > pageSize && (
        <div className="mt-3 flex items-center justify-between">
          <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-xs text-secondary">Page {page} of {Math.max(1, Math.ceil(data.total / pageSize))}</span>
          <Button type="button" variant="ghost" disabled={page * pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </Card>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard variant="info" icon={boxIcon} label="Shipped" value={String(data?.summary.shipped ?? 0)} />
        <StatCard variant="warning" icon={recoveryIcon} label="Returned" value={String(data?.summary.returned ?? 0)} />
        <StatCard variant="dark" icon={chartIcon} label="Return rate" value={`${data?.summary.returnRate ?? 0}%`} />
        <StatCard variant="primary" icon={takaIcon} label="Returned value" value={`৳${Number(data?.summary.returnedValue ?? 0).toLocaleString()}`} />
        <StatCard variant="success" icon={takaIcon} label="Delivery charge earned" value={`৳${Number(data?.summary.deliveryChargeEarned ?? 0).toLocaleString()}`} />
        <StatCard variant="recovery" icon={boxIcon} label="Quantity returned" value={String(data?.summary.returnedQuantity ?? 0)} />
      </div>

      <BarChart
        title="Returns trend"
        currentLabel="Returned"
        compareLabel="Returned"
        data={(data?.trend ?? []).map((p) => ({ label: p.date.slice(5), current: p.returned, compare: p.returned }))}
      />

      <ReturnedOrdersList range={range} />

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
              <div key={p.productId} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-text">{p.name}</span>
                <span className="num text-xs text-muted">avg ৳{Number(p.avgUnitPrice).toLocaleString()}</span>
                <span className="num text-secondary">{p.returnedQty} (৳{Number(p.amount).toLocaleString()})</span>
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
      <PageHeader icon={chartIcon} title="Net Profit" subtitle="Order intelligence, fraud protection, and profit tracking for Amader." badge="Overview" />
      <Tabs
        variant="pill"
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
