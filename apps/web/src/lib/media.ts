import { IMG, cdnImageUrl, cdnOgImageUrl } from "./image-url";

/**
 * The B12 migration stored every media reference as a `legacy://` pseudo-URL
 * (R2 upload was a deliberate follow-up, never done — see backend AGENTS.md).
 * Treat anything that isn't a real http(s) URL as "no image yet" so
 * ProductCard/BentoBlogs/etc. fall back to their placeholder styling instead
 * of a broken <img>.
 *
 * It now also rewrites the URL to be served resized from the CDN edge. Most
 * callers render a raw <img>, which never reaches the next/image loader, so
 * without this they ship whatever was uploaded at full size. That is not
 * theoretical: the site logo was a 1.77 MB PNG rendered at 56 pixels tall.
 *
 * `width` should be roughly 2x the CSS width the image renders at — pass one
 * of the named IMG sizes. The default is deliberately generous, and
 * `fit=scale-down` means a smaller source is never upscaled, so passing
 * nothing is safe if the size genuinely is not known at the call site.
 */
export function toDisplayImageUrl(
  url: string | null | undefined,
  width: number = IMG.default,
): string | undefined {
  if (!url || !/^https?:\/\//.test(url)) return undefined;
  return cdnImageUrl(url, width);
}

/**
 * Same `legacy://` guard as toDisplayImageUrl, but produces a social share
 * card — a fixed 1200x630 that never comes back too small for a scraper to
 * accept. Every og:image/twitter:image goes through this.
 */
export function toOgImageUrl(url: string | null | undefined): string | undefined {
  if (!url || /^https?:\/\//.test(url) === false) return undefined;
  return cdnOgImageUrl(url);
}

export { IMG, OG_IMAGE } from "./image-url";

// Every YouTube URL shape an admin might paste — the share/watch link, the
// youtu.be shortener, Shorts, live, or an already-correct /embed/ one.
// Same id capture as PromoVideoSection's youtubeId.
const YOUTUBE_ID =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/;

// Same "legacy:// isn't real" rule as toDisplayImageUrl, applied to
// Product.videoUrl — plus the conversion the name promises: YouTube refuses
// to be framed on anything but /embed/ (X-Frame-Options), so a pasted
// watch?v= link renders as "page can't be found" inside the iframe.
// ponytail: YouTube only — the one platform the product form asks for. Add
// a Vimeo/Facebook branch here if those ever get used.
export function toEmbeddableVideoUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url || !/^https?:\/\//.test(url)) return undefined;
  const id = url.match(YOUTUBE_ID)?.[1];
  return id ? `https://www.youtube.com/embed/${id}` : url;
}
