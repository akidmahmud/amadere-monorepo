"use client";

import { useEffect, useRef, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { PlayingMedia, type PromoVideoCard } from "./PromoVideoSection";
import type { PromoVideoProduct } from "./PromoVideoModal";

export interface PromoVideoReelViewProps {
  items: PromoVideoCard[];
  products: (PromoVideoProduct | null)[];
  openIndex: number;
  onClose: () => void;
  linkComponent?: LinkComponent;
}

const closeIcon = (
  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

// Only the currently-snapped slide actually mounts PlayingMedia — otherwise
// every video/iframe in the section would be loaded and playing at once in
// a full-height vertical list, unlike the grid where only visible cards play.
function ReelSlide({
  card,
  product,
  active,
  onActive,
  linkComponent: Link = DefaultLink,
}: {
  card: PromoVideoCard;
  product: PromoVideoProduct | null;
  active: boolean;
  onActive: () => void;
  linkComponent?: LinkComponent;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && onActive(), { threshold: 0.6 });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="relative h-full w-full shrink-0 snap-start bg-black">
      {active && <PlayingMedia card={card} muted={false} />}
      {product && (
        <div className="absolute inset-x-4 bottom-6 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-lg">
          {product.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-[10px] object-cover" />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-ui text-sm font-semibold text-ink">{product.name}</span>
            <Link
              href={`/products/${product.slug}`}
              className="font-ui text-xs font-semibold text-green underline underline-offset-2"
            >
              আরো জানুন
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Facebook/Instagram/TikTok-style full-screen reel viewer: one video per
// full-height snapped section, swipe up/down between them, product overlay
// (image, name, learn-more link only — no add-to-cart here, that stays a
// PDP action) pinned to the bottom of whichever slide has one.
export function PromoVideoReelView({ items, products, openIndex, onClose, linkComponent }: PromoVideoReelViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(openIndex);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const slide = el.children[openIndex];
    if (slide instanceof HTMLElement) slide.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white"
      >
        {closeIcon}
      </button>
      <div ref={containerRef} className="h-full w-full snap-y snap-mandatory overflow-y-scroll">
        {items.map((card, i) => (
          <ReelSlide
            key={`${card.url}-${i}`}
            card={card}
            product={products[i] ?? null}
            active={activeIndex === i}
            onActive={() => setActiveIndex(i)}
            linkComponent={linkComponent}
          />
        ))}
      </div>
    </div>
  );
}
