"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { formatMoney } from "./PriceTag";

export interface ComboCardProps {
  href: string;
  imageUrl?: string;
  name: string;
  /** Decimal string — the price a customer actually pays. */
  price: string;
  /** Decimal string — sum of the combo's items at their own price; only
   * passed when it's actually higher than `price` (a real discount to show). */
  originalPrice?: string;
  comboLabel?: string;
  viewDetailsLabel?: string;
  linkComponent?: LinkComponent;
}

// Matches ghorerbazar.com's "Exclusive Combo Deals" card: image, a "Save X%"
// badge (green, left) + "Combo Offer" badge (amber, right) — same dual-badge-
// corner convention already used for product cards elsewhere on this
// storefront (ProductStripSection) — name, current + struck-through original
// price, and a "View Details" link instead of "Add to Cart" (a combo adds
// several products at once, handled on its own detail page).
export function ComboCard({
  href,
  imageUrl,
  name,
  price,
  originalPrice,
  comboLabel = "Combo Offer",
  viewDetailsLabel = "View Details",
  linkComponent: Link = DefaultLink,
}: ComboCardProps) {
  const hasDiscount = originalPrice != null && Number(originalPrice) > Number(price);
  const savePercent = hasDiscount ? Math.round((1 - Number(price) / Number(originalPrice)) * 100) : 0;

  return (
    // basis math matches Carousel's own gap-4.5 (18px) track gap, not
    // ProductStripSection's 20px — this card is composed with the generic
    // Carousel, so it needs 18px-based fractions or rows fall a couple px
    // short of the full row width.
    <article className="relative flex min-w-[170px] flex-none basis-[calc((100%-18px)/2)] snap-start flex-col rounded-xl border border-header-line bg-white p-3.5 pb-4 transition-[box-shadow,border-color] duration-200 hover:border-header-green hover:shadow-[0_10px_24px_rgba(33,113,61,.13)] sm:basis-[calc((100%-36px)/3)] lg:basis-[calc((100%-54px)/4)] xl:basis-[calc((100%-72px)/5)]">
      {hasDiscount && (
        <span className="absolute left-3 top-3 z-[2] rounded-md bg-header-green px-2.5 py-1.5 text-[0.66rem] font-extrabold text-white">
          Save {savePercent}%
        </span>
      )}
      <span className="absolute right-3 top-3 z-[2] rounded-md bg-[#e07b1a] px-2.5 py-1.5 text-[0.66rem] font-extrabold text-white">
        {comboLabel}
      </span>

      <Link href={href} className="mb-3.5 flex h-40 items-center justify-center overflow-hidden md:h-[210px]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="max-h-full max-w-full object-contain transition-transform duration-300 hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-beige" />
        )}
      </Link>

      <h3 className="min-h-[2.6em] font-header text-[0.92rem] font-bold leading-[1.4] text-header-ink">
        <Link href={href} className="hover:text-header-green">
          {name}
        </Link>
      </h3>

      <div className="my-2 mb-3.5 flex items-center gap-2.5">
        <span className="font-header text-base font-extrabold text-header-green">{formatMoney(price)}</span>
        {hasDiscount && (
          <span className="font-header text-[0.82rem] font-semibold text-header-muted line-through">
            {formatMoney(originalPrice!)}
          </span>
        )}
      </div>

      <Link
        href={href}
        className="mt-auto flex h-[42px] w-full items-center justify-center rounded-lg border-[1.5px] border-header-green font-header text-[0.82rem] font-bold text-header-green transition-colors hover:bg-header-green hover:text-white"
      >
        {viewDetailsLabel}
      </Link>
    </article>
  );
}
