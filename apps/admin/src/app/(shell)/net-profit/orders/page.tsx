"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Modal } from "@amader/admin-ui";
import { ConsignModal } from "@/components/ConsignModal";
import { FraudDetailModal } from "@/components/FraudDetailModal";
import { OrderDetailModal } from "@/components/OrderDetailModal";
import { NewOrderModal } from "@/components/orders/NewOrderModal";
import { OrderManagerStatsStrip } from "@/components/net-profit/OrderManagerStatsStrip";
import { OrderManagerFilterBar, type OrderFilterState } from "@/components/net-profit/OrderManagerFilterBar";
import { OrderManagerTable, OPTIONAL_COLUMNS, type OptionalColumn } from "@/components/net-profit/OrderManagerTable";
import { ORDER_MANAGER_KEY, useBulkOrderAction, useOrderManagerList, useOrderManagerStatusCounts, type OrderManagerFilters, type OrderManagerRow } from "@/hooks/useOrderManager";
import { useOrderStatusConfigs } from "@/hooks/useOrderStatuses";
import { useAssignableStaff } from "@/hooks/useCustomers";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OrderStatusesTab } from "./OrderStatusesTab";
import { DeletedOrdersTab } from "./DeletedOrdersTab";

const GREEN = "#2e7d43";
const GREEN_DARK = "#1d5230";
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const MUTED = "#64766b";
const TEXT = "#374840";

const COURIER_PROVIDERS = ["STEADFAST", "PATHAO", "REDX", "ECOURIER"];
const PAGE_SIZE_KEY = "wpfok-order-manager-page-size";
const COLUMNS_KEY = "wpfok-order-manager-columns";
const COLUMN_LABELS: Record<OptionalColumn, string> = {
  payment: "Payment",
  paymentStatus: "Payment Status",
  division: "Division",
  internalNote: "Internal Note",
  source: "Source",
};

const DEFAULT_FILTERS: OrderFilterState = { q: "" };

// Rolling windows measured back from "now", in hours. "today" is
// deliberately NOT in here — it's a calendar day, handled separately below.
const ROLLING_WINDOW_HOURS: Record<string, number> = {
  "1h": 1,
  "6h": 6,
  "12h": 12,
  "24h": 24,
  "7d": 7 * 24,
  "30d": 30 * 24,
};

// The custom inputs are datetime-local ("2026-08-19T14:30"), but a filter
// saved before that change is date-only ("2026-08-19"). Widen the bare-date
// form to cover the whole day so an old saved filter doesn't silently
// collapse to midnight and return nothing.
function parseCustomBound(value: string, edge: "start" | "end"): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!dateOnly) return new Date(value);
  return new Date(edge === "start" ? `${value}T00:00:00.000` : `${value}T23:59:59.999`);
}

