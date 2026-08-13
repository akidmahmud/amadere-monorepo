"use client";

import { cn } from "../lib/cn";
import { formatMoney } from "./PriceTag";

export interface UpsellProgressBarStage {
  label: string;
  triggerType: "ITEM_COUNT" | "ORDER_AMOUNT";
  triggerValue: string;
  unlocked: boolean;
}

export interface UpsellProgressBarNextStage {
  label: string;
  triggerType: "ITEM_COUNT" | "ORDER_AMOUNT";
  remaining: string;
}

export interface UpsellProgressBarProps {
  stages: UpsellProgressBarStage[];
  nextStage: UpsellProgressBarNextStage | null;
  className?: string;
}

function remainingLabel(next: UpsellProgressBarNextStage | null): string | null {
  if (!next) return null;
  const amount =
    next.triggerType === "ORDER_AMOUNT" ? formatMoney(next.remaining) : `${next.remaining} item${next.remaining === "1" ? "" : "s"}`;
  return `Add ${amount} more to unlock ${next.label}`;
}

// Segmented, not a continuous numeric scale — stages can mix item-count and
// order-amount triggers, which have no shared unit to place on one axis.
// Progress fills to the fraction of stages unlocked; each stage gets an
// evenly-spaced checkpoint marker and its own label underneath.
export function UpsellProgressBar({ stages, nextStage, className }: UpsellProgressBarProps) {
  if (stages.length === 0) return null;

  const unlockedCount = stages.filter((s) => s.unlocked).length;
  const pct = (unlockedCount / stages.length) * 100;
  const headline = unlockedCount === stages.length ? "You've unlocked every reward!" : remainingLabel(nextStage);

  return (
    <div className={cn("rounded-[10px] bg-beige p-3", className)}>
      {headline && <p className="mb-2.5 font-ui text-xs font-medium text-ink">{headline}</p>}
      <div className="relative h-1.5 rounded-full bg-white">
        <div className="h-full rounded-full bg-green transition-all" style={{ width: `${pct}%` }} />
        <div className="absolute inset-0 flex items-center justify-between">
          {stages.map((stage, i) => (
            <div
              key={i}
              title={stage.label}
              className={cn("h-3 w-3 rounded-full border-2 border-white transition-colors", stage.unlocked ? "bg-green" : "bg-line")}
            />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between">
        {stages.map((stage, i) => (
          <span key={i} className={cn("font-ui text-[10px]", stage.unlocked ? "text-green" : "text-muted")}>
            {stage.label}
          </span>
        ))}
      </div>
    </div>
  );
}
