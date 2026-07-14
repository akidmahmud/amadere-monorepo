"use client";

import { TabbedCollectionCarousel, type TabbedCollectionCarouselProps } from "@amader/ui";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";
import { AppLink } from "@/components/AppLink";

type Props = Omit<TabbedCollectionCarouselProps, "onAddToCart" | "addToCartPendingHref" | "linkComponent" | "tabs"> & {
  tabs: (TabbedCollectionCarouselProps["tabs"][number] & {
    products: (TabbedCollectionCarouselProps["tabs"][number]["products"][number] & { productId: number })[];
  })[];
};

// Same Server-Component-can't-use-hooks boundary as ProductCarouselSectionClient.
export function TabbedCollectionCarouselSection({ tabs, ...rest }: Props) {
  const { handleAddToCart, isPending, pendingProductId } = useCardAddToCart();
  const allProducts = tabs.flatMap((t) => t.products);

  return (
    <TabbedCollectionCarousel
      {...rest}
      tabs={tabs}
      linkComponent={AppLink}
      onAddToCart={(href, packValue) => {
        const product = allProducts.find((p) => p.href === href);
        if (product) handleAddToCart(product.productId, packValue);
      }}
      addToCartPendingHref={isPending ? allProducts.find((p) => p.productId === pendingProductId)?.href : undefined}
    />
  );
}
