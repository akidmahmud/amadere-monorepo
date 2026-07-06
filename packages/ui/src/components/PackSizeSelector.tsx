"use client";

import { cn } from "../lib/cn";
import { formatMoney } from "./PriceTag";

export interface PackSizeOption {
  value: string;
  label: string;
  price: string;
  originalPrice?: string | null;
  badge?: string;
}

export interface PackSizeSelectorProps {
  options: PackSizeOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PackSizeSelector({ options, value, onChange, className }: PackSizeSelectorProps) {
  return (
    <div className={cn("mb-5 flex flex-wrap gap-3", className)}>
      {options.map((option) => {
        const active = option.value === value;
        const hasDiscount =
          option.originalPrice != null && Number(option.originalPrice) > Number(option.price);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative min-w-[120px] rounded-xl border-[1.5px] bg-white px-4 py-3.5 text-left",
              active ? "border-green bg-cream" : "border-line",
            )}
          >
            {option.badge && (
              <span className="absolute -top-2.5 left-3 rounded-[5px] bg-gold px-2 py-0.5 font-ui text-[10px] font-bold text-green-deep">
                {option.badge}
              </span>
            )}
            <div className="font-ui text-sm font-semibold text-ink">{option.label}</div>
            <div className="mt-1 font-serif font-bold text-green">{formatMoney(option.price)}</div>
            {hasDiscount && (
              <div className="font-ui text-[11px] font-semibold text-gold-dark">
                Save {formatMoney(String(Number(option.originalPrice) - Number(option.price)))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
