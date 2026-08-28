import React, { useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GREEN = "#2e7d43";
const GREEN_LIGHT = "#10b981";
const BLUE = "#3b82f6";
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const MUTED = "#64766b";
const FAINT = "#94a69a";

export interface MonthlyRevenueItem {
  label: string;
  revenue: string | number;
  previousRevenue: string | number;
}

export interface SalesStatisticsChartProps {
  monthlyRevenue: MonthlyRevenueItem[];
}

function formatTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000000) return `${v < 0 ? "-" : ""}৳${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${v < 0 ? "-" : ""}৳${(abs / 1000).toFixed(0)}k`;
  return `৳${v}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SalesTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0].payload;
  const current = Number(dataPoint.current || 0);
  const compare = Number(dataPoint.compare || 0);
  const diff = current - compare;
  const growth = compare > 0 ? (diff / compare) * 100 : current > 0 ? 100 : 0;

  return (
    <div
      className="z-50 rounded-[12px] border p-3.5 shadow-xl transition-all"
      style={{
        background: "rgba(30, 43, 34, 0.95)",
        backdropFilter: "blur(8px)",
        borderColor: "rgba(255, 255, 255, 0.15)",
        color: "#fff",
        minWidth: 210,
      }}
    >
      <div className="mb-2 border-b pb-1.5 text-[0.75rem] font-bold text-white/70" style={{ borderColor: "rgba(255, 255, 255, 0.12)" }}>
        {label ?? "Period"}
      </div>
      <div className="flex flex-col gap-1.5 text-[0.76rem]">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 font-medium text-white/80">
            <span className="h-2 w-2 rounded-full" style={{ background: GREEN }} />
            This Period
          </span>
          <span className="font-extrabold text-white">৳{current.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 font-medium text-white/80">
            <span className="h-2 w-2 rounded-full" style={{ background: BLUE }} />
            Prev Period
          </span>
          <span className="font-bold text-white/80">৳{compare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="mt-1 flex items-center justify-between border-t pt-1.5" style={{ borderColor: "rgba(255, 255, 255, 0.12)" }}>
          <span className="text-[0.7rem] font-semibold text-white/70">Growth</span>
          <span className={`rounded-pill px-2 py-0.5 text-[0.68rem] font-extrabold ${growth >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
            {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function SalesStatisticsChart({ monthlyRevenue }: SalesStatisticsChartProps) {
  const [viewMode, setViewMode] = useState<"bars" | "area" | "growth">("bars");
  const thisGradId = `stats-this-${useId()}`;
  const prevGradId = `stats-prev-${useId()}`;

  const chartData = (monthlyRevenue || []).map((m) => {
    const current = Number(m.revenue || 0);
    const compare = Number(m.previousRevenue || 0);
    const growth = compare > 0 ? Number((((current - compare) / compare) * 100).toFixed(1)) : current > 0 ? 100 : 0;
    return {
      label: m.label,
      current,
      compare,
      growth,
    };
  });

  const totalCurrent = chartData.reduce((sum, d) => sum + d.current, 0);
  const totalCompare = chartData.reduce((sum, d) => sum + d.compare, 0);
  const overallGrowth = totalCompare > 0 ? ((totalCurrent - totalCompare) / totalCompare) * 100 : totalCurrent > 0 ? 100 : 0;

  return (
    <div className="flex flex-col rounded-card border shadow-card p-5 bg-surface" style={{ borderColor: LINE }}>
      {/* Header & Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: LINE }}>
        <div>
          <div className="font-ui text-sm font-extrabold tracking-tight" style={{ color: INK }}>
            Sales Statistics
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-base font-extrabold" style={{ color: INK }}>
              ৳ {totalCurrent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className={`rounded-pill px-2.5 py-0.5 text-[0.68rem] font-bold ${overallGrowth >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
              {overallGrowth >= 0 ? "+" : ""}{overallGrowth.toFixed(1)}% vs prev
            </span>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 rounded-[9px] border p-1" style={{ borderColor: LINE, background: "#f8fbf9" }}>
          <button
            type="button"
            onClick={() => setViewMode("bars")}
            className="rounded-[6px] px-2.5 py-1 text-[0.72rem] font-bold transition-all"
            style={viewMode === "bars" ? { background: GREEN, color: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.1)" } : { color: MUTED }}
          >
            Dual Bars
          </button>
          <button
            type="button"
            onClick={() => setViewMode("area")}
            className="rounded-[6px] px-2.5 py-1 text-[0.72rem] font-bold transition-all"
            style={viewMode === "area" ? { background: GREEN, color: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.1)" } : { color: MUTED }}
          >
            Area Trend
          </button>
          <button
            type="button"
            onClick={() => setViewMode("growth")}
            className="rounded-[6px] px-2.5 py-1 text-[0.72rem] font-bold transition-all"
            style={viewMode === "growth" ? { background: GREEN, color: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.1)" } : { color: MUTED }}
          >
            Growth %
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === "bars" ? (
            <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: 5, bottom: 0 }} barGap={3}>
              <defs>
                <linearGradient id={thisGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2e7d43" stopOpacity={1} />
                  <stop offset="100%" stopColor="#1d5230" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef3ef" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: FAINT }} />
              <YAxis tickLine={false} axisLine={false} width={55} tickFormatter={formatTick} tick={{ fontSize: 11, fill: FAINT }} />
              <Tooltip content={<SalesTooltip />} />
              <Bar dataKey="current" name="This period" fill={`url(#${thisGradId})`} radius={[4, 4, 0, 0]} barSize={10} isAnimationActive={false} />
              <Bar dataKey="compare" name="Previous period" fill={BLUE} radius={[4, 4, 0, 0]} barSize={10} isAnimationActive={false} />
            </RechartsBarChart>
          ) : viewMode === "area" ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id={thisGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2e7d43" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2e7d43" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id={prevGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef3ef" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: FAINT }} />
              <YAxis tickLine={false} axisLine={false} width={55} tickFormatter={formatTick} tick={{ fontSize: 11, fill: FAINT }} />
              <Tooltip content={<SalesTooltip />} />
              <Area type="monotone" dataKey="current" name="This period" stroke="#2e7d43" strokeWidth={2.5} fillOpacity={1} fill={`url(#${thisGradId})`} isAnimationActive={false} />
              <Area type="monotone" dataKey="compare" name="Previous period" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill={`url(#${prevGradId})`} isAnimationActive={false} />
            </AreaChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef3ef" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: FAINT }} />
              <YAxis tickLine={false} axisLine={false} width={45} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: FAINT }} />
              <Tooltip content={<SalesTooltip />} />
              <Line type="monotone" dataKey="growth" name="Growth %" stroke={GREEN_LIGHT} strokeWidth={3} dot={{ r: 4, fill: GREEN_LIGHT }} activeDot={{ r: 6 }} isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend Footer */}
      <div className="mt-3 flex items-center justify-center gap-5 border-t pt-2 text-[0.72rem] font-bold" style={{ borderColor: LINE }}>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: GREEN }} />
          <span style={{ color: MUTED }}>This Period</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BLUE }} />
          <span style={{ color: MUTED }}>Previous Period</span>
        </div>
      </div>
    </div>
  );
}
