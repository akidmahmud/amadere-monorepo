"use client";

import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { Badge } from "./Badge";
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

  return (
    // Size/layout matched to ghorerbazar.com's grid product card (4px
    // radius, flat — no shadow/hover-lift, 8px padding, flush square image
    // with no radius of its own, left-aligned text, outlined not solid-fill
    // Add to Cart button) — colors are Amader's own (green/beige/ink), not
    // copied from their orange.
    <div className={cn("flex h-full flex-col rounded border border-line bg-white p-2", className)}>
      <Link href={href} className="relative block aspect-square bg-beige">
        {imageUrl && (
          // Plain <img> keeps this library framework-agnostic; page-level
          // composition swaps in next/image once wired to real API media (F3+).
          <img src={imageUrl} alt={name} loading="lazy" className="h-full w-full object-cover" />
        )}
        {discountLabel && (
          <Badge className="absolute left-2 top-2">{discountLabel}</Badge>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 pt-3">
        <Link href={href} className="truncate font-ui text-base font-medium text-ink">
          {name}
        </Link>
        <PriceTag price={displayPrice} originalPrice={displayOriginalPrice} align="left" />
        {/* Plain <button>, not the shared Button component — Button's own
            base classes hardcode a 9px radius, and this codebase's `cn()` is
            plain clsx (no tailwind-merge), so a conflicting `rounded`
            override here isn't guaranteed to win (confirmed live: it
            didn't — same class of bug already hit once this session with
            Header's own action-button sizing). A standalone button sidesteps
            the conflict entirely instead of fighting it. */}
        <button
          type="button"
          disabled={addToCartPending}
          onClick={() => onAddToCart?.(defaultPack)}
          className="mt-auto flex h-10 w-full items-center justify-center rounded border-[1.5px] border-green font-ui text-sm font-semibold text-green transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          {addToCartPending ? "Adding…" : addToCartLabel}
        </button>
      </div>
    </div>
  );
}
