"use client";

import { useState } from "react";
import { Button } from "@amader/admin-ui";
import { useUpdateOrderNote, type OrderManagerRow } from "@/hooks/useOrderManager";
import { useOrderStatusConfigs } from "@/hooks/useOrderStatuses";
import { ORDER_STATUSES, useUpdateOrderStatus, type OrderStatus } from "@/hooks/useOrders";

// Same visual language as CustomersTable.tsx (green sticky header, white
// rows, sticky lead columns, numbered-page pagination) — this page is being
// pulled out of the violet Net Profit/WPFOK table theme to match the plain
// Customers page look.
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const TEXT = "#374840";
const MUTED = "#64766b";
const FAINT = "#94a69a";
const GREEN = "#2e7d43";
const GREEN_HEADER = "#2f7d33";

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
export type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];

export interface OrderManagerFiltersLike {
  page?: number;
  pageSize?: number;
}

const TH = ({ children, sticky, style }: { children: React.ReactNode; sticky?: 1 | 2; style?: React.CSSProperties }) => (
  <th
    className="sticky top-0 z-[5] px-3 py-3 text-left text-[0.72rem] font-bold whitespace-nowrap text-white"
    style={{
      background: GREEN_HEADER,
      borderRight: "1px solid rgba(255,255,255,.13)",
      ...(sticky === 1 ? { position: "sticky", left: 0, zIndex: 7, width: 42, minWidth: 42 } : {}),
      ...(sticky === 2 ? { position: "sticky", left: 42, zIndex: 7 } : {}),
      ...style,
    }}
  >
    {children}
  </th>
);

function CourierBadge({ letter, color }: { letter: string; color: string }) {
  return (
    <span className="grid h-6 w-6 place-items-center rounded-[7px] text-[11px] font-bold text-white" style={{ background: color }}>
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
      className="rounded-[8px] border-0 px-2.5 py-1 text-[0.7rem] font-bold outline-none"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {statusByKey.get(s)?.labelEn ?? s}
        </option>
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
      placeholder="Add a note..."
      className="h-9 w-40 rounded-[8px] border bg-transparent px-2.5 text-[0.72rem] font-semibold outline-none hover:bg-white focus:bg-white"
      style={{ borderColor: "transparent" }}
      onFocus={(e) => (e.currentTarget.style.borderColor = GREEN)}
    />
  );
}

