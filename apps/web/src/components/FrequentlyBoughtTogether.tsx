"use client";

import { Fragment, useState } from "react";
import { useLocale } from "next-intl";
import { formatMoney, useCartDrawerStore } from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { toApiLocale } from "@/lib/api-locale";
import { useAddToCart } from "@/hooks/useCart";
import { toProductCardData, type ProductCardData } from "@/lib/product-card-mapper";
import type { components } from "@/lib/api/schema";

type PublicProductDto = components["schemas"]["PublicProductDto"];

// Reference's bundle tile: 70x70 thumbnail on the left, name/price stacked
// to its right (a horizontal row, not a stacked card), light-grey fill,
// brand-green border/checkbox — confirmed via computed styles against
// https://ghorerbazar.com/products/gawa-ghee-1kg's "Frequently bought
// together" widget (border/bg/font-size/radius all measured live).
function FbtCard({
  card,
  checked,
  disabled,
  onToggle,
}: {
  card: ProductCardData;
  checked: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="relative flex min-w-[220px] max-w-[360px] flex-1 items-center gap-3 rounded-md border border-green bg-[#F5F5F5] p-2">
      <AppLink href={card.href} className="block h-[70px] w-[70px] shrink-0 overflow-hidden rounded-lg bg-white">
        {card.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt={card.name} loading="lazy" className="h-full w-full object-contain" />
        )}
      </AppLink>
      <div className="min-w-0 flex-1 pr-5">
        <p className="truncate text-xs font-medium text-[#374151]">{card.name}</p>
        <p className="text-sm font-semibold text-green">{formatMoney(card.price)}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        aria-label={`Include ${card.name}`}
        className="absolute bottom-2 right-2 h-4 w-4 accent-green"
      />
    </div>
  );
}

// The reference's "Frequently bought together" bundle widget: this product
// (always included) plus admin-picked companions (ProductRelation, type
// FREQUENTLY_BOUGHT_TOGETHER — configured in the admin product form's
// FrequentlyBoughtTogetherFields), each toggleable, with a live total and a
// single button that adds everything currently checked to the cart at once.
// Desktop-only, per explicit request — hidden on mobile.
export function FrequentlyBoughtTogether({
  mainProduct,
  items,
}: {
  mainProduct: PublicProductDto;
  items: PublicProductDto[];
}) {
  const mainCard = toProductCardData(mainProduct);
  const itemCards = items.map(toProductCardData).filter((c) => !c.outOfStock);
  const [checked, setChecked] = useState<Set<number>>(() => new Set(itemCards.map((c) => c.productId)));
  const locale = toApiLocale(useLocale());
  const addToCart = useAddToCart(locale);
  const openCartDrawer = useCartDrawerStore((s) => s.open);

  if (itemCards.length === 0) return null;

  const checkedCards = itemCards.filter((c) => checked.has(c.productId));
  const includedCards = [mainCard, ...checkedCards];
  const total = includedCards.reduce((sum, c) => sum + Number(c.price), 0);
  // Real savings — the difference between each included item's original and
  // current (possibly on-sale) price, not a fabricated bundle discount.
  const saved = includedCards.reduce(
    (sum, c) => sum + (c.originalPrice ? Number(c.originalPrice) - Number(c.price) : 0),
    0,
  );
  const count = includedCards.length;

  function toggle(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddAll() {
    for (const card of includedCards) {
      await addToCart.mutateAsync({
        productId: card.productId,
        variantId: card.defaultPackValue ? Number(card.defaultPackValue) : undefined,
        quantity: 1,
      });
    }
    openCartDrawer();
  }

  return (
    <div className="mb-10 hidden rounded-xl bg-white p-6 shadow-[0_2px_4px_rgba(0,0,0,0.11)] md:block">
      <h2 className="mb-4 text-xl font-semibold text-[#222831]">Frequently bought together</h2>
      {/* Every FbtCard carries flex-1 (min/max-width clamped) so a handful of
          items stretch to fill the row instead of clumping to the left with
          empty space on the right — the "+"/"=" signs and the total box stay
          shrink-0 so only the cards themselves absorb the extra width. */}
      <div className="flex flex-wrap items-center gap-3">
        <FbtCard card={mainCard} checked disabled />
        {itemCards.map((card) => (
          <Fragment key={card.productId}>
            <span className="shrink-0 text-xl text-muted">+</span>
            <FbtCard card={card} checked={checked.has(card.productId)} onToggle={() => toggle(card.productId)} />
          </Fragment>
        ))}
        <span className="shrink-0 text-xl text-muted">=</span>
        <div className="shrink-0 rounded-lg bg-green px-4 py-3 text-center text-white">
          <div className="text-base font-bold">{formatMoney(total.toFixed(2))}</div>
          <div className="text-xs">Save {formatMoney(saved.toFixed(2))}</div>
          <button
            type="button"
            disabled={addToCart.isPending || count === 0}
            onClick={handleAddAll}
            className="mt-1 rounded bg-white px-3 py-1.5 text-xs font-medium text-[#222831] transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addToCart.isPending ? "Adding…" : `Add ${count} items to cart`}
          </button>
        </div>
      </div>
    </div>
  );
}
