"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { useCartDrawerStore } from "../stores/cartDrawerStore";
import { useMobileNavDrawerStore } from "../stores/mobileNavDrawerStore";
import { MOBILE_DRAWER_ID } from "./MobileDrawer";

const searchIcon = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
const trackIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const cartIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);
const smallCartIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);
const accountIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const wishlistIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);
const globeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9Z" />
  </svg>
);
const hamburgerIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
    <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
  </svg>
);
const closeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
  </svg>
);
const homeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const blogIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

export interface HeaderProps {
  brandHref: string;
  brandMark: string;
  logoUrl?: string;
  /** Inset space inside the logo's own box (shrinks the visible mark within
   * its fixed-size slot) — admin-configurable, see SettingsService's
   * SITE_LOGO_STYLE_KEY / SiteInfoDto.logoPaddingPx. */
  logoPaddingPx?: number;
  /** Extra space around the logo's box, pushing it away from neighboring
   * header elements — see SiteInfoDto.logoMarginPx. */
  logoMarginPx?: number;
  /** Desktop-only "Home" link shown between logo and search bar. */
  homeHref?: string;
  homeLabel?: string;
  /** Desktop-only "Blog" link shown between logo and search bar. */
  blogHref?: string;
  blogLabel?: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  onSearchSubmit?: (query: string) => void;
  onSearchQueryChange?: (query: string) => void;
  searchSuggestions?: ReactNode;
  trackOrderHref: string;
  trackOrderLabel: string;
  accountHref?: string;
  accountLabel?: string;
  wishlistHref?: string;
  wishlistLabel?: string;
  wishlistCount?: number;
  cartLabel: string;
  cartCount?: number;
  localeSwitchLabel: string;
  onLocaleSwitch: () => void;
  /** aria-label for the mobile-only hamburger button that opens MobileDrawer. */
  mobileMenuLabel: string;
  linkComponent?: LinkComponent;
  className?: string;
}

// Spec 5.1's badge (remeasured from ghorerbazar.com's cart-count pill),
// recolored to brand green + white per explicit request.
function Badge({ count }: { count?: number }) {
  if (count === undefined || count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-green px-1 text-[10px] font-extrabold text-white ring-2 ring-white">
      {count}
    </span>
  );
}

// ghorerbazar.com's cart icon plays a bounce animation whenever an item is
// added — this reproduces that by watching cartCount for an increase (not
// just "> 0", so it also fires on the 2nd/3rd add, not only the very first).
function useCartBounce(cartCount?: number) {
  const [bouncing, setBouncing] = useState(false);
  const prevRef = useRef(cartCount);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = cartCount;
    if (cartCount !== undefined && prev !== undefined && cartCount > prev) {
      setBouncing(true);
      const timer = setTimeout(() => setBouncing(false), 700);
      return () => clearTimeout(timer);
    }
  }, [cartCount]);
  return bouncing;
}

