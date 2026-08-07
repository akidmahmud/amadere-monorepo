"use client";

import { useState } from "react";
import { formatMoney, PackPickerModal, type PackPickerOption } from "@amader/ui";
import { AppLink } from "@/components/AppLink";

const cartIcon = (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);

export interface PlpProductCardProps {
  href: string;
  productId: number;
  name: string;
  imageUrl?: string;
  price: string;
  originalPrice?: string;
  flagLabel?: string;
  outOfStock?: boolean;
  packOptions?: PackPickerOption[];
  defaultPackValue?: string;
  onAddToCart: (productId: number, packValue?: string) => void;
  addToCartPending?: boolean;
}

// Pixel-matched to ghorerbazar.com/collections/honey-2's `.product-item`:
// `.flag-name` (top-left) / `.save-label` (top-right) badges at their exact
// hex (#F48721 / #34BE82 — literal colors, not swapped for Amader's green,
// same call already made for these two specific badges elsewhere in this
// codebase), a bordered Add To Cart button with a cart icon, and a bordered
// red "Stock Out" button in its place when unavailable. The button/underline
// colors elsewhere DO swap ghorerbazar's orange for Amader's own green, per
// the established convention (see ProductStripSection/TopSellingProductsSection).
// Scoped to the collection/listing page only — the homepage's ProductCard
// keeps its own already-tuned look untouched.
export function PlpProductCard({
  href,
  productId,
  name,
  imageUrl,
  price,
  originalPrice,
  flagLabel,
  outOfStock,
  packOptions,
  defaultPackValue,
  onAddToCart,
  addToCartPending,
}: PlpProductCardProps) {
  const defaultPack = defaultPackValue ?? packOptions?.[0]?.value;
  const defaultOption = packOptions?.find((o) => o.value === defaultPack);
  const displayPrice = defaultOption?.price ?? price;
  const displayOriginalPrice = defaultOption ? defaultOption.originalPrice : originalPrice;
  const hasDiscount = displayOriginalPrice != null && Number(displayOriginalPrice) > Number(displayPrice);
  const discountPercent = hasDiscount ? Math.round((1 - Number(displayPrice) / Number(displayOriginalPrice)) * 100) : 0;
  const hasPackChoice = (packOptions?.length ?? 0) > 1;
  const isOutOfStock = packOptions ? packOptions.every((o) => o.outOfStock) : !!outOfStock;
  const [pickerOpen, setPickerOpen] = useState(false);

  function handleClick() {
    if (hasPackChoice) setPickerOpen(true);
    else onAddToCart(productId, defaultPack);
  }

  return (
    <div className="flex flex-col rounded border border-line bg-white p-2">
      <AppLink href={href} className="relative mb-3 flex aspect-square w-full items-center justify-center overflow-hidden bg-beige">
        {flagLabel && (
          <span className="absolute left-1.5 top-1.5 z-10 rounded bg-[#F48721] px-1.5 py-0.5 text-[10px] font-normal leading-normal text-white">
            {flagLabel}
          </span>
        )}
        {hasDiscount && (
          <span className="absolute right-1.5 top-1.5 z-10 rounded bg-[#34BE82] px-1.5 py-0.5 text-[10px] font-normal leading-normal text-white">
            Save {discountPercent}%
          </span>
        )}
        {imageUrl ? (
          <img src={imageUrl} alt={name} loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <div className="h-full w-full bg-beige" />
        )}
      </AppLink>

      <AppLink href={href} className="mb-2 line-clamp-1 font-sans text-base font-medium text-[#222831]">
        {name}
      </AppLink>

      <p className="mb-3">
        <span className="font-sans text-base font-semibold text-header-green">{formatMoney(displayPrice)}</span>
        {hasDiscount && (
          <span className="ml-2 font-sans text-base text-[#aaaaaa] line-through">{formatMoney(displayOriginalPrice!)}</span>
        )}
      </p>

      {isOutOfStock ? (
        <span className="flex h-10 w-full items-center justify-center rounded border border-[#ff1818] font-sans text-sm font-semibold text-[#ff1818]">
          Stock Out
        </span>
      ) : (
        <button
          type="button"
          disabled={addToCartPending}
          onClick={handleClick}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded border border-header-green bg-transparent font-sans text-sm font-semibold text-header-green transition-colors hover:bg-header-green hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cartIcon}
          {addToCartPending ? "Adding…" : "Add To Cart"}
        </button>
      )}

      {pickerOpen && packOptions && (
        <PackPickerModal
          productName={name}
          options={packOptions}
          defaultValue={defaultPack}
          onConfirm={(value: string) => {
            onAddToCart(productId, value);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
          confirmLabel="Add To Cart"
          confirmPending={addToCartPending}
        />
      )}
    </div>
  );
}
