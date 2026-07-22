"use client";

import { BarChart, DoughnutChart } from "@amader/admin-ui";
import type { DashboardOverview } from "@/hooks/useDashboard";

const CHANNEL_COLORS: Record<string, string> = {
  WEBSITE: "#2570eb",
  WHATSAPP: "#22c087",
  PHONE: "#8b5cf6",
  MARKETPLACE: "#3a4356",
  POS: "#f7941d",
  APP: "#14b89b",
};

const CHANNEL_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  PHONE: "Phone",
  MARKETPLACE: "Marketplace",
  POS: "POS",
  APP: "App",
};

export function OverviewCharts({ data }: { data: DashboardOverview }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BarChart
        title="Sales Statistics"
        currentLabel="This period"
        compareLabel="Previous period"
        data={data.monthlyRevenue.map((m) => ({
          label: m.label,
          current: Number(m.revenue),
          compare: Number(m.previousRevenue),
        }))}
      />
      <div className="rounded-card border border-border bg-surface p-[22px] shadow-card">
        <div className="mb-4 font-ui text-sm font-semibold text-text">Sales By Source</div>
        <DoughnutChart
          slices={data.ordersByChannel
            .filter((c) => c.count > 0)
            .map((c) => ({
              label: CHANNEL_LABELS[c.channel] ?? c.channel,
              value: c.count,
              color: CHANNEL_COLORS[c.channel] ?? "#94a3b8",
            }))}
        />
      </div>
    </div>
  );
}
