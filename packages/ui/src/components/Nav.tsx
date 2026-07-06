"use client";

import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  hasChildren?: boolean;
}

export interface NavProps {
  items: NavItem[];
  activeHref?: string;
  linkComponent?: LinkComponent;
  className?: string;
}

const chevron = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[11px] w-[11px]">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export function Nav({ items, activeHref, linkComponent: Link = DefaultLink, className }: NavProps) {
  return (
    <nav className={cn("border-b border-line bg-white", className)}>
      <div className="mx-auto flex h-[46px] max-w-[1180px] items-center justify-center gap-[34px] overflow-x-auto px-5">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap font-ui text-[13.5px] font-medium text-ink hover:text-green",
              activeHref === item.href && "font-semibold text-green",
            )}
          >
            {item.label}
            {item.hasChildren && chevron}
          </Link>
        ))}
      </div>
    </nav>
  );
}
