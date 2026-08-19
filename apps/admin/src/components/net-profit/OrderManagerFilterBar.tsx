"use client";

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

export interface OrderFilterState {
  q: string;
  status?: string;
  paymentProvider?: string;
  courierProvider?: string;
  risk?: RiskLevel;
  division?: string;
  dateRange?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function OrderManagerFilterBar({
  filters,
  onChange,
  onReset,
  statuses,
}: {
  filters: OrderFilterState;
  onChange: (next: OrderFilterState) => void;
  onReset: () => void;
  statuses: OrderStatusConfig[];
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

      <select value={filters.status ?? ""} onChange={(e) => set("status", e.target.value || undefined)} className={selectClass} style={selectStyle}>
        <option value="">All Statuses</option>
        {[...statuses].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => (
          <option key={s.status} value={s.status}>
            {s.labelEn}
          </option>
        ))}
      </select>

      <select value={filters.paymentProvider ?? ""} onChange={(e) => set("paymentProvider", e.target.value || undefined)} className={selectClass} style={selectStyle}>
        <option value="">All Payments</option>
        {PAYMENT_PROVIDERS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <select value={filters.courierProvider ?? ""} onChange={(e) => set("courierProvider", e.target.value || undefined)} className={selectClass} style={selectStyle}>
        <option value="">All Couriers</option>
        {COURIER_PROVIDERS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select value={filters.risk ?? ""} onChange={(e) => set("risk", (e.target.value || undefined) as RiskLevel | undefined)} className={selectClass} style={selectStyle}>
        <option value="">All Risk Levels</option>
        {RISK_LEVELS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

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
