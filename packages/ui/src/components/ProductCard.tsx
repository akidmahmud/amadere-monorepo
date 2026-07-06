"use client";

import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { PriceTag } from "./PriceTag";
import { Select, type SelectOption } from "./Select";

export interface ProductCardProps {
  href: string;
  name: string;
  imageUrl?: string | null;
  price: string;
  originalPrice?: string | null;
  discountLabel?: string;
  packOptions?: SelectOption[];
  selectedPack?: string;
  onPackChange?: (value: string) => void;
  onAddToCart?: () => void;
  addToCartLabel?: string;
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
  selectedPack,
  onPackChange,
  onAddToCart,
  addToCartLabel = "Add to Cart",
  linkComponent: Link = DefaultLink,
  className,
}: ProductCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-brand border border-line bg-white p-2.5 shadow-brand transition-transform duration-150 hover:-translate-y-[3px]",
        className,
      )}
    >
      <Link href={href} className="relative block aspect-square rounded-[10px] bg-beige">
        {imageUrl && (
          // Plain <img> keeps this library framework-agnostic; page-level
          // composition swaps in next/image once wired to real API media (F3+).
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            className="h-full w-full rounded-[10px] object-cover"
          />
        )}
        {discountLabel && (
          <Badge className="absolute left-2 top-2">{discountLabel}</Badge>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2.5 px-1 pb-0.5 pt-2.5">
        <Link
          href={href}
          className="truncate border-b border-line pb-1.5 font-ui text-[13px] font-medium text-ink"
        >
          {name}
        </Link>
        <PriceTag price={price} originalPrice={originalPrice} />
        {packOptions && packOptions.length > 0 && (
          <Select
            options={packOptions}
            value={selectedPack}
            onValueChange={onPackChange}
            aria-label="Pack size"
          />
        )}
        <Button
          variant="green"
          block
          className="mt-auto rounded-[8px] py-2.5"
          onClick={onAddToCart}
        >
          {addToCartLabel}
        </Button>
      </div>
    </div>
  );
}
