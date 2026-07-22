"use client";

import Link from "next/link";
import { useDashboardOverview } from "@/hooks/useDashboard";
import { OverviewCharts } from "@/components/overview/OverviewCharts";
import { RecentOrdersTable, TopCustomersTable } from "@/components/overview/OverviewTables";

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

export default function OverviewPage() {
  const { data, isLoading, error } = useDashboardOverview();

  if (isLoading || !data) {
    return <p className="text-sm text-muted">Loading…</p>;
  }
  if (error) {
    return <p className="text-sm text-danger">Failed to load dashboard.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3">
        <StatCard
          label="Today's Orders"
          value={String(data.today.orders)}
          sub={`${data.today.orders} Orders`}
          bg="var(--stat-green-bg)"
          fg="var(--stat-green)"
          icon={icon(<><line x1="6" y1="20" x2="6" y2="14" /><line x1="12" y1="20" x2="12" y2="8" /><line x1="18" y1="20" x2="18" y2="11" /><line x1="3" y1="20" x2="21" y2="20" /></>)}
        />
        <StatCard
          label="Lifetime Sales"
          value={`৳ ${Number(data.totalRevenue).toLocaleString()}`}
          sub={`${data.totalOrders} Orders`}
          bg="var(--stat-blue-bg)"
          fg="var(--stat-blue)"
          icon={icon(<><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>)}
        />
        <StatCard
          label="Completed Orders"
          value={`৳ ${Number(data.completed.revenue).toLocaleString()}`}
          sub={`${data.completed.orders} Orders`}
          bg="var(--stat-orange-bg)"
          fg="var(--stat-orange)"
          icon={icon(<><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>)}
        />

        <StatCard label="Total Products" value={String(data.totalProducts)} bg="var(--stat-yellow-bg)" fg="var(--stat-yellow)" icon={icon(<><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>)} />
        <StatCard label="Total Customers" value={String(data.totalCustomers)} bg="var(--stat-red-bg)" fg="var(--stat-red)" icon={icon(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>)} />
        <StatCard label="Today Revenue" value={`৳ ${Number(data.today.revenue).toLocaleString()}`} bg="var(--stat-purple-bg)" fg="var(--stat-purple)" icon={icon(<><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 6v2" /><path d="M12 16v2" /></>)} />

        <StatCard label="Average Order Value" value={`৳ ${Number(data.avgOrderValue).toLocaleString()}`} bg="var(--stat-indigo-bg)" fg="var(--stat-indigo)" icon={icon(<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6" /><path d="M9 16h6" /></>)} />
        <StatCard label="Total Revenue" value={`৳ ${Number(data.totalRevenue).toLocaleString()}`} bg="var(--stat-green-bg)" fg="var(--stat-green)" icon={icon(<><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></>)} />
        <StatCard
          label="Pending Orders"
          value={`৳ ${Number(data.pending.revenue).toLocaleString()}`}
          sub={`${data.pending.orders} Orders`}
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
        <OverviewCharts data={data} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:col-span-4 lg:grid-cols-2">
        <RecentOrdersTable data={data} />
        <TopCustomersTable data={data} />
      </div>
    </div>
  );
}
