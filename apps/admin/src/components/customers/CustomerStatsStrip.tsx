import type { CustomerStats } from "@/hooks/useCustomers";

// Reference's own green palette (amader-customers.html), scoped to this
// feature's components — same "one-off literal hex, not the shared blue
// theme" approach used for Overview/Products' hand-matched cards.
const GREEN = "#2e7d43";
const GREEN_SOFT = "#e8f4ea";
const GREEN_SOFT_2 = "#dff0e2";
const INK = "#1e2b22";
const MUTED = "#64766b";

const peopleIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const newPersonIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

const activityIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const repeatIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <polyline points="21 3 21 9 15 9" />
  </svg>
);

const bagIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const trendArrow = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="8 7 17 7 17 16" />
  </svg>
);

function Stat({ label, value, trendPct, icon }: { label: string; value: string; trendPct?: number | null; icon: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-card border p-[17px_19px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: "#e5ebe6" }}>
      <div>
        <div className="text-[0.75rem] font-semibold" style={{ color: MUTED }}>
          {label}
        </div>
        <div className="mt-[7px] text-[1.42rem] font-extrabold tracking-tight" style={{ color: INK }}>
          {value}
        </div>
        {trendPct !== undefined && trendPct !== null && (
          <div className="mt-[9px] flex items-center gap-[5px] text-[0.68rem] font-bold" style={{ color: GREEN }}>
            {trendArrow}
            {Math.abs(trendPct).toFixed(2)}% this month
          </div>
        )}
      </div>
      <div className="grid h-12 w-12 flex-none place-items-center rounded-full border" style={{ background: GREEN_SOFT, color: GREEN, borderColor: GREEN_SOFT_2 }}>
        {icon}
      </div>
    </div>
  );
}

export function CustomerStatsStrip({ stats }: { stats?: CustomerStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <Stat label="Total Customers" value={(stats?.totalCustomers ?? 0).toLocaleString()} trendPct={stats?.totalCustomersTrendPct} icon={peopleIcon} />
      <Stat label="New Customers" value={(stats?.newCustomersThisMonth ?? 0).toLocaleString()} trendPct={stats?.newCustomersTrendPct} icon={newPersonIcon} />
      <Stat label="Active Customers" value={(stats?.activeCustomers ?? 0).toLocaleString()} icon={activityIcon} />
      <Stat label="Repeat Customers" value={(stats?.repeatCustomers ?? 0).toLocaleString()} icon={repeatIcon} />
      <Stat label="Average Order Value" value={`৳ ${Math.round(stats?.averageOrderValue ?? 0).toLocaleString()}`} icon={bagIcon} />
    </div>
  );
}
