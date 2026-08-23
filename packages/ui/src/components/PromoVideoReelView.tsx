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
  onAddToCart?: (productId: number, variantId?: string) => void;
  addToCartPending?: boolean;
  pendingProductId?: number;
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
  onAddToCart,
  addToCartPending,
  pendingProductId,
  linkComponent: Link = DefaultLink,
}: {
  card: PromoVideoCard;
  product: PromoVideoProduct | null;
  active: boolean;
  onActive: () => void;
  onAddToCart?: (productId: number, variantId?: string) => void;
  addToCartPending?: boolean;
  pendingProductId?: number;
  linkComponent?: LinkComponent;
}) {
  const isPending = !!(addToCartPending && product != null && pendingProductId === product.productId);
  const ref = useRef<HTMLDivElement>(null);

  // No visible cart drawer to confirm the add here (the reel is a full-screen
  // z-[100] overlay above CartDrawer's z-[60]/[70], and it deliberately stays
  // open — this isn't a PDP navigation) — so the button briefly says
  // "Added ✓" itself, right when isPending flips back to false.
  const [justAdded, setJustAdded] = useState(false);
  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !isPending) {
      setJustAdded(true);
      const timer = setTimeout(() => setJustAdded(false), 1500);
      wasPendingRef.current = isPending;
      return () => clearTimeout(timer);
    }
    wasPendingRef.current = isPending;
  }, [isPending]);

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
      {/* Raised on mobile to clear MobileStickyFooter's fixed bottom nav
          (~55px tall) — was bottom-6, which sat underneath/behind it. */}
      {product && (
        <div className="absolute inset-x-4 bottom-[76px] flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-lg md:bottom-6">
          <div className="flex items-center gap-3">
            {product.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" src={product.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-[10px] object-cover" />
            )}
            <span className="line-clamp-2 min-w-0 flex-1 font-ui text-sm font-semibold text-ink">{product.name}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/products/${product.slug}`}
              className="shrink-0 font-ui text-xs font-semibold text-green underline underline-offset-2"
            >
              আরো জানুন
            </Link>
            {onAddToCart && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onAddToCart(product.productId, product.defaultVariantId)}
                className="h-8 shrink-0 rounded-full bg-green px-4 font-ui text-xs font-semibold text-white transition-colors hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Adding…" : justAdded ? "Added ✓" : "Add to Cart"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Facebook/Instagram/TikTok-style full-screen reel viewer: one video per
// full-height snapped section, swipe up/down between them, product overlay
// (image, name, learn-more link, and a small Add to Cart CTA) pinned to the
// bottom of whichever slide has one.
export function PromoVideoReelView({
  items,
  products,
  openIndex,
  onClose,
  onAddToCart,
  addToCartPending,
  pendingProductId,
  linkComponent,
}: PromoVideoReelViewProps) {
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
            onAddToCart={onAddToCart}
            addToCartPending={addToCartPending}
            pendingProductId={pendingProductId}
            linkComponent={linkComponent}
          />
        ))}
      </div>
    </div>
  );
}