function CourierSendCell({ order, onConsign }: { order: OrderManagerRow; onConsign: (provider: "STEADFAST" | "REDX") => void }) {
  return (
    <div className="flex flex-col gap-1">
      {SEND_PROVIDERS.map((sp) => (
        <button
          key={sp.provider}
          type="button"
          onClick={() => onConsign(sp.provider)}
          className="rounded-[7px] border px-2 py-1 text-[0.68rem] font-bold"
          style={{ borderColor: LINE, color: TEXT }}
        >
          {sp.label}
        </button>
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
            <CourierBadge letter={sp.letter} color={attempt ? (COURIER_STATUS_COLOR[attempt.status] ?? "#9ca3af") : "#d8d0e4"} />
            <span className="text-[10px]" style={{ color: MUTED }}>
              {attempt ? attempt.status : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

export function OrderManagerTable({
  orders,
  total,
  filters,
  onFiltersChange,
  columns,
  selected,
  onToggle,
  onToggleAll,
  onView,
  onConsign,
  onCheckRisk,
  isLoading,
}: {
  orders: OrderManagerRow[];
  total: number;
  filters: OrderManagerFiltersLike;
  onFiltersChange: (next: OrderManagerFiltersLike) => void;
  columns: Set<OptionalColumn>;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onView: (order: OrderManagerRow) => void;
  onConsign: (order: OrderManagerRow, provider: "STEADFAST" | "REDX") => void;
  onCheckRisk: (phone: string) => void;
  isLoading: boolean;
}) {
  const { data: statusConfigs } = useOrderStatusConfigs();
  const statusByKey = new Map((statusConfigs ?? []).map((s) => [s.status, s]));

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const colCount = 12 + columns.size;
  const td = "px-3 py-[11px] text-[0.76rem] font-semibold whitespace-nowrap align-middle border-b";
  const tdStyle = { color: TEXT, borderColor: "#eef3ef", background: "#fff" } as const;

  return (
    <div className="overflow-hidden rounded-card border shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
      {/* Bounded height with its own scroll (not just overflow-x-auto) — a
          plain horizontal-only scrollbar sits at the bottom of however tall
          the rendered rows happen to be, so on a full page of rows the user
          had to scroll the whole page down before they could even reach it.
          Capping the height here keeps both scrollbars inside one
          always-visible box, sticky header included. */}
      <div className="overflow-auto" style={{ maxHeight: "62vh" }}>
        <table className="border-separate border-spacing-0" style={{ minWidth: 1600, width: "100%" }}>
          <thead>
            <tr>
              <TH sticky={1}>
                <input type="checkbox" checked={orders.length > 0 && selected.size === orders.length} onChange={onToggleAll} className="h-[15px] w-[15px]" style={{ accentColor: GREEN }} />
              </TH>
              <TH sticky={2} style={{ minWidth: 220 }}>
                Order
              </TH>
              <TH>Date</TH>
              <TH>Status</TH>
              <TH>Total</TH>
              <TH>Phone</TH>
              <TH style={{ minWidth: 220 }}>Address</TH>
              <TH>Origin</TH>
              {columns.has("payment") && <TH>Payment</TH>}
              {columns.has("division") && <TH>Division</TH>}
              {columns.has("internalNote") && <TH>Internal Note</TH>}
              {columns.has("source") && <TH>Source</TH>}
              <TH>Risk</TH>
              <TH>Courier Send</TH>
              <TH>Courier Status</TH>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                  No orders match these filters.
                </td>
              </tr>
            )}
            {orders.map((o) => {
              const { date, time } = formatDate(o.createdAt);
              return (
                <tr key={o.id} className="[&:hover>td]:bg-[#f7fbf8]">
                  <td className={td} style={{ ...tdStyle, position: "sticky", left: 0, zIndex: 6 }} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(o.id)} onChange={() => onToggle(o.id)} className="h-[15px] w-[15px]" style={{ accentColor: GREEN }} />
                  </td>
                  <td className={td} style={{ ...tdStyle, position: "sticky", left: 42, zIndex: 6, boxShadow: "6px 0 8px -6px rgba(20,40,25,.14)" }}>
                    <button type="button" className="block font-bold" style={{ color: GREEN }} onClick={() => onView(o)}>
                      #{o.id} · {o.orderNumber}
                    </button>
                    <div className="mt-[3px] text-[0.68rem] font-medium" style={{ color: FAINT }}>
                      {o.recipientName ?? "—"}
                    </div>
                  </td>
                  <td className={td} style={tdStyle}>
                    <div>{date}</div>
                    <div className="text-[0.66rem]" style={{ color: FAINT }}>
                      {time}
                    </div>
                  </td>
                  <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <StatusCell order={o} statusByKey={statusByKey} />
                  </td>
                  <td className={td} style={{ ...tdStyle, fontWeight: 700, color: INK }}>
                    ৳{Number(o.totalAmount).toLocaleString()}
                  </td>
                  <td className={td} style={tdStyle}>
                    {o.shippingPhone ?? "—"}
                  </td>
                  <td className={td} style={tdStyle}>
                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap" style={{ maxWidth: 220 }} title={[o.addressLine, o.district, o.division, o.postCode].filter(Boolean).join(", ") || undefined}>
                      {[o.addressLine, o.district, o.division, o.postCode].filter(Boolean).join(", ") || "—"}
                    </span>
                  </td>
                  <td className={td} style={{ ...tdStyle, color: FAINT, fontWeight: 500 }}>
                    {o.origin}
                  </td>
                  {columns.has("payment") && (
                    <td className={td} style={{ ...tdStyle, color: FAINT, fontWeight: 500 }}>
                      {o.paymentProvider ?? "—"}
                    </td>
                  )}
                  {columns.has("division") && (
                    <td className={td} style={{ ...tdStyle, color: FAINT, fontWeight: 500 }}>
                      {o.division ?? "—"}
                    </td>
                  )}
                  {columns.has("internalNote") && (
                    <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
                      <InternalNoteCell order={o} />
                    </td>
                  )}
                  {columns.has("source") && (
                    <td className={td} style={{ ...tdStyle, color: FAINT, fontWeight: 500 }}>
                      {o.utmSource ? (
                        <>
                          <div style={{ color: TEXT, fontWeight: 700 }}>{o.utmSource}</div>
                          {o.utmCampaign && <div>{o.utmCampaign}</div>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <Button type="button" variant="ghost" disabled={!o.shippingPhone} onClick={() => o.shippingPhone && onCheckRisk(o.shippingPhone)}>
                      Check
                    </Button>
                  </td>
                  <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <CourierSendCell order={o} onConsign={(provider) => onConsign(o, provider)} />
                  </td>
                  <td className={td} style={tdStyle}>
                    <CourierStatusCell order={o} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3.5 border-t p-[13px_18px]" style={{ borderColor: LINE }}>
        <div className="text-[0.76rem] font-semibold" style={{ color: MUTED }}>
          {total === 0 ? "No orders" : `Showing ${start} to ${end} of ${total} orders`}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onFiltersChange({ ...filters, page: page - 1 })}
            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border disabled:opacity-40"
            style={{ borderColor: LINE, color: TEXT }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
            .reduce<number[]>((acc, n) => {
              if (acc.length && n - acc[acc.length - 1] > 1) acc.push(-1);
              acc.push(n);
              return acc;
            }, [])
            .map((n, i) =>
              n === -1 ? (
                <span key={`dots-${i}`} className="px-1 text-[0.74rem]" style={{ color: FAINT }}>
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, page: n })}
                  className="h-[30px] min-w-[30px] rounded-[8px] border px-2 text-[0.74rem] font-bold"
                  style={n === page ? { background: GREEN, borderColor: GREEN, color: "#fff" } : { borderColor: LINE, color: TEXT }}
                >
                  {n}
                </button>
              ),
            )}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onFiltersChange({ ...filters, page: page + 1 })}
            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border disabled:opacity-40"
            style={{ borderColor: LINE, color: TEXT }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <select
            value={pageSize}
            onChange={(e) => onFiltersChange({ ...filters, pageSize: Number(e.target.value), page: 1 })}
            className="h-[30px] rounded-[8px] border bg-white px-2 text-[0.72rem] font-semibold outline-none"
            style={{ borderColor: LINE, color: MUTED }}
          >
            {[20, 50, 100].map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export { OPTIONAL_COLUMNS };
