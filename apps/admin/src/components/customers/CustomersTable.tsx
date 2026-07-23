"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useUpdateCustomer,
  type AdminCustomerListItem,
  type AssignableStaff,
  type CustomerListFilters,
} from "@/hooks/useCustomers";

const LINE = "#e5ebe6";
const INK = "#1e2b22";
const TEXT = "#374840";
const MUTED = "#64766b";
const FAINT = "#94a69a";
const GREEN = "#2e7d43";
const GREEN_HEADER = "#2f7d33";
const BLUE = "#2570eb";
const RED = "#e8465e";

const cellSelectStyle =
  "h-[30px] appearance-none rounded-[8px] border bg-white pr-6 pl-2.5 text-[0.7rem] font-bold outline-none cursor-pointer";
const chevronBg =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364766b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")";
const cellSelectStyleObj = { borderColor: LINE, color: TEXT, backgroundImage: chevronBg, backgroundRepeat: "no-repeat", backgroundPosition: "right 7px center" } as const;

const cellInputClass = "h-[30px] w-[150px] rounded-[8px] border border-transparent bg-transparent px-2.5 text-[0.72rem] font-semibold outline-none hover:border-[color:var(--line)] hover:bg-white focus:border-[color:var(--green)] focus:bg-white";

const PRIORITY_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  HIGH: { bg: "#feeaec", border: "#f8ccd3", color: RED },
  MEDIUM: { bg: "#fdf3dd", border: "#f3e2b3", color: "#c07d13" },
  LOW: { bg: "#e3f4e6", border: "#c8e8cf", color: "#1f7a33" },
};
const STATUS_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  NOT_STARTED: { bg: "#eef1ee", border: "#dde3de", color: "#6b7a70" },
  IN_PROGRESS: { bg: "#e4edfd", border: "#c9dbf9", color: BLUE },
  DONE: { bg: "#e3f4e6", border: "#c8e8cf", color: "#1f7a33" },
  FOLLOW_UP: { bg: "#fdf3dd", border: "#f3e2b3", color: "#c07d13" },
};
const PRIORITY_LABEL: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
const STATUS_LABEL: Record<string, string> = { NOT_STARTED: "Not Started", IN_PROGRESS: "In Progress", FOLLOW_UP: "Follow Up", DONE: "Done" };
const BEHAVIOUR_LABEL: Record<string, string> = { LOYAL: "Loyal", PRICE_SENSITIVE: "Price Sensitive", OCCASIONAL: "Occasional" };

function scoreBadgeStyle(score: number): { bg: string; color: string } {
  if (score >= 4) return { bg: "#e3f4e6", color: "#1f7a33" };
  if (score >= 3) return { bg: "#fdf3dd", color: "#c07d13" };
  return { bg: "#feeaec", color: RED };
}

// ponytail: fixed day thresholds, not tied to any configurable SLA — same
// "documented heuristic, tune later" approach as customer-score.util.ts on
// the backend.
function daysLeftColor(days: number): string {
  if (days <= 5) return RED;
  if (days <= 20) return "#c07d13";
  return "#1f7a33";
}

function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", opts).replace(/ /g, "-");
}

function toDateInputValue(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

const starIcon = (filled: boolean) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "#f5a623" : "#dfe5e0"}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const fbIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5V11H8.5v3H11v7Z" />
  </svg>
);
const eyeIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const editIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);

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

