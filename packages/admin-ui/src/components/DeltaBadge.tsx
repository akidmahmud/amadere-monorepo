import { cn } from "../lib/cn";

export type DeltaTone = "success" | "danger";

export interface DeltaBadgeProps {
  direction: "up" | "down";
  tone: DeltaTone;
  value: string;
  className?: string;
}

const toneClasses: Record<DeltaTone, string> = {
  success: "text-success",
  danger: "text-danger",
};

// §2.4 / §5.14 — color by MEANING, not arrow direction. Callers pass `tone`
// explicitly (a falling expense is `success` even though it's a "down" glyph)
// so the two are never conflated into "up = bad" by accident.
export function DeltaBadge({ direction, tone, value, className }: DeltaBadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", toneClasses[tone], className)}>
      {direction === "up" ? "▲" : "▼"} {value}
    </span>
  );
}
