"use client";

import { SiteProductCard, SlideCarousel } from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";
import type { ProductCardData } from "@/lib/product-card-mapper";

export interface RelatedProductsCarouselProps {
  products: ProductCardData[];
}

// Uses SlideCarousel — the same mechanism as the homepage tabbed/featured
// rows — so every product carousel on the site steps ONE product at a time
// and ping-pongs (1..10 then 10..1) instead of scrolling continuously.
//
// Card count comes from `slotClassName` alone; SlideCarousel measures it, so
// the 2/3/4/5-per-row ladder here matches the homepage's without either side
// having to know the other's number.
//
// Same client-boundary reasoning as before: the PDP is a Server Component and
// cannot own the add-to-cart hook itself.
export function RelatedProductsCarousel({ products }: RelatedProductsCarouselProps) {
  const { handleAddToCart, isPending, pendingProductId } = useCardAddToCart();

  return (
    <SlideCarousel
      slotClassName="basis-1/2 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5"
      gapPx={18}
      autoplayMs={4500}
      ariaLabel="Related products"
    >
      {products.map((product) => (
        <SiteProductCard
          key={product.href}
          {...product}
          linkComponent={AppLink}
          addToCartPending={isPending && pendingProductId === product.productId}
          onAddToCart={(packValue) => handleAddToCart(product.productId, packValue)}
        />
      ))}
    </SlideCarousel>
  );
}
