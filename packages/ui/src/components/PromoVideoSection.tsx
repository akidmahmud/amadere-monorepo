"use client";

import { useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";
import { Carousel } from "./Carousel";
import { SectionHeading } from "./SectionHeading";

export type PromoVideoSource = "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "R2" | "GIF";

export interface PromoVideoCard {
  source: PromoVideoSource;
  url: string;
  thumbnailUrl?: string;
  linkUrl?: string;
}

export interface PromoVideoSectionProps {
  heading?: string;
  items: PromoVideoCard[];
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

// Renders the actual playable element for each source. Only mounted while
// hovering (see PromoVideoCardTile) — nothing loads/plays until then.
// Disclosed limitation: YouTube/TikTok honor the autoplay+mute query params
// reliably; Instagram's oEmbed widget does not officially support
// autoplay-on-load, so its hover behavior may just show the embed's own
// play button rather than truly autoplaying — a platform restriction, not
// something fixable from this side.
function PlayingMedia({ card }: { card: PromoVideoCard }) {
  if (card.source === "R2") {
    return (
      <video
        src={card.url}
        autoPlay
        muted
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
      ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&playsinline=1`
      : card.url;
    return (
      <iframe
        src={src}
        title="Promo video"
        allow="autoplay; encrypted-media"
        className="h-full w-full border-0 object-cover"
      />
    );
  }
  if (card.source === "TIKTOK") {
    const id = tiktokId(card.url);
    const src = id ? `https://www.tiktok.com/embed/v2/${id}?autoplay=1` : card.url;
    return <iframe src={src} title="Promo video" allow="autoplay" className="h-full w-full border-0" />;
  }
  // INSTAGRAM
  const code = instagramCode(card.url);
  const src = code ? `https://www.instagram.com/reel/${code}/embed/?autoplay=1` : card.url;
  return <iframe src={src} title="Promo video" allow="autoplay" className="h-full w-full border-0" />;
}

function PromoVideoCardTile({ card, linkComponent: Link = DefaultLink }: { card: PromoVideoCard; linkComponent?: LinkComponent }) {
  const [isHovering, setIsHovering] = useState(false);

  const tile = (
    <div
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="relative h-[600px] w-[377px] shrink-0 overflow-hidden rounded-2xl bg-black"
    >
      {isHovering ? (
        <PlayingMedia card={card} />
      ) : card.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 grid place-items-center bg-black/20 transition-opacity",
          isHovering ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="grid h-14 w-14 place-items-center rounded-full bg-white/90">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" className="ml-0.5 text-ink">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
  );

  return card.linkUrl ? <Link href={card.linkUrl}>{tile}</Link> : tile;
}

export function PromoVideoSection({ heading, items, linkComponent }: PromoVideoSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="py-9">
      {heading && <SectionHeading>{heading}</SectionHeading>}
      <Carousel>
        {items.map((card, i) => (
          <PromoVideoCardTile key={`${card.url}-${i}`} card={card} linkComponent={linkComponent} />
        ))}
      </Carousel>
    </div>
  );
}
