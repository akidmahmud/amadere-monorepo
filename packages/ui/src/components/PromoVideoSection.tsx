"use client";

import { useEffect, useRef, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";
import { Carousel } from "./Carousel";
import { SectionHeading } from "./SectionHeading";
import { PromoVideoModal, type PromoVideoProduct } from "./PromoVideoModal";
import { PromoVideoReelView } from "./PromoVideoReelView";

export type PromoVideoSource = "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "R2" | "GIF";

export interface PromoVideoCard {
  source: PromoVideoSource;
  url: string;
  thumbnailUrl?: string;
}

export interface PromoVideoSectionProps {
  heading?: string;
  items: PromoVideoCard[];
  products?: (PromoVideoProduct | null)[];
  onAddToCart?: (productId: number) => void;
  addToCartPending?: boolean;
  pendingProductId?: number;
  linkComponent?: LinkComponent;
}

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  return m?.[1] ?? null;
}
function tiktokId(url: string): string | null {
  const m = url.match(/tiktok\.com\/(?:@[^/]+\/video|embed(?:\/v2)?)\/(\d+)/) ?? url.match(/(\d{15,})/);
  return m?.[1] ?? null;
}
function instagramCode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reel|p)\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

// Renders the actual playable element for each source. `muted` only actually
// controls R2 (native <video> — a real DOM property) and YOUTUBE (documented
// `mute` embed param); TikTok/Instagram keep unconditional autoplay-only
// like before (see PromoVideoModal.tsx's mutableSource for why).
// Disclosed limitation: Instagram's oEmbed widget does not officially
// support autoplay-on-load, so its in-view behavior may just show the
// embed's own play button rather than truly autoplaying — a platform
// restriction, not something fixable from this side.
export function PlayingMedia({ card, muted = true }: { card: PromoVideoCard; muted?: boolean }) {
  if (card.source === "R2") {
    return (
      <video
        key={card.url}
        src={card.url}
        autoPlay
        muted={muted}
        loop
        playsInline
        className="h-full w-full object-cover"
      />
    );
  }
  if (card.source === "GIF") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={card.url} alt="" className="h-full w-full object-cover" />;
  }
  if (card.source === "YOUTUBE") {
    const id = youtubeId(card.url);
    const src = id
      ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${id}&playsinline=1`
      : card.url;
    return (
      <EmbedFrame
        key={`${card.url}-${muted}`}
        src={src}
        allow="autoplay; encrypted-media"
      />
    );
  }
  if (card.source === "TIKTOK") {
    const id = tiktokId(card.url);
    const src = id ? `https://www.tiktok.com/embed/v2/${id}?autoplay=1` : card.url;
    return <EmbedFrame src={src} allow="autoplay" />;
  }
  // INSTAGRAM
  const code = instagramCode(card.url);
  const src = code ? `https://www.instagram.com/reel/${code}/embed/?autoplay=1` : card.url;
  return <EmbedFrame src={src} allow="autoplay" />;
}

// `object-fit` only works on <img>/<video> — it's a no-op on <iframe>, so a
// plain h-full/w-full iframe still shows whatever black-bar letterboxing the
// embedded player (YouTube/TikTok/Instagram's own page, not ours) decides to
// draw when the video's native aspect ratio doesn't match this box (most
// visible on tall phone screens against a ~9:16 vertical video). Scaling the
// iframe itself up and clipping the overflow pushes those bars outside the
// visible area instead. This is a fixed heuristic, not device-aware — it
// won't be pixel-perfect on every phone's exact aspect ratio, but removes
// the bars on the common range.
function EmbedFrame({ src, allow }: { src: string; allow: string }) {
  return (
    <div className="h-full w-full overflow-hidden">
      <iframe
        src={src}
        title="Promo video"
        allow={allow}
        className="h-full w-full scale-125 border-0"
      />
    </div>
  );
}

