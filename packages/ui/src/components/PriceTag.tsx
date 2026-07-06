"use client";

import { cn } from "../lib/cn";

export interface PriceTagProps {
  /** Decimal string from the backend, e.g. "1000.00" — never a computed float. */
  price: string;
  /** Decimal string for the pre-sale price, if this line is discounted. */
  originalPrice?: string | null;
  size?: "sm" | "md" | "lg";
  align?: "left" | "center";
  className?: string;
}

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-[22px]",
};

export function formatMoney(value: string): string {
  const amount = Number(value);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `৳${formatted}`;
}

export function PriceTag({
  price,
  originalPrice,
  size = "md",
  align = "center",
  className,
}: PriceTagProps) {
  const hasDiscount =
    originalPrice != null && Number(originalPrice) > Number(price);

  return (
    <div
      className={cn(
        "flex items-baseline gap-2",
        align === "center" && "justify-center",
        className,
      )}
    >
      <span className={cn("font-serif font-semibold text-ink", sizeClasses[size])}>
        {formatMoney(price)}
      </span>
      {hasDiscount && (
        <span className="font-body text-xs text-muted line-through">
          {formatMoney(originalPrice)}
        </span>
      )}
    </div>
  );
}
