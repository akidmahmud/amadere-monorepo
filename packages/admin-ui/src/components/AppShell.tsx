"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { NavItem } from "./NavItem";

export interface AppNavItem {
  key: string;
  label: string;
  icon: ReactNode;
  href: string;
  /** Permission key (e.g. "product.view") gating this row's visibility for
   * a non-super-admin. Omit for rows every admin should always see
   * (e.g. Overview). Filtering itself happens where `nav` is built, not
   * here — AppShell just renders whatever list it's given. */
  permission?: string;
  /** Red dot on this row — e.g. Recovery when new abandoned carts arrive. */
  dot?: boolean;
  /** Count of work waiting behind this row. Takes the place of `dot`, since a
   *  number says everything a dot does and more. */
  badge?: number;
}

/** A section header in the sidebar. Clicking it collapses the rows beneath,
 * so a long nav can be folded down to the sections someone actually uses. */
export interface AppNavSectionLabel {
  type: "label";
  key: string;
  label: string;
}

export type AppNavEntry = AppNavItem | AppNavSectionLabel;

export interface AppNotification {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
  unread?: boolean;
  type?: "order" | "cart" | "alert" | "system";
  onClick?: () => void;
}

function getNotificationIcon(n: AppNotification) {
  if (n.type === "order" || n.id.startsWith("order-")) {
    return (
      <div className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100/80">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </div>
    );
  }
  if (n.type === "cart" || n.id.startsWith("cart-") || n.id.includes("abandoned")) {
    return (
      <div className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100/80">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
      </div>
    );
  }
  return (
    <div className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-brand-50 text-brand-600 border border-brand-100/80">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
    </div>
  );
}

export interface AppShellProps {
  logo: ReactNode;
  /** Data-driven sidebar nav — never hardcode nav rows in a page. Flat list;
   * insert an `{ type: "label", ... }` entry to start a new labeled section. */
  nav: AppNavEntry[];
  activeHref: string;
  userName: string;
  userSubtitle?: string;
  onLogout?: () => void;
  pageTitle: string;
  dateLabel?: string;
  hasNotification?: boolean;
  onNotificationClick?: () => void;
  /**
   * Entries for the bell's dropdown. When omitted the bell keeps its old
   * behaviour — a dot plus a plain onNotificationClick — so any other caller
   * is unaffected.
   */
  notifications?: AppNotification[];
  /** Unread count for the badge. Falls back to the dot when not given. */
  notificationCount?: number;
  /** Fired when the panel opens, so the caller can mark entries seen. */
  onNotificationsOpen?: () => void;
  linkComponent?: LinkComponent;
  children: ReactNode;
}

const bellIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5 text-secondary">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);

const logoutIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M15 12H4M9 7l-5 5 5 5M15 4h4v16h-4" />
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

