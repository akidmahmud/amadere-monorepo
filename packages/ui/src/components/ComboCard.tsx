"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { formatMoney } from "./PriceTag";
import { Badge } from "./Badge";

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
    <article className="group relative flex min-w-[150px] flex-none basis-[calc((100%-18px)/2)] snap-start flex-col justify-between rounded border border-header-line bg-white p-2 font-sans text-[#020101] transition-shadow duration-300 sm:basis-[calc((100%-36px)/3)] lg:basis-[calc((100%-54px)/4)] xl:basis-[calc((100%-72px)/5)]">
      <Badge variant="orange" className="absolute left-[6px] top-[6px] z-10 rounded bg-[#e07b1a] px-2.5 py-1 text-[11px] font-medium text-white">
        {comboLabel}
      </Badge>
      {hasDiscount && (
        <Badge variant="green" className="absolute right-[6px] top-[6px] z-10 rounded bg-[#34be82] px-2.5 py-1 text-[11px] font-medium text-white">
          Save {savePercent}%
        </Badge>
      )}

      <Link href={href} className="relative mb-0 flex aspect-square w-full items-center justify-center overflow-hidden bg-beige">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-[1.04]" />
        ) : (
          <div className="h-full w-full bg-beige" />
        )}
      </Link>

      <div className="flex flex-1 flex-col justify-between pt-3">
        <h3 className="mb-2 line-clamp-2 min-h-[34px] font-sans text-sm font-medium text-[#020101] transition-colors hover:text-header-green md:min-h-[38px] md:text-base">
          <Link href={href}>
            {name}
          </Link>
        </h3>

        <div className="my-1 flex items-center gap-2">
          <span className="font-sans text-sm font-bold text-header-green md:text-[18px]">{formatMoney(price)}</span>
          {hasDiscount && (
            <span className="font-sans text-sm font-medium text-[#767a7a] line-through md:text-[18px]">
              {formatMoney(originalPrice!)}
            </span>
          )}
        </div>

        <div className="mt-3">
          <Link
            href={href}
            className="flex h-[34px] w-full items-center justify-center gap-1.5 rounded border border-header-green bg-transparent font-sans text-xs font-semibold text-header-green transition-all duration-400 hover:bg-header-green hover:text-white md:h-[40px] md:text-sm"
          >
            {viewDetailsLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