function resolveDateRange(value: string | undefined, customFrom?: string, customTo?: string): { from?: string; to?: string } {
  if (value === "custom") {
    if (!customFrom || !customTo) return {};
    return {
      from: parseCustomBound(customFrom, "start").toISOString(),
      to: parseCustomBound(customTo, "end").toISOString(),
    };
  }
  if (!value) return {};
  const to = new Date();
  if (value === "today") {
    // Calendar day (local midnight to now), not a rolling 24h window — the
    // rolling-window version below meant "Today" at, say, 2am actually
    // included nearly all of yesterday (anything after 2am the day before),
    // which is exactly the reported bug. "Last 24 hours" is the rolling
    // equivalent for anyone who actually wants that.
    const from = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  const hours = ROLLING_WINDOW_HOURS[value];
  if (!hours) return {};
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ScreenOptionsModal({
  columns,
  onToggleColumn,
  pageSize,
  onPageSize,
  onClose,
}: {
  columns: Set<OptionalColumn>;
  onToggleColumn: (c: OptionalColumn) => void;
  pageSize: number;
  onPageSize: (n: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="Screen Options">
      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-xs font-semibold text-secondary">Columns</p>
          <div className="flex flex-col gap-1.5">
            {OPTIONAL_COLUMNS.map((col) => (
              <label key={col} className="flex items-center gap-2 text-sm text-text">
                <input type="checkbox" checked={columns.has(col)} onChange={() => onToggleColumn(col)} />
                {COLUMN_LABELS[col]}
              </label>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Modal>
  );
}

function SymbologyModal({ onClose }: { onClose: () => void }) {
  const COURIER_STATUS_COLOR: Record<string, string> = {
    PENDING: "#f5a623",
    DISPATCHED: "#0c8ce9",
    IN_TRANSIT: "#0c8ce9",
    DELIVERED: "#22b07d",
    PARTIALLY_DELIVERED: "#22b07d",
    RETURNED: "#e5484d",
    CANCELED: "#e5484d",
    FAILED: "#e5484d",
  };
  return (
    <Modal open onClose={onClose} title="Symbology">
      <div className="flex flex-col gap-4 text-sm text-text">
        <div>
          <p className="mb-1.5 font-semibold">Risk</p>
          <p className="text-secondary">The "Check" button opens this order's courier delivery-success history and fraud risk level.</p>
        </div>
        <div>
          <p className="mb-1.5 font-semibold">Courier status letters</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-[7px] text-[11px] font-bold text-white" style={{ background: "#9ca3af" }}>
                S
              </span>{" "}
              Steadfast
            </div>
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-[7px] text-[11px] font-bold text-white" style={{ background: "#9ca3af" }}>
                R
              </span>{" "}
              RedX
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {Object.entries(COURIER_STATUS_COLOR).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                <span className="text-xs text-secondary">{status}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">A dash (—) means that courier hasn't been attempted for this order yet.</p>
        </div>
      </div>
    </Modal>
  );
}

function HeaderButton({ children, onClick, href }: { children: React.ReactNode; onClick?: () => void; href?: string }) {
  // No hover/focus feedback at all before this — the button gave no visual
  // cue it was interactive until the browser's own (jarring, blue) default
  // focus ring appeared after a click. hover:bg gives real hover feedback;
  // focus:outline-none + focus-visible:ring swaps that default ring for a
  // subtle brand-green one, and only for keyboard focus (a mouse click no
  // longer leaves a ring stuck on the button).
  const className =
    "inline-flex h-10 items-center gap-2 rounded-[10px] border px-[15px] text-[0.8rem] font-bold transition-colors duration-150 hover:bg-[#f2f6f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d43] focus-visible:ring-offset-1";
  const style = { borderColor: LINE, color: TEXT } as const;
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

export default function OrderManagerPage() {
  const [section, setSection] = useState<"orders" | "statuses" | "deleted">("orders");
  const [uiFilters, setUiFilters] = useState<OrderFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(20);
  const [columns, setColumns] = useState<Set<OptionalColumn>>(new Set(OPTIONAL_COLUMNS));
  const [showScreenOptions, setShowScreenOptions] = useState(false);
  const [showSymbology, setShowSymbology] = useState(false);
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    const savedSize = Number(localStorage.getItem(PAGE_SIZE_KEY));
    if (savedSize) setPageSizeState(savedSize);
    const savedCols = localStorage.getItem(COLUMNS_KEY);
    if (savedCols) {
      try {
        setColumns(new Set(JSON.parse(savedCols) as OptionalColumn[]));
      } catch {
        /* ignore malformed value */
      }
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiFilters.q]);

  function toggleColumn(col: OptionalColumn) {
    setColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      localStorage.setItem(COLUMNS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  // Deliberately doesn't reset page to 1 here — every pagination-button
  // click also passes the (unchanged) current pageSize through this same
  // path, and resetting on every "pageSize is present" call made page
  // numbers un-clickable (always snapping back to 1). The pageSize <select>
  // itself already sends an explicit `page: 1` alongside its own change.
  function setPageSize(n: number) {
    localStorage.setItem(PAGE_SIZE_KEY, String(n));
    setPageSizeState(n);
  }

  // resolveDateRange() computes `to: new Date()` — calling it inline on
  // every render produced a fresh from/to pair (and thus a new React Query
  // key) on EVERY render, which refetched, which re-rendered, which
  // recomputed `to`... an infinite request loop that eventually got
  // rate-limited (429s), which is what made the date filters look like they
  // "don't load" / "take too long." Memoized so it only recomputes when the
  // selected range actually changes.
  const dateRange = useMemo(
    () => resolveDateRange(uiFilters.dateRange, uiFilters.dateFrom, uiFilters.dateTo),
    [uiFilters.dateRange, uiFilters.dateFrom, uiFilters.dateTo],
  );

  const filters: OrderManagerFilters = {
    q: uiFilters.q || undefined,
    status: uiFilters.status,
    paymentProvider: uiFilters.paymentProvider,
    courierProvider: uiFilters.courierProvider,
    risk: uiFilters.risk,
    division: uiFilters.division,
    ...dateRange,
    page,
    pageSize,
  };

  const { data, isLoading } = useOrderManagerList(filters);
  const { data: statusCounts } = useOrderManagerStatusCounts(filters);
  const { data: statusConfigs } = useOrderStatusConfigs();
  const { data: staff } = useAssignableStaff();
  const bulk = useBulkOrderAction();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [consignProvider, setConsignProvider] = useState(COURIER_PROVIDERS[0]);
  const [consignOrder, setConsignOrder] = useState<{ order: OrderManagerRow; provider: "STEADFAST" | "PATHAO" | "REDX" | "ECOURIER" } | null>(null);
  const [detailOrder, setDetailOrder] = useState<OrderManagerRow | null>(null);
  const [riskPhone, setRiskPhone] = useState<string | null>(null);
  // Single-row target xor "bulk" (current `selected` set) — one ConfirmDialog
  // covers both the per-row trash icon and the bulk-action-bar Delete button.
  const [deleteTarget, setDeleteTarget] = useState<OrderManagerRow | "bulk" | null>(null);

  const totalCount = Object.values(statusCounts ?? {}).reduce((a, b) => a + b, 0);
  const countFor = (statuses: string[]) => statuses.reduce((sum, s) => sum + (statusCounts?.[s] ?? 0), 0);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!data) return;
    setSelected((prev) => (prev.size === data.items.length ? new Set() : new Set(data.items.map((o) => o.id))));
  }

  function runBulk(action: "hold" | "block" | "export" | "consign" | "delete" | "assign", courierProvider?: string, assignedAdminId?: number | null) {
    if (selected.size === 0) return;
    bulk.mutate(
      { orderIds: [...selected], action, courierProvider, assignedAdminId },
      {
        onSuccess: (result) => {
          if (result.csv) downloadCsv(result.csv, `orders-${Date.now()}.csv`);
          if (result.failed.length > 0) {
            alert(`${result.succeeded.length} succeeded, ${result.failed.length} failed:\n${result.failed.map((f) => `#${f.orderId}: ${f.error}`).join("\n")}`);
          }
          setSelected(new Set());
        },
      },
    );
  }

  function confirmDelete() {
    if (deleteTarget === "bulk") {
      runBulk("delete");
    } else if (deleteTarget) {
      bulk.mutate({ orderIds: [deleteTarget.id], action: "delete" });
    }
    setDeleteTarget(null);
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.45rem] font-extrabold tracking-tight" style={{ color: INK }}>
            Order Manager
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] font-semibold" style={{ color: MUTED }}>
            Dashboard <span style={{ color: "#94a69a" }}>›</span> <span style={{ color: GREEN }}>Orders</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <HeaderButton onClick={() => setSection(section === "statuses" ? "orders" : "statuses")}>
            {section === "statuses" ? "Back to Orders" : "Order Statuses"}
          </HeaderButton>
          <HeaderButton onClick={() => setSection(section === "deleted" ? "orders" : "deleted")}>
            {section === "deleted" ? "Back to Orders" : "Deleted Orders"}
          </HeaderButton>
          <HeaderButton onClick={() => setShowScreenOptions(true)}>Screen Options</HeaderButton>
          <HeaderButton onClick={() => setShowSymbology(true)}>Symbology</HeaderButton>
          <button
            type="button"
            onClick={() => setNewOrderModalOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-[0.82rem] font-bold text-white"
            style={{ background: GREEN }}
            onMouseEnter={(e) => (e.currentTarget.style.background = GREEN_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.background = GREEN)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add New Order
          </button>
        </div>
      </div>

      {section === "statuses" ? (
        <OrderStatusesTab />
      ) : section === "deleted" ? (
        <DeletedOrdersTab />
      ) : (
        <>
          <OrderManagerStatsStrip
            total={totalCount}
            pending={countFor(["PENDING"])}
            processing={countFor(["CONFIRMED", "PROCESSING"])}
            completed={countFor(["COMPLETED"])}
            canceled={countFor(["CANCELED"])}
          />

          <OrderManagerFilterBar
            filters={uiFilters}
            onChange={(next) => {
              setUiFilters(next);
              setPage(1);
            }}
            onReset={() => {
              setUiFilters(DEFAULT_FILTERS);
              setPage(1);
            }}
            statuses={statusConfigs ?? []}
          />

          <div className="flex flex-wrap items-center gap-2.5 rounded-card border p-[12px_16px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
            <span className="text-[0.76rem] font-semibold" style={{ color: MUTED }}>
              {selected.size > 0 ? `${selected.size} selected` : "Select orders to act on"}
            </span>
            <button
              type="button"
              disabled={selected.size === 0 || bulk.isPending}
              onClick={() => runBulk("hold")}
              className="inline-flex h-[38px] items-center rounded-[9px] border px-3.5 text-[0.75rem] font-bold disabled:opacity-40"
              style={{ borderColor: LINE, color: TEXT, background: "#fff" }}
            >
              Hold
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || bulk.isPending}
              onClick={() => runBulk("export")}
              className="inline-flex h-[38px] items-center rounded-[9px] border px-3.5 text-[0.75rem] font-bold disabled:opacity-40"
              style={{ borderColor: LINE, color: TEXT, background: "#fff" }}
            >
              Export CSV
            </button>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => window.open(`/print/orders/bulk-invoice?ids=${[...selected].join(",")}`, "_blank")}
              className="inline-flex h-[38px] items-center rounded-[9px] border px-3.5 text-[0.75rem] font-bold disabled:opacity-40"
              style={{ borderColor: LINE, color: TEXT, background: "#fff" }}
            >
              Generate Invoices
            </button>
            <div className="flex items-center gap-1.5 rounded-[9px] border p-1" style={{ borderColor: LINE }}>
              <select
                value={consignProvider}
                onChange={(e) => setConsignProvider(e.target.value)}
                className="h-[30px] rounded-[7px] border-0 bg-transparent px-2 text-[0.72rem] font-semibold outline-none"
                style={{ color: TEXT }}
              >
                {COURIER_PROVIDERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={selected.size === 0 || bulk.isPending}
                onClick={() => runBulk("consign", consignProvider)}
                className="inline-flex h-[30px] items-center rounded-[7px] px-3 text-[0.75rem] font-bold text-white disabled:opacity-40"
                style={{ background: GREEN }}
              >
                Consign
              </button>
            </div>
            <button
              type="button"
              disabled={selected.size === 0 || bulk.isPending}
              onClick={() => {
                if (confirm(`Block the phone number on ${selected.size} selected order(s)?`)) runBulk("block");
              }}
              className="inline-flex h-[38px] items-center rounded-[9px] border px-3.5 text-[0.75rem] font-bold disabled:opacity-40"
              style={{ borderColor: "#f8ccd3", background: "#feeaec", color: "#e5484d" }}
            >
              Block Phone
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || bulk.isPending}
              onClick={() => setDeleteTarget("bulk")}
              className="inline-flex h-[38px] items-center rounded-[9px] border px-3.5 text-[0.75rem] font-bold disabled:opacity-40"
              style={{ borderColor: "#f8ccd3", background: "#feeaec", color: "#e5484d" }}
            >
              Delete
            </button>
            <select
              aria-label="Bulk assign to staff"
              disabled={selected.size === 0 || bulk.isPending}
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") return;
                runBulk("assign", undefined, v === "unassign" ? null : Number(v));
              }}
              className="h-[38px] rounded-[9px] border px-2.5 text-[0.75rem] font-semibold disabled:opacity-40"
              style={{ borderColor: LINE, color: MUTED }}
            >
              <option value="" disabled>
                Assign to…
              </option>
              <option value="unassign">— (Unassign)</option>
              {(staff ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <span className="ml-auto text-[0.76rem] font-semibold" style={{ color: MUTED }}>
              {data?.total ?? 0} orders
            </span>
          </div>

          <OrderManagerTable
            orders={data?.items ?? []}
            total={data?.total ?? 0}
            filters={{ page, pageSize }}
            onFiltersChange={(next) => {
              if (next.page !== undefined) setPage(next.page);
              if (next.pageSize !== undefined) setPageSize(next.pageSize);
            }}
            columns={columns}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onView={setDetailOrder}
            onConsign={(order, provider) => setConsignOrder({ order, provider })}
            onCheckRisk={setRiskPhone}
            isLoading={isLoading}
            onDelete={setDeleteTarget}
            staff={staff}
          />
        </>
      )}

      {showScreenOptions && (
        <ScreenOptionsModal columns={columns} onToggleColumn={toggleColumn} pageSize={pageSize} onPageSize={setPageSize} onClose={() => setShowScreenOptions(false)} />
      )}
      {showSymbology && <SymbologyModal onClose={() => setShowSymbology(false)} />}
      {consignOrder && <ConsignModal order={consignOrder.order} defaultProvider={consignOrder.provider} onClose={() => setConsignOrder(null)} />}
      {detailOrder && <OrderDetailModal row={detailOrder} onClose={() => setDetailOrder(null)} />}
      {riskPhone && <FraudDetailModal phone={riskPhone} onClose={() => setRiskPhone(null)} />}
      <NewOrderModal
        open={newOrderModalOpen}
        onClose={() => setNewOrderModalOpen(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ORDER_MANAGER_KEY })}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        pending={bulk.isPending}
        title={deleteTarget === "bulk" ? `Delete ${selected.size} order(s)?` : `Delete order #${deleteTarget?.orderNumber}?`}
        description="This moves the order to Deleted Orders, not a permanent delete — it can be restored from there at any time."
      />
    </div>
  );
}
