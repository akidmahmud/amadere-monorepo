"use client";

import { cn } from "../lib/cn";
import { formatMoney } from "./PriceTag";

export interface FreeShippingLadderProps {
  threshold: string;
  remaining: string;
  unlockedLabel?: string;
  progressLabel?: (remaining: string) => string;
  className?: string;
}

export function FreeShippingLadder({
  threshold,
  remaining,
  unlockedLabel = "You've unlocked free shipping!",
  progressLabel = (r) => `Add ${r} more for free shipping`,
  className,
}: FreeShippingLadderProps) {
  const unlocked = Number(remaining) <= 0;
  const pct = Math.min(100, Math.max(0, ((Number(threshold) - Number(remaining)) / Number(threshold)) * 100));

  return (
    <div className={cn("rounded-[10px] bg-beige p-3", className)}>
      <p className="mb-2 font-ui text-xs font-medium text-ink">
        {unlocked ? unlockedLabel : progressLabel(formatMoney(remaining))}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-green transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
