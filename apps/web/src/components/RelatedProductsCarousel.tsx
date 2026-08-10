"use client";

import { Carousel, SiteProductCard } from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";
import type { ProductCardData } from "@/lib/product-card-mapper";

export interface RelatedProductsCarouselProps {
  products: ProductCardData[];
}

// Thin client boundary so the PDP's Server Component can still wire a real
// Add to Cart (pack-picker included) here, same as every other product card
// on the site — this section used to render its own RelatedProductCard,
// whose "Add to Cart" just linked through to the PDP instead of adding to
// cart, the one card on the site that didn't. Layout (carousel widths,
// autoplay, no arrows) unchanged from before.
export function RelatedProductsCarousel({ products }: RelatedProductsCarouselProps) {
  const { handleAddToCart, isPending, pendingProductId } = useCardAddToCart();

  return (
    <Carousel autoplayMs={7000} centerWhenFits={false} showArrows={false}>
      {products.map((product) => (
        <div
          key={product.href}
          className="w-[calc(50%-9px)] shrink-0 snap-start sm:w-[calc(33.333%-12px)] lg:w-[calc(20%-14.4px)]"
        >
          <SiteProductCard
            {...product}
            linkComponent={AppLink}
            addToCartPending={isPending && pendingProductId === product.productId}
            onAddToCart={(packValue) => handleAddToCart(product.productId, packValue)}
          />
        </div>
      ))}
    </Carousel>
  );
}
