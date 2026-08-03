"use client";

import { formatMoney } from "@amader/ui";
import { AppLink } from "@/components/AppLink";

export interface RelatedProductCardProps {
  href: string;
  name: string;
  imageUrl?: string | null;
  price: string;
  originalPrice?: string | null;
  discountLabel?: string;
  /** Corner "flag" badge text (e.g. "Best Selling") — Product.flagLabel. */
  flagLabel?: string;
  /** Drives price/Add To Cart button color only — badge colors are always
   * the reference's exact flag-name/save-label values regardless of accent.
   * "orange" (default) matches Related Products' reference styling. "green"
   * is our own brand color (#1F703C, i.e. `--color-green`), used by the Cross
   * Sell Products section per explicit request — the reference site has no
   * brand-color equivalent to copy for that section. */
  accent?: "orange" | "green";
}

const ACCENT_CLASSES = {
  orange: { price: "text-[#F48721]", button: "border-[#F48721] text-[#F48721] hover:bg-[#fdf1e8]" },
  green: { price: "text-green", button: "border-green text-green hover:bg-cream" },
};

// Reference's Related Products card: plain grid tile (no shadow/border), a
// top-left badge ribbon, and an outlined (not solid) Add To Cart button that
// links through to the product page — this section dropped its carousel/
// inline-add-to-cart behavior when it became a static grid, so "Add To Cart"
// here navigates rather than mutating the cart directly.
export function RelatedProductCard({
  href,
  name,
  imageUrl,
  price,
  originalPrice,
  discountLabel,
  flagLabel,
  accent = "orange",
}: RelatedProductCardProps) {
  const colors = ACCENT_CLASSES[accent];
  // ghorerbazar.com's `.save-label` shows a percent-off pill whenever a card
  // has a strike-through price — computed here so every caller gets it for
  // free instead of having to pass pre-formatted text.
  const computedDiscountLabel =
    discountLabel ??
    (originalPrice && Number(originalPrice) > Number(price)
      ? `${Math.round((1 - Number(price) / Number(originalPrice)) * 100)}% OFF`
      : undefined);
  return (
    <div className="flex h-full flex-col">
      <AppLink href={href} className="relative block aspect-square overflow-hidden rounded bg-white">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} loading="lazy" className="h-full w-full object-contain" />
        )}
        {/* Pixel-matched to ghorerbazar.com's `.flag-name` / `.save-label`. */}
        {flagLabel && (
          <span className="absolute left-1.5 top-1.5 rounded bg-[#F48721] px-1.5 py-0.5 text-[10px] font-normal leading-normal text-white">
            {flagLabel}
          </span>
        )}
        {computedDiscountLabel && (
          <span className="absolute right-1.5 top-1.5 rounded bg-[#34BE82] px-1.5 py-0.5 text-[10px] font-normal leading-normal text-white">
            {computedDiscountLabel}
          </span>
        )}
      </AppLink>
      <div className="flex flex-1 flex-col gap-1.5 pt-3">
        <AppLink href={href} className="truncate text-base font-medium text-[#222831]">
          {name}
        </AppLink>
        <div className={`text-sm font-semibold ${colors.price}`}>
          {formatMoney(price)}
          {originalPrice && Number(originalPrice) > Number(price) && (
            <span className="ml-2 text-xs text-muted line-through">{formatMoney(originalPrice)}</span>
          )}
        </div>
        <AppLink
          href={href}
          className={`mt-auto flex h-9 w-full items-center justify-center rounded border text-sm font-semibold transition-colors ${colors.button}`}
        >
          Add To Cart
        </AppLink>
      </div>
    </div>
  );
}
