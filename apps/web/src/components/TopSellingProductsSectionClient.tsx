"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { TopSellingProductsSection, type TopSellingProductsSectionProps, useCartDrawerStore } from "@amader/ui";
import { useRouter } from "@/i18n/navigation";
import { toApiLocale } from "@/lib/api-locale";
import { useAddToCart } from "@/hooks/useCart";
import { AppLink } from "@/components/AppLink";

type Props = Omit<TopSellingProductsSectionProps, "onAddToCart" | "addToCartPendingId" | "onBuyNow" | "buyNowPendingId" | "linkComponent">;

// Thin client boundary for the Server Component homepage, same pattern as
// ProductCarouselSectionClient. Buy Now reuses the exact bypass
// PdpPurchasePanel already uses (the /cart/buy-now endpoint is a pricing
// quote only, not a real purchase path): add to cart, then go straight to
// checkout instead of opening the drawer. Both buttons share one mutation
// object, so `buyNowProductId` tracks which one is in flight for the
// correct pending-state button.
export function TopSellingProductsSectionClient(props: Props) {
  const locale = toApiLocale(useLocale());
  const addToCart = useAddToCart(locale);
  const openCart = useCartDrawerStore((s) => s.open);
  const router = useRouter();
  const [buyNowProductId, setBuyNowProductId] = useState<number | null>(null);

  function handleAddToCart(productId: number, packValue?: string) {
    setBuyNowProductId(null);
    addToCart.mutate({ productId, variantId: packValue ? Number(packValue) : undefined }, { onSuccess: () => openCart() });
  }

  function handleBuyNow(productId: number, packValue?: string) {
    setBuyNowProductId(productId);
    addToCart.mutate(
      { productId, variantId: packValue ? Number(packValue) : undefined },
      { onSuccess: () => router.push("/checkout") },
    );
  }

  const pendingProductId = addToCart.isPending ? addToCart.variables?.productId : undefined;

  return (
    <TopSellingProductsSection
      {...props}
      linkComponent={AppLink}
      onAddToCart={handleAddToCart}
      addToCartPendingId={buyNowProductId === null ? pendingProductId : undefined}
      onBuyNow={handleBuyNow}
      buyNowPendingId={buyNowProductId !== null ? pendingProductId : undefined}
    />
  );
}
