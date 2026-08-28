"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import {
  PackSizeSelector,
  PriceTag,
  QtyStepper,
  WatchingNowBadge,
  formatMoney,
  useCartDrawerStore,
} from "@amader/ui";
import { usePathname, useRouter } from "@/i18n/navigation";
import { buildPackSizeOptions, defaultVariantId } from "@/lib/pdp";
import { toApiLocale } from "@/lib/api-locale";
import { useAddToCart } from "@/hooks/useCart";
import { pushEcommerceEvent, productToGa4Item } from "@/lib/analytics-events";
import { useMe } from "@/hooks/useAuth";
import { useAddToWishlist, useRemoveFromWishlist, useWishlist } from "@/hooks/useAccount";
import { useToast } from "@/components/ToastProvider";
import { useSelectedVariant } from "@/components/SelectedVariantProvider";
import { WhatsappOrderButton } from "@/components/WhatsappOrderButton";
import { CallNowButton } from "@/components/CallNowButton";
import type { WhatsappConfig } from "@/lib/whatsapp";
import type { components } from "@/lib/api/schema";

type PublicProductDetailDto = components["schemas"]["PublicProductDetailDto"];

const checkIcon = (
  <svg
    viewBox="0 0 24 24"
    width={15}
    height={15}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0 text-green"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="8.5 12.5 11 15 15.5 9.5" />
  </svg>
);

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
  // Selection lives in SelectedVariantProvider when the PDP wraps this (so
  // the gallery can react to it — see PdpGallery), and falls back to local
  // state anywhere that provider isn't present.
  const variantCtx = useSelectedVariant();
  const [localVariantId, setLocalVariantId] = useState(() => defaultVariantId(product));
  const selectedVariantId = variantCtx ? variantCtx.selectedVariantId : localVariantId;
  const setSelectedVariantId = variantCtx ? variantCtx.setSelectedVariantId : setLocalVariantId;
  const [qty, setQty] = useState(product.minOrderQuantity || 1);
  const openCartDrawer = useCartDrawerStore((s) => s.open);
  const closeCartDrawer = useCartDrawerStore((s) => s.close);
  const locale = toApiLocale(useLocale());
  const addToCart = useAddToCart(locale);
  const router = useRouter();
  const pathname = usePathname();
  const { data: me } = useMe();
  const { data: wishlist } = useWishlist(locale, Boolean(me));
  const addToWishlist = useAddToWishlist(locale);
  const removeFromWishlist = useRemoveFromWishlist(locale);
  const isWishlisted = wishlist?.some((item) => item.productId === product.id) ?? false;
  const toast = useToast();

  // view_item — once per product page visit. add_to_cart is already covered
  // by useAddToCart itself (useCart.ts), so nothing extra needed for that
  // here despite this panel owning the "Add to Cart" button.
  useEffect(() => {
    const item = productToGa4Item(product);
    pushEcommerceEvent("view_item", { currency: "BDT", value: item.price, items: [item] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const badges = (product.keyBenefits ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

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
  // Mirrors the backend's real purchase gate (cart.service.ts's
  // validateLine): stock only blocks a purchase when trackInventory is on
  // AND allowBackorder is off. Previously used `stockCount < 1 &&
  // !isBackorder` alone, which showed "Out of Stock" even for untracked
  // products (trackInventory: false) whose `stock` column is unused/stale.
  const outOfStock = product.trackInventory && !product.allowBackorder && stockCount < 1;

  function addItem(onSuccess: () => void, onError?: () => void) {
    addToCart.mutate(
      {
        productId: product.id,
        variantId: product.hasVariants ? Number(selectedVariantId) : undefined,
        quantity: qty,
      },
      { onSuccess, onError },
    );
  }

  // Drawer opens on the tap, not on the response — the round trip is the
  // whole reason the button felt dead, and the drawer renders its own
  // pending state (SiteCartDrawer) while the line is still in flight. It
  // closes again if the add actually fails, so a stock/network error never
  // leaves an open drawer implying success.
  function handleAddToCart() {
    openCartDrawer();
    addItem(
      () => {},
      () => closeCartDrawer(),
    );
  }

  /**
   * Warm the checkout route while the shopper is still reading the page.
   *
   * Buy Now is a `router.push`, not a `<Link>`, so Next never prefetched it —
   * the whole route (RSC payload plus its JS) was fetched only AFTER the tap,
   * behind the add-to-cart call. Measured on a throttled phone: 484ms adding
   * to the cart, then 3378ms fetching /checkout, and 7.7s before the form was
   * usable. Prefetching moves that fetch off the critical path.
   *
   * Deferred to idle so it never competes with the product images and the
   * page's own hydration, and fired once — Next caches the result, so the tap
   * navigates into a warm router cache.
   */
  useEffect(() => {
    const warm = () => router.prefetch("/checkout");
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (ric) {
      const id = ric(warm, { timeout: 3000 });
      return () => (window as unknown as { cancelIdleCallback?: (i: number) => void })
        .cancelIdleCallback?.(id);
    }
    // Safari has no requestIdleCallback; a short timer is close enough.
    const t = setTimeout(warm, 1500);
    return () => clearTimeout(t);
  }, [router]);

  // The backend's `/cart/buy-now` is a pricing-only quote — it never touches
  // the persisted cart, so there's no real way to "buy" through it directly.
  // The actual bypass here is real, not a stub: add to the cart, then go
  // straight to checkout instead of opening the drawer.
  function handleBuyNow() {
    addItem(() => router.push("/checkout"));
  }

  function handleToggleWishlist() {
    if (!me) {
      // There's no guest wishlist (unlike cart's guest-token flow) — nothing
      // is saved until the customer actually logs in, so this needs its own
      // heads-up instead of silently redirecting, or a customer who taps the
      // heart, logs in, and finds the wishlist still empty reads it as data
      // loss rather than "nothing was ever added."
      toast.push("Log in to save items to your wishlist");
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (isWishlisted) {
      removeFromWishlist.mutate(product.id);
    } else {
      const item = productToGa4Item(product);
      pushEcommerceEvent("add_to_wishlist", { currency: "BDT", value: item.price, items: [item] });
      addToWishlist.mutate(product.id);
    }
  }

  return (
    <div className="font-ui">
      <PriceTag
        price={price}
        originalPrice={originalPrice}
        align="left"
        size="lg"
        className="mb-3 md:mb-4 [&_span]:text-[26px] [&_span]:font-semibold [&_span]:tracking-[-1.3px] [&_span]:text-green"
      />

      {/* Desktop keeps variants above the CTAs (normal convention). Mobile
          moves them below the CTA grid instead — same position ghorerbazar's
          mobile PDP uses for its Brand row — so the first screen on mobile is
          just image/title/price/qty/buttons, per explicit user request. */}
      {product.hasVariants && packOptions.length > 0 && selectedVariantId && (
        <div className="hidden md:block">
          <h4 className="mb-2.5 font-ui text-sm font-medium text-ink">Select Pack Size</h4>
          <PackSizeSelector options={packOptions} value={selectedVariantId} onChange={setSelectedVariantId} />
        </div>
      )}

      {/* Sits right under Select Pack Size (still here even when that
          section doesn't render, e.g. products with no variants). id watched
          by ProductFloatingBarProvider — the mobile sticky Buy Now/Add to
          Cart bar appears once this row scrolls out of view. */}
      <div id="pdp-social-proof" className="mb-4">
        <WatchingNowBadge productId={product.id} salesCount={product.salesCount} />
      </div>

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

      {/* Matches the reference's <hr> between the price/offer block and the
          quantity row — was missing entirely before. */}
      <hr className="mb-3 border-line md:mb-4" />

      <div className="mb-2 flex items-center gap-3 md:mb-3">
        {/* Slim, inline stand-in for the desktop PackSizeSelector card grid
            (kept above the CTAs, unchanged) — that card layout is too wide
            to sit next to the qty stepper on a phone, so mobile gets a
            native select sharing this row instead, per explicit request. */}
        {product.hasVariants && packOptions.length > 0 && selectedVariantId && (
          <select
            aria-label="Select pack size"
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-full border border-line bg-white px-3 font-ui text-base text-ink md:hidden"
          >
            {packOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {formatMoney(option.price)}
              </option>
            ))}
          </select>
        )}
        <QtyStepper
          value={qty}
          onChange={setQty}
          min={product.minOrderQuantity || 1}
          max={product.maxOrderQuantity ?? undefined}
        />
        <button
          type="button"
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={handleToggleWishlist}
          disabled={addToWishlist.isPending || removeFromWishlist.isPending}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line ${isWishlisted ? "text-red-600" : "text-muted"}`}
        >
          {heartIcon(isWishlisted)}
        </button>
      </div>

      {/* Add to Cart/Buy Now drop out when out of stock (and not on
          backorder), leaving WhatsApp/Call Now alone in the grid — CSS grid
          reflows 2 items into a single row on its own, no extra branching
          needed. WhatsApp/Call Now otherwise always show, every product page,
          regardless of stock.

          Mobile: Add to Cart/Buy Now each get their own full-width row (per
          explicit request) instead of sharing a 2-col grid cell — achieved
          without duplicating the buttons by making the outer container a
          column flex (stretches children full-width) on mobile and a 2-col
          grid on desktop, while the WhatsApp/Call Now wrapper is itself a
          2-col grid on mobile but `contents` on desktop so its two children
          fall directly into the parent grid's second row instead of being
          squeezed into a single cell. */}
      <div id="pdp-buy-buttons" className="mb-3 flex flex-col gap-3 md:mb-4 md:grid md:grid-cols-2">
        {!outOfStock && (
          <>
            <button
              type="button"
              disabled={addToCart.isPending}
              onClick={handleAddToCart}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md border-2 border-green bg-transparent text-sm font-semibold uppercase text-green transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addToCart.isPending ? "Adding…" : "Add To Cart"}
            </button>
            <button
              type="button"
              disabled={addToCart.isPending}
              onClick={handleBuyNow}
              className="flex h-11 w-full animate-[wiggle_2.5s_ease-in-out_infinite] items-center justify-center gap-2 rounded-md bg-green text-sm font-semibold uppercase text-white transition-colors hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addToCart.isPending ? "Adding…" : "Buy Now"}
            </button>
          </>
        )}
        <div className="grid grid-cols-2 gap-3 md:contents">
          <WhatsappOrderButton config={whatsappConfig} productName={product.name} />
          <CallNowButton config={whatsappConfig} />
        </div>
      </div>


      {badges.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2.5">
          {badges.map((item) => (
            <span key={item} className="flex items-center gap-2 font-ui text-xs font-bold text-text">
              {checkIcon}
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
