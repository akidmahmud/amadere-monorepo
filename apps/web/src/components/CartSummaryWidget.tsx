"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { formatMoney, useCartDrawerStore } from "@amader/ui";
import { toApiLocale } from "@/lib/api-locale";
import { useCartQuery } from "@/hooks/useCart";
import { usePathname } from "@/i18n/navigation";

// Same cart glyph as the header's own cart icon, for consistency. Sized via
// className (not width/height props) so it can be 16px on mobile / 20px on
// desktop, matching the reference's own two distinct icon sizes.
const cartIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);

// ghorerbazar.com calls this `.cart-toggle.cart-toggle-bounch.label-down.link`
// (their own literal, misspelled class name) — a persistent floating cart
// status tab, always visible (even at 0 items), docked flush to the right
// edge, dead-center vertically (measured exactly 50% on both mobile and
// desktop): a colored top half (icon + count + "Items") over a white bottom
// half (total price), rounded only on the left/bottom-left so it reads as a
// tab tucked into the viewport edge. Recolored brand green + white per
// explicit request (reference uses orange). Mobile is measured narrower on
// padding/icon size but very slightly WIDER overall (71px vs 66px) than
// desktop — both values below are the reference's own literal measurements,
// mobile-first (base classes), with `md:` overrides for desktop.
// A blog POST specifically ("reading" a blog) — not the /blog listing or its
// /blog/category|tag|author sub-listings, which still want the widget.
// `usePathname` here is next-intl's locale-aware version (@/i18n/navigation),
// which always returns the path with the locale prefix already stripped —
// unlike plain next/navigation, this is correct even when the current
// locale has no visible URL prefix (this app's default locale).
function useIsBlogPost(): boolean {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "blog" && parts.length === 2 && !["category", "tag", "author"].includes(parts[1]);
}

export function CartSummaryWidget() {
  const locale = toApiLocale(useLocale());
  const { data: cart } = useCartQuery(locale);
  const openCart = useCartDrawerStore((s) => s.open);
  const isBlogPost = useIsBlogPost();

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  // The reference's "bounce" class name has no CSS behind it (an unwired
  // placeholder, same pattern as its carousel arrows elsewhere on the site)
  // — this makes it a real bounce, firing whenever an item is added.
  const [bouncing, setBouncing] = useState(false);
  const prevCountRef = useRef(itemCount);
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = itemCount;
    if (itemCount > prev) {
      setBouncing(true);
      const timer = setTimeout(() => setBouncing(false), 700);
      return () => clearTimeout(timer);
    }
  }, [itemCount]);

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label="Open cart"
      className={`fixed right-0 top-1/2 z-40 ${isBlogPost ? "hidden md:flex" : "flex"} w-[70px] -translate-y-1/2 flex-col items-center overflow-hidden rounded-l-md shadow-[0_12px_24px_rgba(34,87,122,0.24)] transition-transform hover:-translate-x-[3px] md:w-[66px] ${bouncing ? "animate-bounce" : ""}`}
    >
      <span className="flex w-full flex-col items-center gap-1 bg-green p-2 text-white md:p-3">
        {cartIcon}
        <span className="text-center font-ui text-xs font-semibold">{itemCount} Items</span>
      </span>
      <span className="w-full bg-white px-0.5 py-[5px] text-center font-ui text-sm font-semibold text-green">
        {formatMoney(cart?.total ?? "0")}
      </span>
    </button>
  );
}
