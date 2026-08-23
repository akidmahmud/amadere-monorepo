// Custom next/image loader — resizing happens at Cloudflare's edge instead of
// on the origin VPS.
//
// Why this exists (see also next.config.ts): Next's *built-in* optimizer runs
// on the origin. Enabling it moved every image request off the CDN and onto
// the single VPS, which saturated under ad traffic and took the whole site
// down — the same process serves the HTML. So the app ran with
// `unoptimized: true`, which meant browsers downloaded the raw upload: the
// homepage hero was a 1.77 MB PNG, which on mobile data is essentially the
// entire LCP budget spent on one image.
//
// Cloudflare Image Resizing gives the third option: correctly sized, modern
// formats, and zero origin CPU. Measured on that same hero — 1,773,628 bytes
// PNG becomes 14,765 bytes AVIF at 800px wide, a 99.2% reduction.

/** The R2 bucket's custom domain. Must be on the Cloudflare zone — that is
 *  what makes /cdn-cgi/image/ available on this host at all. */
const CDN_HOST = "cdn.amadere.com";

/**
 * Historic uploads were stored with R2's public dev URL rather than the custom
 * domain, and those absolute URLs are baked into existing database rows. That
 * host is NOT on the Cloudflare zone, so /cdn-cgi/image/ does not exist there
 * — and Cloudflare documents r2.dev as rate-limited and unsuitable for
 * production traffic besides.
 *
 * Rewriting the host here fixes every one of those rows at render time
 * without a data migration. Matching any *.r2.dev host rather than the one
 * bucket id keeps this working if the bucket is ever recreated.
 */
const R2_DEV_HOST = /^https:\/\/[a-z0-9-]+\.r2\.dev/i;

interface LoaderArgs {
  src: string;
  width: number;
  quality?: number;
}

export default function cloudflareImageLoader({
  src,
  width,
  quality,
}: LoaderArgs): string {
  // Local assets (/favicon-default.png and friends) and anything on a host we
  // do not control are passed through untouched.
  const normalised = src.replace(R2_DEV_HOST, `https://${CDN_HOST}`);
  if (!normalised.startsWith(`https://${CDN_HOST}/`)) return src;

  const params = [
    `width=${width}`,
    `quality=${quality ?? 75}`,
    // Serves AVIF or WebP based on the browser's own Accept header, falling
    // back to the original format for anything that supports neither.
    "format=auto",
    // Never upscale: a 300px source requested at 800px would otherwise be
    // blown up, costing bytes to look worse.
    "fit=scale-down",
  ].join(",");

  // /cdn-cgi/image/<options>/<path>. The path is kept exactly as-is —
  // several existing keys contain percent-encoded spaces and commas from
  // their original filenames, and re-encoding them would 404.
  const path = normalised.slice(`https://${CDN_HOST}`.length);
  return `https://${CDN_HOST}/cdn-cgi/image/${params}${path}`;
}
