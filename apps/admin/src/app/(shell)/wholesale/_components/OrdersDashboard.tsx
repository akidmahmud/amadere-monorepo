"use client";

import { useMemo, useState } from "react";
import { Button, Card, Icon, StatCard } from "@amader/admin-ui";
import {
  COURIERS,
  ORDER_CHANNELS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAGE_SIZE,
  downloadWholesaleOrdersCsv,
  channelDetails,
  labelOf,
  useCancelWholesaleOrder,
  useRestoreWholesaleOrder,
  useWholesaleChannels,
  useWholesaleOrders,
  useWholesaleStats,
  wholesaleInvoiceHref,
  type WholesaleOrder,
} from "@/hooks/useWholesale";
import { useCan } from "@/hooks/useAdminAuth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OrderDetailModal } from "./OrderDetailModal";
import { Pager } from "./Pager";

const money = (v: string | number) =>
  `৳${Number(v || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const compactMoney = (v: string | number) =>
  `৳${Number(v || 0).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;

const INPUT =
  "h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition-all duration-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted";

const DATE_RANGES = [
  { value: "", label: "All dates" },
  { value: "1h", label: "Last 1 hour" },
  { value: "6h", label: "Last 6 hours" },
  { value: "12h", label: "Last 12 hours" },
  { value: "24h", label: "Last 24 hours" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom" },
] as const;

const ROLLING_WINDOW_HOURS: Record<string, number> = {
  "1h": 1,
  "6h": 6,
  "12h": 12,
  "24h": 24,
  "7d": 7 * 24,
  "30d": 30 * 24,
};

function parseCustomBound(value: string, edge: "start" | "end") {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(
    dateOnly
      ? `${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}`
      : value,
  );
}

function resolveDateRange(
  value: string,
  customFrom: string,
  customTo: string,
): { from?: string; to?: string } {
  if (!value) return {};
  if (value === "custom") {
    if (!customFrom || !customTo) return {};
    return {
      from: parseCustomBound(customFrom, "start").toISOString(),
      to: parseCustomBound(customTo, "end").toISOString(),
    };
  }
  const to = new Date();
  if (value === "today") {
    const from = new Date(
      to.getFullYear(),
      to.getMonth(),
      to.getDate(),
      0,
      0,
      0,
      0,
    );
    return { from: from.toISOString(), to: to.toISOString() };
  }
  const hours = ROLLING_WINDOW_HOURS[value];
  if (!hours) return {};
  return {
    from: new Date(to.getTime() - hours * 60 * 60 * 1000).toISOString(),
    to: to.toISOString(),
  };
}

const PAY_TONE: Record<string, string> = {
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  PARTIALLY_PAID:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  UNPAID:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};

/** Wholesale, or the order's channel — with that channel's fields marked
 *  "Show in order table" in Channel Settings listed underneath. */
export function TypeBadge({ order }: { order: WholesaleOrder }) {
  const channels = useWholesaleChannels();
  const wholesale = order.type === "WHOLESALE";
  const details = wholesale ? [] : channelDetails(order, channels.data);
  return (
    <div className="space-y-1">
      <span
        className={`inline-block whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-bold ${
          wholesale
            ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
        }`}
      >
        {wholesale ? "Wholesale" : (order.channelName ?? "Channel")}
      </span>
      {details.map((f) => (
        <span key={f.label} className="block text-[10px] text-muted">
          {f.label}: <span className="text-text">{f.value}</span>
        </span>
      ))}
    </div>
  );
}

/** Payment method, reference and status — one cell in the demo, one here. */
export function PaymentCell({ order }: { order: WholesaleOrder }) {
  return (
    <div className="space-y-1">
      <span className="block text-text">
        {labelOf(PAYMENT_METHODS, order.paymentMethod) || "—"}
      </span>
      {order.transactionId && (
        <span className="block text-[10px] text-muted">
          Txn: {order.transactionId}
        </span>
      )}
      <span
        className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold ${
          PAY_TONE[order.paymentStatus] ?? ""
        }`}
      >
        {labelOf(PAYMENT_STATUSES, order.paymentStatus)}
      </span>
    </div>
  );
}

/**
 * The order number, its channel, and its status when that status changes what
 * the row means.
 *
 * PENDING/PROCESSING/DELIVERED are ordinary progress and stay out of the way.
 * CANCELLED does not: its goods went back on the shelf and its invoice was
 * voided, so a cancelled row that looks exactly like a live one invites
 * someone to chase a delivery or a payment that no longer exists.
 */
export function OrderCell({ order }: { order: WholesaleOrder }) {
  const cancelled = order.status === "CANCELLED";
  return (
    <div className="space-y-1">
      <strong className="block text-text">{order.orderNumber}</strong>
      <span className="block text-muted">
        {labelOf(ORDER_CHANNELS, order.channel)}
      </span>
      {cancelled ? (
        <span className="inline-block rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          Cancelled
        </span>
      ) : (
        order.status !== "PENDING" && (
          <span className="block text-[10px] text-muted">
            {labelOf(ORDER_STATUSES, order.status)}
          </span>
        )
      )}
    </div>
  );
}

export function ProductsCell({ order }: { order: WholesaleOrder }) {
  return (
    <div className="space-y-0.5">
      {order.items.map((i) => (
        <span key={i.id} className="block text-text">
          {i.name} × {i.quantity}
        </span>
      ))}
    </div>
  );
}

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export function OrdersDashboard({
  onCollectPayment,
  onEditOrder,
}: {
  onCollectPayment: (o: WholesaleOrder) => void;
  onEditOrder: (o: WholesaleOrder) => void;
}) {
  const [search, setSearch] = useState("");
  // "ALL", "WHOLESALE", or a channel id as "CH:<id>".
  const [type, setType] = useState("ALL");
  const channels = useWholesaleChannels();
  const channelFilter = type.startsWith("CH:")
    ? Number(type.slice(3))
    : undefined;
  const [status, setStatus] = useState("ALL");
  const [dateRange, setDateRange] = useState("today");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<WholesaleOrder | null>(null);
  const [exporting, setExporting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    order: WholesaleOrder;
    action: "delete" | "restore";
  } | null>(null);
  const canDelete = useCan("wholesale.delete");
  const cancelOrder = useCancelWholesaleOrder();
  const restoreOrder = useRestoreWholesaleOrder();

  const resolvedRange = useMemo(
    () => resolveDateRange(dateRange, dateFrom, dateTo),
    [dateRange, dateFrom, dateTo],
  );
  const rangeLabel =
    DATE_RANGES.find((range) => range.value === dateRange)?.label ??
    "All dates";

  const orders = useWholesaleOrders(
    search,
    status,
    channelFilter ? "CHANNEL" : type,
    undefined,
    page,
    undefined,
    channelFilter,
    resolvedRange.from,
    resolvedRange.to,
  );
  const stats = useWholesaleStats(resolvedRange.from, resolvedRange.to);
  const rows = orders.data?.items ?? [];
  const total = orders.data?.total ?? 0;
  const s = stats.data;

  // Any filter change re-cuts the result set, so page 3 of the old one is
  // meaningless — and often past the end of the new one, which would show an
  // empty table with no hint why.
  function refilter(apply: () => void) {
    apply();
    setPage(1);
  }

  function cancel(order: WholesaleOrder) {
    setConfirmation({ order, action: "delete" });
  }

  function confirmCancel(order: WholesaleOrder) {
    setFailure(null);
    cancelOrder.mutate(order.id, {
      onSuccess: () => setConfirmation(null),
      onError: (error: unknown) => {
        setConfirmation(null);
        setFailure(
          error instanceof Error ? error.message : "Could not cancel the order",
        );
      },
    });
  }

  function restore(order: WholesaleOrder) {
    setConfirmation({ order, action: "restore" });
  }

  function confirmRestore(order: WholesaleOrder) {
    setFailure(null);
    restoreOrder.mutate(order.id, {
      onSuccess: () => setConfirmation(null),
      onError: (error: unknown) => {
        setConfirmation(null);
        setFailure(
          error instanceof Error
            ? error.message
            : "Could not restore the order",
        );
      },
    });
  }

  return (
    <div className="space-y-5">
      {/* Counted server-side over every order — not over `rows`, which is one
          filtered page and would make the cards move as staff typed. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Orders"
          value={String(s?.orderCount ?? 0)}
          footer={`${rangeLabel} · wholesale + channels, cancelled excluded`}
          icon={
            <Icon name="receipt_long" size={24} className="text-brand-500" />
          }
        />
        <StatCard
          label="Total Sales"
          value={compactMoney(s?.salesTotal ?? 0)}
          footer={`${rangeLabel} · ${compactMoney(s?.dueTotal ?? 0)} all-time outstanding`}
          icon={<Icon name="payments" size={24} className="text-emerald-500" />}
        />
        <StatCard
          label="Wholesale Orders"
          value={String(s?.wholesaleOrderCount ?? 0)}
          footer={`${rangeLabel} · couriered to a shop`}
          icon={
            <Icon name="local_shipping" size={24} className="text-blue-500" />
          }
        />
        <StatCard
          label="Channel Orders"
          value={String(s?.channelOrderCount ?? 0)}
          footer={`${rangeLabel} · Cash Sale, Daraz and other channels`}
          icon={<Icon name="storefront" size={24} className="text-amber-500" />}
        />
      </div>

      <Card className="space-y-4 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-64 flex-1 flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1">
              <input
                className={`${INPUT} w-full pl-9`}
                placeholder="Search order, customer, phone, product, courier…"
                value={search}
                onChange={(e) => refilter(() => setSearch(e.target.value))}
              />
              <Icon
                name="search"
                size={18}
                className="pointer-events-none absolute left-3 top-2.5 text-muted"
              />
            </div>
            <select
              className={INPUT}
              value={type}
              onChange={(e) => refilter(() => setType(e.target.value))}
              aria-label="Order type"
            >
              <option value="ALL">All Order Types</option>
              <option value="WHOLESALE">Wholesale</option>
              <option value="CHANNEL">All channels</option>
              {(channels.data ?? []).map((c) => (
                <option key={c.id} value={`CH:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className={INPUT}
              value={dateRange}
              onChange={(event) =>
                refilter(() => setDateRange(event.target.value))
              }
              aria-label="Order date range"
            >
              {DATE_RANGES.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
            {dateRange === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  aria-label="Order date from"
                  className={INPUT}
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(event) =>
                    refilter(() => setDateFrom(event.target.value))
                  }
                />
                <span className="text-xs font-semibold text-muted">to</span>
                <input
                  type="datetime-local"
                  aria-label="Order date to"
                  className={INPUT}
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) =>
                    refilter(() => setDateTo(event.target.value))
                  }
                />
              </div>
            )}
            <select
              className={INPUT}
              value={status}
              onChange={(e) => refilter(() => setStatus(e.target.value))}
              aria-label="Order status"
            >
              <option value="ALL">All Statuses</option>
              {ORDER_STATUSES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() =>
                refilter(() =>
                  setStatus(status === "CANCELLED" ? "ALL" : "CANCELLED"),
                )
              }
            >
              <Icon
                name={status === "CANCELLED" ? "arrow_back" : "delete"}
                size={18}
              />
              {status === "CANCELLED" ? "Back to Orders" : "Deleted Orders"}
            </Button>
            <Button
              variant="ghost"
              disabled={exporting}
              onClick={async () => {
                setFailure(null);
                setExporting(true);
                try {
                  await downloadWholesaleOrdersCsv(
                    search,
                    status,
                    resolvedRange.from,
                    resolvedRange.to,
                  );
                } catch (e) {
                  setFailure(
                    e instanceof Error ? e.message : "Couldn't export",
                  );
                } finally {
                  setExporting(false);
                }
              }}
            >
              <Icon name="download" size={18} />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        </div>

        {failure && (
          <p className="rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {failure}
          </p>
        )}

        {orders.isLoading ? (
          <p className="py-10 text-center text-sm text-muted">
            Loading orders…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            No orders match those filters.
          </p>
        ) : (
          <>
            {/* Desktop table. Below md it is replaced by cards — a nine-column
                table on a phone is a horizontal scrollbar nobody uses. */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[1040px] border-collapse">
                <thead>
                  <tr className="bg-surface-2 text-[9px] uppercase tracking-wide text-muted">
                    {[
                      "Order",
                      "Customer",
                      "Type / Channel",
                      "Products",
                      "Courier",
                      "Payment",
                      "Total",
                      "Created",
                      "Action",
                    ].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr
                      key={o.id}
                      className="border-t border-border align-top text-[11px]"
                    >
                      <td className="px-3 py-3">
                        <OrderCell order={o} />
                      </td>
                      <td className="px-3 py-3">
                        <strong className="block text-text">
                          {o.customerName}
                        </strong>
                        <span className="text-muted">{o.customerPhone}</span>
                      </td>
                      <td className="px-3 py-3">
                        <TypeBadge order={o} />
                      </td>
                      <td className="px-3 py-3">
                        <ProductsCell order={o} />
                      </td>
                      <td className="px-3 py-3">
                        <span className="block text-text">
                          {labelOf(COURIERS, o.courier) || "N/A"}
                        </span>
                        {o.consignmentId && (
                          <span className="text-muted">{o.consignmentId}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <PaymentCell order={o} />
                      </td>
                      <td className="px-3 py-3">
                        <strong className="block text-text">
                          {money(o.total)}
                        </strong>
                        {Number(o.due) > 0 && (
                          <span className="text-rose-600 dark:text-rose-400">
                            {money(o.due)} due
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-secondary">
                        {dateLabel(o.placedAt)}
                      </td>
                      <td className="px-3 py-3">
                        <RowActions
                          order={o}
                          onView={() => setViewing(o)}
                          onCollect={() => onCollectPayment(o)}
                          onEdit={() => onEditOrder(o)}
                          onCancel={() => cancel(o)}
                          onRestore={() => restore(o)}
                          canCancel={canDelete}
                          busy={cancelOrder.isPending || restoreOrder.isPending}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {rows.map((o) => (
                <div
                  key={o.id}
                  className="space-y-2.5 rounded-xl border border-border p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-[11px]">
                      <OrderCell order={o} />
                      <span className="text-[10px] text-muted">
                        {dateLabel(o.placedAt)}
                      </span>
                    </div>
                    <TypeBadge order={o} />
                  </div>
                  <div className="text-[11px]">
                    <strong className="block text-text">
                      {o.customerName}
                    </strong>
                    <span className="text-muted">{o.customerPhone}</span>
                  </div>
                  <div className="text-[11px]">
                    <ProductsCell order={o} />
                  </div>
                  <div className="flex items-end justify-between gap-3 text-[11px]">
                    <PaymentCell order={o} />
                    <div className="text-right">
                      <strong className="block text-sm text-text">
                        {money(o.total)}
                      </strong>
                      {Number(o.due) > 0 && (
                        <span className="text-rose-600 dark:text-rose-400">
                          {money(o.due)} due
                        </span>
                      )}
                    </div>
                  </div>
                  <RowActions
                    order={o}
                    onView={() => setViewing(o)}
                    onCollect={() => onCollectPayment(o)}
                    onEdit={() => onEditOrder(o)}
                    onCancel={() => cancel(o)}
                    onRestore={() => restore(o)}
                    canCancel={canDelete}
                    busy={cancelOrder.isPending || restoreOrder.isPending}
                  />
                </div>
              ))}
            </div>
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPage={setPage}
              noun="orders"
            />
          </>
        )}
      </Card>

      {viewing && (
        <OrderDetailModal order={viewing} onClose={() => setViewing(null)} />
      )}
      <ConfirmDialog
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (!confirmation) return;
          if (confirmation.action === "delete") {
            confirmCancel(confirmation.order);
          } else {
            confirmRestore(confirmation.order);
          }
        }}
        title={
          confirmation?.action === "restore"
            ? "Restore this order?"
            : "Delete this order?"
        }
        description={
          confirmation?.action === "restore"
            ? `${confirmation.order.orderNumber} will return to Pending. Its products will leave stock again and the original receivable will be reopened.`
            : `${confirmation?.order.orderNumber ?? "This order"} will be safely cancelled. Its products return to stock and its receivable is voided. You can restore it later from Deleted Orders.`
        }
        confirmLabel={
          confirmation?.action === "restore" ? "Restore Order" : "Delete Order"
        }
        cancelLabel="Keep Order"
        pendingLabel={
          confirmation?.action === "restore" ? "Restoring…" : "Deleting…"
        }
        tone={confirmation?.action === "restore" ? "success" : "danger"}
        pending={cancelOrder.isPending || restoreOrder.isPending}
      />
    </div>
  );
}

function RowActions({
  order,
  onView,
  onCollect,
  onEdit,
  onCancel,
  onRestore,
  canCancel,
  busy,
}: {
  order: WholesaleOrder;
  onView: () => void;
  onCollect: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onRestore: () => void;
  canCancel: boolean;
  busy: boolean;
}) {
  const link =
    "text-left text-[10px] font-bold text-brand-600 hover:underline dark:text-brand-400";
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      <button type="button" className={link} onClick={onView}>
        View Details
      </button>
      {/* Nothing is owed on a cancelled order, and collecting against one
          would post cash to a voided receivable. */}
      {Number(order.due) > 0 && order.status !== "CANCELLED" && (
        <button type="button" className={link} onClick={onCollect}>
          Collect
        </button>
      )}
      {order.status !== "CANCELLED" && (
        <button type="button" className={link} onClick={onEdit}>
          Edit
        </button>
      )}
      <a
        className={link}
        href={wholesaleInvoiceHref(order.id)}
        target="_blank"
        rel="noreferrer"
      >
        Invoice
      </a>
      {canCancel && order.status !== "CANCELLED" && (
        <button
          type="button"
          className="text-left text-[10px] font-bold text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-400"
          disabled={busy}
          onClick={onCancel}
        >
          Delete Order
        </button>
      )}
      {canCancel && order.status === "CANCELLED" && (
        <button
          type="button"
          className="text-left text-[10px] font-bold text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400"
          disabled={busy}
          onClick={onRestore}
        >
          Restore Order
        </button>
      )}
    </div>
  );
}
