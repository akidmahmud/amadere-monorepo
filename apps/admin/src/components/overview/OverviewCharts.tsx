"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  DoughnutController,
  ArcElement,
  Tooltip as ChartJsTooltip,
  type ChartConfiguration,
} from "chart.js";
import { SalesStatisticsChart } from "@amader/admin-ui";
import type { GlobalDashboardOverview } from "@/hooks/useDashboard";

Chart.register(DoughnutController, ArcElement, ChartJsTooltip);

const CHANNEL_COLORS: Record<string, string> = {
  WEBSITE: "#2570eb",
  WHATSAPP: "#2fbfa8",
  PHONE: "#8b5cf6",
  MARKETPLACE: "#3a4356",
  POS: "#f7941d",
  APP: "#14b89b",
  FACEBOOK: "#1877f2",
  INSTAGRAM: "#d62976",
  TIKTOK: "#010101",
  YOUTUBE: "#ff0000",
  X: "#536471",
};

const CHANNEL_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  PHONE: "Phone",
  MARKETPLACE: "Marketplace",
  POS: "POS",
  APP: "App",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X",
};

function SalesBySourceChart({ data }: { data: GlobalDashboardOverview }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slices = data.ordersByChannel
    .filter((c) => c.count > 0)
    .map((c) => ({
      label: CHANNEL_LABELS[c.channel] ?? c.channel,
      value: c.count,
      color: CHANNEL_COLORS[c.channel] ?? "#94a3b8",
    }));

  useEffect(() => {
    if (!canvasRef.current) return;
    const config: ChartConfiguration<"doughnut"> = {
      type: "doughnut",
      data: {
        labels: slices.map((s) => s.label),
        datasets: [{ data: slices.map((s) => s.value), backgroundColor: slices.map((s) => s.color), borderWidth: 3, borderColor: "#ffffff", hoverOffset: 6 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "58%",
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: "#1e293b", padding: 10, cornerRadius: 8, callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed.toLocaleString()}` } },
        },
      },
    };
    const chart = new Chart(canvasRef.current, config);
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div className="rounded-card border border-border bg-surface p-[22px] shadow-card flex flex-col justify-between">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-ui text-sm font-extrabold text-text">Sales By Source</div>
      </div>
      <div className="flex flex-wrap items-center gap-6 my-auto">
        <div className="relative h-[180px] w-[180px] flex-none">
          <canvas ref={canvasRef} />
        </div>
        <ul className="flex flex-1 flex-col gap-3" style={{ minWidth: 160 }}>
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-sm font-bold text-text">
              <span className="h-[11px] w-[11px] flex-none rounded-[3px]" style={{ background: s.color }} />
              {s.label} <span className="font-semibold text-muted">({s.value.toLocaleString()})</span>
            </li>
          ))}
          {slices.length === 0 && <p className="text-sm text-muted">No orders yet.</p>}
        </ul>
      </div>
    </div>
  );
}

export function OverviewCharts({ data }: { data: GlobalDashboardOverview }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SalesStatisticsChart monthlyRevenue={data.monthlyRevenue} />
      <SalesBySourceChart data={data} />
    </div>
  );
}
