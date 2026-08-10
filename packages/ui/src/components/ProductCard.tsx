"use client";

import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { PackPickerModal } from "./PackPickerModal";
import { PriceTag } from "./PriceTag";

const COUNTDOWN_UNITS = [
  ["days", "Days"],
  ["hours", "Hours"],
  ["minutes", "Min"],
  ["seconds", "Sec"],
] as const;

// Pixel-matched to ghorerbazar.com's `.offer-countdown` (label + 4 boxed
// units ticking live), recolored green per explicit request instead of
// their red/coral. Ticks once a second only while an endsAt is actually
// set — no interval runs for the (common) case of a card with no sale.
//
// `now` starts at null (not Date.now()) so the very first client render
// matches the server-rendered HTML exactly (both show no countdown) —
// seeding it with Date.now() directly caused a real hydration mismatch,
// since the server-render and client-hydration timestamps always differ by
// at least a few ms, occasionally enough to flip a displayed digit.
function useCountdown(endsAt?: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!endsAt || now === null) return null;
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export interface ProductCardPackOption {
  value: string;
  label: string;
  price: string;
  originalPrice?: string;
  outOfStock?: boolean;
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
  /** ISO date string — while set and in the future, shows a live "Offer
   * ends in" countdown overlaid on the image's bottom edge. */
  saleEndsAt?: string;
  /** Variant products with more than one pack: Add to Cart opens a small
   * blurred-backdrop popup to pick the pack first, instead of guessing the
   * default. A single pack (or none) still adds directly — nothing to pick. */
  packOptions?: ProductCardPackOption[];
  defaultPackValue?: string;
  /** Simple (non-variant) products only — for variant products, stock is
   * per-pack (see ProductCardPackOption.outOfStock) and this is ignored. */
  outOfStock?: boolean;
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
  saleEndsAt,
  packOptions,
  defaultPackValue,
  outOfStock,
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
  const hasPackChoice = (packOptions?.length ?? 0) > 1;
  const isOutOfStock = packOptions ? packOptions.every((o) => o.outOfStock) : !!outOfStock;
  const [pickerOpen, setPickerOpen] = useState(false);

  function handleAddToCartClick() {
    if (hasPackChoice) {
      setPickerOpen(true);
    } else {
      onAddToCart?.(defaultPack);
    }
  }

  function confirmPickedPack(value: string) {
    onAddToCart?.(value);
    setPickerOpen(false);
  }
  // ghorerbazar.com's `.save-label` shows a percent-off pill whenever a card
  // has a strike-through price — computed here so every caller gets it for
  // free instead of having to pass pre-formatted text.
  const computedDiscountLabel =
    discountLabel ??
    (displayOriginalPrice && Number(displayOriginalPrice) > Number(displayPrice)
      ? `${Math.round((1 - Number(displayPrice) / Number(displayOriginalPrice)) * 100)}% OFF`
      : undefined);
  const countdown = useCountdown(saleEndsAt);

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
      {(flagLabel || computedDiscountLabel) && (
        // flex + justify-between (not two independently left/right-absolute
        // spans) — a real gap-1 between the two badges instead of them
        // sitting flush against whatever text each happens to have. Sized
        // small enough (9px/px-1) that even "Best Selling" + a 3-digit
        // "100% OFF" both fit on the same row on the narrowest (2-per-row
        // mobile grid) card — no ellipsis, no wrap, both always readable.
        // Always renders both <span> slots (empty/unstyled when that label
        // is absent) so justify-between still pushes a lone badge to its
        // correct side.
        <div className="absolute inset-x-1.5 top-1.5 z-10 flex items-start justify-between gap-1">
          <span className={flagLabel ? "shrink-0 rounded bg-[#FF4900] px-1 py-0.5 text-[9px] font-normal leading-normal text-white" : undefined}>
            {flagLabel}
          </span>
          <span className={computedDiscountLabel ? "shrink-0 rounded bg-[#008400] px-1 py-0.5 text-[9px] font-normal leading-normal text-white" : undefined}>
            {computedDiscountLabel}
          </span>
        </div>
      )}
      <Link href={href} className="relative mb-0 flex aspect-square w-full items-center justify-center overflow-hidden bg-beige">
        {imageUrl ? (
          <img src={imageUrl} alt={name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-[1.04]" />
        ) : (
          <div className="h-full w-full bg-beige" />
        )}
        {countdown && (
          <div className="absolute inset-x-1 bottom-1 z-10 rounded bg-white/55 px-1 pb-1 pt-0.5 text-center">
            <div className="mb-0.5 text-[9px] font-semibold leading-tight text-header-green">⏰ Offer ends in:</div>
            <div className="flex items-center justify-center gap-0.5">
              {COUNTDOWN_UNITS.map(([key, label], i) => (
                <span key={key} className="flex items-center gap-0.5">
                  <span className="flex min-w-[22px] flex-col items-center rounded bg-gradient-to-br from-header-green to-header-green-dark px-1 py-0.5 leading-none text-white shadow-sm">
                    <span className="text-[10px] font-bold leading-none">{String(countdown[key]).padStart(2, "0")}</span>
                    <span className="mt-0.5 text-[6.5px] leading-none">{label}</span>
                  </span>
                  {i < COUNTDOWN_UNITS.length - 1 && <span className="text-[11px] font-bold leading-none text-header-green">:</span>}
                </span>
              ))}
            </div>
          </div>
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
            disabled={addToCartPending || isOutOfStock}
            onClick={handleAddToCartClick}
            className={cn(
              "flex h-[34px] md:h-[40px] w-full items-center justify-center gap-1.5 rounded border font-sans text-xs md:text-sm font-semibold transition-all duration-400",
              isOutOfStock
                ? "cursor-not-allowed border-header-line bg-beige text-[#9b9b9b] hover:bg-beige"
                : "border-header-green bg-transparent text-header-green hover:bg-header-green hover:text-white disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {isOutOfStock ? "Out of Stock" : addToCartPending ? "Adding…" : addToCartLabel}
          </button>
        </div>
      </div>
      {pickerOpen && packOptions && (
        <PackPickerModal
          productName={name}
          options={packOptions}
          defaultValue={defaultPack}
          onConfirm={confirmPickedPack}
          onClose={() => setPickerOpen(false)}
          confirmLabel={addToCartLabel}
          confirmPending={addToCartPending}
        />
      )}
    </div>
  );
}
