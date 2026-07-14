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
}

// §5.1 — sidebar nav row. Only one active at a time (the brand-500 pill);
// that active state is the primary way brand color appears in the chrome.
export function NavItem({ icon, label, href, active, linkComponent: Link = DefaultLink }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-11 items-center gap-3 rounded-sm px-3 font-ui text-sm font-medium text-sidebar-text transition-colors duration-150 hover:bg-sidebar-hover [&>svg]:h-5 [&>svg]:w-5 [&>svg]:flex-none",
        active && "bg-brand-500 font-semibold text-sidebar-text-active hover:bg-brand-500",
      )}
    >
      {icon}
      <span className="max-[1024px]:hidden">{label}</span>
    </Link>
  );
}
