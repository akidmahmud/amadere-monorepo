"use client";

import { useLocale } from "next-intl";
import { SiteProductCard } from "@amader/ui";
import type { components } from "@/lib/api/schema";
import { AppLink } from "@/components/AppLink";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl } from "@/lib/media";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";
import { useRemoveFromWishlist, useWishlist } from "@/hooks/useAccount";

type WishlistItemDto = components["schemas"]["WishlistItemDto"];

// Same shape ProductListing/ProductStripSection build for SiteProductCard —
// no packOptions here (the wishlist endpoint only returns the default
// variant, not the full pack list), so a variant product's card just adds
// its default variant directly instead of offering a picker; the full picker
// is still one tap away on the PDP.
function toWishlistCardData(item: WishlistItemDto) {
  return {
    href: `/products/${item.slug}`,
    productId: item.productId,
    name: item.name,
    imageUrl: toDisplayImageUrl(item.image),
    price: item.salePrice ?? item.price ?? "0",
    originalPrice: item.salePrice ? (item.price ?? undefined) : undefined,
    outOfStock: (item.stockStatus as unknown as string) === "OUT_OF_STOCK",
    defaultPackValue: item.variantId ? String(item.variantId) : undefined,
  };
}

export function WishlistGrid() {
  const locale = toApiLocale(useLocale());
  const { data: items, isLoading } = useWishlist(locale);
  const removeFromWishlist = useRemoveFromWishlist(locale);
  const { handleAddToCart, isPending, pendingProductId } = useCardAddToCart();

  if (isLoading) return <p className="font-body text-sm text-muted">Loading…</p>;
  if (!items || items.length === 0) {
    return <p className="font-body text-sm text-muted">Your wishlist is empty.</p>;
  }

  return (
    <div>
      <h2 className="mb-4 font-ui text-[15px] font-semibold text-green">My Wishlist</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.productId} className="relative">
            <button
              type="button"
              onClick={() => removeFromWishlist.mutate(item.productId)}
              aria-label={`Remove ${item.name} from wishlist`}
              className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs text-ink shadow"
            >
              ✕
            </button>
            <SiteProductCard
              {...toWishlistCardData(item)}
              linkComponent={AppLink}
              addToCartPending={isPending && pendingProductId === item.productId}
              onAddToCart={(packValue) => handleAddToCart(item.productId, packValue)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
