"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { PriceTag } from "./PriceTag";

export interface PackPickerOption {
  value: string;
  label: string;
  price: string;
  originalPrice?: string;
  outOfStock?: boolean;
}

export interface PackPickerModalProps {
  productName: string;
  options: PackPickerOption[];
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
  confirmLabel?: string;
  confirmPending?: boolean;
}

const closeIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

// Shared by every "Add to Cart" surface on a variant product with more than
// one pack (ProductCard, ProductStripSection, TopSellingProductsSection's
// desktop card) — a small blurred-backdrop popup to pick the pack first,
// instead of silently guessing the default one.
export function PackPickerModal({
  productName,
  options,
  defaultValue,
  onConfirm,
  onClose,
  confirmLabel = "Add to Cart",
  confirmPending,
}: PackPickerModalProps) {
  const [selected, setSelected] = useState(
    defaultValue ?? options.find((o) => !o.outOfStock)?.value ?? options[0]?.value,
  );
  const selectedOption = options.find((o) => o.value === selected);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Moves real browser focus into the modal the instant it opens (not just
  // on a later click, which Safari/iOS don't reliably focus buttons for
  // anyway) — this is what lets Carousel's existing focus-bubble pause
  // mechanism (built for ProductCardTwo's inline <select>) also catch this
  // modal, on both desktop and mobile, with no changes to Carousel itself.
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[300px] rounded-xl bg-white p-4 shadow-xl sm:max-w-[320px] sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-sans text-sm font-semibold text-[#020101] sm:text-base">{productName}</h3>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-[#6b6b6b] hover:bg-beige hover:text-[#020101]"
          >
            {closeIcon}
          </button>
        </div>
        <div className="mb-4 flex flex-col gap-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={option.outOfStock}
              onClick={() => setSelected(option.value)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                option.outOfStock
                  ? "cursor-not-allowed border-header-line text-[#9b9b9b] opacity-60"
                  : selected === option.value
                    ? "border-header-green bg-header-green/5 text-header-green"
                    : "border-header-line text-[#020101] hover:border-header-green/50",
              )}
            >
              <span className="font-medium">{option.label}</span>
              {option.outOfStock ? (
                <span className="text-xs font-semibold">Out of Stock</span>
              ) : (
                <PriceTag price={option.price} originalPrice={option.originalPrice} align="left" size="sm" />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={confirmPending || !selected || selectedOption?.outOfStock}
          onClick={() => selected && onConfirm(selected)}
          className="flex h-[40px] w-full items-center justify-center rounded border border-header-green bg-header-green font-sans text-sm font-semibold text-white transition-colors hover:bg-header-green-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {confirmPending ? "Adding…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
