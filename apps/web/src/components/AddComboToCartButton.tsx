"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useCartDrawerStore } from "@amader/ui";
import { useAddToCart } from "@/hooks/useCart";
import { toApiLocale } from "@/lib/api-locale";

export interface ComboCartItem {
  productId: number;
  variantId?: number | null;
  quantity: number;
}

// There's no dedicated "add a whole bundle" backend endpoint — this adds
// each item through the existing single-item endpoint instead, one at a
// time (not Promise.all): the very first add-to-cart call is what issues a
// guest's cart token, and firing several before that first response lands
// risks each one racing to create its own separate guest cart.
export function AddComboToCartButton({ items, label = "Add Combo to Cart" }: { items: ComboCartItem[]; label?: string }) {
  const locale = toApiLocale(useLocale());
  const addToCart = useAddToCart(locale);
  const openCart = useCartDrawerStore((s) => s.open);
  const [isAdding, setIsAdding] = useState(false);

  async function handleClick() {
    setIsAdding(true);
    try {
      for (const item of items) {
        await addToCart.mutateAsync({
          productId: item.productId,
          variantId: item.variantId ?? undefined,
          quantity: item.quantity,
        });
      }
      openCart();
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <button
      type="button"
      disabled={isAdding}
      onClick={handleClick}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-header-green font-header text-[0.95rem] font-bold text-white transition-colors hover:bg-header-green-dark disabled:opacity-60 sm:w-auto sm:px-8"
    >
      {isAdding ? "Adding…" : label}
    </button>
  );
}
