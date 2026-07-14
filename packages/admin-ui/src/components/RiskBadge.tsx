import { cn } from "../lib/cn";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

const TONE_CLASSES: Record<RiskLevel, string> = {
  LOW: "bg-success/10 text-success",
  MEDIUM: "bg-warning/10 text-warning",
  HIGH: "bg-danger/10 text-danger",
  UNKNOWN: "bg-border text-secondary",
};

const LABELS: Record<RiskLevel, string> = {
  LOW: "Low risk",
  MEDIUM: "Medium risk",
  HIGH: "High risk",
  UNKNOWN: "Unknown",
};

// Net Profit fraud detection's shared risk indicator (CLAUDE.net-profit.md
// §8) — used on the fraud board, the fraud detail drawer, and (once the
// order board is touched) the orders list. Four fixed tones only, per spec.
export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold",
        TONE_CLASSES[level],
        className,
      )}
    >
      {LABELS[level]}
    </span>
  );
}
