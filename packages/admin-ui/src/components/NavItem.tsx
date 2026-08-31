"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface NavItemProps {
  icon: ReactNode;
  label: string;
  href: string;
  active?: boolean;
  /** Unread marker — a plain red dot, no count. */
  dot?: boolean;
  /** How much work is waiting behind this row (new orders, open carts).
   *  Zero and undefined both render nothing — an empty queue is not news. */
  badge?: number;
  linkComponent?: LinkComponent;
}

/** Four digits of workload is a backlog, not a number anyone reads. */
function formatBadge(count: number): string {
  return count > 999 ? "999+" : String(count);
}

// Flat sidebar row — sizing/spacing matched to the GetCommerce reference's
// own .nav-item (10px/12px padding, 9px radius, .82rem/600 weight, 11px gap).
export function NavItem({ icon, label, href, active, dot, badge, linkComponent: Link = DefaultLink }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-10 min-w-0 items-center gap-2.5 rounded-[9px] px-3 font-ui text-[0.82rem] font-semibold whitespace-nowrap transition-colors duration-150 [&>svg]:h-[17px] [&>svg]:w-[17px] [&>svg]:flex-none [&_.material-symbols-outlined]:!text-[18px]",
        active
          ? "bg-brand-500 text-sidebar-text-active hover:bg-brand-600"
          : "text-sidebar-text hover:bg-sidebar-hover hover:text-text",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {/* After the label, not over the icon: the sidebar collapses labels on
          narrow screens but never the row, so a dot pinned to the icon would
          sit under it. aria-label because a bare dot says nothing to a
          screen reader. */}
      {badge !== undefined && badge > 0 && (
        <span
          role="status"
          aria-label={`${label}: ${badge} waiting`}
          className={cn(
            "flex-none rounded-pill px-1.5 py-0.5 text-[0.68rem] font-bold tabular-nums",
            // On the active row the brand fill is already behind it, so a
            // second coloured chip would fight it — go translucent instead.
            active
              ? "bg-white/25 text-sidebar-text-active"
              : "bg-red-500 text-white",
          )}
        >
          {formatBadge(badge)}
        </span>
      )}
      {dot && badge === undefined && (
        <span
          role="status"
          aria-label={`${label} has new items`}
          className="h-2 w-2 flex-none rounded-full bg-red-500 ring-2 ring-sidebar-bg"
        />
      )}
    </Link>
  );
}
