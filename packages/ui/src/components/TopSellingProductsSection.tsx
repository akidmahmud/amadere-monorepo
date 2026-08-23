"use client";

import { useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { formatMoney } from "./PriceTag";
import { cn } from "../lib/cn";
import { PackPickerModal, type PackPickerOption } from "./PackPickerModal";
import { SiteProductCard } from "./SiteProductCard";

export interface TopSellingProductItem {
  href: string;
  productId: number;
  name: string;
  imageUrl?: string;
  /** Decimal string from the backend. */
  price: string;
  /** Decimal string — present only when the product is on sale. */
  originalPrice?: string;
  /** ISO date string — passed through to the mobile grid's ProductCard for
   * its live countdown. Not shown on the desktop horizontal card (a fully
   * custom layout, out of scope for this pass). */
  saleEndsAt?: string;
  showBadge?: boolean;
  /** Variant products with more than one pack: Add to Cart/Buy Now opens a
   * PackPickerModal to choose first (on both the mobile ProductCard grid and
   * the desktop custom card). A single pack (or none) still adds directly
   * via defaultPackValue below — nothing to pick. */
  packOptions?: PackPickerOption[];
  /** The variant id Add to Cart/Buy Now sends when there's no pack choice to
   * make — without it the backend rejects the request ("requires a variantId"). */
  defaultPackValue?: string;
  /** Simple (non-variant) products only — variant stock lives per-pack on
   * packOptions[].outOfStock instead. */
  outOfStock?: boolean;
}

export interface TopSellingProductsSectionProps {
  heading?: string;
  items: TopSellingProductItem[];
  onAddToCart?: (productId: number, packValue?: string) => void;
  addToCartPendingId?: number;
  onBuyNow?: (productId: number, packValue?: string) => void;
  buyNowPendingId?: number;
  addToCartLabel?: string;
  buyNowLabel?: string;
  bestBadgeLabel?: string;
  saveLabel?: string;
  linkComponent?: LinkComponent;
}

const badgeIcon = (
  <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor">
    <path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1.5-.8-2.6-.8-2.6S17 10 17 13a5 5 0 0 1-10 0c0-5 5-7 5-11Z" />
  </svg>
);
const cartIcon = (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);
const buyIcon = (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 3 14h9l-1 8 10-12h-9Z" />
  </svg>
);

// Desktop/tablet (md+): pixel-matched to amader-home-top.html's "Top Selling
// Products" section — 2-col grid (1-col <1024px) of the big horizontal card,
// literal spacing/radius/colors from that file. Mobile (<768px): a deliberate
// departure from the reference — a plain 2-column grid of the site's normal
// ProductCard (image-top, compact) instead of the horizontal card, per
// explicit user request rather than the reference's own single-column stack.
export function TopSellingProductsSection({
  heading = "Top Selling Products",
  items,
  onAddToCart,
  addToCartPendingId,
  onBuyNow,
  buyNowPendingId,
  addToCartLabel = "Add To Cart",
  buyNowLabel = "Buy Now",
  bestBadgeLabel = "Best Selling",
  saveLabel = "Save",
  linkComponent: Link = DefaultLink,
}: TopSellingProductsSectionProps) {
  const [picker, setPicker] = useState<{ item: TopSellingProductItem; action: "cart" | "buyNow" } | null>(null);

  if (items.length === 0) return null;

  function handleDesktopClick(item: TopSellingProductItem, action: "cart" | "buyNow") {
    if ((item.packOptions?.length ?? 0) > 1) {
      setPicker({ item, action });
    } else if (action === "cart") {
      onAddToCart?.(item.productId, item.defaultPackValue);
    } else {
      onBuyNow?.(item.productId, item.defaultPackValue);
    }
  }

  return (
    <section className="py-10 md:py-14">
      <div className="mx-auto max-w-[1440px] px-4 md:px-6">
        <h2 className="mb-6 text-center font-serif text-[22px] font-semibold text-green md:text-[30px]">
          {heading}
        </h2>

        <div className="grid grid-cols-2 gap-3 md:hidden">
          {items.map((item) => (
            <SiteProductCard
              key={item.productId}
              href={item.href}
              name={item.name}
              imageUrl={item.imageUrl}
              price={item.price}
              originalPrice={item.originalPrice}
              saleEndsAt={item.saleEndsAt}
              flagLabel={item.showBadge ? bestBadgeLabel : undefined}
              packOptions={item.packOptions}
              defaultPackValue={item.defaultPackValue}
              outOfStock={item.outOfStock}
              onAddToCart={(packValue) => onAddToCart?.(item.productId, packValue)}
              addToCartLabel={addToCartLabel}
              addToCartPending={addToCartPendingId === item.productId}
              linkComponent={Link}
            />
          ))}
        </div>

        <div className="hidden grid-cols-1 gap-6 md:grid lg:grid-cols-2">
          {items.map((item) => {
            const hasDiscount = item.originalPrice != null && Number(item.originalPrice) > Number(item.price);
            const isAddingToCart = addToCartPendingId === item.productId;
            const isBuyingNow = buyNowPendingId === item.productId;
            const isOutOfStock = item.packOptions ? item.packOptions.every((o) => o.outOfStock) : !!item.outOfStock;

            return (
              <article
                key={item.productId}
                className="group relative flex min-h-0 flex-col gap-4 rounded-[14px] border border-transparent bg-white p-6 shadow-[0_3px_14px_rgba(30,43,34,.06)] transition-[box-shadow,border-color] duration-200 hover:border-header-green hover:shadow-[0_10px_26px_rgba(33,113,61,.14)] md:min-h-[300px] md:flex-row md:items-stretch md:gap-6"
              >
                {/* Pixel-matched to ghorerbazar.com's `.tp-product-badge`:
                    plain element (not the shared Badge), ribbon-shaped
                    asymmetric radius, exact red/weight/padding. */}
                {item.showBadge && (
                  <span className="absolute right-3 top-3 z-[2] flex items-center gap-1 rounded-tl-[2px] rounded-tr-[8px] rounded-br-[2px] rounded-bl-[8px] bg-[#FF3F33] px-2 py-1 text-xs font-bold text-white md:right-3.5 md:top-3.5">
                    {badgeIcon}
                    {bestBadgeLabel}
                  </span>
                )}

                <Link href={item.href} className="flex h-[220px] w-full shrink-0 items-center justify-center overflow-hidden md:h-[240px] md:w-[240px] md:self-center lg:h-[300px] lg:w-[300px]">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img loading="lazy"
                      src={item.imageUrl}
                      alt=""
                      className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="h-full w-full bg-beige" />
                  )}
                </Link>

                {/* flex-col + justify-between (not the old plain block div) —
                    the button row is a separate flex child pinned to the
                    bottom instead of just trailing whatever height the
                    title/price block happens to need, so Add to
                    Cart/Buy Now land on the same row across every card in a
                    grid line regardless of whether a given product's name
                    wraps to one line or two. */}
                <div className="flex min-w-0 flex-1 flex-col md:justify-between">
                  <div>
                    {/* The "Best Selling" ribbon is absolutely positioned in
                        the article's top-right corner, outside the normal
                        content flow — it only visually clears the title when
                        that particular title's first line happens to be
                        short enough to not reach that corner (pure luck, not
                        a fix). Reserving real top clearance here, only when
                        the badge is actually showing, guarantees the title
                        never starts underneath it regardless of text length
                        or language. */}
                    <h3
                      className={cn(
                        "font-header text-[1.15rem] font-extrabold leading-[1.35] text-header-ink",
                        item.showBadge && "pt-7",
                      )}
                    >
                      <Link href={item.href} className="hover:text-header-green">
                        {item.name}
                      </Link>
                    </h3>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="font-header text-[1.15rem] font-extrabold text-header-green">{formatMoney(item.price)}</span>
                      {hasDiscount && (
                        <span className="font-header text-[0.95rem] font-semibold text-header-muted line-through">
                          {formatMoney(item.originalPrice!)}
                        </span>
                      )}
                    </div>
                    {/* Pixel-matched to ghorerbazar.com's `.save-price`. */}
                    {hasDiscount && (
                      <span className="mt-3 inline-flex rounded-full bg-[#BFDB38] px-2 py-1 text-xs font-semibold text-[#222831]">
                        {saveLabel} {formatMoney(String(Number(item.originalPrice) - Number(item.price)))}
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {isOutOfStock ? (
                      <span className="inline-flex h-11 items-center rounded-[9px] border-[1.5px] border-header-line bg-beige px-[18px] font-header text-[0.84rem] font-bold text-[#9b9b9b]">
                        Out of Stock
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isAddingToCart}
                          onClick={() => handleDesktopClick(item, "cart")}
                          className={cn(
                            "inline-flex h-11 items-center gap-[9px] rounded-[9px] border-[1.5px] border-header-green bg-white px-[18px] font-header text-[0.84rem] font-bold text-header-green transition-colors hover:bg-beige",
                            isAddingToCart && "opacity-60",
                          )}
                        >
                          {cartIcon}
                          {isAddingToCart ? "…" : addToCartLabel}
                        </button>
                        <button
                          type="button"
                          disabled={isBuyingNow}
                          onClick={() => handleDesktopClick(item, "buyNow")}
                          className={cn(
                            "inline-flex h-11 items-center gap-[9px] rounded-[9px] bg-header-green px-5 font-header text-[0.84rem] font-bold text-white transition-colors hover:bg-header-green-dark",
                            isBuyingNow && "opacity-60",
                          )}
                        >
                          {buyIcon}
                          {isBuyingNow ? "…" : buyNowLabel}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      {picker && picker.item.packOptions && (
        <PackPickerModal
          productName={picker.item.name}
          options={picker.item.packOptions}
          defaultValue={picker.item.defaultPackValue}
          onConfirm={(value) => {
            if (picker.action === "cart") onAddToCart?.(picker.item.productId, value);
            else onBuyNow?.(picker.item.productId, value);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
          confirmLabel={picker.action === "cart" ? addToCartLabel : buyNowLabel}
          confirmPending={picker.action === "cart" ? addToCartPendingId === picker.item.productId : buyNowPendingId === picker.item.productId}
        />
      )}
    </section>
  );
}