// The reference's own brand-icon glyph (a shopping bag) — kept literal since
// it's purely decorative chrome, not a wordmark; the real wordmark still
// comes from the `logo` prop (e.g. "Amader Admin").
const brandIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const sectionChevron = (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

function isLabel(entry: AppNavEntry): entry is AppNavSectionLabel {
  return "type" in entry && entry.type === "label";
}

interface RenderGroup {
  /** The label entry's own key — stable across renames, unlike the text.
   *  Null for the leading block above the first label (Overview), which has
   *  no header to click and so is never collapsible. */
  key: string | null;
  label: string | null;
  items: AppNavItem[];
}

function groupNav(entries: AppNavEntry[]): RenderGroup[] {
  const groups: RenderGroup[] = [{ key: null, label: null, items: [] }];
  for (const entry of entries) {
    if (isLabel(entry)) groups.push({ key: entry.key, label: entry.label, items: [] });
    else groups[groups.length - 1].items.push(entry);
  }
  return groups;
}

// A page like /products/77 (edit product) has no nav entry of its own — only
// its parent module (/products) does — so exact-match against `activeHref`
// left the whole sidebar unhighlighted on every sub-page. Matches "/href" or
// "/href/*" instead, so any page under a module keeps that module's nav row
// highlighted. `/net-profit` and `/net-profit/fraud` are both real, separate
// nav entries though (one module's own Overview row, one its subsection) —
// naive prefix matching would light up both at once on the fraud page, so
// this picks the single LONGEST matching href across the whole nav rather
// than matching each item independently.
function isPrefixMatch(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function resolveActiveHref(entries: AppNavEntry[], pathname: string): string | null {
  let best: string | null = null;
  for (const entry of entries) {
    if (isLabel(entry)) continue;
    if (isPrefixMatch(entry.href, pathname) && (!best || entry.href.length > best.length)) {
      best = entry.href;
    }
  }
  return best;
}

// §4 (rebuilt) — flush edge-to-edge shell matching the GetCommerce reference:
// fixed-width white sidebar with a border-right separator (no floating card,
// no gap, no collapse-to-icon-rail), flat nav rows under plain section
// labels, sticky flush topbar. Below 768px the sidebar becomes a real
// off-canvas drawer (the reference just hides it outright at 900px, which
// isn't usable for an app people actually run on a phone) — same drawer
// mechanics as before, reskinned to match.
export function AppShell({
  logo,
  nav,
  activeHref,
  userName,
  userSubtitle = "View profile",
  onLogout,
  pageTitle,
  hasNotification,
  onNotificationClick,
  notifications,
  notificationCount,
  onNotificationsOpen,
  linkComponent: Link = DefaultLink,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navFilter, setNavFilter] = useState("");
  // Tracks which sections are OPEN, not which are closed, so that everything
  // starts folded and stays folded — including sections that appear later.
  // That matters here: `nav` is empty until the signed-in admin's permissions
  // resolve, so a "collapse everything I can see at first render" default
  // would have seen nothing and left the whole menu open.
  //
  // ponytail: in-memory only. The shell lives in the route-group layout, so it
  // stays mounted across every client-side navigation and what you opened
  // stays open while you work; a hard reload folds it back down. Upgrade path
  // if that proves annoying: persist this set to localStorage, read after
  // mount so the server-rendered markup still matches.
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(),
  );
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [activeHref]);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [avatarMenuOpen]);

  useEffect(() => {
    if (!bellOpen) return;
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [bellOpen]);

  function handleClearCache() {
    setCacheMessage("Cache cleared");
    setTimeout(() => setCacheMessage(null), 2000);
  }

  const resolvedActiveHref = resolveActiveHref(nav, activeHref);

  const filter = navFilter.trim().toLowerCase();
  const groups = groupNav(nav)
    .map((g) => ({ ...g, items: filter ? g.items.filter((i) => i.label.toLowerCase().includes(filter)) : g.items }))
    .filter((g) => g.items.length > 0);

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  // A search hides nothing: folding is a browsing convenience, and a matching
  // row sitting inside a closed section reads as "no results".
  function isCollapsed(key: string | null): boolean {
    if (key === null || filter) return false;
    return !expandedSections.has(key);
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-30 hidden bg-black/40 max-[768px]:block"
        />
      )}

      <aside
        className={cn(
          "sticky top-0 z-20 flex h-screen w-[224px] flex-none flex-col gap-1 overflow-y-auto border-r border-border bg-sidebar-bg px-3.5 pt-4 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "max-[768px]:fixed max-[768px]:inset-y-0 max-[768px]:left-0 max-[768px]:z-40 max-[768px]:w-[260px] max-[768px]:shadow-pop max-[768px]:transition-transform max-[768px]:duration-200",
          mobileOpen ? "max-[768px]:translate-x-0" : "max-[768px]:-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-1 pb-4 pt-0.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] bg-brand-500 text-white">{brandIcon}</div>
            <div className="truncate font-display text-[1.05rem] font-extrabold tracking-tight text-text">{logo}</div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="hidden h-7 w-7 flex-none place-items-center rounded-sm text-sidebar-text hover:bg-sidebar-hover max-[768px]:grid"
          >
            {closeIcon}
          </button>
        </div>

        <label className="mb-3 flex h-[38px] flex-none items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-muted">
          {searchIcon}
          <input
            type="text"
            value={navFilter}
            onChange={(e) => setNavFilter(e.target.value)}
            placeholder="Search menu..."
            className="w-full border-0 bg-transparent font-ui text-[0.8rem] text-text outline-none placeholder:text-muted"
          />
        </label>

        <nav className="flex flex-col">
          {groups.map((g, i) => {
            const collapsed = isCollapsed(g.key);
            const panelId = g.key ? `nav-section-${g.key}` : undefined;
            // A collapsed section still reports what is buried in it —
            // folding a section away must never hide work. A summed count
            // where the rows carry counts, otherwise the plain dot.
            const hiddenCount = collapsed
              ? g.items.reduce((sum, item) => sum + (item.badge ?? 0), 0)
              : 0;
            const hasHiddenDot =
              collapsed && hiddenCount === 0 && g.items.some((item) => item.dot);

            return (
              <div key={g.key ?? `top-${i}`}>
                {g.label && g.key && (
                  <button
                    type="button"
                    onClick={() => toggleSection(g.key as string)}
                    aria-expanded={!collapsed}
                    aria-controls={panelId}
                    className="flex w-full items-center gap-1.5 rounded-inner px-1.5 pt-4 pb-2 text-left font-ui text-[0.76rem] font-bold tracking-wide text-brand-500 outline-none hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500/40"
                  >
                    <span
                      className={cn(
                        "flex-none transition-transform duration-150 motion-reduce:transition-none",
                        collapsed && "-rotate-90",
                      )}
                    >
                      {sectionChevron}
                    </span>
                    <span className="flex-1">{g.label}</span>
                    {hiddenCount > 0 && (
                      <span
                        aria-label={`${hiddenCount} waiting in ${g.label}`}
                        className="flex-none rounded-pill bg-red-500 px-1.5 py-0.5 text-[0.68rem] font-bold tabular-nums text-white"
                      >
                        {hiddenCount > 999 ? "999+" : hiddenCount}
                      </span>
                    )}
                    {hasHiddenDot && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 flex-none rounded-full bg-danger"
                      />
                    )}
                  </button>
                )}
                {!collapsed && (
                  <div id={panelId} className="flex flex-col gap-0.5">
                    {g.items.map((item) => (
                      <NavItem
                        key={item.key}
                        icon={item.icon}
                        label={item.label}
                        href={item.href}
                        active={item.href === resolvedActiveHref}
                        dot={item.dot}
                        badge={item.badge}
                        linkComponent={Link}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 flex-none items-center gap-3 border-b border-border bg-surface px-6 max-[768px]:gap-3 max-[768px]:px-4">
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
              className="inline-flex h-9 items-center gap-2 rounded-inner bg-[var(--stat-yellow,#e9a23b)] px-3.5 font-ui text-[13px] font-bold text-white transition-[filter] hover:brightness-95 max-[768px]:w-9 max-[768px]:justify-center max-[768px]:px-0"
            >
              {cacheIcon}
              <span className="max-[768px]:hidden">Clear cache</span>
            </button>
            <a
              href={
                process.env.NEXT_PUBLIC_STOREFRONT_URL && !process.env.NEXT_PUBLIC_STOREFRONT_URL.includes("localhost")
                  ? process.env.NEXT_PUBLIC_STOREFRONT_URL
                  : "https://amadere.com/"
              }
              target="_blank"
              rel="noreferrer"
              aria-label="Visit website"
              className="inline-flex h-9 items-center gap-2 rounded-inner bg-[#3a4356] px-3.5 font-ui text-[13px] font-bold text-white transition-[filter] hover:brightness-110 max-[768px]:w-9 max-[768px]:justify-center max-[768px]:px-0"
            >
              {visitIcon}
              <span className="max-[768px]:hidden">Visit website</span>
            </a>
            <div ref={bellRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!notifications) {
                    onNotificationClick?.();
                    return;
                  }
                  const next = !bellOpen;
                  setBellOpen(next);
                  if (next) onNotificationsOpen?.();
                }}
                aria-label="Notifications"
                aria-expanded={notifications ? bellOpen : undefined}
                className={cn(
                  "relative grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-surface text-secondary transition-all duration-150 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-600 active:scale-95",
                  bellOpen && "border-brand-500 bg-brand-50/80 text-brand-600 ring-2 ring-brand-500/20"
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    (notificationCount ?? 0) > 0 && "animate-[bounce_2s_infinite]"
                  )}
                >
                  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                {(notificationCount ?? 0) > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-600 px-1 text-[10px] font-extrabold text-white shadow-sm ring-2 ring-surface">
                    <span className="absolute -inset-0.5 rounded-full bg-red-500/50 animate-ping" />
                    <span className="relative">{notificationCount! > 99 ? "99+" : notificationCount}</span>
                  </span>
                ) : (
                  hasNotification && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 ring-2 ring-surface">
                      <span className="absolute -inset-0.5 rounded-full bg-red-500/50 animate-ping" />
                    </span>
                  )
                )}
              </button>
              {notifications && bellOpen && (
                <div className="absolute top-full right-0 z-40 mt-2 w-96 overflow-hidden rounded-2xl border border-border/80 bg-surface/95 shadow-2xl backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 bg-surface-2/40">
                    <div className="flex items-center gap-2 font-ui text-[13px] font-bold text-text">
                      <span>Notifications</span>
                      {(notificationCount ?? 0) > 0 && (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-extrabold text-brand-700">
                          {notificationCount} new
                        </span>
                      )}
                    </div>
                    {notifications.some((n) => n.unread) && (
                      <button
                        type="button"
                        onClick={() => {
                          onNotificationsOpen?.();
                        }}
                        className="font-ui text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-400 mb-2">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
                          <path d="m9 12 2 2 4-4" />
                        </svg>
                      </div>
                      <p className="font-ui text-sm font-bold text-text">All caught up!</p>
                      <p className="mt-1 text-xs text-muted">No new notifications right now.</p>
                    </div>
                  ) : (
                    <div className="max-h-[380px] overflow-y-auto divide-y divide-border/50 [scrollbar-width:thin]">
                      {notifications.map((n) => (
                        <Link
                          key={n.id}
                          href={n.href}
                          onClick={() => {
                            n.onClick?.();
                            setBellOpen(false);
                          }}
                          className={cn(
                            "group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2/80",
                            n.unread && "bg-brand-50/20 border-l-2 border-l-brand-500"
                          )}
                        >
                          {getNotificationIcon(n)}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className={cn("truncate font-ui text-[13px]", n.unread ? "font-bold text-text" : "font-semibold text-text/90")}>
                                {n.title}
                              </span>
                              {n.unread && (
                                <span className="h-2 w-2 flex-none rounded-full bg-danger animate-pulse" />
                              )}
                            </div>
                            {n.subtitle && (
                              <span className="mt-0.5 block truncate text-xs text-muted leading-relaxed">
                                {n.subtitle}
                              </span>
                            )}
                            {n.meta && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-muted">
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2}>
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span>{n.meta}</span>
                              </div>
                            )}
                          </div>
                          <span className="mt-1 text-muted opacity-0 group-hover:opacity-100 transition-opacity group-hover:translate-x-0.5">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div ref={avatarRef} className="relative">
              <button
                type="button"
                onClick={() => setAvatarMenuOpen((v) => !v)}
                aria-label="Account menu"
                className="grid h-9 w-9 flex-none place-items-center rounded-pill bg-brand-500 font-ui text-sm font-extrabold text-white outline outline-3 outline-brand-50"
              >
                {userName.trim().charAt(0).toUpperCase() || "A"}
              </button>
              {avatarMenuOpen && (
                <div className="absolute top-full right-0 z-30 mt-2 w-56 overflow-hidden rounded-card border border-border bg-surface shadow-pop">
                  <div className="border-b border-border px-3.5 py-3">
                    <div className="truncate text-[13px] font-semibold text-text">{userName}</div>
                    {userSubtitle && <div className="truncate text-xs text-muted">{userSubtitle}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      onLogout?.();
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left font-ui text-sm font-semibold text-text hover:bg-surface-2"
                  >
                    {logoutIcon}
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