export function CustomersTable({
  customers,
  total,
  filters,
  onFiltersChange,
  staff,
  onView,
}: {
  customers: AdminCustomerListItem[];
  total: number;
  filters: CustomerListFilters;
  onFiltersChange: (next: CustomerListFilters) => void;
  staff?: AssignableStaff[];
  onView: (id: number) => void;
}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="overflow-hidden rounded-card border shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0" style={{ minWidth: 3400, width: "100%" }}>
          <thead>
            <tr>
              <TH sticky={1}>
                <input type="checkbox" className="h-[15px] w-[15px] accent-[color:var(--green)]" style={{ accentColor: GREEN }} />
              </TH>
              <TH sticky={2} style={{ minWidth: 200 }}>
                Name
              </TH>
              <TH>Fav</TH>
              <TH>B-Day</TH>
              <TH style={{ minWidth: 220 }}>Address</TH>
              <TH>Phone</TH>
              <TH style={{ minWidth: 190 }}>Email</TH>
              <TH>Order Count</TH>
              <TH style={{ minWidth: 190 }}>Product</TH>
              <TH>Assign To</TH>
              <TH>Start Date</TH>
              <TH>Last Order Date</TH>
              <TH>Next Call Target</TH>
              <TH>Days Left</TH>
              <TH>Expire Time</TH>
              <TH>New Order</TH>
              <TH>New Order Date</TH>
              <TH>Priority</TH>
              <TH>Status</TH>
              <TH>Behaviour</TH>
              <TH style={{ minWidth: 210 }}>Customer Feedback</TH>
              <TH style={{ minWidth: 210 }}>Amader Feedback</TH>
              <TH style={{ minWidth: 210 }}>Customer Family Details</TH>
              <TH style={{ minWidth: 190 }}>Purchase Reason</TH>
              <TH>F Score</TH>
              <TH>M Score</TH>
              <TH>RFM Score</TH>
              <TH>Facebook Profile</TH>
              <TH>Actions</TH>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={29} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                  No customers match these filters.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <CustomerRow key={c.id} customer={c} staff={staff} onView={onView} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3.5 border-t p-[13px_18px]" style={{ borderColor: LINE }}>
        <div className="text-[0.76rem] font-semibold" style={{ color: MUTED }}>
          {total === 0 ? "No customers" : `Showing ${start} to ${end} of ${total} customers`}
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
            {[10, 25, 50].map((s) => (
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

function CustomerRow({ customer: c, staff, onView }: { customer: AdminCustomerListItem; staff?: AssignableStaff[]; onView: (id: number) => void }) {
  const update = useUpdateCustomer(c.id);
  const [feedback, setFeedback] = useState(c.customerFeedback ?? "");
  const [amaderFeedback, setAmaderFeedback] = useState(c.amaderFeedback ?? "");
  const [family, setFamily] = useState(c.familyDetails ?? "");
  const [reason, setPurchaseReason] = useState(c.purchaseReason ?? "");
  const [fbUrl, setFbUrl] = useState(c.facebookProfileUrl ?? "");

  const daysLeft = c.nextCallTarget ? Math.ceil((new Date(c.nextCallTarget).getTime() - Date.now()) / 86_400_000) : null;
  const priorityStyle = c.priority ? PRIORITY_STYLE[c.priority] : PRIORITY_STYLE.MEDIUM;
  const statusStyle = c.crmStatus ? STATUS_STYLE[c.crmStatus] : STATUS_STYLE.NOT_STARTED;

  const td = "px-3 py-[11px] text-[0.76rem] font-semibold whitespace-nowrap align-middle border-b";
  const tdStyle = { color: TEXT, borderColor: "#eef3ef", background: "#fff" } as const;

  return (
    <tr className="[&:hover>td]:bg-[#f7fbf8]">
      <td className={td} style={{ ...tdStyle, position: "sticky", left: 0, zIndex: 6 }}>
        <input type="checkbox" className="h-[15px] w-[15px]" style={{ accentColor: GREEN }} />
      </td>
      <td className={td} style={{ ...tdStyle, position: "sticky", left: 42, zIndex: 6, boxShadow: "6px 0 8px -6px rgba(20,40,25,.14)" }}>
        <div className="font-bold whitespace-normal" style={{ color: INK }}>
          {c.name}
        </div>
        <div className="mt-[3px] text-[0.66rem] font-medium" style={{ color: FAINT }}>
          #CUST-{c.id} {c.tier ? `· ${c.tier}` : ""}
        </div>
      </td>
      <td className={td} style={tdStyle}>
        <button type="button" onClick={() => update.mutate({ isFavorite: !c.isFavorite })} aria-label="Toggle favorite">
          {starIcon(c.isFavorite)}
        </button>
      </td>
      <td className={td} style={tdStyle}>
        <input
          type="date"
          defaultValue={toDateInputValue(c.dob)}
          onChange={(e) => update.mutate({ dob: e.target.value || null })}
          className={cellInputClass}
          style={{ width: 140 }}
        />
      </td>
      <td className={td} style={tdStyle}>
        <span className="block overflow-hidden text-ellipsis whitespace-nowrap" style={{ maxWidth: 220 }} title={c.address ?? undefined}>
          {c.address ?? "—"}
        </span>
      </td>
      <td className={td} style={tdStyle}>
        {c.phone ?? "—"}
      </td>
      <td className={td} style={{ ...tdStyle, color: FAINT, fontWeight: 500 }}>
        {c.email ?? "—"}
      </td>
      <td className={td} style={{ ...tdStyle, fontWeight: 700, color: INK }}>
        {c.completedOrderCount}
      </td>
      <td className={td} style={tdStyle}>
        <span className="block overflow-hidden text-ellipsis whitespace-nowrap" style={{ maxWidth: 190 }} title={c.topProduct ?? undefined}>
          {c.topProduct ?? "—"}
        </span>
      </td>
      <td className={td} style={tdStyle}>
        <select
          value={c.assignedAdminId ?? ""}
          onChange={(e) => update.mutate({ assignedAdminId: e.target.value ? Number(e.target.value) : null })}
          className={cellSelectStyle}
          style={cellSelectStyleObj}
        >
          <option value="">—</option>
          {(staff ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </td>
      <td className={td} style={tdStyle}>
        {formatDate(c.createdAt)}
      </td>
      <td className={td} style={{ ...tdStyle, fontWeight: 700, color: INK }}>
        {formatDate(c.lastOrderDate)}
      </td>
      <td className={td} style={tdStyle}>
        <input
          type="date"
          defaultValue={toDateInputValue(c.nextCallTarget)}
          onChange={(e) => update.mutate({ nextCallTarget: e.target.value || null })}
          className={cellInputClass}
          style={{ width: 140 }}
        />
      </td>
      <td className={td} style={tdStyle}>
        {daysLeft !== null ? <span className="font-extrabold" style={{ color: daysLeftColor(daysLeft) }}>{daysLeft}</span> : <span style={{ color: FAINT }}>—</span>}
      </td>
      <td className={td} style={tdStyle}>
        <select
          value={c.followUpCadenceDays ?? ""}
          onChange={(e) => update.mutate({ followUpCadenceDays: e.target.value ? Number(e.target.value) : null })}
          className={cellSelectStyle}
          style={cellSelectStyleObj}
        >
          <option value="">—</option>
          <option value={7}>7 days</option>
          <option value={15}>15 days</option>
          <option value={30}>30 days</option>
        </select>
      </td>
      <td className={td} style={tdStyle}>
        <select
          value={c.hasNewOrder ? "yes" : "no"}
          onChange={(e) => update.mutate({ hasNewOrder: e.target.value === "yes" })}
          className={cellSelectStyle}
          style={cellSelectStyleObj}
        >
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </td>
      <td className={td} style={{ ...tdStyle, color: FAINT, fontWeight: 500 }}>
        {c.hasNewOrder ? (
          <input
            type="date"
            defaultValue={toDateInputValue(c.newOrderAt)}
            onChange={(e) => update.mutate({ newOrderAt: e.target.value || null })}
            className={cellInputClass}
            style={{ width: 140 }}
          />
        ) : (
          "—"
        )}
      </td>
      <td className={td} style={tdStyle}>
        <select
          value={c.priority ?? "MEDIUM"}
          onChange={(e) => update.mutate({ priority: e.target.value as never })}
          className={cellSelectStyle}
          style={{ background: priorityStyle.bg, borderColor: priorityStyle.border, color: priorityStyle.color }}
        >
          {Object.entries(PRIORITY_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className={td} style={tdStyle}>
        <select
          value={c.crmStatus ?? "NOT_STARTED"}
          onChange={(e) => update.mutate({ crmStatus: e.target.value as never })}
          className={cellSelectStyle}
          style={{ background: statusStyle.bg, borderColor: statusStyle.border, color: statusStyle.color }}
        >
          {Object.entries(STATUS_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className={td} style={tdStyle}>
        <select value={c.behaviour ?? ""} onChange={(e) => update.mutate({ behaviour: (e.target.value || null) as never })} className={cellSelectStyle} style={cellSelectStyleObj}>
          <option value="">—</option>
          {Object.entries(BEHAVIOUR_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className={td} style={tdStyle}>
        <input
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          onBlur={() => feedback !== (c.customerFeedback ?? "") && update.mutate({ customerFeedback: feedback })}
          placeholder="Add feedback..."
          className={cellInputClass}
          style={{ width: 190 }}
        />
      </td>
      <td className={td} style={tdStyle}>
        <input
          value={amaderFeedback}
          onChange={(e) => setAmaderFeedback(e.target.value)}
          onBlur={() => amaderFeedback !== (c.amaderFeedback ?? "") && update.mutate({ amaderFeedback })}
          placeholder="Add note..."
          className={cellInputClass}
          style={{ width: 190 }}
        />
      </td>
      <td className={td} style={tdStyle}>
        <input
          value={family}
          onChange={(e) => setFamily(e.target.value)}
          onBlur={() => family !== (c.familyDetails ?? "") && update.mutate({ familyDetails: family })}
          placeholder="Add details..."
          className={cellInputClass}
          style={{ width: 190 }}
        />
      </td>
      <td className={td} style={tdStyle}>
        <input
          value={reason}
          onChange={(e) => setPurchaseReason(e.target.value)}
          onBlur={() => reason !== (c.purchaseReason ?? "") && update.mutate({ purchaseReason: reason })}
          placeholder="Reason..."
          className={cellInputClass}
        />
      </td>
      <td className={td} style={tdStyle}>
        <span className="inline-flex h-6 min-w-[26px] items-center justify-center rounded-[7px] px-[7px] text-[0.7rem] font-extrabold" style={{ background: scoreBadgeStyle(c.fScore).bg, color: scoreBadgeStyle(c.fScore).color }}>
          {c.fScore}
        </span>
      </td>
      <td className={td} style={tdStyle}>
        <span className="inline-flex h-6 min-w-[26px] items-center justify-center rounded-[7px] px-[7px] text-[0.7rem] font-extrabold" style={{ background: scoreBadgeStyle(c.mScore).bg, color: scoreBadgeStyle(c.mScore).color }}>
          {c.mScore}
        </span>
      </td>
      <td className={td} style={tdStyle}>
        <span className="inline-flex h-6 min-w-[26px] items-center justify-center rounded-[7px] px-[7px] text-[0.7rem] font-extrabold text-white" style={{ background: GREEN }}>
          {c.rfmScore}
        </span>
      </td>
      <td className={td} style={tdStyle}>
        <div className="flex items-center gap-1.5">
          <input
            value={fbUrl}
            onChange={(e) => setFbUrl(e.target.value)}
            onBlur={() => fbUrl !== (c.facebookProfileUrl ?? "") && update.mutate({ facebookProfileUrl: fbUrl })}
            placeholder="Profile URL..."
            className={cellInputClass}
            style={{ width: 130 }}
          />
          {c.facebookProfileUrl && (
            <a href={c.facebookProfileUrl} target="_blank" rel="noreferrer" style={{ color: BLUE }} aria-label="Open Facebook profile">
              {fbIcon}
            </a>
          )}
        </div>
      </td>
      <td className={td} style={tdStyle}>
        <div className="flex items-center gap-[5px]">
          <button
            type="button"
            onClick={() => onView(c.id)}
            aria-label="View"
            className="grid h-[29px] w-[29px] place-items-center rounded-[8px] border border-transparent hover:border-[color:var(--line)]"
            style={{ color: FAINT }}
            onMouseEnter={(e) => (e.currentTarget.style.color = GREEN)}
            onMouseLeave={(e) => (e.currentTarget.style.color = FAINT)}
          >
            {eyeIcon}
          </button>
          <Link
            href={`/customers/${c.id}`}
            aria-label="Edit"
            className="grid h-[29px] w-[29px] place-items-center rounded-[8px] border border-transparent hover:border-[color:var(--line)]"
            style={{ color: FAINT }}
            onMouseEnter={(e) => (e.currentTarget.style.color = GREEN)}
            onMouseLeave={(e) => (e.currentTarget.style.color = FAINT)}
          >
            {editIcon}
          </Link>
        </div>
      </td>
    </tr>
  );
}