export function Header({
  brandHref,
  brandMark,
  logoUrl,
  logoPaddingPx = 0,
  logoMarginPx = 0,
  homeHref,
  homeLabel,
  blogHref,
  blogLabel,
  searchPlaceholder,
  searchAriaLabel,
  onSearchSubmit,
  onSearchQueryChange,
  searchSuggestions,
  trackOrderHref,
  trackOrderLabel,
  accountHref,
  accountLabel,
  wishlistHref,
  wishlistLabel,
  wishlistCount,
  cartLabel,
  cartCount,
  localeSwitchLabel,
  onLocaleSwitch,
  mobileMenuLabel,
  linkComponent: Link = DefaultLink,
  className,
}: HeaderProps) {
  // `boxSizing: border-box` so padding shrinks the visible logo *within* its
  // fixed-height slot (h-[88px]/h-full below) instead of growing past it —
  // a plain content-box padding would add on top of the slot's height and
  // overflow it, same overflow problem explicit sizing already had to work
  // around once this session.
  const logoStyle = { padding: logoPaddingPx, margin: logoMarginPx, boxSizing: "border-box" as const };
  const [query, setQuery] = useState("");
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const openCart = useCartDrawerStore((s) => s.open);
  const isDrawerOpen = useMobileNavDrawerStore((s) => s.isOpen);
  const openDrawer = useMobileNavDrawerStore((s) => s.open);
  const cartBouncing = useCartBounce(cartCount);

  function handleQueryChange(value: string) {
    setQuery(value);
    onSearchQueryChange?.(value);
    setIsSuggestionsOpen(value.trim().length > 0);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSuggestionsOpen(false);
    setIsMobileSearchOpen(false);
    onSearchSubmit?.(query);
  }

  // Shared between the mobile and desktop layouts (spec 5.1's 48/48/44px
  // tiers and 5.2's 40px mobile row both use the same input+button markup) —
  // only the wrapper's height/rounding differ per call site.
  function searchForm(heightClass: string, autoFocus = false) {
    return (
      <form
        onSubmit={handleSubmit}
        className={cn(
          "flex w-full items-center rounded-lg border border-header-green bg-white pl-[18px] pr-1.5 transition-colors focus-within:border-header-green focus-within:bg-white focus-within:ring-2 focus-within:ring-header-green/20",
          heightClass,
        )}
      >
        <input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => query.trim().length > 0 && setIsSuggestionsOpen(true)}
          onBlur={() => setIsSuggestionsOpen(false)}
          placeholder={searchPlaceholder}
          autoFocus={autoFocus}
          className="w-0 flex-1 bg-transparent font-header text-sm text-header-ink outline-none placeholder:text-header-muted"
        />
        <button
          type="submit"
          aria-label={searchAriaLabel}
          className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-md text-header-ink hover:bg-white/70"
        >
          {searchIcon}
        </button>
      </form>
    );
  }

  function suggestionsPanel() {
    if (!isSuggestionsOpen || !searchSuggestions) return null;
    return (
      // onMouseDown fires before the input's onBlur, and preventDefault stops
      // that mousedown from shifting focus away from the input at all — so
      // blur never closes this before a click on a suggestion link runs.
      <div
        onMouseDown={(e) => e.preventDefault()}
        className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-lg border border-header-line bg-white shadow-brand"
      >
        {searchSuggestions}
      </div>
    );
  }

  // Remeasured from ghorerbazar.com: actions are icon-only ~22×22px at
  // md/lg (no separate 44×44 "compact" tier, no padded hover box — just a
  // bare icon that shifts color on hover), then auto-width icon+label
  // stacks (~44px tall, no fixed min-width column) at xl. Replaces the
  // earlier 44×44/74×64 padded-box tiers. Colored brand green (not the
  // reference's dark ink) per explicit request — cart-toggle/label-down-link
  // items specifically.
  const desktopActionClass =
    "relative flex h-[22px] w-[22px] items-center justify-center text-green hover:text-green-dark xl:h-11 xl:w-auto xl:flex-col xl:justify-center xl:gap-1";
  const desktopActionLabelClass = "hidden font-header text-[11px] font-semibold xl:inline";

  return (
    // Sticky only on mobile (no separate Nav bar exists there to take over
    // the job) — at md+, Nav.tsx becomes the sticky element instead, so
    // scrolling shows just the slim category bar, not this whole
    // logo/search/actions row, per explicit user request.
    <header className={cn("sticky top-0 z-40 border-b border-header-line bg-white font-header md:relative md:z-50", className)}>
      {/* ===== Mobile (<768px) — single row + drawer + search overlay =====
          The search bar used to be a permanent second row; now it's a
          tap-to-open icon beside Cart (per explicit user request), so the
          header is a single row on mobile. Row height bumped from the
          original 64px to 104px, and the logo from 48px to 88px, per
          explicit request for a larger logo — 104px is that 88px logo plus
          enough padding to actually fit inside the row (a straight
          height-for-height swap would have made the logo taller than its
          own row and spill out past the header's top/bottom edges). */}
      <div className="md:hidden">
        <div className="grid h-[84px] grid-cols-[44px_1fr_44px_44px] items-center px-4">
          <button
            type="button"
            aria-label={mobileMenuLabel}
            aria-expanded={isDrawerOpen}
            aria-controls={MOBILE_DRAWER_ID}
            onClick={openDrawer}
            className="grid h-11 w-11 place-items-center text-header-ink"
          >
            {hamburgerIcon}
          </button>
          <Link href={brandHref} className="col-start-2 flex items-center justify-self-center ml-[44px]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brandMark} className="h-[80px] w-auto" style={logoStyle} />
            ) : (
              <span className="font-bengali text-lg font-bold text-header-green">{brandMark}</span>
            )}
          </Link>
          <button
            type="button"
            aria-label={searchAriaLabel}
            onClick={() => setIsMobileSearchOpen(true)}
            className="col-start-3 grid h-11 w-11 place-items-center justify-self-end text-header-ink"
          >
            {searchIcon}
          </button>
          <button
            type="button"
            onClick={openCart}
            aria-label={`${cartLabel}, ${cartCount ?? 0} items`}
            className="relative col-start-4 flex h-full w-11 flex-col items-center justify-center justify-self-end gap-0.5 text-green"
          >
            <span className={cn("relative", cartBouncing && "animate-bounce")}>
              {smallCartIcon}
              <Badge count={cartCount} />
            </span>
            <span className="font-header text-[10px] font-semibold">{cartLabel}</span>
          </button>
        </div>

        {isMobileSearchOpen && (
          <div className="fixed inset-0 z-50">
            {/* Backdrop — dims/"focuses out" the rest of the page while
                searching, tap to dismiss. */}
            <div
              className="absolute inset-0 bg-ink/40"
              onClick={() => setIsMobileSearchOpen(false)}
              aria-hidden
            />
            <div className="relative border-b border-header-line bg-white px-4 py-3 shadow-brand">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  {searchForm("h-11", true)}
                  {suggestionsPanel()}
                </div>
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => setIsMobileSearchOpen(false)}
                  className="grid h-11 w-11 shrink-0 place-items-center text-header-ink"
                >
                  {closeIcon}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== Tablet/laptop/desktop (>=768px) ===== */}
      <div className="mx-auto hidden w-full max-w-[1440px] items-center px-6 md:grid md:h-[112px] md:grid-cols-[auto_auto_1fr_auto] md:gap-x-[28px] lg:gap-x-8 xl:gap-x-10">
        <Link href={brandHref} className="flex h-[100px] shrink-0 items-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandMark} className="h-full w-auto" style={logoStyle} />
          ) : (
            <span className="font-bengali text-xl font-bold text-header-green">{brandMark}</span>
          )}
        </Link>

        {/* Home & Blog quick links — matches ghorerbazar.com's desktop header
            layout: logo → Home | Blog → wide search bar → action icons. */}
        {(homeHref || blogHref) && (
          <div className="flex shrink-0 items-center gap-3">
            {homeHref && homeLabel && (
              <Link href={homeHref} className="flex items-center gap-1.5 font-header text-[13px] font-semibold text-header-green underline decoration-header-green/40 underline-offset-2 hover:decoration-header-green">
                {homeIcon}
                {homeLabel}
              </Link>
            )}
            {homeHref && blogHref && (
              <span className="h-5 w-px bg-header-line" aria-hidden />
            )}
            {blogHref && blogLabel && (
              <Link href={blogHref} className="flex items-center gap-1.5 font-header text-[13px] font-semibold text-header-green underline decoration-header-green/40 underline-offset-2 hover:decoration-header-green">
                {blogIcon}
                {blogLabel}
              </Link>
            )}
          </div>
        )}

        <div className="relative w-full">
          {searchForm("h-[47px]")}
          {suggestionsPanel()}
        </div>

        <div className="flex shrink-0 items-center gap-[23px]">
          {/* Locale switch leads the group (not trailing after Cart) so Cart
              stays the true rightmost action, its right edge flush with the
              container's own right edge — per the exact position spec
              (Cart 1342-1416 at a 1440px container, right edge = container
              right = 1440-24 gutter = 1416). */}
          <button type="button" onClick={onLocaleSwitch} className={desktopActionClass}>
            {globeIcon}
            <span className={desktopActionLabelClass}>{localeSwitchLabel}</span>
          </button>
          <Link href={trackOrderHref} className={desktopActionClass}>
            {trackIcon}
            <span className={desktopActionLabelClass}>{trackOrderLabel}</span>
          </Link>
          {accountHref && accountLabel && (
            <Link href={accountHref} className={desktopActionClass}>
              {accountIcon}
              <span className={desktopActionLabelClass}>{accountLabel}</span>
            </Link>
          )}
          {wishlistHref && wishlistLabel && (
            <Link href={wishlistHref} className={desktopActionClass}>
              {wishlistIcon}
              <Badge count={wishlistCount} />
              <span className={desktopActionLabelClass}>{wishlistLabel}</span>
            </Link>
          )}
          <button type="button" onClick={openCart} aria-label={`${cartLabel}, ${cartCount ?? 0} items`} className={desktopActionClass}>
            <span className={cn("relative flex items-center justify-center", cartBouncing && "animate-bounce")}>
              {cartIcon}
              <Badge count={cartCount} />
            </span>
            <span className={desktopActionLabelClass}>{cartLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
