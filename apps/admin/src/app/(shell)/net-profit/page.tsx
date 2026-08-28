"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, DoughnutChart, Icon, RevenueProfitTrend, RiskBadge } from "@amader/admin-ui";
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

const GREEN = "#2e7d43";
const GREEN_HEADER = "#2f7d33";
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const MUTED = "#64766b";
const TEXT = "#374840";
const FAINT = "#94a69a";

const RANGES: { value: OverviewRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
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

function HeaderButton({ children, onClick, href, active }: { children: React.ReactNode; onClick?: () => void; href?: string; active?: boolean }) {
  const className =
    "inline-flex h-10 items-center gap-2 rounded-[10px] border px-[15px] text-[0.8rem] font-bold transition-colors duration-150 hover:bg-[#f2f6f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d43] focus-visible:ring-offset-1";
  const style = active
    ? { borderColor: GREEN, color: "#fff", background: GREEN }
    : { borderColor: LINE, color: TEXT, background: "#fff" };

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b pb-2" style={{ borderColor: LINE }}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: GREEN }} />
        <h2 className="text-[1.05rem] font-extrabold tracking-tight" style={{ color: INK }}>
          {title}
        </h2>
      </div>
      {subtitle && <span className="text-[0.74rem] font-medium" style={{ color: MUTED }}>{subtitle}</span>}
    </div>
  );
}

const TH = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <th
    className="sticky top-0 z-[5] px-3 py-3 text-left text-[0.72rem] font-bold whitespace-nowrap text-white"
    style={{
      background: GREEN_HEADER,
      borderRight: "1px solid rgba(255,255,255,.13)",
      ...style,
    }}
  >
    {children}
  </th>
);

