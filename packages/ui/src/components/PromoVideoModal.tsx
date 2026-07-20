"use client";

import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { Button } from "./Button";
import { PriceTag } from "./PriceTag";
import { PlayingMedia, type PromoVideoCard } from "./PromoVideoSection";

export interface PromoVideoProduct {
  productId: number;
  slug: string;
  name: string;
  description: string | null;
  price: string;
  originalPrice?: string;
  imageUrl?: string;
}

export interface PromoVideoModalProps {
  items: PromoVideoCard[];
  products: (PromoVideoProduct | null)[];
  openIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onAddToCart?: (productId: number) => void;
  addToCartPending?: boolean;
  pendingProductId?: number;
  linkComponent?: LinkComponent;
}

const closeIcon = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const chevronIcon = (
  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2.4}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
const mutedIcon = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
    <path d="M16.5 12A4.5 4.5 0 0 0 14 8v2.2l2.45 2.45c.03-.2.05-.43.05-.65zm2.5 0c0 .94-.2 1.82-.54 2.62l1.51 1.51A8.94 8.94 0 0 0 21 12c0-4.28-3-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
  </svg>
);
const unmutedIcon = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4-.91 7-4.49 7-8.77s-3-7.86-7-8.77z" />
  </svg>
);

// Only R2 (native <video> — a real DOM property) and YOUTUBE (documented
// `mute` embed param) actually respond to the mute toggle. TikTok/Instagram
// have no verified mute query param in their public embed APIs, so the
// toggle button is hidden for those — showing a control that silently does
// nothing would be worse than not showing one.
function mutableSource(source: PromoVideoCard["source"]): boolean {
  return source === "R2" || source === "YOUTUBE";
}

function ProductPanel({
  product,
  onAddToCart,
  addToCartPending,
  pendingProductId,
  linkComponent: Link = DefaultLink,
}: {
  product: PromoVideoProduct;
  onAddToCart?: (productId: number) => void;
  addToCartPending?: boolean;
  pendingProductId?: number;
  linkComponent?: LinkComponent;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPending = addToCartPending && pendingProductId === product.productId;

  return (
    <div className="flex w-full max-w-[360px] flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-start gap-3">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-[10px] bg-beige object-cover"
          />
        )}
        <div className="flex flex-col gap-1.5">
          <h3 className="font-ui text-lg font-semibold text-ink">{product.name}</h3>
          <PriceTag price={product.price} originalPrice={product.originalPrice} align="left" size="md" />
        </div>
      </div>
      {product.description && (
        <div>
          {/* Sanitized server-side before this ever reaches the component
              (see apps/web's product-card-mapper.ts) — rendered as HTML,
              not plain text, so it doesn't show raw `<p><strong>` tags. */}
          {/* eslint-disable-next-line react/no-danger */}
          <div
            className={cn("font-body text-sm text-ink/80 [&_strong]:font-semibold [&_strong]:text-ink", !expanded && "line-clamp-3")}
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 font-ui text-xs font-semibold text-green hover:underline"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        </div>
      )}
      <div className="mt-auto flex gap-3">
        <Link
          href={`/products/${product.slug}`}
          className="inline-flex flex-1 items-center justify-center rounded-[9px] border-[1.5px] border-green px-5 py-2.5 text-center font-ui text-sm font-medium text-green hover:bg-cream"
        >
          More info
        </Link>
        <Button
          variant="green"
          className="flex-1 rounded-[30px]"
          disabled={isPending}
          onClick={() => onAddToCart?.(product.productId)}
        >
          {isPending ? "Adding…" : "Add to cart"}
        </Button>
      </div>
    </div>
  );
}

export function PromoVideoModal({
  items,
  products,
  openIndex,
  onClose,
  onNavigate,
  onAddToCart,
  addToCartPending,
  pendingProductId,
  linkComponent,
}: PromoVideoModalProps) {
  const [muted, setMuted] = useState(false);
  const card = items[openIndex];
  const product = products[openIndex] ?? null;

  useEffect(() => {
    setMuted(false);
  }, [openIndex]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNavigate((openIndex + 1) % items.length);
      if (e.key === "ArrowLeft") onNavigate((openIndex - 1 + items.length) % items.length);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openIndex, items.length, onClose, onNavigate]);

  if (!card) return null;

  const prevIndex = (openIndex - 1 + items.length) % items.length;
  const nextIndex = (openIndex + 1) % items.length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center gap-4 bg-black/80 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-5 top-5 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        {closeIcon}
      </button>

      {/* Peek at the previous video — only shown when there's room beside
          the modal (xl+). Clicking it jumps straight there. This is on top
          of the always-present prev/next arrows below, not a replacement —
          smaller screens rely on the arrows alone. */}
      {items.length > 1 && (
        <PeekThumb card={items[prevIndex]} label="Previous video" onClick={() => onNavigate(prevIndex)} />
      )}

      <div className="relative flex max-h-[85vh] w-full max-w-[820px] shrink-0 overflow-hidden rounded-2xl bg-white max-sm:flex-col">
        {items.length > 1 && (
          <button
            type="button"
            aria-label="Previous video"
            onClick={() => onNavigate(prevIndex)}
            className="absolute left-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink hover:bg-white"
          >
            <span className="rotate-180">{chevronIcon}</span>
          </button>
        )}
        <div className="relative aspect-[377/600] w-full max-w-[420px] shrink-0 bg-black">
          <PlayingMedia card={card} muted={muted} />
          {mutableSource(card.source) && (
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => setMuted((v) => !v)}
              className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              {muted ? mutedIcon : unmutedIcon}
            </button>
          )}
        </div>
        {product && (
          <ProductPanel
            product={product}
            onAddToCart={onAddToCart}
            addToCartPending={addToCartPending}
            pendingProductId={pendingProductId}
            linkComponent={linkComponent}
          />
        )}
        {items.length > 1 && (
          <button
            type="button"
            aria-label="Next video"
            onClick={() => onNavigate(nextIndex)}
            className="absolute right-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink hover:bg-white"
          >
            {chevronIcon}
          </button>
        )}
      </div>

      {items.length > 1 && (
        <PeekThumb card={items[nextIndex]} label="Next video" onClick={() => onNavigate(nextIndex)} />
      )}
    </div>
  );
}

// Static thumbnail only — not PlayingMedia — so opening the modal never has
// more than one video/iframe actually loaded and playing at once. Hidden
// below xl (not enough width to fit two peeks + an 820px modal without
// overflowing smaller laptop/tablet viewports).
function PeekThumb({ card, label, onClick }: { card: PromoVideoCard; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="hidden h-[70%] w-[110px] shrink-0 overflow-hidden rounded-2xl opacity-50 transition-opacity hover:opacity-90 xl:block"
    >
      {card.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.thumbnailUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-white/10" />
      )}
    </button>
  );
}
