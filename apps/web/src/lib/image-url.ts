// Single definition of how an image URL becomes a CDN URL.
//
// Used by two callers that must never disagree:
//   - cloudflare-image-loader.ts, for components rendering through next/image
//   - toDisplayImageUrl() in media.ts, for the ~54 places that render a raw
//     <img> and so never reach the loader at all
//
// The raw <img> path is not an edge case. Measured on the live homepage: the
// site logo was a 1,773,628-byte PNG displayed at max-h-[56px] — about 150x
// larger than the pixels it occupies — because it bypassed every optimisation
// the app has. It alone was ~72% of the page's image bytes.

/** The R2 bucket's custom domain. Must be on the Cloudflare zone — that is
 *  what makes /cdn-cgi/image/ available on this host at all. */
const CDN_HOST = "cdn.amadere.com";

/**
 * Historic uploads were stored with R2's public dev URL rather than the
 * custom domain, and those absolute URLs are baked into existing database
 * rows. That host is NOT on the Cloudflare zone, so /cdn-cgi/image/ does not
 * exist there — and Cloudflare documents r2.dev as rate-limited and
 * unsuitable for production traffic besides.
 *
 * Rewriting the host here fixes every one of those rows at render time
 * without a data migration. Matching any *.r2.dev host rather than the one
 * bucket id keeps this working if the bucket is ever recreated.
 */
const R2_DEV_HOST = /^https:\/\/[a-z0-9-]+\.r2\.dev/i;

/**
 * Rewrites an image URL to be served resized from the CDN edge.
 *
 * Returns the input untouched for local assets (/images/…), data URIs, and
 * any host we do not control — those must keep working exactly as before.
 *
 * `fit=scale-down` never upscales: asking for 1280 on a 400px source returns
 * the 400px original rather than a blown-up copy that costs more and looks
 * worse. That makes a generous default width safe.
 */
export function cdnImageUrl(src: string, width: number, quality = 75): string {
  if (!src) return src;

  const normalised = src.replace(R2_DEV_HOST, `https://${CDN_HOST}`);
  if (!normalised.startsWith(`https://${CDN_HOST}/`)) return src;

  const params = `width=${width},quality=${quality},format=auto,fit=scale-down`;

  // Already transformed. This happens legitimately: a mapper wraps the URL
  // for the raw-<img> case, and then a component renders it through
  // next/image, whose loader wraps it again. Nesting would 404, and simply
  // returning the first version would pin every srcset entry to one width —
  // silently undoing responsive sizing. Replacing the parameters lets the
  // last caller win, which is the one that actually knows the render width.
  const marker = "/cdn-cgi/image/";
  if (normalised.includes(marker)) {
    const at = normalised.indexOf(marker) + marker.length;
    const rest = normalised.slice(at);
    const slash = rest.indexOf("/");
    return `https://${CDN_HOST}${marker}${params}${rest.slice(slash)}`;
  }

  // The path is kept exactly as-is: several existing keys contain
  // percent-encoded spaces and commas from their original filenames, and
  // re-encoding them would 404.
  const path = normalised.slice(`https://${CDN_HOST}`.length);
  return `https://${CDN_HOST}/cdn-cgi/image/${params}${path}`;
}

/**
 * Widths for the raw-<img> call sites, named by role rather than by number so
 * the intent survives a redesign. Each is roughly 2x the CSS size it renders
 * at, which covers retina without paying for more.
 */
export const IMG = {
  /** Header/footer logos — rendered at max-h 56-72px. */
  logo: 320,
  /** Avatars, payment marks, small badges. */
  icon: 128,
  /** Certification marks, brand logos in a row. */
  badge: 256,
  /** Product/blog thumbnails in a list or cart line. */
  thumb: 400,
  /** Cards in a grid. */
  card: 640,
  /** Full-width banners and hero art. */
  banner: 1600,
  /** Anything whose size is not known at the call site. */
  default: 1280,
} as const;
