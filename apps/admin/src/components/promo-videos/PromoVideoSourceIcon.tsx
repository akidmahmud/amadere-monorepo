import { Icon } from "@amader/admin-ui";
import type { PromoVideoSource } from "@/hooks/usePromoVideos";

// Material Symbols is Google's own icon set and deliberately ships no
// third-party brand logos — the 4 platform marks (YouTube/TikTok/Instagram/
// Facebook) are small hand-drawn glyphs instead, same scale/treatment as
// every other 16-20px icon in this admin. Custom URL / My Server (R2) / GIF
// stay on Material Symbols since those are generic concepts, not brands.
const YouTubeGlyph = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#FF0000">
    <path d="M23 12s0-3.4-.4-5a3 3 0 0 0-2.1-2.1C18.9 4.5 12 4.5 12 4.5s-6.9 0-8.5.4A3 3 0 0 0 1.4 7 31 31 0 0 0 1 12a31 31 0 0 0 .4 5A3 3 0 0 0 3.5 19c1.6.5 8.5.5 8.5.5s6.9 0 8.5-.5a3 3 0 0 0 2.1-2.1c.4-1.6.4-5 .4-5Z" />
    <path d="M9.8 15.3 15.8 12l-6-3.3v6.6Z" fill="#fff" />
  </svg>
);

const TikTokGlyph = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#000">
    <path d="M16.6 4c.4 2 1.6 3.4 3.6 3.7v2.6a6.6 6.6 0 0 1-3.6-1.1v6.3a5.4 5.4 0 1 1-5.4-5.4c.2 0 .5 0 .7.1v2.7a2.7 2.7 0 1 0 1.9 2.6V4h2.8Z" />
  </svg>
);

const InstagramGlyph = (
  <svg viewBox="0 0 24 24" width="16" height="16">
    <defs>
      <linearGradient id="igGrad" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#FEDA75" />
        <stop offset="45%" stopColor="#D62976" />
        <stop offset="100%" stopColor="#4F5BD5" />
      </linearGradient>
    </defs>
    <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="url(#igGrad)" />
    <circle cx="12" cy="12" r="4.6" fill="none" stroke="#fff" strokeWidth="1.6" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="#fff" />
  </svg>
);

const FacebookGlyph = (
  <svg viewBox="0 0 24 24" width="16" height="16">
    <circle cx="12" cy="12" r="10" fill="#1877F2" />
    <path
      d="M13.6 21.8v-7.4h2.5l.4-2.9h-2.9V9.6c0-.8.2-1.4 1.4-1.4h1.6V5.6c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.1H8v2.9h2.5v7.4h3.1Z"
      fill="#fff"
    />
  </svg>
);

export const SOURCE_META: Record<PromoVideoSource, { label: string; icon: React.ReactNode }> = {
  YOUTUBE: { label: "YouTube", icon: YouTubeGlyph },
  TIKTOK: { label: "TikTok", icon: TikTokGlyph },
  INSTAGRAM: { label: "Instagram Reels", icon: InstagramGlyph },
  FACEBOOK: { label: "Facebook Reels", icon: FacebookGlyph },
  CUSTOM_URL: { label: "Custom URL", icon: <Icon name="link" size={16} /> },
  R2: { label: "My Server", icon: <Icon name="cloud_upload" size={16} /> },
  GIF: { label: "GIF", icon: <Icon name="gif_box" size={16} /> },
};

// The reference design badges a Shorts-shaped YouTube URL as "YouTube
// Short" instead of plain "YouTube" — cosmetic only (same YOUTUBE source
// value), detected from the URL shape rather than a separate enum value.
export function sourceLabel(source: PromoVideoSource, url: string): string {
  if (source === "YOUTUBE" && /\/shorts\//.test(url)) return "YouTube Short";
  return SOURCE_META[source].label;
}

export function PromoVideoSourceIcon({ source }: { source: PromoVideoSource }) {
  return <span className="inline-flex h-4 w-4 flex-none items-center justify-center">{SOURCE_META[source].icon}</span>;
}
