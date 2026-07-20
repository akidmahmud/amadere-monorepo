"use client";

import { useEffect, useState, type ReactNode } from "react";
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

const collapseIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

const COLLAPSED_KEY = "admin-sidebar-collapsed";

// §4 — fixed 240px sidebar + content area, both rendered as floating inset
// panels on a neutral page backdrop (shadcn dashboard-01 parity). Below
// ~1024px the sidebar auto-collapses to icons-only via the media query;
// above that, the user can manually collapse it (persisted), and a
// collapsed sidebar temporarily widens on hover (an overlay — it doesn't
// reflow `main`, which is what actually lets content reclaim the freed
// space) via the `group/sidebar` + `group-hover/sidebar:` pairing below.
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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  const labelClass = collapsed ? "hidden group-hover/sidebar:inline" : "max-[1024px]:hidden";

  return (
    <div
      className={cn(
        "grid min-h-screen items-start gap-3 bg-bg p-3",
        collapsed ? "grid-cols-[72px_1fr]" : "grid-cols-[240px_1fr] max-[1024px]:grid-cols-[72px_1fr]",
      )}
    >
      <aside
        className={cn(
          "group/sidebar sticky top-3 z-20 flex h-[calc(100vh-1.5rem)] flex-none flex-col overflow-hidden rounded-card border border-border bg-sidebar-bg px-3 py-4 transition-[width] duration-150",
          collapsed ? "w-[72px] hover:w-[288px] hover:overflow-visible hover:shadow-pop" : "w-[240px]",
        )}
      >
        <div className="flex items-center justify-between pb-[22px]">
          <div className={cn("px-2 pt-1.5 font-display text-xl font-bold whitespace-nowrap text-text", labelClass)}>{logo}</div>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid h-7 w-7 flex-none place-items-center rounded-sm text-sidebar-text hover:bg-sidebar-hover"
          >
            <span className={cn("transition-transform duration-150", collapsed && "rotate-180")}>{collapseIcon}</span>
          </button>
        </div>
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
                labelClassName={labelClass}
              />
            ) : (
              <NavItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                href={item.href!}
                active={item.href === activeHref}
                linkComponent={Link}
                labelClassName={labelClass}
              />
            ),
          )}
        </nav>
        <div className="flex-1" />
        <div className="mt-3.5 flex flex-col gap-3 border-t border-border pt-3.5">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2.5 rounded-sm bg-sidebar-hover px-3 py-2.5 font-ui text-sm whitespace-nowrap text-sidebar-text"
          >
            {logoutIcon}
            <span className={labelClass}>Logout</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 flex-none rounded-pill bg-gradient-to-br from-brand-400 to-brand-700" />
            <div className={cn("min-w-0 whitespace-nowrap", labelClass)}>
              <div className="truncate text-[13px] font-semibold text-text">{userName}</div>
              <div className="truncate text-xs text-sidebar-text">{userSubtitle}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card">
        <header className="flex h-14 flex-none items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-2.5">
            <h1 className="font-ui text-lg font-semibold text-text">{pageTitle}</h1>
            {dateLabel && <span className="text-[13px] text-muted">›› {dateLabel}</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNotificationClick}
              aria-label="Notifications"
              className="relative grid h-9 w-9 place-items-center rounded-pill border border-border bg-surface"
            >
              {bellIcon}
              {hasNotification && (
                <span className="absolute top-[8px] right-[10px] h-[7px] w-[7px] rounded-full border-2 border-surface bg-danger" />
              )}
            </button>
            <SearchInput />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
