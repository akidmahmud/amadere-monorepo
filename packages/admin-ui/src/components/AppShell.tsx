"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { NavItem } from "./NavItem";
import { NavGroup, type NavGroupChild } from "./NavGroup";
import { SearchInput } from "./SearchInput";

export interface AppNavItem {
  key: string;
  label: string;
  icon: ReactNode;
  /** Plain link when set; omit and use `children` instead for a collapsible group. */
  href?: string;
  /** Renders as a collapsible group instead of a link when present. */
  children?: NavGroupChild[];
}

export interface AppShellProps {
  logo: ReactNode;
  /** Data-driven sidebar nav — never hardcode nav rows in a page. */
  nav: AppNavItem[];
  activeHref: string;
  userName: string;
  userSubtitle?: string;
  onLogout?: () => void;
  pageTitle: string;
  dateLabel?: string;
  hasNotification?: boolean;
  onNotificationClick?: () => void;
  linkComponent?: LinkComponent;
  children: ReactNode;
}

const bellIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5 text-secondary">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);

const logoutIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M15 12H4M9 7l-5 5 5 5M15 4h4v16h-4" />
  </svg>
);

// §4 — fixed 240px sidebar + ~72px topbar + content area. Below ~1024px the
// sidebar collapses to icons-only (72px, handled per-item via NavItem's own
// responsive label hiding — no JS breakpoint state needed).
export function AppShell({
  logo,
  nav,
  activeHref,
  userName,
  userSubtitle = "View profile",
  onLogout,
  pageTitle,
  dateLabel,
  hasNotification,
  onNotificationClick,
  linkComponent: Link = DefaultLink,
  children,
}: AppShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] max-[1024px]:grid-cols-[72px_1fr]">
      <aside className="sticky top-0 flex h-screen flex-col bg-sidebar-bg px-4 py-[22px]">
        <div className="px-2 pt-1.5 pb-[22px] font-display text-xl font-bold text-white max-[1024px]:hidden">{logo}</div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) =>
            item.children ? (
              <NavGroup
                key={item.key}
                icon={item.icon}
                label={item.label}
                children={item.children}
                activeHref={activeHref}
                linkComponent={Link}
              />
            ) : (
              <NavItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                href={item.href!}
                active={item.href === activeHref}
                linkComponent={Link}
              />
            ),
          )}
        </nav>
        <div className="flex-1" />
        <div className="mt-3.5 flex flex-col gap-3 border-t border-[#2A2A2A] pt-3.5">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2.5 rounded-sm bg-sidebar-hover px-3 py-2.5 font-ui text-sm text-sidebar-text"
          >
            {logoutIcon}
            <span className="max-[1024px]:hidden">Logout</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 flex-none rounded-pill bg-gradient-to-br from-brand-400 to-brand-700" />
            <div className="min-w-0 max-[1024px]:hidden">
              <div className="truncate text-[13px] font-semibold text-white">{userName}</div>
              <div className="truncate text-xs text-sidebar-text">{userSubtitle}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-[72px] items-center justify-between px-7">
          <div className="flex items-center gap-2.5">
            <h1 className="font-ui text-xl font-bold text-text">{pageTitle}</h1>
            {dateLabel && <span className="text-[13px] text-muted">›› {dateLabel}</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNotificationClick}
              aria-label="Notifications"
              className="relative grid h-10 w-10 place-items-center rounded-pill border border-border bg-surface"
            >
              {bellIcon}
              {hasNotification && (
                <span className="absolute top-[9px] right-[11px] h-[7px] w-[7px] rounded-full border-2 border-surface bg-danger" />
              )}
            </button>
            <SearchInput />
          </div>
        </header>
        <main className={cn("flex flex-1 flex-col gap-6 px-7 pt-2 pb-10")}>{children}</main>
      </div>
    </div>
  );
}
