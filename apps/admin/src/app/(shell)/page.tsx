"use client";

import Link from "next/link";
import { Skeleton } from "@amader/admin-ui";
import { useDashboardOverview, type GlobalDashboardOverview, type StaffDashboardOverview } from "@/hooks/useDashboard";
import { OverviewCharts } from "@/components/overview/OverviewCharts";
import { RecentOrdersTable, TopCustomersTable } from "@/components/overview/OverviewTables";

// Mirrors the real grid below (9 stat cards + Quick Actions + charts + two
// tables) rather than a generic placeholder, so the loading state doesn't
// visually jump around once the real content replaces it.
function StatCardSkeleton() {
  return (
    <div className="flex min-h-[118px] items-start justify-between gap-3.5 rounded-card border border-border bg-surface p-[22px] shadow-card">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <Skeleton className="h-[46px] w-[46px] shrink-0 rounded-inner" />
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <div className="rounded-card border border-border bg-surface p-5 lg:row-span-3">
        <Skeleton className="mb-4 h-4 w-28" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[78px] rounded-inner" />
          ))}
        </div>
      </div>

      <div className="lg:col-span-4">
        <Skeleton className="h-[300px] w-full rounded-card" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:col-span-4 lg:grid-cols-2">
        <Skeleton className="h-[280px] rounded-card" />
        <Skeleton className="h-[280px] rounded-card" />
      </div>
    </div>
  );
}

function plusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function StatCard({ label, value, sub, bg, fg, icon }: { label: string; value: string; sub?: string; bg: string; fg: string; icon: React.ReactNode }) {
  return (
    <div className="flex min-h-[118px] items-start justify-between gap-3.5 rounded-card border border-border bg-surface p-[22px] shadow-card">
      <div>
        <div className="font-ui text-[11px] font-bold tracking-wide text-secondary uppercase">{label}</div>
        <div className="mt-2 font-ui text-2xl font-extrabold text-text">{value}</div>
        {sub && <div className="mt-2 text-xs font-semibold text-muted">{sub}</div>}
      </div>
      <div className="grid h-[46px] w-[46px] flex-none place-items-center rounded-inner" style={{ background: bg, color: fg }}>
        {icon}
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: "Create Sale", href: "/orders/new", bg: "#2570eb" },
  { label: "Create Product", href: "/products/new", bg: "#ef3a3a" },
  { label: "Add Customer", href: "/customers/new", bg: "#f7941d" },
  { label: "Add Membership Tier", href: "/customers/tiers", bg: "#12b394" },
  { label: "New Discount", href: "/discounts", bg: "#7c4dff" },
  { label: "Write Blog", href: "/blog-posts/new", bg: "#3a4356" },
];

const icon = (paths: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);

