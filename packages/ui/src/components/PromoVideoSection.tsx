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
  /** Auto-advance one "page" every N ms — much longer than a plain product
   * carousel's default (4000ms) so a video actually gets time to play
   * before sliding away; pass 0 to disable. */
  autoplayMs?: number;
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
        poster={card.thumbnailUrl}
        preload="auto"
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
      ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${id}&playsinline=1`
      : card.url;
    return (
      <>
        <YoutubePreconnect />
        <EmbedFrame
          key={`${card.url}-${muted}`}
          src={src}
          allow="autoplay; encrypted-media"
          thumbnailUrl={card.thumbnailUrl}
        />
      </>
    );
  }
  if (card.source === "TIKTOK") {
    const id = tiktokId(card.url);
    const src = id ? `https://www.tiktok.com/embed/v2/${id}?autoplay=1` : card.url;
    return <EmbedFrame src={src} allow="autoplay" thumbnailUrl={card.thumbnailUrl} />;
  }
  // INSTAGRAM
  const code = instagramCode(card.url);
  const src = code ? `https://www.instagram.com/reel/${code}/embed/?autoplay=1` : card.url;
  return <EmbedFrame src={src} allow="autoplay" thumbnailUrl={card.thumbnailUrl} />;
}

// Actual YouTube video bytes can't be cached/rehosted ourselves — that's a
// YouTube ToS violation, not just a technical limitation (use the existing
// "R2" source instead if a video should be truly self-hosted and load
// instantly with no third-party dependency at all). This shaves the DNS/TLS
// handshake time off the embed's own load instead — rendered from inside
// PromoVideoSection so it only appears in the page's <head> on pages that
// actually have a YouTube promo card (Next.js App Router hoists <link> tags
// rendered anywhere in the tree).
function YoutubePreconnect() {
  return (
    <>
      <link rel="preconnect" href="https://www.youtube-nocookie.com" />
      <link rel="preconnect" href="https://i.ytimg.com" />
    </>
  );
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
//
// The thumbnail stays on top of the iframe (not replaced by it) until the
// embed's document reports loaded, plus a short fixed buffer — the iframe's
// `onLoad` fires once the embedded page itself has loaded, which is earlier
// than the third-party player actually painting real video frames, so a
// bare onLoad swap still shows a beat of black. This masks that gap with the
// thumbnail we already have instead of a blank box, without needing
// YouTube's/TikTok's postMessage player APIs just to know "video is now
// visibly playing".
function EmbedFrame({ src, allow, thumbnailUrl }: { src: string; allow: string; thumbnailUrl?: string }) {
  const [ready, setReady] = useState(false);

  function handleLoad() {
    setTimeout(() => setReady(true), 600);
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <iframe
        src={src}
        title="Promo video"
        allow={allow}
        onLoad={handleLoad}
        className="h-full w-full scale-125 border-0"
      />
      {thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            ready ? "opacity-0" : "opacity-100",
          )}
        />
      )}
    </div>
  );
}

// Starts loading well before the card is actually scrolled into view, and —
// once it has ever come into view — stays mounted and playing even after it
// scrolls back out (a real user request: re-mounting the iframe every time
// the card left and re-entered the expanded zone forced YouTube/TikTok/
// Instagram to reboot their embed from scratch each time, showing a black
// "reloading" flash and making `loop=1` look like it wasn't working since
// the video kept restarting from 0 instead of actually looping). One-shot
// latch: the observer disconnects for good the first time it fires, so a
// card way off-screen still never loads, but a card that's already loaded
// is never torn down again. rootMargin extends the "visible" zone outward on
// all sides: 400px horizontally (this is a horizontally-scrolling row) and a
// much larger 1000px vertically, since the section itself typically sits
// well below the fold — a small vertical margin meant the card only started
// loading once the user had already scrolled it ~50% into view, so the
// embed (third-party page + player JS, not this app) was still booting
// right as the user's eyes arrived, showing the thumbnail for a beat.
// threshold 0 (not 0.5) means it fires the instant any part of the card
// enters that expanded zone, not once it's half-visible — by the time the
// user actually scrolls to it, the video has had ~1000px of scroll distance
// (roughly a full screen) to finish loading and be playing already.
function useInView(threshold = 0.5, rootMargin = "0px"): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [hasBeenInView, setHasBeenInView] = useState(false);

  useEffect(() => {
    if (hasBeenInView) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setHasBeenInView(true);
    }, { threshold, rootMargin });
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, hasBeenInView]);

  return [ref, hasBeenInView];
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
  const [ref, isInView] = useInView(0, "1000px 400px 1000px 400px");

  return (
    <div
      ref={ref}
      // Mobile: exactly 2 cards visible per screen width (a reel-row feel,
      // matching FB/IG/TikTok's preview strip) — calc() against the
      // Carousel's own 18px gap, not an approximate vw guess, plus
      // snap-start so it actually rests on a full card instead of settling
      // mid-card. aspect-ratio scales the height so a narrower card isn't
      // disproportionately tall. sm+ (640px) reverts to the original fixed
      // reel dimensions.
      className="relative aspect-[377/600] w-[calc(50%-9px)] shrink-0 snap-start overflow-hidden rounded-2xl bg-black sm:aspect-auto sm:h-[600px] sm:w-[377px]"
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
  autoplayMs = 12000,
}: PromoVideoSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isMobile = useIsMobile();

  if (items.length === 0) return null;

  return (
    <div className="py-9">
      {heading && <SectionHeading>{heading}</SectionHeading>}
      {/* Mobile: touch-swipe only, no arrow buttons — autoplay stays on
          regardless (autoplayMs is unaffected by showArrows). */}
      <Carousel autoplayMs={autoplayMs} showArrows={!isMobile}>
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
