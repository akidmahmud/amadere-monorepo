import React, { useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Line,
  LineChart,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GREEN = "#2e7d43";
const GREEN_LIGHT = "#10b981";
const DANGER = "#e5484d";
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const MUTED = "#64766b";
const FAINT = "#94a69a";

export interface DailyTrendItem {
  reportDate: string;
  totalRevenue: number;
  netProfit: number;
  totalBuyCost?: number;
  totalAdsCost?: number;
}

export interface RevenueProfitTrendProps {
  data: DailyTrendItem[];
}

function formatTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000000) return `${v < 0 ? "-" : ""}৳${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${v < 0 ? "-" : ""}৳${(abs / 1000).toFixed(0)}k`;
  return `৳${v}`;
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr || dateStr === "—") return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(5);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return dateStr.slice(5);
  }
}

// Custom Rich Tooltip
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0].payload as DailyTrendItem & { marginPercent?: number };
  const rev = Number(dataPoint.totalRevenue || 0);
  const profit = Number(dataPoint.netProfit || 0);
  const costs = (dataPoint.totalBuyCost || 0) + (dataPoint.totalAdsCost || 0);
  const margin = rev > 0 ? (profit / rev) * 100 : 0;

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
        {label ? formatDateLabel(String(label)) : "—"} ({dataPoint.reportDate})
      </div>
      <div className="flex flex-col gap-1.5 text-[0.76rem]">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 font-medium text-white/80">
            <span className="h-2 w-2 rounded-full" style={{ background: GREEN_LIGHT }} />
            Revenue
          </span>
          <span className="font-extrabold text-white">৳{rev.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 font-medium text-white/80">
            <span className="h-2 w-2 rounded-full" style={{ background: profit >= 0 ? "#34d399" : DANGER }} />
            Net Profit
          </span>
          <span className={`font-extrabold ${profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            ৳{profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
        {costs > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 font-medium text-white/60">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Est. Costs
            </span>
            <span className="font-bold text-white/80">৳{costs.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        <div className="mt-1 flex items-center justify-between border-t pt-1.5" style={{ borderColor: "rgba(255, 255, 255, 0.12)" }}>
          <span className="text-[0.7rem] font-semibold text-white/70">Margin</span>
          <span
            className={`rounded-pill px-2 py-0.5 text-[0.68rem] font-extrabold ${
              profit >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
            }`}
          >
            {margin.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function RevenueProfitTrend({ data }: RevenueProfitTrendProps) {
  const [viewMode, setViewMode] = useState<"bars" | "area" | "margin">("bars");
  const revGradientId = `trend-rev-${useId()}`;
  const profitGradientId = `trend-profit-${useId()}`;

  const formattedData = (data.length > 0 ? data : [{ reportDate: "—", totalRevenue: 0, netProfit: 0 }]).map((d) => {
    const rev = Number(d.totalRevenue || 0);
    const profit = Number(d.netProfit || 0);
    const marginPercent = rev > 0 ? Number(((profit / rev) * 100).toFixed(1)) : 0;
    return {
      ...d,
      label: formatDateLabel(d.reportDate),
      marginPercent,
    };
  });

  const totalRev = data.reduce((sum, d) => sum + Number(d.totalRevenue || 0), 0);
  const totalProfit = data.reduce((sum, d) => sum + Number(d.netProfit || 0), 0);
  const overallMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
  const peakRev = Math.max(0, ...data.map((d) => Number(d.totalRevenue || 0)));

  return (
    <div className="flex flex-col overflow-hidden rounded-card border shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
      {/* Metrics & Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b p-[14px_18px]" style={{ borderColor: LINE }}>
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <div className="text-[0.7rem] font-semibold" style={{ color: MUTED }}>
              Period Revenue
            </div>
            <div className="mt-0.5 text-[1.1rem] font-extrabold" style={{ color: INK }}>
              ৳{totalRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="h-7 w-[1px]" style={{ background: LINE }} />
          <div>
            <div className="text-[0.7rem] font-semibold" style={{ color: MUTED }}>
              Period Profit
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className={`text-[1.1rem] font-extrabold ${totalProfit >= 0 ? "text-success" : "text-danger"}`}>
                ৳{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className={`rounded-pill px-2 py-0.5 text-[0.68rem] font-extrabold ${totalProfit >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                {overallMargin.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="h-7 w-[1px]" style={{ background: LINE }} />
          <div>
            <div className="text-[0.7rem] font-semibold" style={{ color: MUTED }}>
              Peak Day Revenue
            </div>
            <div className="mt-0.5 text-[1.1rem] font-extrabold" style={{ color: GREEN }}>
              ৳{peakRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 rounded-[10px] border p-1" style={{ borderColor: LINE, background: "#f8fbf9" }}>
          <button
            type="button"
            onClick={() => setViewMode("bars")}
            className="rounded-[7px] px-3 py-1 text-[0.74rem] font-bold transition-all"
            style={viewMode === "bars" ? { background: GREEN, color: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.1)" } : { color: MUTED }}
          >
            Dual Bars
          </button>
          <button
            type="button"
            onClick={() => setViewMode("area")}
            className="rounded-[7px] px-3 py-1 text-[0.74rem] font-bold transition-all"
            style={viewMode === "area" ? { background: GREEN, color: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.1)" } : { color: MUTED }}
          >
            Area Trend
          </button>
          <button
            type="button"
            onClick={() => setViewMode("margin")}
            className="rounded-[7px] px-3 py-1 text-[0.74rem] font-bold transition-all"
            style={viewMode === "margin" ? { background: GREEN, color: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.1)" } : { color: MUTED }}
          >
            Margin %
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="p-4 pt-6" style={{ height: 320, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === "bars" ? (
            <RechartsBarChart data={formattedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barGap={3}>
              <defs>
                <linearGradient id={revGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2e7d43" stopOpacity={1} />
                  <stop offset="100%" stopColor="#1d5230" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef3ef" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: FAINT }} />
              <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={formatTick} tick={{ fontSize: 11, fill: FAINT }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="totalRevenue"
                name="Revenue"
                fill={`url(#${revGradientId})`}
                radius={[4, 4, 0, 0]}
                barSize={12}
                isAnimationActive={false}
              />
              <Bar
                dataKey="netProfit"
                name="Net Profit"
                fill="#10b981"
                shape={(props: any) => {
                  const { x, y, width, height, value } = props;
                  const val = Array.isArray(value) ? value[0] : (value ?? 0);
                  const negative = val < 0;
                  return (
                    <Rectangle
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      radius={negative ? [0, 0, 4, 4] : [4, 4, 0, 0]}
                      fill={negative ? DANGER : GREEN_LIGHT}
                    />
                  );
                }}
                barSize={12}
                isAnimationActive={false}
              />
            </RechartsBarChart>
          ) : viewMode === "area" ? (
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id={revGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2e7d43" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2e7d43" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id={profitGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef3ef" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: FAINT }} />
              <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={formatTick} tick={{ fontSize: 11, fill: FAINT }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="totalRevenue" name="Revenue" stroke="#2e7d43" strokeWidth={2.5} fillOpacity={1} fill={`url(#${revGradientId})`} isAnimationActive={false} />
              <Area type="monotone" dataKey="netProfit" name="Net Profit" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill={`url(#${profitGradientId})`} isAnimationActive={false} />
            </AreaChart>
          ) : (
            <LineChart data={formattedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef3ef" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: FAINT }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11, fill: FAINT }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="marginPercent" name="Margin %" stroke={GREEN} strokeWidth={3} dot={{ r: 4, fill: GREEN }} activeDot={{ r: 6 }} isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
