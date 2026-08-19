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
  const closeCartDrawer = useCartDrawerStore((s) => s.close);
  const router = useRouter();
  const update = useProductFloatingBarStore((s) => s._update);
  const reset = useProductFloatingBarStore((s) => s._reset);

  // --- Stock check (same rule as PdpPurchasePanel) ---
  // Was reading product.stock unconditionally — the parent Product's own
  // stock field is unused/stale (typically 0) for any variant product,
  // since real stock lives on each ProductVariant. That made outOfStock
  // true for essentially every variant product regardless of real stock,
  // permanently hiding this sticky bar's Buy Now/Add to Cart buttons on
  // mobile after scrolling — while PdpPurchasePanel's inline buttons stayed
  // visible/correct because it already checked the variant's own stock.
  const selectedVariant = product.hasVariants
    ? product.variants.find((v) => String(v.id) === selectedVariantId)
    : undefined;
  const stockCount = selectedVariant ? selectedVariant.stock : product.stock;
  const outOfStock = product.trackInventory && !product.allowBackorder && stockCount < 1;

  // --- Handlers (stable refs via useCallback) ---
  // Same as PdpPurchasePanel: open on tap, close again only if the add
  // failed. The sticky bar is the one control a mobile shopper reaches for
  // most, so waiting out the round trip before anything moved was the worst
  // place to do it.
  const handleAddToCart = useCallback(() => {
    openCartDrawer();
    addToCart.mutate(
      {
        productId: product.id,
        variantId: product.hasVariants ? Number(selectedVariantId) : undefined,
        quantity: product.minOrderQuantity || 1,
      },
      { onError: () => closeCartDrawer() },
    );
  }, [addToCart, product.id, product.hasVariants, product.minOrderQuantity, selectedVariantId, openCartDrawer, closeCartDrawer]);

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

  // --- Scroll-position check (was IntersectionObserver, replaced — see
  //     below) ---
  //
  // IntersectionObserver reportedly went stale/never fired on some real
  // devices (iPhone Safari, Huawei Browser) — both are known for caching a
  // stale root/target rect across the dynamic address-bar show/hide that
  // happens mid-scroll, so the callback can simply stop firing instead of
  // reporting the element left the viewport. Rather than chase per-browser
  // IntersectionObserver quirks, this just re-measures the real element
  // position directly (getBoundingClientRect, universally reliable, no
  // caching) on every scroll/resize tick, rAF-throttled so it's cheap.
  // `rect.bottom < 0` = the watched row has scrolled fully above the
  // viewport top, same condition the old observer callback intended.
  //
  // Watches #pdp-social-proof (the "N People watching / N People bought"
  // row, PdpPurchasePanel.tsx) rather than #pdp-buy-buttons — per explicit
  // request, the sticky bar should appear as soon as that row scrolls out of
  // view, not only once the buy buttons themselves are gone too.
  useEffect(() => {
    const target = document.getElementById("pdp-social-proof");
    if (!target) return;

    let ticking = false;
    function check() {
      ticking = false;
      const rect = target!.getBoundingClientRect();
      update({ isScrolledPast: rect.bottom < 0 });
    }
    function onScrollOrResize() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(check);
    }

    check();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [update]);

  // --- Reset on unmount (navigating away from product page) ---
  useEffect(() => {
    return () => reset();
  }, [reset]);

  return <>{children}</>;
}
