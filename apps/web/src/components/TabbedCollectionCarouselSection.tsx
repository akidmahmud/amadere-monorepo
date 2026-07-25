"use client";

import { ProductStripSection, type ProductStripSectionProps } from "@amader/ui";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";
import { AppLink } from "@/components/AppLink";

type Props = Omit<ProductStripSectionProps, "onAddToCart" | "addToCartPendingId" | "linkComponent">;

// Same Server-Component-can't-use-hooks boundary as ProductCarouselSectionClient.
// Named for the section type it renders (TABBED_COLLECTION_CAROUSEL), which
// is no longer tabbed — see ProductStripSection's own doc comment.
export function TabbedCollectionCarouselSection({ items, ...rest }: Props) {
  const { handleAddToCart, isPending, pendingProductId } = useCardAddToCart();

  return (
    <ProductStripSection
      {...rest}
      items={items}
      linkComponent={AppLink}
      onAddToCart={(productId, packValue) => handleAddToCart(productId, packValue)}
      addToCartPendingId={isPending ? pendingProductId : undefined}
    />
  );
}
