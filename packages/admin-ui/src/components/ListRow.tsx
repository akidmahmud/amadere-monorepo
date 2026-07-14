import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { IconTile } from "./IconTile";

export interface ListRowProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  amount?: string;
  meta?: string;
  right?: ReactNode;
  className?: string;
}

// §5.10 — transactions, bills, any icon+label+amount row. `right` overrides
// the default amount/meta stack for rows that need something else there
// (e.g. the reference's "Upcoming Bill" ghost-button price).
export function ListRow({ icon, title, subtitle, amount, meta, right, className }: ListRowProps) {
  return (
    <div className={cn("flex items-center gap-3 py-3", className)}>
      <IconTile>{icon}</IconTile>
      <div className="min-w-0 flex-1">
        <div className="truncate font-ui text-sm font-medium text-text">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted">{subtitle}</div>}
      </div>
      {right ?? (
        <div className="text-right">
          {amount && <div className="num text-sm font-semibold text-text">{amount}</div>}
          {meta && <div className="text-xs text-muted">{meta}</div>}
        </div>
      )}
    </div>
  );
}
