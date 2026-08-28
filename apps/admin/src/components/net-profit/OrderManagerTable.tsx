"use client";

import { useState } from "react";
import { BD_DIVISIONS, isValidBdPhone } from "@amader/shared";
import { Button } from "@amader/admin-ui";
import { useAssignOrder, useUpdateOrderNote, type OrderManagerRow } from "@/hooks/useOrderManager";
import type { AssignableStaff } from "@/hooks/useCustomers";
import { useOrderStatusConfigs } from "@/hooks/useOrderStatuses";
import {
  ORDER_STATUSES,
  PAYMENT_PROVIDER_TYPES,
  useUpdateOrderDetails,
  useUpdateOrderPayment,
  useUpdateOrderStatus,
  type ManualOrderPaymentStatus,
  type OrderStatus,
  type PaymentProviderType,
} from "@/hooks/useOrders";

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

const OPTIONAL_COLUMNS = ["payment", "paymentStatus", "division", "internalNote", "source"] as const;
export type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];

const PAYMENT_STATUSES: ManualOrderPaymentStatus[] = ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "CANCELED"];
// "CAPTURED" is the Prisma enum's own gateway-jargon name for "money is
// actually in hand" — shown to staff as "Paid" everywhere, same relabeling
// NewOrderForm.tsx and InvoiceDocument.tsx already do; the stored value is
// unchanged.
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  AUTHORIZED: "Authorized",
  CAPTURED: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially Refunded",
  CANCELED: "Cancelled",
};
const PAYMENT_STATUS_COLOR: Record<string, string> = {
  PENDING: "#f5a623",
  AUTHORIZED: "#0c8ce9",
  CAPTURED: "#22b07d",
  FAILED: "#e5484d",
  REFUNDED: "#e5484d",
  PARTIALLY_REFUNDED: "#e5484d",
  CANCELED: "#9ca3af",
};

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
      // Was a pale ~10%-opacity tint with colored text — too low-contrast
      // to scan a full page of rows at a glance (reported: staff couldn't
      // tell a fresh/new order apart from an already-actioned one). Solid
      // fill + white text reads as a real, unmissable status badge instead.
      className="rounded-pill border-0 px-3 py-1 text-[0.72rem] font-extrabold uppercase tracking-wide text-white shadow-[0_1px_3px_rgba(0,0,0,.18)] outline-none"
      style={{ backgroundColor: color }}
    >
      {ORDER_STATUSES.map((s) => (
        // Options need their own dark text — the select's white text color
        // above is only meant for the closed/badge state; native <option>
        // rows render against the browser's own (light) dropdown background,
        // and would otherwise inherit that same white and go invisible.
        <option key={s} value={s} className="text-text" style={{ backgroundColor: "#fff", color: "#1e2b22" }}>
          {statusByKey.get(s)?.labelEn ?? s}
        </option>
      ))}
    </select>
  );
}

