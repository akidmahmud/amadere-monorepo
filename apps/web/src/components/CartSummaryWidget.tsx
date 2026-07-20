"use client";

import { useLocale } from "next-intl";
import { formatMoney, useCartDrawerStore } from "@amader/ui";
import { toApiLocale } from "@/lib/api-locale";
import { useCartQuery } from "@/hooks/useCart";

const bagIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5">
    <path d="M6 8h12l-1 12H7L6 8Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);

// Persistent floating cart status — always visible (even at 0 items, per
// the reference design), opens the same drawer the header's own cart
// button does (shared zustand store, no new open/close wiring needed).
// Flush against the right edge (no gap, square outer corners) so it reads
// as a tab/bookmark tucked into the side of the viewport, vertically
// centered — clear of the bottom-right WhatsApp button.
export function CartSummaryWidget() {
  const locale = toApiLocale(useLocale());
  const { data: cart } = useCartQuery(locale);
  const openCart = useCartDrawerStore((s) => s.open);

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label="Open cart"
      className="fixed right-0 top-1/2 z-40 w-14 -translate-y-1/2 overflow-hidden rounded-l-lg bg-cream text-left shadow-lg transition-transform hover:-translate-x-1 sm:w-[88px] sm:rounded-l-xl"
    >
      <div className="bg-gold px-1 py-1 sm:px-2 sm:py-2">
        <div className="mx-auto mb-0.5 grid h-4 w-4 place-items-center rounded-full border border-white/70 text-white sm:mb-1 sm:h-6 sm:w-6 sm:border-2">
          {bagIcon}
        </div>
        <p className="text-center font-ui text-[8px] font-bold text-white sm:text-[11px]">{itemCount} Items</p>
      </div>
      <div className="px-1 py-1 sm:px-2 sm:py-1.5">
        <p className="text-center font-ui text-[9px] font-bold text-ink sm:text-xs">{formatMoney(cart?.total ?? "0")}</p>
      </div>
    </button>
  );
}
