"use client";

import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { PriceTag } from "./PriceTag";

export interface ProductCardPackOption {
  value: string;
  label: string;
  price: string;
  originalPrice?: string;
}

export interface ProductCardProps {
  href: string;
  name: string;
  imageUrl?: string | null;
  price: string;
  originalPrice?: string | null;
  discountLabel?: string;
  /** Corner "flag" badge text (e.g. "Best Selling", "New Arrival") — admin
   * editable per-product (Product.flagLabel) or curated per homepage
   * placement, depending on the caller. Absent = no flag badge. */
  flagLabel?: string;
  /** Variant products: Add to Cart adds this pack directly, no inline
   * picker — matches ghorerbazar.com's card (name/price/button only).
   * Choosing a different pack size happens on the product detail page. */
  packOptions?: ProductCardPackOption[];
  defaultPackValue?: string;
  onAddToCart?: (packValue?: string) => void;
  addToCartLabel?: string;
  addToCartPending?: boolean;
  linkComponent?: LinkComponent;
  className?: string;
}

export function ProductCard({
  href,
  name,
  imageUrl,
  price,
  originalPrice,
  discountLabel,
  flagLabel,
  packOptions,
  defaultPackValue,
  onAddToCart,
  addToCartLabel = "Add to Cart",
  addToCartPending,
  linkComponent: Link = DefaultLink,
  className,
}: ProductCardProps) {
  const defaultPack = defaultPackValue ?? packOptions?.[0]?.value;
  const defaultOption = packOptions?.find((o) => o.value === defaultPack);
  const displayPrice = defaultOption?.price ?? price;
  const displayOriginalPrice = defaultOption ? defaultOption.originalPrice : (originalPrice ?? undefined);
  // ghorerbazar.com's `.save-label` shows a percent-off pill whenever a card
  // has a strike-through price — computed here so every caller gets it for
  // free instead of having to pass pre-formatted text.
  const computedDiscountLabel =
    discountLabel ??
    (displayOriginalPrice && Number(displayOriginalPrice) > Number(displayPrice)
      ? `${Math.round((1 - Number(displayPrice) / Number(displayOriginalPrice)) * 100)}% OFF`
      : undefined);

  return (
    // Size/layout matched to ghorerbazar.com's grid product card (4px
    // radius, flat — no shadow/hover-lift, 8px padding, flush square image
    // with no radius of its own, left-aligned text, outlined not solid-fill
    // Add to Cart button) — colors are Amader's own (green/beige/ink), not
    // copied from their orange.
    <div className={cn("group relative flex h-full flex-col justify-between rounded border border-header-line bg-white p-2 text-[#020101] font-sans transition-shadow duration-300", className)}>
      {/* Pixel-matched to ghorerbazar.com's `.flag-name` / `.save-label`:
          plain elements (not the shared Badge, whose own base classes would
          fight these exact values under plain clsx) — 10px/400, 2px 6px
          padding, 4px radius, 6px inset from each top corner. */}
      {flagLabel && (
        <span className="absolute left-1.5 top-1.5 z-10 rounded bg-[#F48721] px-1.5 py-0.5 text-[10px] font-normal leading-normal text-white">
          {flagLabel}
        </span>
      )}
      {computedDiscountLabel && (
        <span className="absolute right-1.5 top-1.5 z-10 rounded bg-[#34BE82] px-1.5 py-0.5 text-[10px] font-normal leading-normal text-white">
          {computedDiscountLabel}
        </span>
      )}
      <Link href={href} className="relative mb-0 flex aspect-square w-full items-center justify-center overflow-hidden bg-beige">
        {imageUrl ? (
          <img src={imageUrl} alt={name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-[1.04]" />
        ) : (
          <div className="h-full w-full bg-beige" />
        )}
      </Link>
      <div className="flex flex-1 flex-col justify-between pt-3">
        <Link href={href} className="mb-2 line-clamp-2 min-h-[34px] md:min-h-[38px] font-sans text-sm md:text-base font-medium text-[#020101] transition-colors hover:text-header-green">
          {name}
        </Link>
        <PriceTag price={displayPrice} originalPrice={displayOriginalPrice} align="left" />
        <div className="mt-3">
          <button
            type="button"
            disabled={addToCartPending}
            onClick={() => onAddToCart?.(defaultPack)}
            className="flex h-[34px] md:h-[40px] w-full items-center justify-center gap-1.5 rounded border border-header-green bg-transparent font-sans text-xs md:text-sm font-semibold text-header-green transition-all duration-400 hover:bg-header-green hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addToCartPending ? "Adding…" : addToCartLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
