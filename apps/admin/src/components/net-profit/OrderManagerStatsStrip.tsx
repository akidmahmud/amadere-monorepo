// Same visual language as CustomerStatsStrip.tsx (amader-customers.html's
// palette) — this page is being pulled out of the violet Net Profit/WPFOK
// theme to match the plain Customers page look, so it reuses that exact
// component shape rather than the wpfok stat-card variants.
const GREEN = "#2e7d43";
const GREEN_SOFT = "#e8f4ea";
const GREEN_SOFT_2 = "#dff0e2";
const INK = "#1e2b22";
const MUTED = "#64766b";

const ordersIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);
const clockIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const truckIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" />
    <path d="M16 8h4l3 3v5h-7V8Z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const checkIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const cancelIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-card border p-[17px_19px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: "#e5ebe6" }}>
      <div>
        <div className="text-[0.75rem] font-semibold" style={{ color: MUTED }}>
          {label}
        </div>
        <div className="mt-[7px] text-[1.42rem] font-extrabold tracking-tight" style={{ color: INK }}>
          {value}
        </div>
      </div>
      <div className="grid h-12 w-12 flex-none place-items-center rounded-full border" style={{ background: GREEN_SOFT, color: GREEN, borderColor: GREEN_SOFT_2 }}>
        {icon}
      </div>
    </div>
  );
}

export function OrderManagerStatsStrip({
  total,
  pending,
  processing,
  completed,
  canceled,
}: {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  canceled: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <Stat label="Total Orders" value={total.toLocaleString()} icon={ordersIcon} />
      <Stat label="Pending" value={pending.toLocaleString()} icon={clockIcon} />
      <Stat label="Processing" value={processing.toLocaleString()} icon={truckIcon} />
      <Stat label="Completed" value={completed.toLocaleString()} icon={checkIcon} />
      <Stat label="Canceled" value={canceled.toLocaleString()} icon={cancelIcon} />
    </div>
  );
}
