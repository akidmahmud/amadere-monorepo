"use client";

import { FeaturedDealsSection, type FeaturedDealsSectionProps } from "@amader/ui";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";
import { AppLink } from "@/components/AppLink";

type Props = Omit<FeaturedDealsSectionProps, "onAddToCart" | "addToCartPendingHref" | "linkComponent" | "items"> & {
  items: (FeaturedDealsSectionProps["items"][number] & { productId: number })[];
};

// Same Server-Component-can't-use-hooks boundary as ProductCarouselSectionClient.
export function FeaturedDealsSectionClient({ items, ...rest }: Props) {
  const { handleAddToCart, isPending, pendingProductId } = useCardAddToCart();

  return (
    <FeaturedDealsSection
      {...rest}
      items={items}
      linkComponent={AppLink}
      onAddToCart={(href, packValue) => {
        const product = items.find((p) => p.href === href);
        if (product) handleAddToCart(product.productId, packValue);
      }}
      addToCartPendingHref={isPending ? items.find((p) => p.productId === pendingProductId)?.href : undefined}
    />
  );
}
