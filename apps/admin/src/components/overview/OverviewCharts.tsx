"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  DoughnutController,
  ArcElement,
  Legend,
  Tooltip,
  type ChartConfiguration,
} from "chart.js";
import type { DashboardOverview } from "@/hooks/useDashboard";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, DoughnutController, ArcElement, Legend, Tooltip);

const CHANNEL_COLORS: Record<string, string> = {
  WEBSITE: "#2570eb",
  WHATSAPP: "#2fbfa8",
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

// Exact visual config ported from getcommerce-dashboard.html's `salesChart` —
// same colors/rounding/legend/tooltip treatment. Real data only gives us two
// series (this period vs. previous period revenue, from monthlyRevenue), not
// the reference's three (it used static mock data) — mapped onto the
// reference's first two dataset colors rather than inventing a third series.
function SalesStatisticsChart({ data }: { data: DashboardOverview }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const config: ChartConfiguration<"bar"> = {
      type: "bar",
      data: {
        labels: data.monthlyRevenue.map((m) => m.label),
        datasets: [
          {
            label: "This period",
            data: data.monthlyRevenue.map((m) => Number(m.revenue)),
            backgroundColor: "#22c087",
            borderRadius: 4,
            barPercentage: 0.72,
            categoryPercentage: 0.62,
          },
          {
            label: "Previous period",
            data: data.monthlyRevenue.map((m) => Number(m.previousRevenue)),
            backgroundColor: "#4e8cf0",
            borderRadius: 4,
            barPercentage: 0.72,
            categoryPercentage: 0.62,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 10, boxHeight: 10, padding: 18, font: { size: 12, weight: 600 }, color: "#334155" },
          },
          tooltip: { backgroundColor: "#1e293b", padding: 10, cornerRadius: 8, titleFont: { weight: 700 } },
        },
        scales: {
          y: { beginAtZero: true, ticks: { font: { size: 11 }, color: "#94a3b8" }, grid: { color: "#eef2f7" }, border: { display: false } },
          x: { ticks: { font: { size: 11, weight: 600 }, color: "#64748b" }, grid: { display: false }, border: { display: false } },
        },
      },
    };
    const chart = new Chart(canvasRef.current, config);
    return () => chart.destroy();
  }, [data]);

  return (
    <div className="rounded-card border border-border bg-surface p-[22px] shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-ui text-sm font-semibold text-text">Sales Statistics</div>
      </div>
      <div className="relative h-[280px]">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

// Exact visual config ported from the reference's `sourceChart` — cutout,
// borderWidth/borderColor, and hoverOffset (the hover "transition" effect
// the reference has that a hand-rolled static SVG donut cannot produce) all
// match. Side legend markup (dot + label + count) also mirrors the
// reference's `.source-legend` list exactly, since the reference disables
// Chart.js's own legend and renders its own.
function SalesBySourceChart({ data }: { data: DashboardOverview }) {
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
    <div className="rounded-card border border-border bg-surface p-[22px] shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-ui text-sm font-semibold text-text">Sales By Source</div>
      </div>
      <div className="flex flex-wrap items-center gap-6">
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

export function OverviewCharts({ data }: { data: DashboardOverview }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SalesStatisticsChart data={data} />
      <SalesBySourceChart data={data} />
    </div>
  );
}
