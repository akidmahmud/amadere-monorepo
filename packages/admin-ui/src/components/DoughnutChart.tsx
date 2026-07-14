export interface DoughnutSlice {
  label: string;
  value: number;
  color: string;
}

export interface DoughnutChartProps {
  slices: DoughnutSlice[];
  centerLabel?: string;
  centerCaption?: string;
  className?: string;
}

// Order-status distribution (Net Profit / WPFOK parity — plugin hand-rolls
// this on <canvas>; SVG stroke-dasharray segments give the same multi-slice
// ring without a charting library or canvas hit-testing code).
export function DoughnutChart({ slices, centerLabel, centerCaption, className }: DoughnutChartProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const r = 70;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={`flex flex-wrap items-center gap-6 ${className ?? ""}`}>
      <div className="relative h-[180px] w-[180px] shrink-0">
        <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
          <circle cx="90" cy="90" r={r} fill="none" stroke="var(--border)" strokeWidth="24" />
          {total > 0 &&
            slices
              .filter((s) => s.value > 0)
              .map((s) => {
                const length = (s.value / total) * circumference;
                const dasharray = `${length} ${circumference - length}`;
                const dashoffset = -offset;
                offset += length;
                return (
                  <circle
                    key={s.label}
                    cx="90"
                    cy="90"
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="24"
                    strokeDasharray={dasharray}
                    strokeDashoffset={dashoffset}
                  />
                );
              })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerLabel && <div className="num text-xl font-bold text-text">{centerLabel}</div>}
          {centerCaption && <div className="text-xs text-muted">{centerCaption}</div>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 160 }}>
        {slices.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-text">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="num text-secondary">{s.value}</span>
          </div>
        ))}
        {slices.length === 0 && <p className="text-sm text-muted">No data.</p>}
      </div>
    </div>
  );
}
