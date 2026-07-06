"use client";

import { FormEvent, useState } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { useCartDrawerStore } from "../stores/cartDrawerStore";

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

export interface HeaderProps {
  brandHref: string;
  brandMark: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  onSearchSubmit?: (query: string) => void;
  trackOrderHref: string;
  trackOrderLabel: string;
  cartLabel: string;
  cartCount?: number;
  localeSwitchLabel: string;
  onLocaleSwitch: () => void;
  linkComponent?: LinkComponent;
  className?: string;
}

export function Header({
  brandHref,
  brandMark,
  searchPlaceholder,
  searchAriaLabel,
  onSearchSubmit,
  trackOrderHref,
  trackOrderLabel,
  cartLabel,
  cartCount,
  localeSwitchLabel,
  onLocaleSwitch,
  linkComponent: Link = DefaultLink,
  className,
}: HeaderProps) {
  const [query, setQuery] = useState("");
  const openCart = useCartDrawerStore((s) => s.open);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSearchSubmit?.(query);
  }

  return (
    <header className={cn("sticky top-0 z-40 bg-white", className)}>
      <div className="mx-auto flex h-[74px] max-w-[1180px] items-center gap-6 px-5">
        <Link href={brandHref} className="flex items-center gap-1.5">
          {leaf}
          <span className="font-bengali text-[25px] font-bold leading-none text-green">
            {brandMark}
            <span className="align-super text-[8px]">™</span>
          </span>
        </Link>

        <form
          onSubmit={handleSubmit}
          className="mx-auto flex h-10 max-w-[440px] flex-1 items-center rounded-[30px] bg-beige pl-5 pr-2"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent font-body text-[13.5px] text-ink outline-none placeholder:text-[#9c9080]"
          />
          <button
            type="submit"
            aria-label={searchAriaLabel}
            className="grid h-7 w-7 place-items-center text-green-deep"
          >
            {searchIcon}
          </button>
        </form>

        <div className="ml-auto flex items-center gap-4">
          <button
            type="button"
            onClick={onLocaleSwitch}
            className="font-ui text-[13px] font-medium text-ink hover:text-green"
          >
            {localeSwitchLabel}
          </button>
          <Link href={trackOrderHref} aria-label={trackOrderLabel} className="grid place-items-center text-green">
            {trackIcon}
          </Link>
          <button
            type="button"
            aria-label={cartLabel}
            onClick={openCart}
            className="relative grid place-items-center text-green"
          >
            {cartIcon}
            {cartCount !== undefined && cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-gold text-[10px] font-bold text-green-deep">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
