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
}

/** A section header row in the sidebar — matches the reference's plain
 * `.nav-label` separators, not a collapsible group. */
export interface AppNavSectionLabel {
  type: "label";
  key: string;
  label: string;
}

export type AppNavEntry = AppNavItem | AppNavSectionLabel;

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

function isLabel(entry: AppNavEntry): entry is AppNavSectionLabel {
  return "type" in entry && entry.type === "label";
}

interface RenderGroup {
  label: string | null;
  items: AppNavItem[];
}

function groupNav(entries: AppNavEntry[]): RenderGroup[] {
  const groups: RenderGroup[] = [{ label: null, items: [] }];
  for (const entry of entries) {
    if (isLabel(entry)) groups.push({ label: entry.label, items: [] });
    else groups[groups.length - 1].items.push(entry);
  }
  return groups;
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
  linkComponent: Link = DefaultLink,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navFilter, setNavFilter] = useState("");
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

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

  function handleClearCache() {
    setCacheMessage("Cache cleared");
    setTimeout(() => setCacheMessage(null), 2000);
  }

  const filter = navFilter.trim().toLowerCase();
  const groups = groupNav(nav)
    .map((g) => ({ ...g, items: filter ? g.items.filter((i) => i.label.toLowerCase().includes(filter)) : g.items }))
    .filter((g) => g.items.length > 0);

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
          {groups.map((g, i) => (
            <div key={g.label ?? `top-${i}`}>
              {g.label && (
                <div className="px-1.5 pt-4 pb-2 font-ui text-[0.76rem] font-bold tracking-wide text-brand-500">{g.label}</div>
              )}
              <div className="flex flex-col gap-0.5">
                {g.items.map((item) => (
                  <NavItem
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    href={item.href}
                    active={item.href === activeHref}
                    linkComponent={Link}
                  />
                ))}
              </div>
            </div>
          ))}
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
              href={process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3001"}
              target="_blank"
              rel="noreferrer"
              aria-label="Visit website"
              className="inline-flex h-9 items-center gap-2 rounded-inner bg-[#3a4356] px-3.5 font-ui text-[13px] font-bold text-white transition-[filter] hover:brightness-110 max-[768px]:w-9 max-[768px]:justify-center max-[768px]:px-0"
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
