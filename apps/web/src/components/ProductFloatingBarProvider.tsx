"use client";

import { useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { useCartDrawerStore } from "@amader/ui";
import { useRouter } from "@/i18n/navigation";
import { defaultVariantId } from "@/lib/pdp";
import { toApiLocale } from "@/lib/api-locale";
import { useAddToCart } from "@/hooks/useCart";
import { useProductFloatingBarStore } from "./ProductFloatingBarContext";
import type { components } from "@/lib/api/schema";

type PublicProductDetailDto = components["schemas"]["PublicProductDetailDto"];

// Client component rendered on the product page that:
// 1. Watches #pdp-buy-buttons via IntersectionObserver (same logic the old
//    ProductMobileIsland used).
// 2. Pushes product actions (addToCart / buyNow) and scroll state into the
//    global zustand store so the layout-level MobileStickyFooter can
//    transform into a product action bar without prop-drilling.
export function ProductFloatingBarProvider({
  product,
  children,
}: {
  product: PublicProductDetailDto;
  children: React.ReactNode;
}) {
  const selectedVariantId = defaultVariantId(product);
  const locale = toApiLocale(useLocale());
  const addToCart = useAddToCart(locale);
  const openCartDrawer = useCartDrawerStore((s) => s.open);
  const router = useRouter();
  const update = useProductFloatingBarStore((s) => s._update);
  const reset = useProductFloatingBarStore((s) => s._reset);

  // --- Stock check (same rule as PdpPurchasePanel) ---
  const outOfStock = product.trackInventory && !product.allowBackorder && product.stock < 1;

  // --- Handlers (stable refs via useCallback) ---
  const handleAddToCart = useCallback(() => {
    addToCart.mutate(
      {
        productId: product.id,
        variantId: product.hasVariants ? Number(selectedVariantId) : undefined,
        quantity: product.minOrderQuantity || 1,
      },
      { onSuccess: () => openCartDrawer() },
    );
  }, [addToCart, product.id, product.hasVariants, product.minOrderQuantity, selectedVariantId, openCartDrawer]);

  const handleBuyNow = useCallback(() => {
    addToCart.mutate(
      {
        productId: product.id,
        variantId: product.hasVariants ? Number(selectedVariantId) : undefined,
        quantity: product.minOrderQuantity || 1,
      },
      { onSuccess: () => router.push("/checkout") },
    );
  }, [addToCart, product.id, product.hasVariants, product.minOrderQuantity, selectedVariantId, router]);

  // --- Push state into the global store ---
  useEffect(() => {
    update({
      onAddToCart: handleAddToCart,
      onBuyNow: handleBuyNow,
      isPending: addToCart.isPending,
      outOfStock,
    });
  }, [handleAddToCart, handleBuyNow, addToCart.isPending, outOfStock, update]);

  // --- IntersectionObserver (same logic as old ProductMobileIsland) ---
  useEffect(() => {
    const target = document.getElementById("pdp-buy-buttons");
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only flip on once the row has genuinely scrolled up past the
        // top edge, not just because it hasn't been scrolled to yet.
        update({ isScrolledPast: !entry.isIntersecting && entry.boundingClientRect.top < 0 });
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [update]);

  // --- Reset on unmount (navigating away from product page) ---
  useEffect(() => {
    return () => reset();
  }, [reset]);

  return <>{children}</>;
}
