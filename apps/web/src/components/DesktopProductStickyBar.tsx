"use client";

import { useProductFloatingBarStore } from "./ProductFloatingBarContext";

/**
 * Desktop counterpart to the mobile buy bar.
 *
 * On phones, MobileStickyFooter transforms into an Add-to-cart / Buy-now bar
 * once the reader scrolls past the real buttons. Desktop had nothing: scroll
 * down a long product page and the only way to buy was to scroll back up.
 *
 * It reads the same zustand store the mobile bar does, so the two can never
 * disagree about price, stock or whether a mutation is in flight — and the
 * buttons are literally the same handlers the PDP panel uses, not a second
 * purchase path.
 *
 * Desktop shows the product name, image and price as well. The mobile bar is
 * buttons only because there is no room; a full-width desktop bar with two
 * bare buttons and no context reads as a stray toolbar.
 */
export function DesktopProductStickyBar() {
  const isScrolledPast = useProductFloatingBarStore((s) => s.isScrolledPast);
  const onAddToCart = useProductFloatingBarStore((s) => s.onAddToCart);
  const onBuyNow = useProductFloatingBarStore((s) => s.onBuyNow);
  const isPending = useProductFloatingBarStore((s) => s.isPending);
  const outOfStock = useProductFloatingBarStore((s) => s.outOfStock);
  const productName = useProductFloatingBarStore((s) => s.productName);
  const productImage = useProductFloatingBarStore((s) => s.productImage);
  const priceLabel = useProductFloatingBarStore((s) => s.priceLabel);
  const originalPriceLabel = useProductFloatingBarStore((s) => s.originalPriceLabel);

  // `onAddToCart` is the signal that a product page is mounted at all — the
  // store is global and outlives the page, so scroll state alone would let
  // the bar flash on unrelated routes.
  const onProductPage = Boolean(onAddToCart);
  const visible = onProductPage && isScrolledPast && !outOfStock;

  return (
    <div
      aria-hidden={!visible}
      // md:flex — phones already have MobileStickyFooter and must not get
      // two competing bars. Always rendered so the slide is animatable
      // rather than popping in.
      className={`fixed inset-x-0 bottom-0 z-40 hidden border-t border-line bg-white/95 backdrop-blur md:flex ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0"
      } transition-all duration-300 ease-in-out shadow-[0_-4px_20px_rgba(30,43,34,0.10)]`}
    >
      <div className="mx-auto flex w-full max-w-[1180px] items-center gap-4 px-5 py-3">
        {productImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={productImage}
            alt=""
            className="h-12 w-12 shrink-0 rounded-brand border border-line object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-sm font-semibold text-ink" title={productName ?? ""}>
            {productName}
          </p>
          <p className="flex items-baseline gap-2">
            <span className="font-ui text-base font-bold text-green">{priceLabel}</span>
            {originalPriceLabel && (
              <span className="font-ui text-xs text-muted line-through">{originalPriceLabel}</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            disabled={isPending}
            onClick={onAddToCart ?? undefined}
            className="h-11 rounded-full border border-green px-6 font-ui text-sm font-semibold text-green transition-colors hover:bg-green hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Adding…" : "Add to Cart"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onBuyNow ?? undefined}
            className="h-11 rounded-full bg-green px-7 font-ui text-sm font-semibold text-white transition-colors hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Adding…" : "Buy Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
