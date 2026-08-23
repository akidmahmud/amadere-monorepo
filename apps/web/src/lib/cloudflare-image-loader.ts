// Custom next/image loader — resizing happens at Cloudflare's edge instead of
// on the origin VPS.
//
// Why this exists (see also next.config.ts): Next's *built-in* optimizer runs
// on the origin. Enabling it moved every image request off the CDN and onto
// the single VPS, which saturated under ad traffic and took the whole site
// down — the same process serves the HTML. So the app ran with
// `unoptimized: true`, which kept the origin safe by doing no resizing at all
// and shipping the raw upload instead.
//
// Cloudflare Image Resizing gives the third option: correctly sized, modern
// formats, and zero origin CPU, so that saturation cannot recur.
//
// The URL construction itself lives in image-url.ts, shared with the raw-<img>
// path — components that do not render through next/image never reach this
// file, and they were where the real weight was hiding.

import { cdnImageUrl } from "./image-url";

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
  return cdnImageUrl(src, width, quality ?? 75);
}
