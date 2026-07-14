import type { ReactNode } from "react";
import { Card } from "./Card";
import { IconTile } from "./IconTile";
import { DeltaBadge, type DeltaTone } from "./DeltaBadge";

export interface CategorySubrow {
  label: string;
  amount: string;
  date: string;
}

export interface CategoryCardProps {
  icon: ReactNode;
  name: string;
  amount: string;
  deltaDirection: "up" | "down";
  deltaTone: DeltaTone;
  deltaValue: string;
  note?: string;
  subrows?: CategorySubrow[];
  className?: string;
}

// §5.12 — category/expense breakdown card. Tiles into a
// `repeat(auto-fit, minmax(300px, 1fr))` grid at the call site.
export function CategoryCard({
  icon,
  name,
  amount,
  deltaDirection,
  deltaTone,
  deltaValue,
  note = "Compare to last month",
  subrows,
  className,
}: CategoryCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-start gap-3">
        <IconTile>{icon}</IconTile>
        <div className="flex-1">
          <div className="text-[13px] text-secondary">{name}</div>
          <div className="num mt-0.5 text-lg font-bold text-text">{amount}</div>
        </div>
        <div className="text-right">
          <DeltaBadge direction={deltaDirection} tone={deltaTone} value={deltaValue} />
          <div className="mt-1 text-[11px] text-muted">{note}</div>
        </div>
      </div>
      {subrows && subrows.length > 0 && (
        <div className="mt-3.5 rounded-inner bg-surface-2 px-3">
          {subrows.map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center justify-between py-2.5 text-[13px] ${i > 0 ? "border-t border-border" : ""}`}
            >
              <span className="text-text">{row.label}</span>
              <span className="text-right">
                <span className="num text-text">{row.amount}</span>
                <div className="text-[11px] text-muted">{row.date}</div>
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
