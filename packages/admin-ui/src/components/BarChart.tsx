import { useId, type ReactNode } from "react";
import { Bar, BarChart as RechartsBarChart, CartesianGrid, Rectangle, XAxis, YAxis, type BarShapeProps } from "recharts";
import { Card } from "./Card";
import { cn } from "../lib/cn";

export interface BarChartSeries {
  label: string;
  current: number;
  compare: number;
}

export interface BarChartProps {
  title: ReactNode;
  currentLabel?: string;
  compareLabel?: string;
  lossLabel?: string;
  data: BarChartSeries[];
  className?: string;
}

function formatTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${v < 0 ? "-" : ""}${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  return String(v);
}

function barValue(v: BarShapeProps["value"]): number {
  return Array.isArray(v) ? v[0] : (v ?? 0);
}

// §5.8 — dual-series signed bar chart. Now backed by recharts (replaced an
// earlier hand-rolled CSS/SVG version — recharts already solves "nice" axis
// ticks, zero-baseline signed bars, and responsive sizing, so hand-rolling
// that math was wasted effort once a real charting lib was on the table).
export function BarChart({
  title,
  currentLabel = "This period",
  compareLabel = "Last period",
  lossLabel = "Loss",
  data,
  className,
}: BarChartProps) {
  const gradientId = `bar-chart-revenue-${useId()}`;

  const revenueShape = (props: BarShapeProps) => {
    const { x, y, width, height } = props;
    const negative = barValue(props.value) < 0;
    return (
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        radius={negative ? [0, 0, 4, 4] : [4, 4, 0, 0]}
        fill={`url(#${gradientId})`}
      />
    );
  };

  const profitShape = (props: BarShapeProps) => {
    const { x, y, width, height } = props;
    const negative = barValue(props.value) < 0;
    return (
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        radius={negative ? [0, 0, 4, 4] : [4, 4, 0, 0]}
        fill={negative ? "var(--danger)" : "var(--success)"}
      />
    );
  };

  return (
    <div className={cn("relative overflow-hidden rounded-card", className)}>
      <div
        className="absolute inset-x-0 top-0 z-10 h-[3px]"
        style={{ background: "linear-gradient(90deg, var(--brand-500), var(--brand-400))" }}
      />
      <Card className="pt-[25px]">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="font-ui text-sm font-semibold text-text">{title}</div>
          <div className="flex gap-4 text-xs text-secondary">
            <span className="flex items-center gap-1.5">
              <i className="block h-[9px] w-[9px] rounded-[2px]" style={{ background: "var(--brand-500)" }} />
              {currentLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <i className="block h-[9px] w-[9px] rounded-[2px]" style={{ background: "var(--success)" }} />
              {compareLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <i className="block h-[9px] w-[9px] rounded-[2px]" style={{ background: "var(--danger)" }} />
              {lossLabel}
            </span>
          </div>
        </div>

        <RechartsBarChart responsive data={data} style={{ width: "100%", height: 220 }} margin={{ left: -12 }} barGap={2}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-400)" />
              <stop offset="100%" stopColor="var(--brand-500)" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={formatTick}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          />
          <Bar dataKey="current" name={currentLabel} shape={revenueShape} barSize={10} legendType="none" isAnimationActive={false} />
          <Bar dataKey="compare" name={compareLabel} shape={profitShape} barSize={10} legendType="none" isAnimationActive={false} />
        </RechartsBarChart>
      </Card>
    </div>
  );
}
