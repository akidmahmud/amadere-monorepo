"use client";

import { useEffect, useState } from "react";
import { Button, Card, Icon, Modal, PageHeader, Table, TableEmptyRow, TableIdBadge } from "@amader/admin-ui";
import type { RiskLevel as RiskBadgeLevel } from "@amader/admin-ui";
import { ConsignModal } from "@/components/ConsignModal";
import { FraudDetailModal } from "@/components/FraudDetailModal";
import { OrderDetailModal } from "@/components/OrderDetailModal";
import { useBulkOrderAction, useOrderManagerList, useOrderManagerStatusCounts, useUpdateOrderNote, type OrderManagerFilters, type OrderManagerRow } from "@/hooks/useOrderManager";
import { useOrderStatusConfigs } from "@/hooks/useOrderStatuses";
import { ORDER_STATUSES, useUpdateOrderStatus, type OrderStatus } from "@/hooks/useOrders";
import { OrderStatusesTab } from "./OrderStatusesTab";

const PAYMENT_PROVIDERS = ["COD", "BKASH", "NAGAD", "SSLCOMMERZ", "BANK_TRANSFER"];
const COURIER_PROVIDERS = ["STEADFAST", "PATHAO", "REDX", "ECOURIER"];
const RISK_LEVELS: RiskBadgeLevel[] = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"];
const PAGE_SIZE_KEY = "wpfok-order-manager-page-size";
const COLUMNS_KEY = "wpfok-order-manager-columns";

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

const OPTIONAL_COLUMNS = ["payment", "division", "internalNote", "source"] as const;
type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];
const COLUMN_LABELS: Record<OptionalColumn, string> = {
  payment: "Payment",
  division: "Division",
  internalNote: "Internal Note",
  source: "Source",
};

const DATE_RANGES = [
  { value: "", label: "All dates" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

function resolveDateRange(value: string): { from?: string; to?: string } {
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
    <Modal open onClose={onClose} title="Screen Options" tone="dark">
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
            {[20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
    </Modal>
  );
}

function SymbologyModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Symbology" tone="dark">
      <div className="flex flex-col gap-4 text-sm text-text">
        <div>
          <p className="mb-1.5 font-semibold">Score</p>
          <p className="text-secondary">The "Check" button opens this order's courier delivery-success history and fraud risk level.</p>
        </div>
        <div>
          <p className="mb-1.5 font-semibold">Courier status letters</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2"><CourierBadge letter="S" color="#9ca3af" /> Steadfast</div>
            <div className="flex items-center gap-2"><CourierBadge letter="R" color="#9ca3af" /> RedX</div>
            <div className="flex items-center gap-2"><CourierBadge letter="P" color="#9ca3af" /> Pathao</div>
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

function CourierBadge({ letter, color }: { letter: string; color: string }) {
  return (
    <span
      className="grid h-6 w-6 place-items-center rounded-inner text-[11px] font-bold text-white"
      style={{ background: color }}
    >
      {letter}
    </span>
  );
}

function StatusCell({ order, statusByKey }: { order: OrderManagerRow; statusByKey: Map<string, { labelEn: string; color: string }> }) {
  const updateStatus = useUpdateOrderStatus(order.id);
  const config = statusByKey.get(order.status);
  const color = config?.color ?? "#9ca3af";

  return (
    <select
      value={order.status}
      disabled={updateStatus.isPending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => updateStatus.mutate({ status: e.target.value as OrderStatus })}
      className="rounded-pill border-0 px-2.5 py-1 text-xs font-semibold outline-none"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>{statusByKey.get(s)?.labelEn ?? s}</option>
      ))}
    </select>
  );
}

const SEND_PROVIDERS: { provider: "STEADFAST" | "REDX"; label: string; letter: string }[] = [
  { provider: "STEADFAST", label: "Steadfast", letter: "S" },
  { provider: "REDX", label: "RedX", letter: "R" },
];

function InternalNoteCell({ order }: { order: OrderManagerRow }) {
  const [value, setValue] = useState(order.staffNote ?? "");
  const updateNote = useUpdateOrderNote(order.id);

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== (order.staffNote ?? "") && updateNote.mutate(value)}
      onClick={(e) => e.stopPropagation()}
      placeholder="Add a note…"
      className="h-9 w-40 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none focus:border-brand-500"
    />
  );
}

