"use client";

import { useLocale } from "next-intl";
import { Button, PriceTag } from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl } from "@/lib/media";
import { useAddToCart } from "@/hooks/useCart";
import { useRemoveFromWishlist, useWishlist } from "@/hooks/useAccount";

export function WishlistGrid() {
  const locale = toApiLocale(useLocale());
  const { data: items, isLoading } = useWishlist(locale);
  const removeFromWishlist = useRemoveFromWishlist(locale);
  const addToCart = useAddToCart(locale);

  if (isLoading) return <p className="font-body text-sm text-muted">Loading…</p>;
  if (!items || items.length === 0) {
    return <p className="font-body text-sm text-muted">Your wishlist is empty.</p>;
  }

  return (
    <div>
      <h2 className="mb-4 font-ui text-[15px] font-semibold text-green">My Wishlist</h2>
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2">
        {items.map((item) => (
          <div key={item.productId} className="rounded-brand border border-line bg-white p-2.5">
            <AppLink href={`/products/${item.slug}`} className="block aspect-square rounded-[10px] bg-beige">
              {toDisplayImageUrl(item.image) && (
                <img
                  src={toDisplayImageUrl(item.image)}
                  alt={item.name}
                  className="h-full w-full rounded-[10px] object-cover"
                />
              )}
            </AppLink>
            <AppLink href={`/products/${item.slug}`} className="mt-2 block truncate font-ui text-sm text-ink">
              {item.name}
            </AppLink>
            <PriceTag price={item.salePrice ?? item.price ?? "0"} originalPrice={item.salePrice ? item.price : undefined} align="left" size="sm" className="my-1.5" />
            <div className="flex gap-2">
              <Button
                variant="green"
                size="md"
                className="flex-1"
                disabled={(item.stockStatus as unknown as string) === "OUT_OF_STOCK" || addToCart.isPending}
                onClick={() => addToCart.mutate({ productId: item.productId })}
              >
                Add to Cart
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => removeFromWishlist.mutate(item.productId)}
                aria-label={`Remove ${item.name} from wishlist`}
              >
                ✕
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
