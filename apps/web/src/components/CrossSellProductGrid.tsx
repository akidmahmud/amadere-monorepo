"use client";

import { SiteProductCard } from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";
import type { ProductCardData } from "@/lib/product-card-mapper";

export interface CrossSellProductGridProps {
  products: ProductCardData[];
}

// Same client-boundary reasoning as RelatedProductsCarousel — plain
// responsive grid instead of a carousel, matching Cross Sell's existing
// static layout.
export function CrossSellProductGrid({ products }: CrossSellProductGridProps) {
  const { handleAddToCart, isPending, pendingProductId } = useCardAddToCart();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {products.map((product) => (
        <SiteProductCard
          key={product.href}
          {...product}
          linkComponent={AppLink}
          addToCartPending={isPending && pendingProductId === product.productId}
          onAddToCart={(packValue) => handleAddToCart(product.productId, packValue)}
        />
      ))}
    </div>
  );
}
