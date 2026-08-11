"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { useMobileNavDrawerStore } from "../stores/mobileNavDrawerStore";

const closeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const chevronIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3 shrink-0 text-header-muted transition-transform duration-150">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const trackIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px] shrink-0">
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const accountIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px] shrink-0">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const wishlistIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px] shrink-0">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);
const globeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px] shrink-0">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9Z" />
  </svg>
);

// Shared with Header.tsx's hamburger button (aria-controls) so the two
// components agree on the drawer's id without threading a prop between them.
export const MOBILE_DRAWER_ID = "amader-mobile-nav-drawer";

export interface MobileDrawerCategory {
  key: string;
  label: string;
  href: string;
  children?: { key: string; label: string; href: string }[];
}

export interface MobileDrawerProps {
  brandHref: string;
  brandMark: string;
  logoUrl?: string;
  /** Same meaning as Header's logoPaddingPx/logoMarginPx — see there. */
  logoPaddingPx?: number;
  logoMarginPx?: number;
  closeLabel: string;
  allProductsHref: string;
  allProductsLabel: string;
  categories: MobileDrawerCategory[];
  trackOrderHref: string;
  trackOrderLabel: string;
  accountHref?: string;
  accountLabel?: string;
  wishlistHref?: string;
  wishlistLabel?: string;
  localeSwitchLabel: string;
  onLocaleSwitch: () => void;
  quickLinksLabel?: string;
  linkComponent?: LinkComponent;
}

// Spec 5.2: logo+close row, then the category list (children as an
// accordion, not a hover dropdown — there's no hover on touch), a divider,
// then Track Order / My Account / Wishlist / locale as a plain link group.
// Radix Dialog supplies the focus trap, Escape-to-close, overlay-click-to-close,
// and body scroll lock for free — this file only adds the drawer's own content.
export function MobileDrawer({
  brandHref,
  brandMark,
  logoUrl,
  logoPaddingPx = 0,
  logoMarginPx = 0,
  closeLabel,
  allProductsHref,
  allProductsLabel,
  categories,
  trackOrderHref,
  trackOrderLabel,
  accountHref,
  accountLabel,
  wishlistHref,
  wishlistLabel,
  localeSwitchLabel,
  onLocaleSwitch,
  quickLinksLabel = "Quick Links",
  linkComponent: Link = DefaultLink,
}: MobileDrawerProps) {
  const isOpen = useMobileNavDrawerStore((s) => s.isOpen);
  const close = useMobileNavDrawerStore((s) => s.close);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Radix returns focus to the trigger on close automatically only when the
  // trigger is its own <Dialog.Trigger> — this hamburger lives in Header.tsx,
  // a separate component connected only via the shared store, so Radix has
  // no reference to it. Focus it manually by its aria-controls link instead
  // (spec 7: "focus returns to hamburger").
  function handleOpenChange(open: boolean) {
    if (open) return;
    close();
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[aria-controls="${MOBILE_DRAWER_ID}"]`)?.focus();
    });
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(0,0,0,.45)] data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <Dialog.Content
          id={MOBILE_DRAWER_ID}
          className="fixed left-0 top-0 z-[70] flex h-full w-[300px] max-w-[85vw] flex-col gap-4 overflow-y-auto bg-white p-4 pb-20 font-header"
          aria-describedby={undefined}
        >
          <div className="flex shrink-0 items-center justify-between">
            <Dialog.Title asChild>
              <Link href={brandHref} className="flex items-center" onClick={close}>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={brandMark}
                    className="h-10 w-auto"
                    style={{ padding: logoPaddingPx, margin: logoMarginPx, boxSizing: "border-box" }}
                  />
                ) : (
                  <span className="font-bengali text-lg font-bold text-header-green">{brandMark}</span>
                )}
              </Link>
            </Dialog.Title>
            <Dialog.Close
              aria-label={closeLabel}
              className="grid h-8 w-8 place-items-center rounded-full text-header-ink hover:bg-header-line/40"
            >
              {closeIcon}
            </Dialog.Close>
          </div>

          {/* Pixel-matched to ghorerbazar.com's `.sidebar-menu-head` (orange
              card, avatar + greeting) — recolored to brand green per
              explicit request. */}
          <div className="flex shrink-0 items-center gap-3 rounded-xl bg-green p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 text-white">{accountIcon}</div>
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-white">Hello there!</p>
              {accountHref && accountLabel && (
                <Link href={accountHref} onClick={close} className="text-sm text-white/85 hover:text-white hover:underline">
                  {accountLabel}
                </Link>
              )}
            </div>
          </div>

          {/* Pixel-matched to ghorerbazar.com's `.mobile-menu` card (light
              card, per-row divider, chevron accordion for submenus). */}
          <ul className="shrink-0 rounded-lg bg-header-line/15 px-2">
            <li className="border-b border-header-line/60">
              <Link
                href={allProductsHref}
                onClick={close}
                className="block px-2 py-3 text-[13.5px] font-normal text-header-ink hover:text-header-green"
              >
                {allProductsLabel}
              </Link>
            </li>
            {categories.map((category, i) => {
              const hasChildren = !!category.children?.length;
              const isExpanded = expanded.has(category.key);
              return (
                <li key={category.key} className={cn(i < categories.length - 1 && "border-b border-header-line/60")}>
                  <div className="flex items-stretch">
                    <Link
                      href={category.href}
                      onClick={close}
                      className="flex-1 px-2 py-3 text-[13.5px] font-normal text-header-ink hover:text-header-green"
                    >
                      {category.label}
                    </Link>
                    {hasChildren && (
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={category.label}
                        onClick={() => toggle(category.key)}
                        className="grid w-9 place-items-center"
                      >
                        <span className={cn("transition-transform duration-150", isExpanded && "rotate-180")}>{chevronIcon}</span>
                      </button>
                    )}
                  </div>
                  {hasChildren && isExpanded && (
                    <ul className="pb-1">
                      {category.children!.map((child) => (
                        <li key={child.key}>
                          <Link
                            href={child.href}
                            onClick={close}
                            className="block px-4 py-2.5 text-[13px] font-medium text-header-muted hover:text-header-green"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Pixel-matched to ghorerbazar.com's `.sidebar-more-menu-widget`
              ("Quick Links" heading + icon-row card). */}
          <div className="shrink-0">
            <p className="relative mb-3 inline-block text-[15px] font-semibold text-header-ink after:absolute after:-bottom-1.5 after:left-0 after:h-[3px] after:w-8 after:rounded-full after:bg-header-green after:content-['']">
              {quickLinksLabel}
            </p>
            <ul className="rounded-lg bg-header-line/15 p-1">
              <li>
                <Link
                  href={trackOrderHref}
                  onClick={close}
                  className="flex items-center gap-2.5 px-2 py-2.5 text-[13.5px] font-medium text-header-ink hover:text-header-green"
                >
                  {trackIcon}
                  {trackOrderLabel}
                </Link>
              </li>
              {wishlistHref && wishlistLabel && (
                <li>
                  <Link
                    href={wishlistHref}
                    onClick={close}
                    className="flex items-center gap-2.5 px-2 py-2.5 text-[13.5px] font-medium text-header-ink hover:text-header-green"
                  >
                    {wishlistIcon}
                    {wishlistLabel}
                  </Link>
                </li>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onLocaleSwitch();
                    close();
                  }}
                  className="flex w-full items-center gap-2.5 px-2 py-2.5 text-left text-[13.5px] font-medium text-header-ink hover:text-header-green"
                >
                  {globeIcon}
                  {localeSwitchLabel}
                </button>
              </li>
            </ul>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
