"use client";

import { useEffect, useRef } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { formatMoney } from "./PriceTag";

export interface CartCrossSellItem {
  id: number;
  href: string;
  name: string;
  price?: string | null;
  imageUrl?: string | null;
}

export interface CartCrossSellRowProps {
  heading: string;
  items: CartCrossSellItem[];
  onAdd: (id: number) => void;
  addLabel?: string;
  linkComponent?: LinkComponent;
  /** Auto-advance interval in ms — pass 0 to disable. */
  autoSlideMs?: number;
}

const CARD_WIDTH = 128; // px — matches the card's own w-32 below
const CARD_GAP = 10; // px — matches gap-2.5 below

export function CartCrossSellRow({
  heading,
  items,
  onAdd,
  addLabel = "Add",
  linkComponent: Link = DefaultLink,
  autoSlideMs = 3500,
}: CartCrossSellRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function slide(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const next = el.scrollLeft + direction * (CARD_WIDTH + CARD_GAP);
    const maxScroll = el.scrollWidth - el.clientWidth;
    // Wraps at either end instead of stalling, so auto-slide loops forever.
    if (next >= maxScroll - 1) el.scrollTo({ left: 0, behavior: "smooth" });
    else if (next < 0) el.scrollTo({ left: maxScroll, behavior: "smooth" });
    else el.scrollTo({ left: next, behavior: "smooth" });
  }

  useEffect(() => {
    if (!autoSlideMs || items.length < 2) return;
    const id = setInterval(() => slide(1), autoSlideMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSlideMs, items.length]);

  if (items.length === 0) return null;

  return (
    <div className="border-t border-line py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="font-ui text-xs font-semibold text-ink">
          {heading}
          <span className="mt-1 block h-0.5 w-6 bg-green" />
        </p>
        {items.length > 1 && (
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => slide(-1)}
              className="grid h-6 w-6 place-items-center rounded-full bg-beige font-ui text-xs text-ink hover:bg-green hover:text-white"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => slide(1)}
              className="grid h-6 w-6 place-items-center rounded-full bg-beige font-ui text-xs text-ink hover:bg-green hover:text-white"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-2.5 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <div key={item.id} className="w-32 shrink-0 rounded-lg border border-line bg-white p-2">
            <Link href={item.href} className="mb-1.5 block h-16 w-full overflow-hidden rounded-md bg-beige">
              {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />}
            </Link>
            <Link href={item.href} className="mb-1 block truncate font-ui text-[11px] text-ink">
              {item.name}
            </Link>
            <div className="flex items-center justify-between gap-1">
              {item.price && <span className="font-body text-[11px] text-muted">{formatMoney(item.price)}</span>}
              <button
                type="button"
                onClick={() => onAdd(item.id)}
                className="shrink-0 rounded-full border border-green px-2 py-0.5 font-ui text-[10px] font-semibold text-green hover:bg-green hover:text-white"
              >
                + {addLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
