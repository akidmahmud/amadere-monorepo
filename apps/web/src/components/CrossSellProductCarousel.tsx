"use client";

import { InfiniteMarquee, SiteProductCard } from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";
import type { ProductCardData } from "@/lib/product-card-mapper";

export interface CrossSellProductCarouselProps {
  products: ProductCardData[];
}

// Was CrossSellProductGrid — a static 2/3/5-column grid. Now a continuously
// looping row, matching Related Products directly above it, so the two
// sections on the PDP behave the same way instead of one scrolling and one
// sitting still.
//
// Same client-boundary reasoning as RelatedProductsCarousel: the PDP is a
// Server Component and cannot own the add-to-cart hook itself.
export function CrossSellProductCarousel({ products }: CrossSellProductCarouselProps) {
  const { handleAddToCart, isPending, pendingProductId } = useCardAddToCart();

  return (
    <InfiniteMarquee secondsPerItem={10} gapPx={16} ariaLabel="You may also like">
      {products.map((product) => (
        <div
          key={product.href}
          className="w-[150px] sm:w-[200px] md:w-[230px] xl:w-[260px]"
        >
          <SiteProductCard
            {...product}
            linkComponent={AppLink}
            addToCartPending={isPending && pendingProductId === product.productId}
            onAddToCart={(packValue) => handleAddToCart(product.productId, packValue)}
          />
        </div>
      ))}
    </InfiniteMarquee>
  );
}
