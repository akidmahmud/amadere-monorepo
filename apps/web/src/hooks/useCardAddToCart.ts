"use client";

import { useLocale } from "next-intl";
import { useCartDrawerStore } from "@amader/ui";
import { toApiLocale } from "@/lib/api-locale";
import { useAddToCart } from "./useCart";

// Shared by every place a bare product card renders an "Add to Cart" button
// (listings, search, homepage collections, related products) — one real
// cart-add call + drawer-open, instead of each call site reinventing it.
export function useCardAddToCart() {
  const locale = toApiLocale(useLocale());
  const addToCart = useAddToCart(locale);
  const openCart = useCartDrawerStore((s) => s.open);

  function handleAddToCart(productId: number, packValue?: string) {
    addToCart.mutate(
      { productId, variantId: packValue ? Number(packValue) : undefined },
      { onSuccess: () => openCart() },
    );
  }

  return { handleAddToCart, isPending: addToCart.isPending, pendingProductId: addToCart.variables?.productId };
}