// Plays the card once it's ≥50% scrolled into view, pauses when it scrolls
// back out of view — replaces the old hover-to-play behavior so a section
// with many cards doesn't autoplay everything at once on page load.
// rootMargin extends the "visible" zone outward on the sides (this is a
// horizontally-scrolling row) so a card starts mounting/loading its video
// ~400px before it's actually scrolled into view — by the time the user's
// eyes reach it, YouTube/TikTok/Instagram's embed page and player JS (the
// actual source of the load delay, not this app or its dev server — those
// are third-party requests to youtube.com/tiktok.com/instagram.com) have
// had a head start instead of starting from zero at the exact moment it
// needs to play. Still bounded — a card way off-screen never loads.
function useInView(threshold = 0.5, rootMargin = "0px"): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold, rootMargin });
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView];
}

// Below this width, clicking a card opens the full-screen swipeable reel
// viewer (packages/ui's PromoVideoReelView) instead of the side-by-side
// desktop modal — matches Tailwind's own `md` breakpoint so it lines up with
// every other responsive class already used across this codebase.
function useIsMobile(breakpointPx = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpointPx]);

  return isMobile;
}

function PromoVideoCardTile({ card, onClick }: { card: PromoVideoCard; onClick: () => void }) {
  const [ref, isInView] = useInView(0.5, "0px 400px 0px 400px");

  return (
    <div
      ref={ref}
      // Mobile: ~2 cards visible per screen width (a reel-row feel, matching
      // FB/IG/TikTok's preview strip), aspect-ratio scaling the height so a
      // narrower card isn't disproportionately tall. sm+ (640px) reverts to
      // the original fixed reel dimensions.
      className="relative aspect-[377/600] w-[46vw] shrink-0 overflow-hidden rounded-2xl bg-black sm:aspect-auto sm:h-[600px] sm:w-[377px]"
    >
      {isInView ? (
        <PlayingMedia card={card} />
      ) : card.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : null}
      {/* A click on a playing YOUTUBE/TIKTOK/INSTAGRAM iframe never reaches
          this component — iframes are a separate browsing context and don't
          bubble click events to the parent page. This transparent button
          sits above the embed in stacking order (later in DOM, no
          pointer-events-none) so every click lands here instead, regardless
          of what's playing underneath. Also gives free keyboard support
          (Enter/Space) instead of a manual onKeyDown. */}
      <button
        type="button"
        onClick={onClick}
        aria-label="Open video"
        className="absolute inset-0 h-full w-full cursor-pointer bg-transparent"
      >
        <span
          className={cn(
            "absolute inset-0 grid place-items-center bg-black/20 transition-opacity",
            isInView ? "opacity-0" : "opacity-100",
          )}
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" className="ml-0.5 text-ink">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      </button>
    </div>
  );
}

export function PromoVideoSection({
  heading,
  items,
  products,
  onAddToCart,
  addToCartPending,
  pendingProductId,
  linkComponent = DefaultLink,
}: PromoVideoSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isMobile = useIsMobile();

  if (items.length === 0) return null;

  return (
    <div className="py-9">
      {heading && <SectionHeading>{heading}</SectionHeading>}
      <Carousel>
        {items.map((card, i) => (
          <PromoVideoCardTile key={`${card.url}-${i}`} card={card} onClick={() => setOpenIndex(i)} />
        ))}
      </Carousel>
      {openIndex !== null &&
        (isMobile ? (
          <PromoVideoReelView
            items={items}
            products={products ?? items.map(() => null)}
            openIndex={openIndex}
            onClose={() => setOpenIndex(null)}
            linkComponent={linkComponent}
          />
        ) : (
          <PromoVideoModal
            items={items}
            products={products ?? items.map(() => null)}
            openIndex={openIndex}
            onClose={() => setOpenIndex(null)}
            onNavigate={setOpenIndex}
            onAddToCart={onAddToCart}
            addToCartPending={addToCartPending}
            pendingProductId={pendingProductId}
            linkComponent={linkComponent}
          />
        ))}
    </div>
  );
}
