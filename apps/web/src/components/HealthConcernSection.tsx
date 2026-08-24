"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { ProductCarouselSection, type ProductCarouselItem } from "@amader/ui";
import { Link } from "@/i18n/navigation";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
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
type ProductApiItem = components["schemas"]["PublicProductDto"];

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
      // Same-origin (`/api/backend/...`), not the public API host: measured
      // on production, that hostname is unreachable from a browser
      // (ERR_CONNECTION_TIMED_OUT after ~21s) while this path answers in
      // ~0.4s. A failed switch leaves the current pill's products on screen
      // rather than emptying the carousel.
      const params = new URLSearchParams({
        tagIds: String(tagId),
        pageSize: "8",
        locale: toApiLocale(locale),
      });
      try {
        const data = await proxyFetch<{ items?: ProductApiItem[] }>(
          `/products?${params}`,
        );
        setProducts((data.items ?? []).map(toProductCardData));
      } catch {
        /* keep what is already rendered */
      }
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
        autoplayMs={4000}
      />
    </div>
  );
}
