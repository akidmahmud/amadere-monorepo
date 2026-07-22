"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { NavItem } from "./NavItem";
import { NavGroup, type NavGroupChild } from "./NavGroup";

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

const searchIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const cacheIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="m21 2-9.6 9.6" />
    <path d="m15.5 7.5 3 3L22 7l-3-3" />
  </svg>
);

const visitIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const COLLAPSED_KEY = "admin-sidebar-collapsed";

const menuIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);

const closeIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navFilter, setNavFilter] = useState("");
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  // Below ~768px (true phone widths, distinct from the icon-rail tablet
  // breakpoint at 1024px above) the sidebar can't just shrink to icons —
  // there's no hover to reveal labels on a touch device, and squeezing
  // `main` into a sliver next to a permanent icon rail is unusable. Instead
  // it becomes a full-label off-canvas drawer, closed by default and
  // auto-closing on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [activeHref]);

  function handleClearCache() {
    setCacheMessage("Cache cleared");
    setTimeout(() => setCacheMessage(null), 2000);
  }

  function matchesFilter(item: AppNavItem): boolean {
    if (!navFilter.trim()) return true;
    const q = navFilter.trim().toLowerCase();
    if (item.label.toLowerCase().includes(q)) return true;
    return (item.children ?? []).some((c) => c.label.toLowerCase().includes(q));
  }

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

  // The `!inline`/`!flex` overrides force labels visible on the mobile
  // drawer regardless of the desktop collapsed/icon-rail state — a
  // temporary full-screen overlay has no use for an icon-only mode.
  const labelClass = cn(collapsed ? "hidden group-hover/sidebar:inline" : "max-[1024px]:hidden", "max-[768px]:!inline");

  return (
    <div
      className={cn(
        "grid min-h-screen items-start gap-3 bg-bg p-3",
        collapsed ? "grid-cols-[72px_1fr]" : "grid-cols-[240px_1fr] max-[1024px]:grid-cols-[72px_1fr]",
        "max-[768px]:grid-cols-1",
      )}
    >
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-30 hidden bg-black/40 max-[768px]:block"
        />
      )}

      <aside
        className={cn(
          "group/sidebar sticky top-3 z-20 flex h-[calc(100vh-1.5rem)] flex-none flex-col overflow-hidden rounded-card border border-border bg-sidebar-bg px-3 py-4 transition-[width] duration-150",
          collapsed ? "w-[72px] hover:w-[288px] hover:overflow-visible hover:shadow-pop" : "w-[240px]",
          "max-[768px]:fixed max-[768px]:inset-y-3 max-[768px]:left-3 max-[768px]:z-40 max-[768px]:!w-[260px] max-[768px]:!h-[calc(100vh-1.5rem)] max-[768px]:overflow-y-auto max-[768px]:transition-transform max-[768px]:duration-200",
          mobileOpen ? "max-[768px]:translate-x-0 max-[768px]:shadow-pop" : "max-[768px]:-translate-x-[120%]",
        )}
      >
        <div className="flex items-center justify-between pb-[22px]">
          <div className={cn("px-2 pt-1.5 font-display text-xl font-bold whitespace-nowrap text-text", labelClass)}>{logo}</div>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid h-7 w-7 flex-none place-items-center rounded-sm text-sidebar-text hover:bg-sidebar-hover max-[768px]:hidden"
          >
            <span className={cn("transition-transform duration-150", collapsed && "rotate-180")}>{collapseIcon}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="hidden h-7 w-7 flex-none place-items-center rounded-sm text-sidebar-text hover:bg-sidebar-hover max-[768px]:grid"
          >
            {closeIcon}
          </button>
        </div>
        <label className={cn("mb-3 flex h-9 items-center gap-2 rounded-inner border border-border bg-surface px-2.5 text-secondary", collapsed && "hidden group-hover/sidebar:flex")}>
          {searchIcon}
          <input
            type="text"
            value={navFilter}
            onChange={(e) => setNavFilter(e.target.value)}
            placeholder="Search menu..."
            className="w-full border-0 bg-transparent font-ui text-xs text-text outline-none placeholder:text-muted"
          />
        </label>
        <nav className="flex flex-col gap-1">
          {nav.filter(matchesFilter).map((item) =>
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
        <header className="flex h-16 flex-none items-center gap-3 border-b border-border px-6 max-[768px]:gap-3 max-[768px]:px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="hidden h-9 w-9 flex-none place-items-center rounded-inner border border-border text-text max-[768px]:grid"
          >
            {menuIcon}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-ui text-[11px] font-bold tracking-wide text-secondary uppercase max-[768px]:hidden">
              <span className="text-brand-500">Home</span>
              <span className="text-muted">›</span>
              <span className="text-brand-500">{pageTitle}</span>
            </div>
            <h1 className="mt-0.5 font-ui text-lg font-extrabold text-text">{pageTitle}</h1>
          </div>
          <div className="ml-auto flex items-center gap-3 max-[768px]:gap-2">
            {cacheMessage && <span className="text-xs font-semibold text-success max-[768px]:hidden">{cacheMessage}</span>}
            <button
              type="button"
              onClick={handleClearCache}
              aria-label="Clear cache"
              className="inline-flex h-9 items-center gap-2 rounded-inner bg-[var(--stat-yellow,#e9a23b)] px-3.5 font-ui text-[13px] font-bold text-white transition-[filter] hover:brightness-95 max-[768px]:w-9 max-[768px]:px-0 max-[768px]:justify-center"
            >
              {cacheIcon}
              <span className="max-[768px]:hidden">Clear cache</span>
            </button>
            <a
              href={process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3001"}
              target="_blank"
              rel="noreferrer"
              aria-label="Visit website"
              className="inline-flex h-9 items-center gap-2 rounded-inner bg-[#3a4356] px-3.5 font-ui text-[13px] font-bold text-white transition-[filter] hover:brightness-110 max-[768px]:w-9 max-[768px]:px-0 max-[768px]:justify-center"
            >
              {visitIcon}
              <span className="max-[768px]:hidden">Visit website</span>
            </a>
            <button
              type="button"
              onClick={onNotificationClick}
              aria-label="Notifications"
              className="relative grid h-9 w-9 place-items-center rounded-inner bg-brand-50 text-brand-500"
            >
              {bellIcon}
              {hasNotification && (
                <span className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-pill border-2 border-surface bg-danger px-1 text-[10px] font-bold text-white">
                  •
                </span>
              )}
            </button>
            <div className="grid h-9 w-9 flex-none place-items-center rounded-pill bg-brand-500 font-ui text-sm font-extrabold text-white outline outline-3 outline-brand-50">
              {userName.trim().charAt(0).toUpperCase() || "A"}
            </div>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
