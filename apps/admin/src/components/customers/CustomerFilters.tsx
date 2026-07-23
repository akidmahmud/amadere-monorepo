import type { AssignableStaff, CustomerCrmStatus, CustomerPriority, CustomerTier } from "@/hooks/useCustomers";

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

const DISTRICTS = ["Dhaka", "Cumilla", "Gazipur", "Sylhet", "Chattogram"];

export interface CustomerFilterState {
  q: string;
  tierId?: number;
  crmStatus?: CustomerCrmStatus;
  district?: string;
  priority?: CustomerPriority;
  assignedAdminId?: number;
  birthdayToday?: boolean;
}

export function CustomerFilters({
  filters,
  onChange,
  onReset,
  tiers,
  staff,
}: {
  filters: CustomerFilterState;
  onChange: (next: CustomerFilterState) => void;
  onReset: () => void;
  tiers?: CustomerTier[];
  staff?: AssignableStaff[];
}) {
  function set<K extends keyof CustomerFilterState>(key: K, value: CustomerFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-card border p-[14px_16px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
      <div className="relative w-[210px]">
        <input
          type="text"
          placeholder="Search customers..."
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

      <select value={filters.tierId ?? ""} onChange={(e) => set("tierId", e.target.value ? Number(e.target.value) : undefined)} className={selectClass} style={selectStyle}>
        <option value="">All Customer Groups</option>
        {(tiers ?? []).map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>

      <select value={filters.crmStatus ?? ""} onChange={(e) => set("crmStatus", (e.target.value || undefined) as CustomerCrmStatus | undefined)} className={selectClass} style={selectStyle}>
        <option value="">All Status</option>
        <option value="NOT_STARTED">Not Started</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="FOLLOW_UP">Follow Up</option>
        <option value="DONE">Done</option>
      </select>

      <select value={filters.district ?? ""} onChange={(e) => set("district", e.target.value || undefined)} className={selectClass} style={selectStyle}>
        <option value="">All Cities</option>
        {DISTRICTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <select value={filters.priority ?? ""} onChange={(e) => set("priority", (e.target.value || undefined) as CustomerPriority | undefined)} className={selectClass} style={selectStyle}>
        <option value="">All Priorities</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
      </select>

      <select value={filters.assignedAdminId ?? ""} onChange={(e) => set("assignedAdminId", e.target.value ? Number(e.target.value) : undefined)} className={selectClass} style={selectStyle}>
        <option value="">Assigned To: Anyone</option>
        {(staff ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => set("birthdayToday", filters.birthdayToday ? undefined : true)}
        className="inline-flex h-10 items-center gap-2 rounded-[10px] border px-[15px] text-[0.8rem] font-bold"
        style={
          filters.birthdayToday
            ? { borderColor: "#f5a623", background: "#fdf3dd", color: "#c07d13" }
            : { borderColor: LINE, color: "#374840" }
        }
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
          <path d="M4 16h16" />
          <path d="M12 8v5" />
          <path d="M12 8a1.5 1.5 0 1 0-1.14-2.474C10.28 6.202 10 8 10 8Z" />
          <path d="M12 8a1.5 1.5 0 1 1 1.14-2.474C13.72 6.202 14 8 14 8Z" />
        </svg>
        Birthday Today
      </button>

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
