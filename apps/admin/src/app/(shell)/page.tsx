"use client";

import { BarChart, Card, IconTile, ListRow, RadialGauge, StatCard } from "@amader/admin-ui";
import { useDashboardOverview } from "@/hooks/useDashboard";

const orderIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18M9 10a3 3 0 0 0 6 0" />
  </svg>
);
const productIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M20.5 7.5 12 3 3.5 7.5 12 12l8.5-4.5Z" />
    <path d="M3.5 7.5v9L12 21l8.5-4.5v-9M12 12v9" />
  </svg>
);

function formatBDT(value: string): string {
  return `৳${Number(value).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function OverviewPage() {
  const { data, isLoading, isError } = useDashboardOverview();

  if (isLoading) {
    return <p className="font-body text-sm text-muted">Loading dashboard…</p>;
  }
  if (isError || !data) {
    return <p className="font-body text-sm text-danger">Could not load dashboard data.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-6 max-[900px]:grid-cols-1">
        <StatCard label="Total Revenue" value={formatBDT(data.totalRevenue)} />

        <StatCard label="Orders Completed" value={`${(data.completedOrderRate * 100).toFixed(1)}%`}>
          <RadialGauge progress={data.completedOrderRate} centerLabel={String(data.totalOrders)} caption="of all orders" />
        </StatCard>

        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-ui text-base font-semibold text-text">Order Status</h3>
            <span className="text-xs text-muted">{data.totalOrders} total</span>
          </div>
          {data.statusBreakdown.map((s) => (
            <ListRow key={s.status} icon={orderIcon} title={s.status} amount={String(s.count)} />
          ))}
        </Card>
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-6 max-[900px]:grid-cols-1">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-ui text-base font-semibold text-text">Recent Orders</h3>
          </div>
          {data.recentOrders.map((o) => (
            <ListRow
              key={o.id}
              icon={orderIcon}
              title={o.orderNumber}
              subtitle={`${o.customerName} · ${o.status}`}
              amount={formatBDT(o.total)}
              meta={formatDate(o.createdAt)}
            />
          ))}
        </Card>

        <BarChart
          title="Monthly Revenue"
          currentLabel="Month"
          compareLabel="Previous month"
          data={data.monthlyRevenue.map((m) => ({
            label: m.label,
            current: Number(m.revenue),
            compare: Number(m.previousRevenue),
          }))}
        />
      </div>

      <div>
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="font-ui text-base font-semibold text-text">Top Selling Products</h3>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
          {data.topProducts.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start gap-3">
                <IconTile>{productIcon}</IconTile>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-secondary" title={p.name}>
                    {p.name}
                  </div>
                  <div className="num mt-0.5 text-lg font-bold text-text">{formatBDT(p.revenue)}</div>
                  <div className="text-xs text-muted">{p.unitsSold} units sold</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
