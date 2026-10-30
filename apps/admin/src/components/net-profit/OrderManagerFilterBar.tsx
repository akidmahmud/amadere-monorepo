"use client";

import { useEffect, useRef, useState } from "react";
import { ORDER_SOURCES } from "@amader/shared";
import { ORDER_CHANNELS, ORDER_CHANNEL_LABELS } from "@/hooks/useOrders";
import type { AssignableStaff } from "@/hooks/useCustomers";
import type { RiskLevel } from "@/hooks/useFraud";
import type { OrderManagerFilters } from "@/hooks/useOrderManager";
import type { OrderStatusConfig } from "@/hooks/useOrderStatuses";

// Same visual language as CustomerFilters.tsx — one consolidated row instead
// of this page's old status-pills + bulk-bar + collapsible "more filters"
// stack of three separate cards.
const LINE = "#e5ebe6";
const MUTED = "#64766b";
const FAINT = "#94a69a";

const selectClass = "h-[38px] appearance-none rounded-[9px] border bg-white px-2.5 pr-7 text-[0.75rem] font-semibold outline-none";
const selectStyle = {
  borderColor: LINE,
  color: MUTED,
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364766b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 9px center",
} as const;

const PAYMENT_PROVIDERS = ["COD", "BKASH", "NAGAD", "SSLCOMMERZ", "BANK_TRANSFER"];
const COURIER_PROVIDERS = ["STEADFAST", "PATHAO", "REDX", "ECOURIER"];
const RISK_LEVELS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"];
// Hour presets sit above the day ones so the common "what's come in since
// I last looked" case is the first thing in the list. "Custom" is a real
// datetime range (not date-only) — an ad campaign or a courier cutoff is
// frequently a few hours inside one day, which whole-day filtering can't
// express.
/** Exported so the stat cards can name the window they are reporting on. */
export const DATE_RANGES = [
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

export interface OrderFilterState {
  q: string;
  status?: string;
  /** Only Exchange orders (any status); chosen from the status menu. */
  exchange?: boolean;
  paymentProvider?: string;
  courierProvider?: string;
  /** Multi-select filters below hold their picks comma-joined ("COD,BKASH"). */
  risk?: string;
  /** An admin id as a string, or "none" for orders nobody has picked up. */
  assignedAdminId?: string;
  division?: string;
  channel?: string;
  utmSource?: string;
  dateRange?: string;
  dateFrom?: string;
  dateTo?: string;
}

const split = (v?: string) => (v ? v.split(",") : []);
const join = (v: string[]) => (v.length ? v.join(",") : undefined);
const plain = (v: string) => ({ value: v, label: v });

/** Dropdown of checkboxes; nothing ticked = no filter. */
function MultiSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const picked = options.filter((o) => value.includes(o.value));
  const text =
    picked.length === 0 ? label : picked.length === 1 ? picked[0].label : `${picked[0].label} +${picked.length - 1}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${selectClass} max-w-[170px] truncate text-left`}
        style={{ ...selectStyle, ...(picked.length ? { borderColor: "#2e7d32", color: "#1b5e20" } : {}) }}
      >
        {text}
      </button>
      {open && (
        <div
          className="absolute left-0 top-[42px] z-30 max-h-72 min-w-[190px] overflow-y-auto rounded-[9px] border bg-white py-1 shadow-lg"
          style={{ borderColor: LINE }}
        >
          {picked.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="block w-full px-3 py-1.5 text-left text-[0.72rem] font-semibold text-red-600 hover:bg-gray-50">
              Clear
            </button>
          )}
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[0.75rem] hover:bg-gray-50" style={{ color: "#374840" }}>
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-green-700"
                checked={value.includes(o.value)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))
                }
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderManagerFilterBar({
  filters,
  onChange,
  onReset,
  statuses,
  staff,
}: {
  filters: OrderFilterState;
  onChange: (next: OrderFilterState) => void;
  onReset: () => void;
  statuses: OrderStatusConfig[];
  staff: AssignableStaff[];
}) {
  function set<K extends keyof OrderFilterState>(key: K, value: OrderFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-card border p-[14px_16px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
      <div className="relative w-[230px]">
        <input
          type="text"
          placeholder="Search by ID, name, email, phone..."
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          className="h-[38px] w-full rounded-[9px] border py-0 pr-[34px] pl-3 text-[0.76rem] outline-none"
          style={{ borderColor: LINE, color: "#374840" }}
        />
        <svg className="pointer-events-none absolute top-1/2 right-[11px] -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>

      <MultiSelect
        label="All Statuses"
        // "Exchange" is a filter across statuses, not a status itself.
        value={[...split(filters.status), ...(filters.exchange ? ["EXCHANGE"] : [])]}
        onChange={(v) =>
          onChange({
            ...filters,
            status: join(v.filter((x) => x !== "EXCHANGE")),
            exchange: v.includes("EXCHANGE") || undefined,
          })
        }
        options={[
          ...[...statuses].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => ({ value: s.status, label: s.labelEn })),
          { value: "EXCHANGE", label: "Exchange" },
        ]}
      />

      <MultiSelect label="All Payments" value={split(filters.paymentProvider)} onChange={(v) => set("paymentProvider", join(v))} options={PAYMENT_PROVIDERS.map(plain)} />

      <MultiSelect label="All Couriers" value={split(filters.courierProvider)} onChange={(v) => set("courierProvider", join(v))} options={COURIER_PROVIDERS.map(plain)} />

      <MultiSelect label="All Risk Levels" value={split(filters.risk)} onChange={(v) => set("risk", join(v))} options={RISK_LEVELS.map(plain)} />

      {/* "Unassigned" is a real option: nothing ticked already means
          "don't filter", so without it there is no way to ask for the pile
          nobody has picked up yet. */}
      <MultiSelect
        label="All Staff"
        value={split(filters.assignedAdminId)}
        onChange={(v) => set("assignedAdminId", join(v))}
        options={[{ value: "none", label: "Unassigned" }, ...staff.map((s) => ({ value: String(s.id), label: s.name }))]}
      />

      {/* Origin reads Order.channel, the same field the detail modal edits, so
          this filter and the Origin column can never disagree. */}
      <MultiSelect
        label="All Origins"
        value={split(filters.channel)}
        onChange={(v) => set("channel", join(v))}
        options={ORDER_CHANNELS.map((c) => ({ value: c, label: ORDER_CHANNEL_LABELS[c] }))}
      />

      {/* Matches the Source COLUMN's reading, not the raw string: picking
          facebook also finds fb / m.facebook.com, and never the paid markers.
          "No source" is its own option for the same reason "Unassigned" is. */}
      <MultiSelect
        label="All Sources"
        value={split(filters.utmSource)}
        onChange={(v) => set("utmSource", join(v))}
        options={[{ value: "none", label: "No source" }, ...ORDER_SOURCES.map(plain)]}
      />

      <input
        type="text"
        placeholder="Division"
        value={filters.division ?? ""}
        onChange={(e) => set("division", e.target.value || undefined)}
        className="h-[38px] w-[110px] rounded-[9px] border px-2.5 text-[0.76rem] outline-none"
        style={{ borderColor: LINE, color: "#374840" }}
      />

      <select value={filters.dateRange ?? ""} onChange={(e) => set("dateRange", e.target.value || undefined)} className={selectClass} style={selectStyle}>
        {DATE_RANGES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      {filters.dateRange === "custom" && (
        <>
          {/* datetime-local, not date — picking a time is the whole point of
              a custom range here. resolveDateRange (page.tsx) still accepts
              a bare "YYYY-MM-DD" and widens it to the full day, so any
              previously-saved date-only value keeps working. */}
          <input
            type="datetime-local"
            value={filters.dateFrom ?? ""}
            onChange={(e) => set("dateFrom", e.target.value || undefined)}
            className="h-[38px] rounded-[9px] border px-2.5 text-[0.76rem] outline-none"
            style={{ borderColor: LINE, color: "#374840" }}
          />
          <span style={{ color: FAINT }}>to</span>
          <input
            type="datetime-local"
            value={filters.dateTo ?? ""}
            onChange={(e) => set("dateTo", e.target.value || undefined)}
            className="h-[38px] rounded-[9px] border px-2.5 text-[0.76rem] outline-none"
            style={{ borderColor: LINE, color: "#374840" }}
          />
        </>
      )}

      <button
        type="button"
        onClick={onReset}
        className="ml-auto inline-flex h-10 items-center gap-2 rounded-[10px] border px-[15px] text-[0.8rem] font-bold"
        style={{ borderColor: LINE, color: "#374840" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
        Reset
      </button>
    </div>
  );
}
