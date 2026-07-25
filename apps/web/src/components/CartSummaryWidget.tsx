"use client";

import { useLocale } from "next-intl";
import { formatMoney, useCartDrawerStore } from "@amader/ui";
import { toApiLocale } from "@/lib/api-locale";
import { useCartQuery } from "@/hooks/useCart";

// Same cart glyph as the header's own cart icon, for consistency.
const cartIcon = (
  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);

// Persistent floating cart status — always visible (even at 0 items, per
// the reference design), opens the same drawer the header's own cart
// button does (shared zustand store, no new open/close wiring needed).
// Flush against the right edge (no gap, square outer corners) so it reads
// as a tab/bookmark tucked into the side of the viewport. Reference's own
// .float-cart: solid gold tab (not split cream/gold), icon + "N Items" in
// white, then a white rounded-6px pill just around the amount — positioned
// at top:55%, not dead-center, so it clears the bottom-right WhatsApp button.
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
      className="fixed right-0 top-[55%] z-40 hidden -translate-y-1/2 flex-col items-center gap-1 rounded-l-[10px] bg-gold px-3 py-3 shadow-[-4px_4px_16px_rgba(30,43,34,.18)] transition-transform hover:-translate-x-[3px] md:flex"
    >
      <div className="grid h-6 w-6 place-items-center rounded-full border-2 border-white/80 text-white">{cartIcon}</div>
      <p className="text-center font-ui text-[0.72rem] font-extrabold text-[#3d3410]">{itemCount} Items</p>
      <p className="rounded-[6px] bg-white px-[9px] py-[3px] text-center font-ui text-[0.72rem] font-extrabold text-green">
        {formatMoney(cart?.total ?? "0")}
      </p>
    </button>
  );
}
