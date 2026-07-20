"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface NavItemProps {
  icon: ReactNode;
  label: string;
  href: string;
  active?: boolean;
  linkComponent?: LinkComponent;
  /** Overrides the default responsive (max-[1024px]:hidden) label-hiding —
   * AppShell passes its own collapsed/hover-reveal classes when the sidebar
   * is manually collapsed. */
  labelClassName?: string;
}

// §5.1 — sidebar nav row. Only one active at a time (the brand-500 pill);
// that active state is the primary way brand color appears in the chrome.
export function NavItem({ icon, label, href, active, linkComponent: Link = DefaultLink, labelClassName = "max-[1024px]:hidden" }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-11 min-w-0 items-center gap-3 rounded-sm px-3 font-ui text-sm font-medium transition-colors duration-150 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:flex-none [&_.material-symbols-outlined]:!text-[20px]",
        active
          ? "bg-brand-500 font-semibold text-sidebar-text-active hover:bg-brand-600"
          : "text-sidebar-text hover:bg-sidebar-hover",
      )}
    >
      {icon}
      <span className={cn("min-w-0 flex-1 whitespace-nowrap", labelClassName)}>{label}</span>
    </Link>
  );
}
