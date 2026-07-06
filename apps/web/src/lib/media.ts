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

// Same "legacy:// isn't real" rule as toDisplayImageUrl, applied to
// Product.videoUrl (an embeddable video URL, e.g. YouTube/Vimeo).
export function toEmbeddableVideoUrl(
  url: string | null | undefined,
): string | undefined {
  return url && /^https?:\/\//.test(url) ? url : undefined;
}
