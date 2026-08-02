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
  /** "orange" (default) matches Related Products' reference styling. "green"
   * is our own brand color (#1F703C, i.e. `--color-green`), used by the Cross
   * Sell Products section per explicit request — the reference site has no
   * brand-color equivalent to copy for that section. */
  accent?: "orange" | "green";
}

const ACCENT_CLASSES = {
  orange: { badge: "bg-[#F48721]", price: "text-[#F48721]", button: "border-[#F48721] text-[#F48721] hover:bg-[#fdf1e8]" },
  green: { badge: "bg-green", price: "text-green", button: "border-green text-green hover:bg-cream" },
};

// Reference's Related Products card: plain grid tile (no shadow/border), a
// top-left badge ribbon, and an outlined (not solid) Add To Cart button that
// links through to the product page — this section dropped its carousel/
// inline-add-to-cart behavior when it became a static grid, so "Add To Cart"
// here navigates rather than mutating the cart directly.
export function RelatedProductCard({ href, name, imageUrl, price, originalPrice, discountLabel, accent = "orange" }: RelatedProductCardProps) {
  const colors = ACCENT_CLASSES[accent];
  return (
    <div className="flex h-full flex-col">
      <AppLink href={href} className="relative block aspect-square overflow-hidden rounded bg-white">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} loading="lazy" className="h-full w-full object-contain" />
        )}
        {discountLabel && (
          <span className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] text-white ${colors.badge}`}>
            {discountLabel}
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
