"use client";

import { useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { NavItem } from "./NavItem";

export interface NavGroupChild {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
}

export interface NavGroupProps {
  icon: ReactNode;
  label: string;
  children: NavGroupChild[];
  activeHref: string;
  linkComponent?: LinkComponent;
  /** See NavItemProps.labelClassName — same override, same reason. */
  labelClassName?: string;
}

const chevron = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 flex-none transition-transform duration-150">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

// A collapsible sidebar section — same row height/styling as a plain
// NavItem so a group doesn't stand out as a different kind of control, it
// just happens to expand. Auto-open on mount if one of its children is the
// active page, otherwise collapsed (§ sidebar had 27 flat rows; grouping
// related ones cuts the top-level count down while keeping every page one
// click away).
export function NavGroup({
  icon,
  label,
  children,
  activeHref,
  linkComponent: Link = DefaultLink,
  labelClassName = "max-[1024px]:hidden",
}: NavGroupProps) {
  const hasActiveChild = children.some((c) => c.href === activeHref);
  const [isOpen, setIsOpen] = useState(hasActiveChild);
  // Same override signal used for the indent bar / sub-item list below —
  // "hidden until hover" for label text means the sub-items should stay
  // tucked away until hover too, same as the responsive collapse already did.
  const collapsedOverride = labelClassName !== "max-[1024px]:hidden";

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "flex h-11 w-full min-w-0 items-center gap-3 rounded-sm px-3 font-ui text-sm font-medium text-sidebar-text transition-colors duration-150 hover:bg-sidebar-hover [&>svg:first-child]:h-5 [&>svg:first-child]:w-5 [&>svg:first-child]:flex-none",
          hasActiveChild && !isOpen && "text-brand-500",
        )}
      >
        {icon}
        <span className={cn("min-w-0 flex-1 whitespace-nowrap text-left", labelClassName)}>{label}</span>
        <span className={cn("flex-none", labelClassName, isOpen && "rotate-90")}>{chevron}</span>
      </button>
      {isOpen && (
        <div
          className={cn(
            "ml-4 flex flex-col gap-1 border-l border-border pl-2 pt-1 max-[1024px]:ml-0 max-[1024px]:border-none max-[1024px]:pl-0",
            collapsedOverride && "hidden group-hover/sidebar:flex group-hover/sidebar:ml-4 group-hover/sidebar:border-l group-hover/sidebar:pl-2",
          )}
        >
          {children.map((child) => (
            <NavItem
              key={child.key}
              icon={child.icon}
              label={child.label}
              href={child.href}
              active={child.href === activeHref}
              linkComponent={Link}
              labelClassName={labelClassName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
