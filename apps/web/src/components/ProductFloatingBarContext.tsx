"use client";

import { create } from "zustand";

// Zustand store (not React context) so the layout-level MobileStickyFooter
// can read product-page state without being a descendant of the provider.
// Same global-store pattern as useCartDrawerStore / useMobileNavDrawerStore.

export interface ProductFloatingBarState {
  /** True once the user has scrolled past #pdp-buy-buttons */
  isScrolledPast: boolean;
  /** Fire-and-forget: adds the product to the cart then opens the cart drawer */
  onAddToCart: (() => void) | null;
  /** Fire-and-forget: adds the product to the cart then navigates to /checkout */
  onBuyNow: (() => void) | null;
  /** Whether the mutation is in-flight (disables both buttons) */
  isPending: boolean;
  /** True when the product is genuinely out of stock (hides both CTA buttons) */
  outOfStock: boolean;
  /** Internal — called by the provider to push state */
  _update: (patch: Partial<Omit<ProductFloatingBarState, "_update" | "_reset">>) => void;
  /** Internal — called on unmount to clear everything */
  _reset: () => void;
}

const INITIAL: Omit<ProductFloatingBarState, "_update" | "_reset"> = {
  isScrolledPast: false,
  onAddToCart: null,
  onBuyNow: null,
  isPending: false,
  outOfStock: false,
};

export const useProductFloatingBarStore = create<ProductFloatingBarState>((set) => ({
  ...INITIAL,
  _update: (patch) => set(patch),
  _reset: () => set(INITIAL),
}));