// A staff member's own workload — counts only, no revenue figures (the
// user explicitly wants staff not to see Lifetime Sales/Total Revenue/Today
// Revenue/Average Order Value/Completed & Pending revenue). Just what's
// assigned to them and the status breakdown of it.
function StaffOverviewView({ data }: { data: StaffDashboardOverview }) {
  const statusCount = (status: string) => data.myAssignedOrdersByStatus.find((s) => s.status === status)?.count ?? 0;
  const pending = statusCount("PENDING") + statusCount("HOLD");
  const processing = statusCount("CONFIRMED") + statusCount("PROCESSING");
  const completed = statusCount("COMPLETED");
  const canceled = statusCount("CANCELED") + statusCount("RETURNED") + statusCount("PARTIALLY_RETURNED");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3">
        <StatCard
          label="My Assigned Orders"
          value={String(data.myAssignedOrdersTotal)}
          bg="var(--stat-blue-bg)"
          fg="var(--stat-blue)"
          icon={icon(<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>)}
        />
        <StatCard
          label="Assigned Today"
          value={String(data.myAssignedOrdersToday)}
          bg="var(--stat-green-bg)"
          fg="var(--stat-green)"
          icon={icon(<><line x1="6" y1="20" x2="6" y2="14" /><line x1="12" y1="20" x2="12" y2="8" /><line x1="18" y1="20" x2="18" y2="11" /><line x1="3" y1="20" x2="21" y2="20" /></>)}
        />
        <StatCard
          label="My Customers"
          value={String(data.myAssignedCustomersTotal)}
          bg="var(--stat-red-bg)"
          fg="var(--stat-red)"
          icon={icon(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>)}
        />
        <StatCard label="Pending" value={String(pending)} bg="var(--stat-yellow-bg)" fg="var(--stat-yellow)" icon={icon(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>)} />
        <StatCard label="Processing" value={String(processing)} bg="var(--stat-purple-bg)" fg="var(--stat-purple)" icon={icon(<><rect x="1" y="3" width="15" height="13" /><path d="M16 8h4l3 3v5h-7V8Z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>)} />
        <StatCard label="Completed" value={String(completed)} bg="var(--stat-teal-bg)" fg="var(--stat-teal)" icon={icon(<><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>)} />
        {canceled > 0 && (
          <StatCard label="Canceled / Returned" value={String(canceled)} bg="var(--stat-indigo-bg)" fg="var(--stat-indigo)" icon={icon(<><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>)} />
        )}
      </div>

      <div className="rounded-card border border-border bg-surface p-5 lg:row-span-3">
        <div className="mb-4 font-ui text-base font-extrabold text-text">Quick Actions</div>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              style={{ background: a.bg }}
              className="flex h-[78px] flex-col items-center justify-center gap-1.5 rounded-inner text-center font-ui text-[13px] font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              {plusIcon()}
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="lg:col-span-4">
        <RecentOrdersTable data={data} />
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { data, isLoading, error } = useDashboardOverview();

  if (isLoading || !data) {
    return <OverviewSkeleton />;
  }
  if (error) {
    return <p className="text-sm text-danger">Failed to load dashboard.</p>;
  }
  if (data.scope === "staff") {
    return <StaffOverviewView data={data as StaffDashboardOverview} />;
  }

  const g = data as GlobalDashboardOverview;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3">
        <StatCard
          label="Today's Orders"
          value={String(g.today.orders)}
          sub={`${g.today.orders} Orders`}
          bg="var(--stat-green-bg)"
          fg="var(--stat-green)"
          icon={icon(<><line x1="6" y1="20" x2="6" y2="14" /><line x1="12" y1="20" x2="12" y2="8" /><line x1="18" y1="20" x2="18" y2="11" /><line x1="3" y1="20" x2="21" y2="20" /></>)}
        />
        <StatCard
          label="Lifetime Sales"
          value={`৳ ${Number(g.totalRevenue).toLocaleString()}`}
          sub={`${g.totalOrders} Orders`}
          bg="var(--stat-blue-bg)"
          fg="var(--stat-blue)"
          icon={icon(<><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>)}
        />
        <StatCard
          label="Completed Orders"
          value={`৳ ${Number(g.completed.revenue).toLocaleString()}`}
          sub={`${g.completed.orders} Orders`}
          bg="var(--stat-orange-bg)"
          fg="var(--stat-orange)"
          icon={icon(<><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>)}
        />

        <StatCard label="Total Products" value={String(g.totalProducts)} bg="var(--stat-yellow-bg)" fg="var(--stat-yellow)" icon={icon(<><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>)} />
        <StatCard label="Total Customers" value={String(g.totalCustomers)} bg="var(--stat-red-bg)" fg="var(--stat-red)" icon={icon(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>)} />
        <StatCard label="Today Revenue" value={`৳ ${Number(g.today.revenue).toLocaleString()}`} bg="var(--stat-purple-bg)" fg="var(--stat-purple)" icon={icon(<><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 6v2" /><path d="M12 16v2" /></>)} />

        <StatCard label="Average Order Value" value={`৳ ${Number(g.avgOrderValue).toLocaleString()}`} bg="var(--stat-indigo-bg)" fg="var(--stat-indigo)" icon={icon(<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6" /><path d="M9 16h6" /></>)} />
        <StatCard label="Total Revenue" value={`৳ ${Number(g.totalRevenue).toLocaleString()}`} bg="var(--stat-green-bg)" fg="var(--stat-green)" icon={icon(<><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></>)} />
        <StatCard
          label="Pending Orders"
          value={`৳ ${Number(g.pending.revenue).toLocaleString()}`}
          sub={`${g.pending.orders} Orders`}
          bg="var(--stat-teal-bg)"
          fg="var(--stat-teal)"
          icon={icon(<><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>)}
        />
      </div>

      <div className="rounded-card border border-border bg-surface p-5 lg:row-span-3">
        <div className="mb-4 font-ui text-base font-extrabold text-text">Quick Actions</div>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              style={{ background: a.bg }}
              className="flex h-[78px] flex-col items-center justify-center gap-1.5 rounded-inner text-center font-ui text-[13px] font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              {plusIcon()}
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="lg:col-span-4">
        <OverviewCharts data={g} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:col-span-4 lg:grid-cols-2">
        <RecentOrdersTable data={g} />
        <TopCustomersTable data={g} />
      </div>
    </div>
  );
}
