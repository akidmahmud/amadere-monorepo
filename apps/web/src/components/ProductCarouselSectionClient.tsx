"use client";

import { ProductCarouselSection, type ProductCarouselSectionProps } from "@amader/ui";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";
import { AppLink } from "@/components/AppLink";

type Props = Omit<ProductCarouselSectionProps, "onAddToCart" | "addToCartPendingHref" | "linkComponent" | "products"> & {
  products: (ProductCarouselSectionProps["products"][number] & { productId: number })[];
};

// The Server Component pages that render product collections (homepage,
// PDP's Related Products) can't use hooks directly — this is the thin client
// boundary that wires the real "Add to Cart" handler for them, same as
// ProductListing/SearchResults do inline since those are already client
// components.
export function ProductCarouselSectionClient({ products, ...rest }: Props) {
  const { handleAddToCart, isPending, pendingProductId } = useCardAddToCart();

  return (
    <ProductCarouselSection
      {...rest}
      products={products}
      linkComponent={AppLink}
      onAddToCart={(href, packValue) => {
        const product = products.find((p) => p.href === href);
        if (product) handleAddToCart(product.productId, packValue);
      }}
      addToCartPendingHref={isPending ? products.find((p) => p.productId === pendingProductId)?.href : undefined}
    />
  );
}
