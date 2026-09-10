"use client";

import { useState } from "react";
import { Button, Card, Icon, StatCard } from "@amader/admin-ui";
import {
  COURIERS,
  ORDER_CHANNELS,
  ORDER_STATUSES,
  ORDER_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAGE_SIZE,
  downloadWholesaleOrdersCsv,
  labelOf,
  useWholesaleOrders,
  useWholesaleStats,
  wholesaleInvoiceHref,
  type WholesaleOrder,
} from "@/hooks/useWholesale";
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

const PAY_TONE: Record<string, string> = {
  PAID: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  PARTIALLY_PAID: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  UNPAID: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export function TypeBadge({ type }: { type: WholesaleOrder["type"] }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-black ${
        type === "WHOLESALE"
          ? "bg-brand-500/15 text-brand-600 dark:text-brand-400"
          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      }`}
    >
      {type === "WHOLESALE" ? "Wholesale" : "Cash Sale"}
    </span>
  );
}

/** Payment method, reference and status — one cell in the demo, one here. */
export function PaymentCell({ order }: { order: WholesaleOrder }) {
  return (
    <div className="space-y-1">
      <span className="block text-text">
        {labelOf(PAYMENT_METHODS, order.paymentMethod) || "—"}
      </span>
      {order.gpNumber && (
        <span className="block text-[10px] text-muted">
          GP: {order.gpNumber}
        </span>
      )}
      {order.transactionId && (
        <span className="block text-[10px] text-muted">
          Txn: {order.transactionId}
        </span>
      )}
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-black ${
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
        <span className="inline-block rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-black text-rose-700 dark:text-rose-300">
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
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<WholesaleOrder | null>(null);
  const [exporting, setExporting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const orders = useWholesaleOrders(search, status, type, undefined, page);
  const stats = useWholesaleStats();
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

  return (
    <div className="space-y-5">
      {/* Counted server-side over every order — not over `rows`, which is one
          filtered page and would make the cards move as staff typed. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Orders"
          value={String(s?.orderCount ?? 0)}
          footer="Wholesale + cash sale, cancelled excluded"
          icon={<Icon name="receipt_long" size={24} className="text-brand-500" />}
        />
        <StatCard
          label="Total Sales"
          value={compactMoney(s?.salesTotal ?? 0)}
          footer={`${compactMoney(s?.dueTotal ?? 0)} still outstanding`}
          icon={<Icon name="payments" size={24} className="text-emerald-500" />}
        />
        <StatCard
          label="Wholesale Orders"
          value={String(s?.wholesaleOrderCount ?? 0)}
          footer="Couriered to a shop"
          icon={
            <Icon name="local_shipping" size={24} className="text-blue-500" />
          }
        />
        <StatCard
          label="Cash Sales"
          value={String(s?.cashSaleCount ?? 0)}
          footer="Handed over the counter"
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
              {ORDER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
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
          <Button
            variant="ghost"
            disabled={exporting}
            onClick={async () => {
              setFailure(null);
              setExporting(true);
              try {
                await downloadWholesaleOrdersCsv(search, status);
              } catch (e) {
                setFailure(e instanceof Error ? e.message : "Couldn't export");
              } finally {
                setExporting(false);
              }
            }}
          >
            <Icon name="download" size={18} />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>

        {failure && (
          <p className="rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {failure}
          </p>
        )}

        {orders.isLoading ? (
          <p className="py-10 text-center text-sm text-muted">Loading orders…</p>
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
                      "Type",
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
                        <TypeBadge type={o.type} />
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
                    <TypeBadge type={o.type} />
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
    </div>
  );
}

function RowActions({
  order,
  onView,
  onCollect,
  onEdit,
}: {
  order: WholesaleOrder;
  onView: () => void;
  onCollect: () => void;
  onEdit: () => void;
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
    </div>
  );
}