function StatCard({ label, value, icon, bgColor = "#e8f4ea", color = GREEN, borderColor = "#dff0e2" }: { label: string; value: string; icon: React.ReactNode; bgColor?: string; color?: string; borderColor?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-card border p-[15px_17px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
      <div>
        <div className="text-[0.72rem] font-semibold" style={{ color: MUTED }}>
          {label}
        </div>
        <div className="mt-1 text-[1.25rem] font-extrabold tracking-tight" style={{ color: INK }}>
          {value}
        </div>
      </div>
      <div className="grid h-10 w-10 flex-none place-items-center rounded-full border" style={{ background: bgColor, color, borderColor }}>
        {icon}
      </div>
    </div>
  );
}

function DashboardTab() {
  const [range, setRange] = useState<OverviewRange>("7d");
  const { data, isLoading } = useNetProfitOverview(range);
  const kpis = data?.kpis;

  const trendData = (data?.revenueVsProfit ?? []).map((p) => ({
    reportDate: p.date,
    totalRevenue: Number(p.revenue),
    netProfit: Number(p.netProfit),
  }));

  const statusSlices = (data?.orderStatusBreakdown ?? []).map((s) => ({
    label: `${s.status} (${s.count})`,
    value: s.count,
    color: STATUS_COLORS[s.status] ?? "#9ca3af",
  }));

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Range Selection Bar */}
      <div className="flex items-center gap-2 rounded-card border p-3 shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <span className="text-[0.76rem] font-bold" style={{ color: TEXT }}>
          Cockpit Range:
        </span>
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRange(r.value)}
            className="rounded-pill px-3 py-1 text-[0.74rem] font-bold transition-all"
            style={
              range === r.value
                ? { background: GREEN, color: "#fff" }
                : { background: "#f2f6f3", color: MUTED }
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted">Loading cockpit data…</p>}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <StatCard label="Revenue" value={`৳${Number(kpis?.revenue ?? 0).toLocaleString()}`} icon={<Icon name="payments" />} bgColor="#e8f4ea" color={GREEN} borderColor="#dff0e2" />
        <StatCard label="Net Profit" value={`৳${Number(kpis?.netProfit ?? 0).toLocaleString()}`} icon={<Icon name="savings" />} bgColor="#e8f4ea" color={GREEN} borderColor="#dff0e2" />
        <StatCard label="Orders" value={String(kpis?.orders ?? 0)} icon={<Icon name="inventory_2" />} bgColor="#e6f4ff" color="#0c8ce9" borderColor="#cce7ff" />
        <StatCard label="Avg Order Value" value={`৳${Number(kpis?.avgOrderValue ?? 0).toLocaleString()}`} icon={<Icon name="inventory_2" />} bgColor="#f3f4f6" color="#374151" borderColor="#e5e7eb" />
        <StatCard label="COD Risk Exposure" value={`৳${Number(kpis?.codRiskExposure ?? 0).toLocaleString()}`} icon={<Icon name="shield" />} bgColor="#fff8e6" color="#d97706" borderColor="#feeed0" />
        <StatCard label="Fraud Savings" value={`৳${Number(kpis?.fraudSavings ?? 0).toLocaleString()}`} icon={<Icon name="shield" />} bgColor="#e8f4ea" color={GREEN} borderColor="#dff0e2" />
        <StatCard label="Recovered Orders" value={`${kpis?.recoveredOrders ?? 0} (৳${Number(kpis?.recoveredValue ?? 0).toLocaleString()})`} icon={<Icon name="restart_alt" />} bgColor="#e0f2fe" color="#0284c7" borderColor="#bae6fd" />
        <StatCard label="SMS Spend" value={`৳${Number(kpis?.smsSpend ?? 0).toLocaleString()}`} icon={<Icon name="sms" />} bgColor="#f3f4f6" color="#374151" borderColor="#e5e7eb" />
        <StatCard label="Delivery Earned" value={`৳${Number(kpis?.deliveryChargeEarned ?? 0).toLocaleString()}`} icon={<Icon name="payments" />} bgColor="#e8f4ea" color={GREEN} borderColor="#dff0e2" />
        <StatCard label="Incomplete Orders" value={`${kpis?.incompleteOrders ?? 0} (৳${Number(kpis?.incompleteValue ?? 0).toLocaleString()})`} icon={<Icon name="restart_alt" />} bgColor="#fff8e6" color="#d97706" borderColor="#feeed0" />
        <StatCard label="OTP Verified" value={String(kpis?.otpVerified ?? 0)} icon={<Icon name="shield" />} bgColor="#e6f4ff" color="#0c8ce9" borderColor="#cce7ff" />
        <StatCard label="VPN Detected" value={String(kpis?.vpnDetected ?? 0)} icon={<Icon name="shield" />} bgColor="#f3f4f6" color="#374151" borderColor="#e5e7eb" />
        <StatCard label="Blocked (Auto / Manual)" value={`${kpis?.blockedAuto ?? 0} / ${kpis?.blockedManual ?? 0}`} icon={<Icon name="shield" />} bgColor="#e8f4ea" color={GREEN} borderColor="#dff0e2" />
      </div>

      {/* Revenue & Profit Trend Chart */}
      <div>
        <SectionHeader title="Revenue vs Net Profit Trend" />
        <RevenueProfitTrend data={trendData} />
      </div>

      {/* Distribution & Blocked Phones */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col rounded-card border p-4 shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
          <div className="mb-3 font-extrabold text-sm text-text">Order Status Distribution</div>
          <DoughnutChart slices={statusSlices} centerLabel={String(kpis?.orders ?? 0)} centerCaption="orders" />
        </div>

        <div className="flex flex-col rounded-card border p-4 shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
          <div className="mb-3 font-extrabold text-sm text-text">Recently Blocked Phones</div>
          <div className="flex flex-col gap-1.5 max-h-52 overflow-auto">
            {kpis?.recentBlockedPhones.map((phone) => (
              <div key={phone} className="flex items-center justify-between rounded-inner border bg-surface-2 p-2.5 text-xs font-bold text-text">
                <span>{phone}</span>
                <span className="rounded-pill bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-700">Blocked</span>
              </div>
            ))}
            {kpis && kpis.recentBlockedPhones.length === 0 && <p className="text-sm text-muted">No blocked phones in this range.</p>}
          </div>
        </div>
      </div>

      {/* Hourly Performance */}
      <div>
        <SectionHeader title="Hourly Sales Performance" subtitle="Sales amount and order count by hour of day" />
        <div className="rounded-card border p-4 shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data?.hourlyPerformance.map((slot) => (
              <div
                key={slot.label}
                className="rounded-[10px] p-4 text-white shadow-sm"
                style={{ background: "linear-gradient(135deg, #1e2b22 0%, #2e7d43 100%)" }}
              >
                <div className="text-[0.72rem] font-semibold text-white/85">{slot.label}</div>
                <div className="mt-1.5 text-[1.15rem] font-extrabold">৳ {Number(slot.revenue).toFixed(2)}</div>
                <div className="my-2.5 h-1.5 overflow-hidden rounded-pill bg-white/20">
                  <div className="h-full rounded-pill bg-white" style={{ width: `${Math.max(slot.barWidth, slot.orders > 0 ? 6 : 2)}%` }} />
                </div>
                <div className="text-[0.7rem] font-medium text-white/80">{slot.orders} orders</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Breakdown */}
      <div className="flex flex-col rounded-card border p-4 shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <div className="mb-3 font-extrabold text-sm text-text">Orders by Risk Level</div>
        <div className="flex flex-wrap gap-3">
          {data && data.ordersByRisk.length === 0 && <p className="text-sm text-muted">No orders in this range.</p>}
          {data?.ordersByRisk.map((r) => (
            <div key={r.riskLevel} className="flex items-center gap-2 rounded-pill border bg-surface-2 px-3 py-1 text-xs font-bold text-text">
              <RiskBadge level={r.riskLevel as RiskLevel} />
              <span>{r.orders} orders</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {QUICK_LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            <div className="rounded-card border p-3 text-center text-[0.75rem] font-bold text-text transition-all hover:-translate-y-0.5 hover:shadow-card hover:border-[#2e7d43]" style={{ background: "#fff", borderColor: LINE }}>
              {l.label}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const INVENTORY_FILTERS: { value: InventoryFilter; label: string }[] = [
  { value: "all", label: "All Items" },
  { value: "low", label: "Low Stock" },
  { value: "out", label: "Out of Stock" },
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
        className="h-8 w-20 rounded-[8px] border bg-white px-2 text-[0.75rem] font-semibold outline-none hover:border-[#2e7d43] focus:border-[#2e7d43]"
        style={{ borderColor: LINE, color: TEXT }}
      />
      {editing && (
        <button
          type="button"
          disabled={updateStock.isPending}
          onClick={() =>
            updateStock.mutate(
              { productId: row.productId, variantId: row.variantId, stock: Number(draft) },
              { onSuccess: () => setDraft("") },
            )
          }
          className="h-8 rounded-[8px] px-2.5 text-[0.72rem] font-bold text-white shadow-sm"
          style={{ background: GREEN }}
        >
          Save
        </button>
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

  const td = "px-3 py-[11px] text-[0.76rem] font-semibold whitespace-nowrap align-middle border-b";
  const tdStyle = { color: TEXT, borderColor: "#eef3ef", background: "#fff" } as const;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="All Items" value={String(data?.counts.all ?? 0)} icon={<Icon name="inventory_2" />} bgColor="#e6f4ff" color="#0c8ce9" borderColor="#cce7ff" />
        <StatCard label="Low Stock" value={String(data?.counts.low ?? 0)} icon={<Icon name="shield" />} bgColor="#fff8e6" color="#d97706" borderColor="#feeed0" />
        <StatCard label="Out of Stock" value={String(data?.counts.out ?? 0)} icon={<Icon name="shield" />} bgColor="#feeef0" color="#e5484d" borderColor="#fcdde0" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-card border p-[14px_16px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <div className="flex items-center gap-2">
          {INVENTORY_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => updateFilter(f.value)}
              className="rounded-pill px-3 py-1 text-[0.74rem] font-bold transition-all"
              style={
                filter === f.value
                  ? { background: GREEN, color: "#fff" }
                  : { background: "#f2f6f3", color: MUTED }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-[200px]">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or SKU..."
            className="h-[38px] w-full rounded-[9px] border py-0 pr-[34px] pl-3 text-[0.76rem] outline-none"
            style={{ borderColor: LINE, color: TEXT }}
          />
          <svg className="pointer-events-none absolute top-1/2 right-[11px] -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <input
          type="number"
          placeholder="Min stock"
          value={stockMin}
          onChange={(e) => { setStockMin(e.target.value); setPage(1); }}
          className="h-[38px] w-24 rounded-[9px] border px-2.5 text-[0.76rem] outline-none"
          style={{ borderColor: LINE, color: TEXT }}
        />
        <input
          type="number"
          placeholder="Max stock"
          value={stockMax}
          onChange={(e) => { setStockMax(e.target.value); setPage(1); }}
          className="h-[38px] w-24 rounded-[9px] border px-2.5 text-[0.76rem] outline-none"
          style={{ borderColor: LINE, color: TEXT }}
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[0.74rem] font-semibold" style={{ color: MUTED }}>
            Threshold: {data?.lowStockThreshold ?? "—"}
          </span>
          <input
            type="number"
            min={0}
            placeholder="New"
            value={thresholdDraft}
            onChange={(e) => setThresholdDraft(e.target.value)}
            className="h-[38px] w-20 rounded-[9px] border px-2 text-[0.76rem] outline-none"
            style={{ borderColor: LINE, color: TEXT }}
          />
          <button
            type="button"
            disabled={setThreshold.isPending || !thresholdDraft}
            onClick={() => setThreshold.mutate(Number(thresholdDraft), { onSuccess: () => setThresholdDraft("") })}
            className="h-[38px] rounded-[9px] border px-3 text-[0.75rem] font-bold disabled:opacity-40"
            style={{ borderColor: LINE, color: TEXT, background: "#fff" }}
          >
            Save
          </button>
          <a href={inventoryExportUrl(filter)} download className="inline-flex">
            <button
              type="button"
              className="inline-flex h-[38px] items-center rounded-[9px] border px-3.5 text-[0.75rem] font-bold"
              style={{ borderColor: LINE, color: TEXT, background: "#fff" }}
            >
              Export CSV
            </button>
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-card border shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <div className="overflow-auto" style={{ maxHeight: "62vh" }}>
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <TH>Product Name</TH>
                <TH>SKU</TH>
                <TH>Stock Editor</TH>
                <TH>Reserved</TH>
                <TH>Available Status</TH>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                    Loading inventory…
                  </td>
                </tr>
              )}
              {!isLoading && data && data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                    No inventory records match these filters.
                  </td>
                </tr>
              )}
              {!isLoading &&
                data?.items.map((r) => (
                  <tr key={`${r.productId}-${r.variantId ?? "base"}`} className="[&:hover>td]:bg-[#f7fbf8]">
                    <td className={td} style={{ ...tdStyle, fontWeight: 700, color: INK }}>
                      {r.name}
                      {r.variantId && <span className="text-[0.68rem] font-normal" style={{ color: MUTED }}> (Variant #{r.variantId})</span>}
                    </td>
                    <td className={td} style={{ ...tdStyle, color: MUTED }}>
                      {r.sku ?? "—"}
                    </td>
                    <td className={td} style={tdStyle}>
                      <StockEditor row={r} />
                    </td>
                    <td className={td} style={tdStyle}>
                      <span className="font-semibold text-secondary">{r.reservedStock}</span>
                    </td>
                    <td className={td} style={tdStyle}>
                      <span
                        className={`inline-block rounded-pill px-2.5 py-0.5 text-[0.68rem] font-bold ${
                          r.available <= 0
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                            : r.available <= (data?.lowStockThreshold ?? 10)
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400"
                        }`}
                      >
                        {r.available} available
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReturnedOrdersList({ range }: { range: OverviewRange }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { data, isLoading } = useReturnedOrdersList(range, page, pageSize);

  const td = "px-3 py-[11px] text-[0.76rem] font-semibold whitespace-nowrap align-middle border-b";
  const tdStyle = { color: TEXT, borderColor: "#eef3ef", background: "#fff" } as const;

  return (
    <div className="overflow-hidden rounded-card border shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
      <div className="border-b p-3 font-extrabold text-sm text-text" style={{ borderColor: LINE }}>
        Returned Orders List
      </div>
      <div className="overflow-auto" style={{ maxHeight: "400px" }}>
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <TH>Order Number</TH>
              <TH>Customer</TH>
              <TH>Returned At</TH>
              <TH>Qty</TH>
              <TH>Amount</TH>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm" style={{ color: FAINT }}>
                  Loading returned orders…
                </td>
              </tr>
            )}
            {!isLoading && data && data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm" style={{ color: FAINT }}>
                  No returned orders in this range.
                </td>
              </tr>
            )}
            {!isLoading &&
              data?.items.map((o) => (
                <tr key={o.orderId} className="[&:hover>td]:bg-[#f7fbf8]">
                  <td className={td} style={{ ...tdStyle, fontWeight: 700, color: GREEN }}>
                    {o.orderNumber}
                  </td>
                  <td className={td} style={tdStyle}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-text">{o.recipientName}</span>
                      <span className="text-[0.68rem] text-secondary">{o.phone}</span>
                    </div>
                  </td>
                  <td className={td} style={{ ...tdStyle, color: MUTED }}>
                    {new Date(o.returnedAt).toLocaleString()}
                  </td>
                  <td className={td} style={tdStyle}>
                    {o.quantity}
                  </td>
                  <td className={td} style={{ ...tdStyle, fontWeight: 700, color: INK }}>
                    ৳{Number(o.totalAmount).toLocaleString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReturnedTab() {
  const [range, setRange] = useState<OverviewRange>("7d");
  const { data, isLoading } = useReturnedOrders(range);

  const trendData = (data?.trend ?? []).map((p) => ({
    reportDate: p.date,
    totalRevenue: Number(p.returned),
    netProfit: Number(p.returned),
  }));

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-center gap-2 rounded-card border p-3 shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <span className="text-[0.76rem] font-bold" style={{ color: TEXT }}>
          Returns Period:
        </span>
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRange(r.value)}
            className="rounded-pill px-3 py-1 text-[0.74rem] font-bold transition-all"
            style={
              range === r.value
                ? { background: GREEN, color: "#fff" }
                : { background: "#f2f6f3", color: MUTED }
            }
          >
            {r.label}
          </button>
        ))}
        <a className="ml-auto" href={returnedOrdersExportUrl(range)} download>
          <button
            type="button"
            className="inline-flex h-[38px] items-center rounded-[9px] border px-3.5 text-[0.75rem] font-bold"
            style={{ borderColor: LINE, color: TEXT, background: "#fff" }}
          >
            Export CSV
          </button>
        </a>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading returns data…</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Shipped" value={String(data?.summary.shipped ?? 0)} icon={<Icon name="inventory_2" />} bgColor="#e6f4ff" color="#0c8ce9" borderColor="#cce7ff" />
        <StatCard label="Returned" value={String(data?.summary.returned ?? 0)} icon={<Icon name="restart_alt" />} bgColor="#feeef0" color="#e5484d" borderColor="#fcdde0" />
        <StatCard label="Return Rate" value={`${data?.summary.returnRate ?? 0}%`} icon={<Icon name="monitoring" />} bgColor="#fff8e6" color="#d97706" borderColor="#feeed0" />
        <StatCard label="Returned Value" value={`৳${Number(data?.summary.returnedValue ?? 0).toLocaleString()}`} icon={<Icon name="payments" />} bgColor="#feeef0" color="#e5484d" borderColor="#fcdde0" />
        <StatCard label="Delivery Earned" value={`৳${Number(data?.summary.deliveryChargeEarned ?? 0).toLocaleString()}`} icon={<Icon name="payments" />} bgColor="#e8f4ea" color={GREEN} borderColor="#dff0e2" />
        <StatCard label="Qty Returned" value={String(data?.summary.returnedQuantity ?? 0)} icon={<Icon name="inventory_2" />} bgColor="#f3f4f6" color="#374151" borderColor="#e5e7eb" />
      </div>

      <div>
        <SectionHeader title="Returns Trend" />
        <RevenueProfitTrend data={trendData} />
      </div>

      <ReturnedOrdersList range={range} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-card border p-4 shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
          <div className="mb-3 font-extrabold text-sm text-text">Returns by Courier</div>
          <div className="flex flex-col gap-2">
            {data?.byCourier.map((c) => (
              <div key={c.provider} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-text">{c.provider}</span>
                <span className="font-extrabold text-secondary">{c.returned}</span>
              </div>
            ))}
            {data && data.byCourier.length === 0 && <p className="text-sm text-muted">No returns in this range.</p>}
          </div>
        </div>

        <div className="flex flex-col rounded-card border p-4 shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
          <div className="mb-3 font-extrabold text-sm text-text">Top Return Reasons</div>
          <div className="flex flex-col gap-2">
            {data?.topReasons.map((r) => (
              <div key={r.reason} className="flex items-center justify-between text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold text-text">{r.reason}</span>
                <span className="font-extrabold text-secondary">{r.count}</span>
              </div>
            ))}
            {data && data.topReasons.length === 0 && <p className="text-sm text-muted">No return reasons logged.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NetProfitOverviewPage() {
  const [section, setSection] = useState<"dashboard" | "inventory" | "returned">("dashboard");

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Top Header matching Order Manager */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.45rem] font-extrabold tracking-tight" style={{ color: INK }}>
            Net Profit Cockpit
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] font-semibold" style={{ color: MUTED }}>
            Dashboard <span style={{ color: "#94a69a" }}>›</span> Net Profit <span style={{ color: "#94a69a" }}>›</span>{" "}
            <span style={{ color: GREEN }}>Overview</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <HeaderButton active={section === "dashboard"} onClick={() => setSection("dashboard")}>
            Dashboard
          </HeaderButton>
          <HeaderButton active={section === "inventory"} onClick={() => setSection("inventory")}>
            Inventory
          </HeaderButton>
          <HeaderButton active={section === "returned"} onClick={() => setSection("returned")}>
            Returned
          </HeaderButton>
        </div>
      </div>

      {section === "dashboard" && <DashboardTab />}
      {section === "inventory" && <InventoryTab />}
      {section === "returned" && <ReturnedTab />}
    </div>
  );
}
