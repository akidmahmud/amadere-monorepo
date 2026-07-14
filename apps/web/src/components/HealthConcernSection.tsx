"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { ProductCarouselSection, type ProductCarouselItem } from "@amader/ui";
import { Link } from "@/i18n/navigation";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { toProductCardData } from "@/lib/product-card-mapper";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";

type HealthConcernProduct = ProductCarouselItem & { productId: number };

export interface HealthConcernSectionProps {
  heading: string;
  viewAllLabel: string;
  tags: { id: number; label: string }[];
  initialTagId: number;
  initialProducts: HealthConcernProduct[];
}

// Pill switching re-fetches from the same public typed client, client-side —
// a plain useState/useTransition stopgap for F3; swap for TanStack Query once
// it's wired for the rest of the interactive surfaces (cart/search/wishlist).
export function HealthConcernSection({
  heading,
  viewAllLabel,
  tags,
  initialTagId,
  initialProducts,
}: HealthConcernSectionProps) {
  const [activeTagId, setActiveTagId] = useState(initialTagId);
  const [products, setProducts] = useState(initialProducts);
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();
  const { handleAddToCart, isPending: isAdding, pendingProductId } = useCardAddToCart();

  function handlePillChange(value: string) {
    const tagId = Number(value);
    setActiveTagId(tagId);
    startTransition(async () => {
      const { data } = await safeGet("/api/v1/products", {
        params: { query: { tagIds: [tagId], pageSize: 8, locale: toApiLocale(locale) } },
      });
      setProducts((data?.items ?? []).map(toProductCardData));
    });
  }

  return (
    <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
      <ProductCarouselSection
        heading={heading}
        products={products}
        viewAllHref="/products"
        viewAllLabel={viewAllLabel}
        pillOptions={tags.map((t) => ({ value: String(t.id), label: t.label }))}
        activePill={String(activeTagId)}
        onPillChange={handlePillChange}
        onAddToCart={(href, packValue) => {
          const product = products.find((p) => p.href === href);
          if (product) handleAddToCart(product.productId, packValue);
        }}
        addToCartPendingHref={isAdding ? products.find((p) => p.productId === pendingProductId)?.href : undefined}
        linkComponent={Link}
      />
    </div>
  );
}