function CourierSendCell({ order, onConsign }: { order: OrderManagerRow; onConsign: (provider: "STEADFAST" | "REDX") => void }) {
  return (
    <div className="flex flex-col gap-1">
      {SEND_PROVIDERS.map((sp) => (
        <Button key={sp.provider} type="button" variant="ghost" onClick={() => onConsign(sp.provider)}>
          {sp.label}
        </Button>
      ))}
    </div>
  );
}

function CourierStatusCell({ order }: { order: OrderManagerRow }) {
  return (
    <div className="flex flex-col gap-1">
      {SEND_PROVIDERS.map((sp) => {
        const attempt = order.courierAttempts.find((a) => a.provider === sp.provider);
        return (
          <div key={sp.provider} className="flex items-center gap-1.5">
            <CourierBadge letter={sp.letter} color={attempt ? COURIER_STATUS_COLOR[attempt.status] ?? "#9ca3af" : "#d8d0e4"} />
            <span className="text-[10px] text-muted">{attempt ? attempt.status : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderManagerPage() {
  const [section, setSection] = useState<"orders" | "statuses">("orders");
  const [filters, setFilters] = useState<OrderManagerFilters>({ page: 1, pageSize: 20 });
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [columns, setColumns] = useState<Set<OptionalColumn>>(new Set(OPTIONAL_COLUMNS));
  const [moreFilters, setMoreFilters] = useState(false);
  const [showScreenOptions, setShowScreenOptions] = useState(false);
  const [showSymbology, setShowSymbology] = useState(false);

  useEffect(() => {
    const savedSize = Number(localStorage.getItem(PAGE_SIZE_KEY));
    if (savedSize) setFilters((f) => ({ ...f, pageSize: savedSize }));
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
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: search || undefined, page: 1 })), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setFilters((f) => ({ ...f, ...resolveDateRange(dateRange), page: 1 }));
  }, [dateRange]);

  function toggleColumn(col: OptionalColumn) {
    setColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      localStorage.setItem(COLUMNS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function setPageSize(pageSize: number) {
    localStorage.setItem(PAGE_SIZE_KEY, String(pageSize));
    setFilters((f) => ({ ...f, pageSize, page: 1 }));
  }

  const { data, isLoading } = useOrderManagerList(filters);
  const { data: statusCounts } = useOrderManagerStatusCounts(filters);
  const { data: statusConfigs } = useOrderStatusConfigs();
  const bulk = useBulkOrderAction();
  const statusByKey = new Map((statusConfigs ?? []).map((s) => [s.status, s]));
  const sortedStatuses = [...statusByKey.values()].sort((a, b) => a.sortOrder - b.sortOrder);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"consign" | "hold" | "block" | "export">("hold");
  const [consignProvider, setConsignProvider] = useState(COURIER_PROVIDERS[0]);
  const [consignOrder, setConsignOrder] = useState<{ order: OrderManagerRow; provider: "STEADFAST" | "PATHAO" | "REDX" | "ECOURIER" } | null>(null);
  const [detailOrder, setDetailOrder] = useState<OrderManagerRow | null>(null);
  const [riskPhone, setRiskPhone] = useState<string | null>(null);

  const totalCount = Object.values(statusCounts ?? {}).reduce((a, b) => a + b, 0);

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

  function applyBulk() {
    if (selected.size === 0) return;
    bulk.mutate(
      { orderIds: [...selected], action: bulkAction, courierProvider: bulkAction === "consign" ? consignProvider : undefined },
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
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Icon name="assignment" />}
        title="Orders Manager"
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setSection(section === "statuses" ? "orders" : "statuses")}>
              Order Statuses
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowScreenOptions(true)}>
              <Icon name="settings" size={16} /> Screen Options
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowSymbology(true)}>
              <Icon name="key" size={16} /> Symbology
            </Button>
            <Button type="button" variant="primary" onClick={() => alert("Manual order creation isn't built yet.")}>
              <Icon name="add" size={16} /> Add New Order
            </Button>
          </div>
        }
      />

      {section === "statuses" ? (
        <OrderStatusesTab />
      ) : (
        <>
          <Card className="flex flex-wrap gap-2 p-3">
            <button
              type="button"
              onClick={() => setFilters({ ...filters, status: undefined, page: 1 })}
              className={`flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-semibold ${
                !filters.status ? "bg-brand-500 text-white" : "bg-surface-2 text-secondary"
              }`}
            >
              All
              <span className={`rounded-pill px-1.5 py-0.5 text-[10px] ${!filters.status ? "bg-white/25" : "bg-surface"}`}>{totalCount}</span>
            </button>
            {sortedStatuses.map((s) => (
              <button
                key={s.status}
                type="button"
                onClick={() => setFilters({ ...filters, status: s.status, page: 1 })}
                className={`flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-semibold ${
                  filters.status === s.status ? "bg-brand-500 text-white" : "bg-surface-2 text-secondary"
                }`}
              >
                {s.labelEn}
                <span className={`rounded-pill px-1.5 py-0.5 text-[10px] ${filters.status === s.status ? "bg-white/25" : "bg-surface"}`}>
                  {statusCounts?.[s.status] ?? 0}
                </span>
              </button>
            ))}
          </Card>

          <Card className="flex flex-wrap items-center gap-2 p-3">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value as typeof bulkAction)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            >
              <option value="hold">Hold</option>
              <option value="consign">Consign</option>
              <option value="block">Block phone</option>
              <option value="export">Export CSV</option>
            </select>
            {bulkAction === "consign" && (
              <select
                value={consignProvider}
                onChange={(e) => setConsignProvider(e.target.value)}
                className="h-10 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none"
              >
                {COURIER_PROVIDERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <Button type="button" variant="primary" disabled={selected.size === 0 || bulk.isPending} onClick={applyBulk}>
              Apply
            </Button>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            >
              {DATE_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button type="button" onClick={() => setMoreFilters((v) => !v)} className="text-xs font-semibold text-brand-500 hover:underline">
              {moreFilters ? "Fewer filters" : "More filters"}
            </button>
            <span className="text-xs text-muted">{selected.size > 0 ? `${selected.size} selected · ` : ""}{data?.total ?? 0} orders</span>

            <div className="ml-auto flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID, name, email, phone…"
                className="h-10 w-64 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
              <Button type="button" variant="primary" onClick={() => setFilters((f) => ({ ...f, q: search || undefined, page: 1 }))}>
                Search
              </Button>
            </div>
          </Card>

          {moreFilters && (
            <Card className="flex flex-wrap items-end gap-3 p-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Payment</span>
                <select
                  value={filters.paymentProvider ?? ""}
                  onChange={(e) => setFilters({ ...filters, paymentProvider: e.target.value || undefined, page: 1 })}
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                >
                  <option value="">All</option>
                  {PAYMENT_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Courier</span>
                <select
                  value={filters.courierProvider ?? ""}
                  onChange={(e) => setFilters({ ...filters, courierProvider: e.target.value || undefined, page: 1 })}
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                >
                  <option value="">All</option>
                  {COURIER_PROVIDERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Risk</span>
                <select
                  value={filters.risk ?? ""}
                  onChange={(e) => setFilters({ ...filters, risk: (e.target.value as RiskBadgeLevel) || undefined, page: 1 })}
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                >
                  <option value="">All</option>
                  {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Division</span>
                <input
                  value={filters.division ?? ""}
                  onChange={(e) => setFilters({ ...filters, division: e.target.value || undefined, page: 1 })}
                  placeholder="Dhaka"
                  className="h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
            </Card>
          )}

          <Table>
            <thead>
              <tr>
                <th><input type="checkbox" checked={!!data && data.items.length > 0 && selected.size === data.items.length} onChange={toggleAll} /></th>
                <th>Product</th>
                <th>Order</th>
                <th>Date</th>
                <th>Status</th>
                <th>Total</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Origin</th>
                {columns.has("payment") && <th>Payment</th>}
                {columns.has("division") && <th>Division</th>}
                {columns.has("internalNote") && <th>Internal Note</th>}
                {columns.has("source") && <th>Source</th>}
                <th>Score</th>
                <th>Courier Send</th>
                <th>Courier Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableEmptyRow colSpan={14}>Loading…</TableEmptyRow>}
              {data && data.items.length === 0 && <TableEmptyRow colSpan={14}>No orders match these filters.</TableEmptyRow>}
              {data?.items.map((o) => {
                const created = new Date(o.createdAt);
                return (
                  <tr key={o.id}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                    </td>
                    <td>
                      {o.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.thumbnailUrl} alt="" className="h-10 w-10 rounded-inner border border-border object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-inner bg-surface-2 text-[10px] text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="num block font-semibold text-brand-500 hover:underline" onClick={() => setDetailOrder(o)}>
                        <TableIdBadge>#{o.id}</TableIdBadge> {o.orderNumber}
                      </button>
                      <span className="text-xs text-muted">{o.recipientName ?? "—"}</span>
                    </td>
                    <td>
                      <div className="text-xs text-text">{created.toLocaleDateString()}</div>
                      <div className="text-xs text-muted">{created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <StatusCell order={o} statusByKey={statusByKey} />
                    </td>
                    <td className="num font-semibold text-text">৳{Number(o.totalAmount).toLocaleString()}</td>
                    <td className="num text-secondary">{o.shippingPhone ?? "—"}</td>
                    <td>
                      <div className="text-xs font-semibold text-text">{o.recipientName ?? "—"}</div>
                      <div className="max-w-[220px] text-xs text-muted">
                        {[o.addressLine, o.district, o.division, o.postCode].filter(Boolean).join(", ") || "—"}
                      </div>
                    </td>
                    <td className="text-xs text-secondary">{o.origin}</td>
                    {columns.has("payment") && <td className="text-secondary">{o.paymentProvider ?? "—"}</td>}
                    {columns.has("division") && <td className="text-secondary">{o.division ?? "—"}</td>}
                    {columns.has("internalNote") && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <InternalNoteCell order={o} />
                      </td>
                    )}
                    {columns.has("source") && (
                      <td className="text-xs text-secondary">
                        {o.utmSource ? (
                          <>
                            <div className="font-semibold text-text">{o.utmSource}</div>
                            {o.utmCampaign && <div className="text-muted">{o.utmCampaign}</div>}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                    <td onClick={(e) => e.stopPropagation()}>
                      <Button type="button" variant="ghost" disabled={!o.shippingPhone} onClick={() => o.shippingPhone && setRiskPhone(o.shippingPhone)}>
                        Check
                      </Button>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <CourierSendCell order={o} onConsign={(provider) => setConsignOrder({ order: o, provider })} />
                    </td>
                    <td>
                      <CourierStatusCell order={o} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <Card className="flex items-center justify-between p-3">
            <span className="text-xs text-secondary">Rows per page: {filters.pageSize ?? 20}</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })}>
                Previous
              </Button>
              <span className="text-xs text-secondary">
                Page {data?.page ?? 1} of {Math.max(1, Math.ceil((data?.total ?? 0) / (filters.pageSize ?? 20)))}
              </span>
              <Button
                type="button"
                variant="ghost"
                disabled={!data || (filters.page ?? 1) * (filters.pageSize ?? 20) >= data.total}
                onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}
              >
                Next
              </Button>
            </div>
          </Card>
        </>
      )}

      {showScreenOptions && (
        <ScreenOptionsModal
          columns={columns}
          onToggleColumn={toggleColumn}
          pageSize={filters.pageSize ?? 20}
          onPageSize={setPageSize}
          onClose={() => setShowScreenOptions(false)}
        />
      )}
      {showSymbology && <SymbologyModal onClose={() => setShowSymbology(false)} />}
      {consignOrder && (
        <ConsignModal order={consignOrder.order} defaultProvider={consignOrder.provider} onClose={() => setConsignOrder(null)} />
      )}
      {detailOrder && <OrderDetailModal row={detailOrder} onClose={() => setDetailOrder(null)} />}
      {riskPhone && <FraudDetailModal phone={riskPhone} onClose={() => setRiskPhone(null)} />}
    </div>
  );
}
