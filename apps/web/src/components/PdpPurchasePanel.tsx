"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import {
  Button,
  PackSizeSelector,
  PriceTag,
  QtyStepper,
  useCartDrawerStore,
} from "@amader/ui";
import { usePathname, useRouter } from "@/i18n/navigation";
import { buildPackSizeOptions, defaultVariantId } from "@/lib/pdp";
import { toApiLocale } from "@/lib/api-locale";
import { useAddToCart } from "@/hooks/useCart";
import { useMe } from "@/hooks/useAuth";
import { useAddToWishlist, useRemoveFromWishlist, useWishlist } from "@/hooks/useAccount";
import { WhatsappOrderButton } from "@/components/WhatsappOrderButton";
import type { WhatsappConfig } from "@/lib/whatsapp";
import type { components } from "@/lib/api/schema";

type PublicProductDetailDto = components["schemas"]["PublicProductDetailDto"];

const heartIcon = (filled: boolean) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.8}
    className="h-4.5 w-4.5"
  >
    <path d="M12 20.5s-7-4.35-9.5-8.6C.6 8.6 2 5 5.5 5c2 0 3.5 1.2 4.5 2.7C11 6.2 12.5 5 14.5 5 18 5 19.4 8.6 17.5 11.9 15 16.15 12 20.5 12 20.5z" />
  </svg>
);

export function PdpPurchasePanel({
  product,
  whatsappConfig,
}: {
  product: PublicProductDetailDto;
  whatsappConfig: WhatsappConfig | null;
}) {
  const packOptions = useMemo(() => buildPackSizeOptions(product), [product]);
  const [selectedVariantId, setSelectedVariantId] = useState(() => defaultVariantId(product));
  const [qty, setQty] = useState(product.minOrderQuantity || 1);
  const openCartDrawer = useCartDrawerStore((s) => s.open);
  const locale = toApiLocale(useLocale());
  const addToCart = useAddToCart(locale);
  const router = useRouter();
  const pathname = usePathname();
  const { data: me } = useMe();
  const { data: wishlist } = useWishlist(locale, Boolean(me));
  const addToWishlist = useAddToWishlist(locale);
  const removeFromWishlist = useRemoveFromWishlist(locale);
  const isWishlisted = wishlist?.some((item) => item.productId === product.id) ?? false;

  const selectedVariant = product.hasVariants
    ? product.variants.find((v) => String(v.id) === selectedVariantId)
    : undefined;

  const price = product.hasVariants
    ? (packOptions.find((p) => p.value === selectedVariantId)?.price ?? "0")
    : (product.salePrice ?? product.price ?? "0");
  const originalPrice = product.hasVariants
    ? packOptions.find((p) => p.value === selectedVariantId)?.originalPrice
    : product.salePrice && Number(product.salePrice) < Number(product.price ?? 0)
      ? product.price
      : undefined;

  const stockStatus = selectedVariant ? selectedVariant.stockStatus : product.stockStatus;
  const stockCount = selectedVariant ? selectedVariant.stock : product.stock;
  const isBackorder = (stockStatus as unknown as string) === "ON_BACKORDER";
  // The real stock count, not the `stockStatus` label — that field is a
  // manually-set admin column (products.mapper.ts passes it through as-is)
  // that nothing recomputes when `stock` actually hits 0, so it can go
  // stale. ON_BACKORDER stays an explicit admin override that keeps buying
  // open even at 0 stock (unchanged pre-existing behavior).
  const outOfStock = stockCount < 1 && !isBackorder;

  function addItem(onSuccess: () => void) {
    addToCart.mutate(
      {
        productId: product.id,
        variantId: product.hasVariants ? Number(selectedVariantId) : undefined,
        quantity: qty,
      },
      { onSuccess },
    );
  }

  function handleAddToCart() {
    addItem(() => openCartDrawer());
  }

  // The backend's `/cart/buy-now` is a pricing-only quote — it never touches
  // the persisted cart, so there's no real way to "buy" through it directly.
  // The actual bypass here is real, not a stub: add to the cart, then go
  // straight to checkout instead of opening the drawer.
  function handleBuyNow() {
    addItem(() => router.push("/checkout"));
  }

  function handleToggleWishlist() {
    if (!me) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (isWishlisted) {
      removeFromWishlist.mutate(product.id);
    } else {
      addToWishlist.mutate(product.id);
    }
  }

  return (
    <div>
      <PriceTag price={price} originalPrice={originalPrice} align="left" size="lg" className="mb-4" />

      {product.hasVariants && packOptions.length > 0 && selectedVariantId && (
        <>
          <h4 className="mb-2.5 font-ui text-sm font-medium text-ink">Select Pack Size</h4>
          <PackSizeSelector options={packOptions} value={selectedVariantId} onChange={setSelectedVariantId} />
        </>
      )}

      {outOfStock ? (
        <p className="mb-4 font-ui text-sm font-semibold text-red-600">Out of Stock</p>
      ) : (
        (stockStatus as unknown as string) === "ON_BACKORDER" && (
          <p className="mb-4 font-ui text-sm text-gold-dark">Available on backorder</p>
        )
      )}

      {addToCart.isError && (
        <p className="mb-3 font-ui text-sm text-red-600">
          {addToCart.error instanceof Error ? addToCart.error.message : "Couldn't add to cart"}
        </p>
      )}

      <div className="mb-6 flex items-center gap-3">
        <QtyStepper
          value={qty}
          onChange={setQty}
          min={product.minOrderQuantity || 1}
          max={product.maxOrderQuantity ?? undefined}
        />
        <Button variant="gold" disabled={outOfStock || addToCart.isPending} onClick={handleAddToCart}>
          Add to Cart
        </Button>
        <Button variant="green" disabled={outOfStock || addToCart.isPending} onClick={handleBuyNow}>
          Buy Now
        </Button>
        <button
          type="button"
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={handleToggleWishlist}
          disabled={addToWishlist.isPending || removeFromWishlist.isPending}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line ${isWishlisted ? "text-red-600" : "text-muted"}`}
        >
          {heartIcon(isWishlisted)}
        </button>
        {!outOfStock && <WhatsappOrderButton config={whatsappConfig} productName={product.name} />}
      </div>

      {outOfStock && <WhatsappOrderButton config={whatsappConfig} productName={product.name} variant="block" />}
    </div>
  );
}
