"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { formatMoney } from "./PriceTag";

export interface ProductCardTwoPackOption {
  value: string;
  label: string;
  price: string;
  originalPrice?: string;
  outOfStock?: boolean;
}

export interface ProductCardTwoProps {
  href: string;
  name: string;
  imageUrl?: string | null;
  price: string;
  originalPrice?: string | null;
  discountLabel?: string;
  /** Corner "flag" badge text (e.g. "Best Selling") — same source as ProductCard's. */
  flagLabel?: string;
  /** 2+ options: a real dropdown to pick before adding to cart. Exactly 1:
   * nothing to pick, so it's shown as a plain (non-interactive) label
   * instead of a pointless one-item dropdown. None: falls back to
   * `weightLabel` (a plain static label, same slot) if given, else omitted —
   * a simple product with no weight info has nothing to show there. */
  packOptions?: ProductCardTwoPackOption[];
  defaultPackValue?: string;
  /** Simple (non-variant) products only — shown in the pack slot in place of
   * a dropdown, since there's nothing to actually pick. Ignored when
   * packOptions is set. */
  weightLabel?: string;
  outOfStock?: boolean;
  onAddToCart?: (packValue?: string) => void;
  addToCartLabel?: string;
  addToCartPending?: boolean;
  linkComponent?: LinkComponent;
  className?: string;
  /** Same contract as ProductCard's onSelect — fires right before the
   * card's Link navigates, for the caller's own GA4 select_item push. */
  onSelect?: () => void;
}

// Second card style — pixel-matched to organicindia.com's product card
// (`.card-wrapper.product-card-wrapper.underline-links-hover`, measured
// directly off the live site): 20px-rounded photo + 1px warm border, a
// single-line title (never 2 lines — `truncate`, not ProductCard's
// line-clamp-2), bold price + faded strikethrough compare price, and two
// full pill-shaped controls (variant select, Add to Cart) instead of
// ProductCard's rectangular-with-radius ones. Colors swapped to this site's
// own tokens (green button, gold badge) — same convention already used
// everywhere else a reference design gets cloned in this codebase — but
// sizes/spacing/radii match the measurement exactly.
export function ProductCardTwo({
  href,
  name,
  imageUrl,
  price,
  originalPrice,
  discountLabel,
  flagLabel,
  packOptions,
  defaultPackValue,
  weightLabel,
  outOfStock,
  onAddToCart,
  addToCartLabel = "Add to Cart",
  addToCartPending,
  linkComponent: Link = DefaultLink,
  className,
  onSelect,
}: ProductCardTwoProps) {
  const hasChoice = (packOptions?.length ?? 0) > 1;
  const singleOption = packOptions?.length === 1 ? packOptions[0] : undefined;
  const [selected, setSelected] = useState(defaultPackValue ?? packOptions?.[0]?.value);
  const selectedOption = packOptions?.find((o) => o.value === selected) ?? singleOption;

  const displayPrice = selectedOption?.price ?? price;
  const displayOriginalPrice = selectedOption ? selectedOption.originalPrice : (originalPrice ?? undefined);
  const isOutOfStock = packOptions ? packOptions.every((o) => o.outOfStock) : !!outOfStock;
  const computedDiscountLabel =
    discountLabel ??
    (displayOriginalPrice && Number(displayOriginalPrice) > Number(displayPrice)
      ? `${Math.round((1 - Number(displayPrice) / Number(displayOriginalPrice)) * 100)}% OFF`
      : undefined);

  function handleAddToCart() {
    onAddToCart?.(packOptions ? (selected ?? singleOption?.value) : undefined);
  }

  return (
    <div className={cn("group flex h-full flex-col rounded-[20px] border border-line bg-transparent p-2.5", className)}>
      <Link href={href} onClick={onSelect} className="relative block aspect-square w-full overflow-hidden rounded-[20px] bg-beige">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-[1.04]"
          />
        ) : null}
        {(flagLabel || computedDiscountLabel) && (
          // All badges grouped on the right, stacked in a column (not a
          // wrapping row) per explicit request — flex-col + items-end so
          // multiple badges stack one per line, each right-aligned. Only
          // rendering the spans that actually have content (the old
          // justify-between layout needed both slots present — even empty —
          // to keep a lone badge pinned to its designated side; that's not
          // needed here since items-end right-aligns regardless).
          <div className="absolute inset-x-1.5 top-1.5 flex flex-col items-end gap-1">
            {flagLabel && (
              <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-[10px] leading-normal text-ink">
                {flagLabel}
              </span>
            )}
            {computedDiscountLabel && (
              <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-[10px] leading-normal text-ink">
                {computedDiscountLabel}
              </span>
            )}
          </div>
        )}
      </Link>

      {/* flex-1 + justify-between (not a plain block div) — the button is a
          separate flex child pinned to the card's bottom instead of just
          trailing directly after the pack slot, so a card with no
          pack/weight to show (no dropdown or label rendered above) doesn't
          end up shorter than one that has one. Requires the root card div's
          `h-full` above so there's actually spare height to distribute when
          this card sits in the same grid row as a taller one. */}
      <div className="flex flex-1 flex-col justify-between pt-2.5">
        <div>
          <Link href={href} onClick={onSelect} className="block truncate font-sans text-[13px] leading-[130%] text-ink" title={name}>
            {name}
          </Link>

          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-sans text-lg font-semibold text-ink">{formatMoney(displayPrice)}</span>
            {displayOriginalPrice && Number(displayOriginalPrice) > Number(displayPrice) && (
              <span className="font-sans text-sm text-muted line-through">{formatMoney(displayOriginalPrice)}</span>
            )}
          </p>

          {hasChoice ? (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-[5px] h-[33px] w-full rounded-full border border-ink/70 bg-cream px-3 font-sans text-sm text-ink outline-none"
            >
              {packOptions!.map((o) => (
                <option key={o.value} value={o.value} disabled={o.outOfStock}>
                  {o.label}
                  {o.outOfStock ? " — Out of Stock" : ""}
                </option>
              ))}
            </select>
          ) : singleOption ? (
            <div className="mt-[5px] flex h-[33px] w-full items-center rounded-full border border-ink/30 bg-cream px-3 font-sans text-sm text-ink">
              {singleOption.label}
            </div>
          ) : weightLabel ? (
            <div className="mt-[5px] flex h-[33px] w-full items-center rounded-full border border-ink/30 bg-cream px-3 font-sans text-sm text-ink">
              {weightLabel}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          disabled={isOutOfStock || addToCartPending}
          onClick={handleAddToCart}
          className={cn(
            "mt-2.5 h-[47px] w-full rounded-full font-sans text-lg font-semibold transition-colors",
            isOutOfStock
              ? "cursor-not-allowed bg-line text-muted"
              : "bg-green text-white hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {isOutOfStock ? "Out of Stock" : addToCartPending ? "Adding…" : addToCartLabel}
        </button>
      </div>
    </div>
  );
}
