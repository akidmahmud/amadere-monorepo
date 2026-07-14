import type { ReactNode } from "react";
import { Card } from "./Card";

export interface BarChartSeries {
  label: string;
  current: number;
  compare: number;
}

export interface BarChartProps {
  title: ReactNode;
  currentLabel?: string;
  compareLabel?: string;
  data: BarChartSeries[];
  className?: string;
}

// §5.8 — dual-series bar chart wrapper. A presentational wrapper (CSS bars,
// not a charting library) since the reference itself renders plain divs —
// matches "BarChart wrapper" scope, not a full charting integration.
export function BarChart({ title, currentLabel = "This period", compareLabel = "Last period", data, className }: BarChartProps) {
  const max = Math.max(1, ...data.flatMap((d) => [d.current, d.compare]));

  return (
    <Card className={className}>
      <div className="mb-3.5 flex items-center justify-between">
        <div className="font-ui text-sm font-semibold text-text">{title}</div>
        <div className="flex gap-4 text-xs text-secondary">
          <span className="flex items-center gap-1.5">
            <i className="block h-[9px] w-[9px] rounded-[2px] bg-chart-current" />
            {currentLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="block h-[9px] w-[9px] rounded-[2px] bg-chart-compare" />
            {compareLabel}
          </span>
        </div>
      </div>
      <div className="flex h-[180px] items-end gap-2.5 pt-2.5">
        {data.map((series) => (
          <div key={series.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-[150px] items-end gap-1">
              <div
                className="w-[9px] rounded-t bg-chart-current"
                style={{ height: `${(series.current / max) * 150}px` }}
              />
              <div
                className="w-[9px] rounded-t bg-chart-compare"
                style={{ height: `${(series.compare / max) * 150}px` }}
              />
            </div>
            <div className="text-[11px] text-muted">{series.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
