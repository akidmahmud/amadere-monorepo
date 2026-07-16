"use client";

import { PromoVideoSection, type PromoVideoSectionProps } from "@amader/ui";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";
import { AppLink } from "@/components/AppLink";

type Props = Omit<PromoVideoSectionProps, "onAddToCart" | "addToCartPending" | "pendingProductId" | "linkComponent">;

// Mirrors ProductCarouselSectionClient.tsx — the Server Component homepage
// can't use hooks directly, so this is the thin client boundary that wires
// the real "Add to Cart" handler for the promo video modal.
export function PromoVideoSectionClient(props: Props) {
  const { handleAddToCart, isPending, pendingProductId } = useCardAddToCart();

  return (
    <PromoVideoSection
      {...props}
      linkComponent={AppLink}
      onAddToCart={(productId) => handleAddToCart(productId)}
      addToCartPending={isPending}
      pendingProductId={pendingProductId}
    />
  );
}
