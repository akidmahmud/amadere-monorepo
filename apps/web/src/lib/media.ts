/**
 * The B12 migration stored every media reference as a `legacy://` pseudo-URL
 * (R2 upload was a deliberate follow-up, never done — see backend AGENTS.md).
 * Treat anything that isn't a real http(s) URL as "no image yet" so
 * ProductCard/BentoBlogs/etc. fall back to their placeholder styling instead
 * of a broken <img>.
 */
export function toDisplayImageUrl(
  url: string | null | undefined,
): string | undefined {
  return url && /^https?:\/\//.test(url) ? url : undefined;
}

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
