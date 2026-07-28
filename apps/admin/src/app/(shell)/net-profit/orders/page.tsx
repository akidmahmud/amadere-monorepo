"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@amader/admin-ui";
import { ConsignModal } from "@/components/ConsignModal";
import { FraudDetailModal } from "@/components/FraudDetailModal";
import { OrderDetailModal } from "@/components/OrderDetailModal";
import { OrderManagerStatsStrip } from "@/components/net-profit/OrderManagerStatsStrip";
import { OrderManagerFilterBar, type OrderFilterState } from "@/components/net-profit/OrderManagerFilterBar";
import { OrderManagerTable, OPTIONAL_COLUMNS, type OptionalColumn } from "@/components/net-profit/OrderManagerTable";
import { useBulkOrderAction, useOrderManagerList, useOrderManagerStatusCounts, type OrderManagerFilters, type OrderManagerRow } from "@/hooks/useOrderManager";
import { useOrderStatusConfigs } from "@/hooks/useOrderStatuses";
import { OrderStatusesTab } from "./OrderStatusesTab";

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
  division: "Division",
  internalNote: "Internal Note",
  source: "Source",
};

const DEFAULT_FILTERS: OrderFilterState = { q: "" };

function resolveDateRange(value: string | undefined): { from?: string; to?: string } {
  if (!value) return {};
  const days = value === "today" ? 1 : value === "7d" ? 7 : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
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
  const className = "inline-flex h-10 items-center gap-2 rounded-[10px] border px-[15px] text-[0.8rem] font-bold";
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
  const [section, setSection] = useState<"orders" | "statuses">("orders");
  const [uiFilters, setUiFilters] = useState<OrderFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(20);
  const [columns, setColumns] = useState<Set<OptionalColumn>>(new Set(OPTIONAL_COLUMNS));
  const [showScreenOptions, setShowScreenOptions] = useState(false);
  const [showSymbology, setShowSymbology] = useState(false);

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

  const filters: OrderManagerFilters = {
    q: uiFilters.q || undefined,
    status: uiFilters.status,
    paymentProvider: uiFilters.paymentProvider,
    courierProvider: uiFilters.courierProvider,
    risk: uiFilters.risk,
    division: uiFilters.division,
    ...resolveDateRange(uiFilters.dateRange),
    page,
    pageSize,
  };

  const { data, isLoading } = useOrderManagerList(filters);
  const { data: statusCounts } = useOrderManagerStatusCounts(filters);
  const { data: statusConfigs } = useOrderStatusConfigs();
  const bulk = useBulkOrderAction();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [consignProvider, setConsignProvider] = useState(COURIER_PROVIDERS[0]);
  const [consignOrder, setConsignOrder] = useState<{ order: OrderManagerRow; provider: "STEADFAST" | "PATHAO" | "REDX" | "ECOURIER" } | null>(null);
  const [detailOrder, setDetailOrder] = useState<OrderManagerRow | null>(null);
  const [riskPhone, setRiskPhone] = useState<string | null>(null);

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

  function runBulk(action: "hold" | "block" | "export" | "consign", courierProvider?: string) {
    if (selected.size === 0) return;
    bulk.mutate(
      { orderIds: [...selected], action, courierProvider },
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
          <HeaderButton onClick={() => setShowScreenOptions(true)}>Screen Options</HeaderButton>
          <HeaderButton onClick={() => setShowSymbology(true)}>Symbology</HeaderButton>
          <Link
            href="/orders/new"
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
          </Link>
        </div>
      </div>

      {section === "statuses" ? (
        <OrderStatusesTab />
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
    </div>
  );
}