function PaymentStatusCell({ order }: { order: OrderManagerRow }) {
  const updatePayment = useUpdateOrderPayment(order.id);
  const color = order.paymentStatus ? (PAYMENT_STATUS_COLOR[order.paymentStatus] ?? "#9ca3af") : "#9ca3af";
  return (
    <select
      value={order.paymentStatus ?? ""}
      disabled={updatePayment.isPending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => updatePayment.mutate({ status: e.target.value as ManualOrderPaymentStatus })}
      className="rounded-pill border-0 px-3 py-1 text-[0.72rem] font-extrabold uppercase tracking-wide text-white shadow-[0_1px_3px_rgba(0,0,0,.18)] outline-none"
      style={{ backgroundColor: color }}
    >
      {!order.paymentStatus && (
        <option value="" style={{ backgroundColor: "#fff", color: "#1e2b22" }}>—</option>
      )}
      {PAYMENT_STATUSES.map((s) => (
        <option key={s} value={s} style={{ backgroundColor: "#fff", color: "#1e2b22" }}>
          {PAYMENT_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

function AssignCell({ order, staff }: { order: OrderManagerRow; staff: AssignableStaff[] | undefined }) {
  const assign = useAssignOrder(order.id);
  return (
    <select
      value={order.assignedAdminId ?? ""}
      disabled={assign.isPending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => assign.mutate(e.target.value === "" ? null : Number(e.target.value))}
      className="h-9 rounded-[8px] border bg-transparent px-2 text-[0.72rem] font-semibold outline-none hover:bg-white focus:bg-white"
      style={{ borderColor: "transparent" }}
      onFocus={(e) => (e.currentTarget.style.borderColor = GREEN)}
    >
      <option value="">—</option>
      {(staff ?? []).map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

const SEND_PROVIDERS: { provider: "STEADFAST" | "REDX"; label: string; letter: string }[] = [
  { provider: "STEADFAST", label: "Steadfast", letter: "S" },
  { provider: "REDX", label: "RedX", letter: "R" },
];

function InternalNoteCell({ order, editing }: { order: OrderManagerRow; editing: boolean }) {
  const [value, setValue] = useState(order.staffNote ?? "");
  const updateNote = useUpdateOrderNote(order.id);

  if (!editing) return <ReadOnlyCell value={value} placeholder="Add a note..." width={160} />;

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

// Non-dropdown cells (Phone/Address/Internal Note/Source) are read-only
// until the row's Edit icon is clicked — typed fields sitting directly in
// the table were too easy to fat-finger while just scrolling/browsing.
// Dropdown cells (Status/Payment/Division) have no equivalent risk and stay
// directly editable at all times.
function ReadOnlyCell({ value, placeholder, width }: { value: string; placeholder?: string; width?: number }) {
  return (
    <span className="inline-block truncate px-2.5 align-middle text-[0.72rem] font-semibold" style={{ width, color: value ? TEXT : FAINT }} title={value || undefined}>
      {value || placeholder || "—"}
    </span>
  );
}

function PhoneCell({ order, editing }: { order: OrderManagerRow; editing: boolean }) {
  const [value, setValue] = useState(order.shippingPhone ?? "");
  const [error, setError] = useState(false);
  const updateDetails = useUpdateOrderDetails(order.id);

  function commit() {
    if (value === (order.shippingPhone ?? "")) return;
    if (!isValidBdPhone(value)) {
      setError(true);
      return;
    }
    setError(false);
    updateDetails.mutate({ phone: value });
  }

  if (!editing) return <ReadOnlyCell value={value} placeholder="Phone" width={128} />;

  return (
    <input
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        setError(false);
      }}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      placeholder="Phone"
      title={error ? "Enter a valid Bangladeshi mobile number, e.g. 01712345678" : undefined}
      className="h-9 w-32 rounded-[8px] border bg-transparent px-2.5 text-[0.72rem] font-semibold outline-none hover:bg-white focus:bg-white"
      style={{ borderColor: error ? "#e5484d" : "transparent" }}
      onFocus={(e) => !error && (e.currentTarget.style.borderColor = GREEN)}
    />
  );
}

function AddressCell({ order, editing }: { order: OrderManagerRow; editing: boolean }) {
  const [value, setValue] = useState(order.addressLine ?? "");
  const updateDetails = useUpdateOrderDetails(order.id);
  const title = [order.district, order.division, order.postCode].filter(Boolean).join(", ") || undefined;

  if (!editing) return <ReadOnlyCell value={value} placeholder="Address line" width={200} />;

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== (order.addressLine ?? "") && updateDetails.mutate({ addressLine: value })}
      onClick={(e) => e.stopPropagation()}
      placeholder="Address line"
      title={title}
      className="h-9 w-full rounded-[8px] border bg-transparent px-2.5 text-[0.72rem] font-semibold outline-none hover:bg-white focus:bg-white"
      style={{ borderColor: "transparent", minWidth: 200 }}
      onFocus={(e) => (e.currentTarget.style.borderColor = GREEN)}
    />
  );
}

const ORDER_SOURCES = ["facebook", "instagram", "whatsapp", "website", "Telisell", "localsell", "wholesell", "tiktok", "youtube"];

function SourceCell({ order }: { order: OrderManagerRow }) {
  const updateDetails = useUpdateOrderDetails(order.id);
  return (
    <select
      value={order.utmSource ?? ""}
      disabled={updateDetails.isPending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => updateDetails.mutate({ utmSource: e.target.value })}
      className="h-9 rounded-[8px] border bg-transparent px-2 text-[0.72rem] font-semibold outline-none hover:bg-white focus:bg-white"
      style={{ borderColor: "transparent" }}
      onFocus={(e) => (e.currentTarget.style.borderColor = GREEN)}
    >
      {!order.utmSource && <option value="">—</option>}
      {ORDER_SOURCES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

function PaymentCell({ order }: { order: OrderManagerRow }) {
  const updatePayment = useUpdateOrderPayment(order.id);
  return (
    <select
      value={(order.paymentProvider as PaymentProviderType) ?? ""}
      disabled={updatePayment.isPending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => updatePayment.mutate({ provider: e.target.value as PaymentProviderType })}
      className="h-9 rounded-[8px] border bg-transparent px-2 text-[0.72rem] font-semibold outline-none hover:bg-white focus:bg-white"
      style={{ borderColor: "transparent" }}
      onFocus={(e) => (e.currentTarget.style.borderColor = GREEN)}
    >
      {!order.paymentProvider && <option value="">—</option>}
      {PAYMENT_PROVIDER_TYPES.map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
    </select>
  );
}

function DivisionCell({ order }: { order: OrderManagerRow }) {
  const updateDetails = useUpdateOrderDetails(order.id);
  return (
    <select
      value={order.division ?? ""}
      disabled={updateDetails.isPending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => updateDetails.mutate({ division: e.target.value })}
      className="h-9 rounded-[8px] border bg-transparent px-2 text-[0.72rem] font-semibold outline-none hover:bg-white focus:bg-white"
      style={{ borderColor: "transparent" }}
      onFocus={(e) => (e.currentTarget.style.borderColor = GREEN)}
    >
      {!order.division && <option value="">—</option>}
      {BD_DIVISIONS.map((d) => (
        <option key={d} value={d}>{d}</option>
      ))}
    </select>
  );
}

// Sending a canceled/returned/held order to a courier makes no sense —
// there's nothing live left to ship (or, for HOLD, shipping is explicitly
// what staff paused). Disabled rather than hidden so the row's layout stays
// stable and it's visible *why* dispatch isn't available here.
const COURIER_SEND_DISABLED_STATUSES = new Set(["CANCELED", "RETURNED", "PARTIALLY_RETURNED", "HOLD"]);

function CourierSendCell({ order, onConsign }: { order: OrderManagerRow; onConsign: (provider: "STEADFAST" | "REDX") => void }) {
  const disabled = COURIER_SEND_DISABLED_STATUSES.has(order.status);
  return (
    <div className="flex flex-col gap-1">
      {SEND_PROVIDERS.map((sp) => (
        <button
          key={sp.provider}
          type="button"
          disabled={disabled}
          title={disabled ? `Can't dispatch — order is ${order.status.replace(/_/g, " ").toLowerCase()}` : undefined}
          onClick={() => onConsign(sp.provider)}
          className="rounded-[7px] border px-2 py-1 text-[0.68rem] font-bold disabled:cursor-not-allowed disabled:opacity-40"
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

const deleteIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);
const editIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);
const checkIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const restoreIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

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
  onDelete,
  onRestore,
  restoringId,
  staff,
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
  /** Present on the main (active-orders) table — renders a red trash icon per row. */
  onDelete?: (order: OrderManagerRow) => void;
  /** Present on the Deleted Orders tab's table — renders a Restore button per row instead. */
  onRestore?: (order: OrderManagerRow) => void;
  restoringId?: number | null;
  staff?: AssignableStaff[];
}) {
  const { data: statusConfigs } = useOrderStatusConfigs();
  const statusByKey = new Map((statusConfigs ?? []).map((s) => [s.status, s]));

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const colCount = 16 + columns.size;
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
              <TH>Actions</TH>
              <TH>Order Status</TH>
              {columns.has("paymentStatus") && <TH>Payment Status</TH>}
              <TH>Assign</TH>
              <TH style={{ minWidth: 230 }}>Products</TH>
              <TH>Total</TH>
              <TH>Phone</TH>
              <TH style={{ minWidth: 220 }}>Address</TH>
              <TH>Origin</TH>
              {columns.has("payment") && <TH>Payment</TH>}
              {columns.has("division") && <TH>Division</TH>}
              {columns.has("internalNote") && <TH>Internal Note</TH>}
              {columns.has("source") && <TH>Source</TH>}
              <TH>Invoice</TH>
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
            {orders.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                statusByKey={statusByKey}
                columns={columns}
                selected={selected.has(o.id)}
                onToggle={() => onToggle(o.id)}
                onView={onView}
                onConsign={onConsign}
                onCheckRisk={onCheckRisk}
                onDelete={onDelete}
                onRestore={onRestore}
                restoringId={restoringId}
                td={td}
                tdStyle={tdStyle}
                staff={staff}
              />
            ))}
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

function OrderRow({
  order: o,
  statusByKey,
  columns,
  selected,
  onToggle,
  onView,
  onConsign,
  onCheckRisk,
  onDelete,
  onRestore,
  restoringId,
  td,
  tdStyle,
  staff,
}: {
  order: OrderManagerRow;
  statusByKey: Map<string, { labelEn: string; color: string }>;
  columns: Set<OptionalColumn>;
  selected: boolean;
  onToggle: () => void;
  onView: (order: OrderManagerRow) => void;
  onConsign: (order: OrderManagerRow, provider: "STEADFAST" | "REDX") => void;
  onCheckRisk: (phone: string) => void;
  onDelete?: (order: OrderManagerRow) => void;
  onRestore?: (order: OrderManagerRow) => void;
  restoringId?: number | null;
  td: string;
  tdStyle: { color: string; borderColor: string; background: string };
  staff?: AssignableStaff[];
}) {
  const [editing, setEditing] = useState(false);
  const { date, time } = formatDate(o.createdAt);

  return (
    <tr className="[&:hover>td]:bg-[#f7fbf8]">
      <td className={td} style={{ ...tdStyle, position: "sticky", left: 0, zIndex: 6 }} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} className="h-[15px] w-[15px]" style={{ accentColor: GREEN }} />
      </td>
      <td className={td} style={{ ...tdStyle, position: "sticky", left: 42, zIndex: 6, boxShadow: "6px 0 8px -6px rgba(20,40,25,.14)" }}>
        <button type="button" className="group block text-left" onClick={() => onView(o)}>
          <span className="block font-bold text-[#2e7d43] transition-colors duration-150 group-hover:text-[#1d5230]">
            #{o.id} · {o.orderNumber}
          </span>
          <span className="mt-[3px] block text-[0.68rem] font-medium text-[#94a69a] transition-colors duration-150 group-hover:text-[#1d5230]">
            {o.recipientName ?? "—"}
          </span>
        </button>
      </td>
      <td className={td} style={tdStyle}>
        <div>{date}</div>
        <div className="text-[0.66rem]" style={{ color: FAINT }}>
          {time}
        </div>
      </td>
      <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-label={editing ? "Done editing" : "Edit"}
            title={editing ? "Done editing" : "Edit"}
            className="grid h-[29px] w-[29px] place-items-center rounded-[8px] border"
            style={editing ? { color: GREEN, borderColor: GREEN, background: "#e3f4e6" } : { color: FAINT, borderColor: "transparent" }}
          >
            {editing ? checkIcon : editIcon}
          </button>
          {onRestore && (
            <button
              type="button"
              disabled={restoringId === o.id}
              onClick={() => onRestore(o)}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[0.7rem] font-bold disabled:opacity-50"
              style={{ borderColor: GREEN, color: GREEN }}
            >
              {restoreIcon}
              {restoringId === o.id ? "Restoring…" : "Restore"}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label="Delete order"
              title="Delete order"
              onClick={() => onDelete(o)}
              className="grid h-8 w-8 place-items-center rounded-[8px] border text-[#e5484d] transition-colors duration-150 hover:bg-[#e5484d] hover:text-white"
              style={{ borderColor: "#f8ccd3" }}
            >
              {deleteIcon}
            </button>
          )}
        </div>
      </td>
      <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
        <StatusCell order={o} statusByKey={statusByKey} />
      </td>
      {columns.has("paymentStatus") && (
        <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
          <PaymentStatusCell order={o} />
        </td>
      )}
      <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
        <AssignCell order={o} staff={staff} />
      </td>
      {/* What was actually bought. An order can hold several lines, so each
          gets its own row inside the cell with an explicit qty — collapsing
          them to "3 items" would hide the one fact staff pick orders by.
          Capped at 3 with a "+N more" tail so a 12-line wholesale order
          cannot stretch the table row to a full screen. */}
      <td className={td} style={tdStyle}>
        {o.items.length === 0 ? (
          <span style={{ color: FAINT }}>—</span>
        ) : (
          <div className="flex flex-col gap-0.5">
            {o.items.slice(0, 3).map((it, i) => (
              <div key={i} className="flex items-baseline gap-1.5 leading-tight">
                <span className="shrink-0 font-bold" style={{ color: GREEN }}>
                  {it.quantity}&times;
                </span>
                <span className="truncate" title={it.sku ? `${it.name} (${it.sku})` : it.name}>
                  {it.name}
                </span>
              </div>
            ))}
            {o.items.length > 3 && (
              <span className="text-[0.66rem]" style={{ color: FAINT }}>
                +{o.items.length - 3} more
              </span>
            )}
          </div>
        )}
      </td>
      <td className={td} style={{ ...tdStyle, fontWeight: 700, color: INK }}>
        ৳{Number(o.totalAmount).toLocaleString()}
      </td>
      <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
        <PhoneCell order={o} editing={editing} />
      </td>
      <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
        <AddressCell order={o} editing={editing} />
      </td>
      <td className={td} style={{ ...tdStyle, color: FAINT, fontWeight: 500 }}>
        {o.origin}
      </td>
      {columns.has("payment") && (
        <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
          <PaymentCell order={o} />
        </td>
      )}
      {columns.has("division") && (
        <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
          <DivisionCell order={o} />
        </td>
      )}
      {columns.has("internalNote") && (
        <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
          <InternalNoteCell order={o} editing={editing} />
        </td>
      )}
      {columns.has("source") && (
        <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
          <SourceCell order={o} />
        </td>
      )}
      <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
        <a
          href={`/print/orders/${o.id}/invoice`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[0.7rem] font-bold"
          style={{ borderColor: LINE, color: TEXT }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9V2h12v7" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Invoice
        </a>
      </td>
      <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {/* The row already carried riskLevel and nothing ever showed it, so
              spotting a risky order meant clicking Check on every line. HIGH
              is the only level marked: colouring MEDIUM too would leave most
              of the table shouting and the genuinely bad ones no louder. */}
          {o.riskLevel === "HIGH" && (
            <span
              title="High risk — poor courier delivery history"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-rose-500/15 px-2 py-0.5 text-[0.68rem] font-bold text-rose-700 dark:text-rose-400"
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rose-600" />
              High risk
            </span>
          )}
          <Button type="button" variant="ghost" disabled={!o.shippingPhone} onClick={() => o.shippingPhone && onCheckRisk(o.shippingPhone)}>
            Check
          </Button>
        </div>
      </td>
      <td className={td} style={tdStyle} onClick={(e) => e.stopPropagation()}>
        <CourierSendCell order={o} onConsign={(provider) => onConsign(o, provider)} />
      </td>
      <td className={td} style={tdStyle}>
        <CourierStatusCell order={o} />
      </td>
    </tr>
  );
}

export { OPTIONAL_COLUMNS };
