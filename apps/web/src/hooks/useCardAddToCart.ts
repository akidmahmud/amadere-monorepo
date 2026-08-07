"use client";

import { useLocale } from "next-intl";
import { useCartDrawerStore } from "@amader/ui";
import { toApiLocale } from "@/lib/api-locale";
import { useToast } from "@/components/ToastProvider";
import { useAddToCart } from "./useCart";

// Shared by every place a bare product card renders an "Add to Cart" button
// (listings, search, homepage collections, related products) — one real
// cart-add call + drawer-open, instead of each call site reinventing it.
// Also the single choke point for the pack-picker's confirm action, so a
// stock error on a variant surfaces here too, not just on plain products.
export function useCardAddToCart() {
  const locale = toApiLocale(useLocale());
  const addToCart = useAddToCart(locale);
  const openCart = useCartDrawerStore((s) => s.open);
  const toast = useToast();

  function handleAddToCart(productId: number, packValue?: string) {
    addToCart.mutate(
      { productId, variantId: packValue ? Number(packValue) : undefined },
      {
        onSuccess: () => openCart(),
        onError: (error) => toast.push(error instanceof Error ? error.message : "Couldn't add to cart"),
      },
    );
  }

  return { handleAddToCart, isPending: addToCart.isPending, pendingProductId: addToCart.variables?.productId };
}
