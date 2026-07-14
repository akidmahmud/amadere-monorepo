export interface RadialGaugeProps {
  progress: number; // 0–1
  centerLabel: string;
  caption?: string;
  className?: string;
}

// §5.9 — ~180° arc gauge for goals/targets. Track = border, progress = brand.
export function RadialGauge({ progress, centerLabel, caption, className }: RadialGaugeProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  // Arc geometry matches the reference exactly (15,95 -> 165,95 half-circle);
  // the progress arc sweeps proportionally from the same start point.
  const angle = Math.PI * (1 - clamped);
  const cx = 90;
  const cy = 95;
  const r = 75;
  const endX = cx - r * Math.cos(angle);
  const endY = cy - r * Math.sin(angle);
  const largeArc = clamped > 0.5 ? 1 : 0;

  return (
    <div className={`flex flex-col items-center gap-1.5 pt-1 ${className ?? ""}`}>
      <svg width="180" height="100" viewBox="0 0 180 100">
        <path d="M15 95 A75 75 0 0 1 165 95" fill="none" stroke="var(--border)" strokeWidth="12" strokeLinecap="round" />
        {clamped > 0 && (
          <path
            d={`M15 95 A${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none"
            stroke="var(--brand-500)"
            strokeWidth="12"
            strokeLinecap="round"
          />
        )}
        <text x="90" y="80" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--text)">
          {centerLabel}
        </text>
      </svg>
      {caption && <div className="text-[11px] text-muted">{caption}</div>}
    </div>
  );
}
