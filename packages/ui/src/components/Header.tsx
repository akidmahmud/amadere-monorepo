"use client";

import { FormEvent, ReactNode, useState } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { useCartDrawerStore } from "../stores/cartDrawerStore";
import { useMobileNavDrawerStore } from "../stores/mobileNavDrawerStore";

const leaf = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-green">
    <path d="M17 8C8 10 5.9 16.2 3.8 21.5c-.4 1 .5 1.9 1.5 1.5C10.6 21 16.8 18.9 19 10c1-4 .4-6-1.5-8C15.6.2 12.6.6 10 3c-1.5 1.4-2 3.5-1 5 .5.8 1.5 1.2 2.3 1 1-.3 1.7-1.5 1.7-2.5" />
  </svg>
);
const searchIcon = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.2}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4-4" />
  </svg>
);
const trackIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
    <path d="M3 7h13v10H3zM16 10h3l2 3v4h-5" />
    <circle cx="7" cy="18" r="1.6" />
    <circle cx="18" cy="18" r="1.6" />
  </svg>
);
const cartIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
  </svg>
);
const accountIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
  </svg>
);
const hamburgerIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
    <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
  </svg>
);

export interface HeaderProps {
  brandHref: string;
  brandMark: string;
  logoUrl?: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  onSearchSubmit?: (query: string) => void;
  onSearchQueryChange?: (query: string) => void;
  searchSuggestions?: ReactNode;
  trackOrderHref: string;
  trackOrderLabel: string;
  accountHref?: string;
  accountLabel?: string;
  cartLabel: string;
  cartCount?: number;
  localeSwitchLabel: string;
  onLocaleSwitch: () => void;
  /** aria-label for the mobile-only hamburger button that opens MobileNavDrawer. */
  mobileMenuLabel: string;
  linkComponent?: LinkComponent;
  className?: string;
}

export function Header({
  brandHref,
  brandMark,
  logoUrl,
  searchPlaceholder,
  searchAriaLabel,
  onSearchSubmit,
  onSearchQueryChange,
  searchSuggestions,
  trackOrderHref,
  trackOrderLabel,
  accountHref,
  accountLabel,
  cartLabel,
  cartCount,
  localeSwitchLabel,
  onLocaleSwitch,
  mobileMenuLabel,
  linkComponent: Link = DefaultLink,
  className,
}: HeaderProps) {
  const [query, setQuery] = useState("");
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const openCart = useCartDrawerStore((s) => s.open);
  const openMobileNav = useMobileNavDrawerStore((s) => s.open);

  function handleQueryChange(value: string) {
    setQuery(value);
    onSearchQueryChange?.(value);
    setIsSuggestionsOpen(value.trim().length > 0);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSuggestionsOpen(false);
    onSearchSubmit?.(query);
  }

  return (
    <header className={cn("sticky top-0 z-40 bg-white", className)}>
      {/* 3-zone header: logo pinned left, search truly centered (CSS grid,
          not flex auto-margins — those drift off-center whenever the logo
          and icons zones differ in width), icons pinned right. Each zone
          carries an id so it's directly identifiable in devtools (Elements
          panel shows the id on the tag; "Copy selector" yields "#site-header-…"). */}
      <div
        id="site-header-row"
        className="relative flex w-full flex-wrap items-start gap-x-6 gap-y-3 px-5 py-3 sm:grid sm:grid-cols-[auto_1fr_auto] sm:flex-nowrap sm:items-center sm:h-32 sm:py-0"
      >
        <button
          type="button"
          aria-label={mobileMenuLabel}
          onClick={openMobileNav}
          className="grid h-8 w-8 shrink-0 place-items-center text-ink sm:hidden"
        >
          {hamburgerIcon}
        </button>
        {/* Mobile only: pinned to the row's top edge and horizontally
            centered so it lines up with the hamburger/cart icons instead of
            floating at whatever height its own (much taller, desktop-sized)
            content pushes it to. Sized down for mobile so it doesn't
            overlap the search bar below. Reverts to a plain in-flow grid
            item (column 1, original size, no margin) at sm+, untouched from
            the original desktop layout. */}
        <Link
          id="site-header-logo"
          href={brandHref}
          className="absolute left-1/2 top-0 mb-2 flex shrink-0 -translate-x-1/2 items-center gap-1.5 sm:static sm:left-auto sm:top-auto sm:mb-0 sm:ml-30 sm:translate-x-0"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandMark} className="h-16 w-auto sm:mb-0 sm:h-40" />
          ) : (
            <>
              {leaf}
              <span className="font-bengali text-[25px] font-bold leading-none text-green">
                {brandMark}
                <span className="align-super text-[8px]">™</span>
              </span>
            </>
          )}
        </Link>

        <div
          id="site-header-search"
          className="relative order-3 mt-2 w-full sm:order-none sm:mb-5 sm:w-full sm:max-w-[650px] sm:justify-self-center"
        >
          <form
            onSubmit={handleSubmit}
            className="flex h-10 w-full items-center rounded-[30px] bg-beige pl-5 pr-2"
          >
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => query.trim().length > 0 && setIsSuggestionsOpen(true)}
              onBlur={() => setIsSuggestionsOpen(false)}
              placeholder={searchPlaceholder}
              className="w-0 flex-1 bg-transparent font-body text-[13.5px] text-ink outline-none placeholder:text-[#9c9080]"
            />
            <button
              type="submit"
              aria-label={searchAriaLabel}
              className="grid h-7 w-7 shrink-0 place-items-center text-green-deep"
            >
              {searchIcon}
            </button>
          </form>
          {isSuggestionsOpen && searchSuggestions && (
            // onMouseDown here fires before the input's onBlur, and
            // preventDefault stops that mousedown from shifting focus away
            // from the input at all — so blur never closes this before a
            // click on a suggestion link gets to run.
            <div
              onMouseDown={(e) => e.preventDefault()}
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[14px] border border-line bg-white shadow-brand"
            >
              {searchSuggestions}
            </div>
          )}
        </div>

        <div
          id="site-header-icons"
          className="order-2 ml-auto flex shrink-0 items-center gap-8 sm:order-none sm:mr-20 sm:justify-self-end"
        >
          <button
            type="button"
            onClick={onLocaleSwitch}
            className="hidden font-ui text-[13px] font-medium text-ink hover:text-green sm:block"
          >
            {localeSwitchLabel}
          </button>
          {accountHref && accountLabel && (
            <Link href={accountHref} className="hidden flex-col items-center gap-0.5 text-green sm:flex">
              {accountIcon}
              <span className="font-ui text-[11px] font-medium text-ink">{accountLabel}</span>
            </Link>
          )}
          <Link href={trackOrderHref} className="hidden flex-col items-center gap-0.5 text-green sm:flex">
            {trackIcon}
            <span className="font-ui text-[11px] font-medium text-ink">{trackOrderLabel}</span>
          </Link>
          <button
            type="button"
            onClick={openCart}
            className="relative flex flex-col items-center gap-0.5 text-green"
          >
            {cartIcon}
            {cartCount !== undefined && cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-gold text-[10px] font-bold text-green-deep">
                {cartCount}
              </span>
            )}
            <span className="font-ui text-[11px] font-medium text-ink">{cartLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
